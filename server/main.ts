import { Meteor } from 'meteor/meteor';
import { Accounts } from "meteor/accounts-base";
import { RolesCollection, RoleDefinitionsCollection } from '../imports/api/roles';
import { ZonesCollection } from '../imports/api/zones';
import { DivisionsCollection } from '../imports/api/divisions';
import { ControllersCollection } from '/imports/api/controllers';
import { CommonMethods } from '/imports/applications/common';
import { PersonAlertmethods } from '/imports/applications/personAlert';
import { startProbe, stopDiscovery } from 'node-onvif-ts';
import { OnvifDevice } from '/imports/api/onvifClient';
import { Cam, CamsCollection } from '/imports/api/cams';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import { VisitsCollection, Visit } from '/imports/api/visits';
import { VisitSummary, VisitsSummaryCollection } from '/imports/api/visitSummary';
import resizeBase64Image from './utils'
import { AccessControllMethods } from '/imports/applications/accessControl';
import { MetrixMethods } from '/imports/applications/metrix';
import { WorkspacesCollection, App } from '/imports/api/workspace';
import { GatesCollection, Gate } from '/imports/api/gates';
import { AlertLists } from '/imports/api/alertLists';
import {spawn, exec} from 'child_process';
import {AlertsArchiveCollection, } from '/imports/api/alertsArchive';
import { AccessReportCollection, AccessReport } from '/imports/api/accessReport';
import {IntruderAlertsCollection, IntruderVisit} from '/imports/api/intruderAlerts';
import { CountAlertsCollection } from '/imports/api/countAlerts';
import { TemporaryCardsCollection } from '/imports/api/temporaryCards';
import { cleanupExpiredTemporaryCards } from '/imports/applications/accessControl/temporaryCards/serverMethods';
import { sendAlert } from '/imports/bot/alerts'
import {APIConfig, SettingsCollection} from '/imports/api/settings'
import TelegramBot from 'node-telegram-bot-api';
import { TgSessions } from '/imports/api/tgSessions';
import { initBot } from '../imports/bot/bot';
import ApolloWrapper, { CardHolder } from './apollowrapper';
import { ApolloStatusType } from '/imports/api/apolloStatus';
import { RecordingsCollection } from '/imports/api/recordings';
import { initDvr } from './dvrManager';
import './dvrFileServer';
let tgBot :TelegramBot | undefined = undefined;
let ApolloApi : any | undefined = undefined;

// Global Apollo status tracking
let apolloStatus: { status: ApolloStatusType; message?: string; lastUpdated: Date } = {
  status: 'not_configured',
  message: 'Apollo API not configured',
  lastUpdated: new Date()
};
const embeddingStd = (v: number[]): number => {
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    return Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
};

const apolloStatusSubscribers = new Set<any>();

function updateApolloStatus(status: ApolloStatusType, message?: string) {
  apolloStatus = { status, message, lastUpdated: new Date() };
  // Notify all subscribers
  apolloStatusSubscribers.forEach(sub => {
    sub.changed('apolloStatus', 'apollo-status', { ...apolloStatus });
  });
}
interface CamWithCounter extends Cam{
  count:number
  state:'success' | 'warning' | "danger"
}
const myCams:{[x:string]:CamWithCounter} ={}
const StreamHandler:{[x:string]:any} = {}
const ASPHandler:{[x:string]:any} ={}
const GatesMap : {[x:string]:Gate}= {}
type cardReadMessage={
  source:string;
  controller:string;
  card:number;
}
const LiveGatePersons :{[x:string]:{[x:string]:{handler:NodeJS.Timeout}}}={}
const LiveCamAlerts :{[x:string]:{[x:string]:{handler:NodeJS.Timeout}}}={}
const LiveGateIntrudders :{[x:string]:{handler:number}}={}
const LiveGateReports :{[x:string]:{handler:number}}={}
const LiveGateCards :{[x:string]:{[x:string]:{handler:NodeJS.Timeout, card:string}}}={}
const ControllerIfLock:{[x:string]:number} = {}
const KnownPersons:{[x:string]:any} ={}

// ── Per-camera frame-consumer state ──────────────────────────────────────────
interface FaceState {
  obsCount:         number;
  consecutiveId:    string | null;
  consecutiveHits:  number;
  lastPublishedTime: number;
}
// CamFaceState[camId][personTid] — cleared when camera stops
const CamFaceState: Record<string, Record<number, FaceState>> = {};
// Set of camera IDs currently streaming (drives the BLPOP consumer)
const StreamingCams = new Set<string>();

// ── ArcFace embedding utilities ───────────────────────────────────────────────
// Embeddings come from Python as raw float32 bytes encoded in base64 (512 × 4 = 2048 bytes).
const decodeEmbedding = (b64: string): Float32Array | null => {
  try {
    const buf = Buffer.from(b64, 'base64');
    if (buf.length !== 512 * 4) return null;
    // Slice to get a properly-aligned ArrayBuffer
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return new Float32Array(ab);
  } catch { return null; }
};
const normalizeEmb = (emb: Float32Array): Float32Array => {
  let sq = 0;
  for (let i = 0; i < emb.length; i++) sq += emb[i] * emb[i];
  const n = Math.sqrt(sq) || 1;
  const out = new Float32Array(emb.length);
  for (let i = 0; i < emb.length; i++) out[i] = emb[i] / n;
  return out;
};
// Cosine similarity — assumes a is normalized; b (stored face_model) must also be normalized.
const cosineSim = (a: Float32Array, b: number[]): number => {
  let dot = 0;
  for (let i = 0; i < 512; i++) dot += a[i] * b[i];
  return dot;
};
// Match a normalized embedding against all models in KnownPersons.
const matchFace = (emb: Float32Array): { personId: string; similarity: number; modelId: string } | null => {
  const THRESHOLD = 0.45;
  let best: { personId: string; similarity: number; modelId: string } | null = null;
  for (const [pid, person] of Object.entries(KnownPersons)) {
    for (const model of (person.models ?? []) as { _id: string; face_model: number[] }[]) {
      if (!model.face_model || model.face_model.length !== 512) continue;
      const sim = cosineSim(emb, model.face_model);
      if (sim >= THRESHOLD && (!best || sim > best.similarity))
        best = { personId: pid, similarity: sim, modelId: model._id };
    }
  }
  return best;
};

import redisClient from './redisclient';
Meteor.startup(async () => {

  exec('pkill -f cmps_cam')
  initDvr();
  const tgSetting = (await SettingsCollection.findOneAsync({type:'telegram'}))?.config as string;
  if(tgSetting){
    tgBot = initBot(tgSetting);
  }

  // Check if running in development mode (only when explicitly enabled via Meteor settings)
  const isDevelopmentMode = Meteor.settings.public?.isDevelopment === true;

  // Skip Apollo API initialization in development mode
  if (!isDevelopmentMode) {
    const apacsSetting = (await SettingsCollection.findOneAsync({type:'apacs'}))?.config as APIConfig;
    if(apacsSetting && apacsSetting.url && apacsSetting.username && apacsSetting.password){
      const myApiConfig = {
        server:apacsSetting.url,
        user:apacsSetting.username,
        password:apacsSetting.password,
      }
      console.log('apacsSetting', myApiConfig, apacsSetting)
      ApolloApi = new ApolloWrapper(myApiConfig);
      updateApolloStatus('connecting', 'Connecting to Apollo API...');

      // Register Apollo event handlers for status updates
      ApolloApi.on('connected', () => {
        updateApolloStatus('connected', 'Connected to Apollo API');
        syncApolloData();
      });
      ApolloApi.on('disconnected', (reason: string) => {
        updateApolloStatus('offline', `Disconnected: ${reason}`);
      });
      ApolloApi.on('connectionError', (err: any) => {
        const message = err?.message || 'Connection error';
        if (message.toLowerCase().includes('401') || message.toLowerCase().includes('auth')) {
          updateApolloStatus('auth_error', 'Authentication failed');
        } else {
          updateApolloStatus('offline', message);
        }
      });
      ApolloApi.on('liveEvent', (_e:any)=>{
        // console.log(e)
      });
      ApolloApi.on('liveState', (_s:any)=>{
        // console.log(s)
      });
      ApolloApi.on('liveAudit', async (s:any)=>{
      if (s.AffectedObject.TypeId === 'CardIssue' || s.AffectedObject.TypeId ===  'Cardholder'){
        if(s.AffectedObject.TypeId === 'Cardholder'){
          if( s.Operation === 2){
            const localPerson = await VisitsSummaryCollection.findOneAsync({"idInfo.syncId":`${s.AffectedObject.Id}`})
            if(localPerson){
              await VisitsCollection.removeAsync({tracking_id:localPerson._id})
              await VisitsSummaryCollection.removeAsync(localPerson._id)
            }
            return;
          }else{
            const localPerson = await VisitsSummaryCollection.findOneAsync({"idInfo.syncId":`${s.AffectedObject.Id}`})
            const cardHolder = await ApolloApi.getData(`/cardholder/${s.AffectedObject.Id}`)
            const cardIssues = await ApolloApi.getData(`/cardissue?filter={Expressions:[{Property:"Owner.Id",Operation:"Eq", Value:${cardHolder.Id}}]}`)
            const divission = await DivisionsCollection.findOneAsync({name:cardHolder.Group.Label})
            if(localPerson && cardHolder){
              if(localPerson.idInfo){
                const accessCards = cardIssues.Records.map((card: any) => `${card.CardId}`) || [];
                VisitsSummaryCollection.updateAsync(localPerson._id, {
                  $set:{
                    idInfo:{
                      ...localPerson.idInfo,
                      firstName:cardHolder.FirstName,
                      lastName:cardHolder.LastName,
                      accessCard: accessCards,
                      comment:`Mobile: ${cardHolder.MobilePhoneNumber}, Work:${cardHolder.WorkPhoneNumber}, Department:${cardHolder.Department}, Employee Id:${cardHolder.EmployeeId}`,
                      syncId:`${cardHolder.Id}`,
                      divission:divission?._id || ''
                    }
                  }
                })
              }
            }else{
              const accessCards = cardHolder.CardsIssue?.map((card: any) => `${card.CardId}`) || [];
              await VisitsSummaryCollection.insertAsync({
                idInfo:{
                  firstName:cardHolder.FirstName,
                  lastName:cardHolder.LastName,
                  accessCard: accessCards,
                  comment:`Mobile: ${cardHolder.MobilePhoneNumber}, Work:${cardHolder.WorkPhoneNumber}, Department:${cardHolder.Department}, Employee Id:${cardHolder.EmployeeId}`,
                  syncId:`${cardHolder.Id}`,
                  divission:divission?._id || '',
                  alertList:'',
                  alertpause:5,
                  alertThreshold:80,
                  cA:true,
                  allowedGates:[],
                  bypassFace: false
                },
                face_b64: "",
                person_b64: "",
                face_model: [],
                timestamp: new Date(),
                face_box: { left: 0, top: 0, width: 0, height: 0 },
                person_box: { left: 0, top: 0, width: 0, height: 0 },
                source: 'apacs',
              })
            }
          }
        }
        if(s.AffectedObject.TypeId === 'CardIssue'){
          if (s.Operation === 2) return;
          const cardIssue = await ApolloApi.getData(`/cardissue/${s.AffectedObject.Id}`)
          const localPerson = await VisitsSummaryCollection.findOneAsync({"idInfo.syncId":`${cardIssue.Owner?.Id}`})
          const divission = await DivisionsCollection.findOneAsync({name:cardIssue.Owner?.Group?.Label})
          if(localPerson && cardIssue){
            if(localPerson.idInfo && cardIssue.Owner){
              const cardIssues = await ApolloApi.getData(`/cardissue?filter={Expressions:[{Property:"Owner.Id",Operation:"Eq", Value:${cardIssue.Owner.Id}}]}`)
              const accessCards = cardIssues.Records.map((card: any) => `${card.CardId}`) || [];
              VisitsSummaryCollection.updateAsync(localPerson._id, {
                $set:{
                  idInfo:{
                    ...localPerson.idInfo,
                    firstName:cardIssue.Owner.FirstName,
                    lastName:cardIssue.Owner.LastName,
                    accessCard: accessCards,
                    comment:`Mobile: ${cardIssue.Owner.MobilePhoneNumber}, Work:${cardIssue.Owner.WorkPhoneNumber}, Department:${cardIssue.Owner.Department}, Employee Id:${cardIssue.Owner.EmployeeId}`,
                    syncId:`${cardIssue.Owner.Id}`,
                    divission:divission?._id || ''
                  }
                }
              })
            }
          }else{
            const cardIssues = await ApolloApi.getData(`/cardissue?filter={Expressions:[{Property:"Owner.Id",Operation:"Eq", Value:${cardIssue.Owner.Id}}]}`)
            const accessCards = cardIssues.Records.map((card: any) => `${card.CardId}`) || [];
            await VisitsSummaryCollection.insertAsync({
              idInfo:{
                firstName:cardIssue.Owner?.FirstName || cardIssue.FirstName,
                lastName:cardIssue.Owner?.LastName || cardIssue.LastName,
                accessCard: accessCards,
                comment:`Mobile: ${cardIssue.Owner?.MobilePhoneNumber || ''}, Work:${cardIssue.Owner?.WorkPhoneNumber || ''}, Department:${cardIssue.Owner?.Department || ''}, Employee Id:${cardIssue.Owner?.EmployeeId || ''}`,
                syncId:`${cardIssue.Owner?.Id}`,
                divission:divission?._id || '',
                alertList:'',
                alertpause:5,
                alertThreshold:80,
                cA:true,
                allowedGates:[],
                bypassFace: false
              },
              face_b64: "",
              person_b64: "",
              face_model: [],
              timestamp: new Date(),
              face_box: { left: 0, top: 0, width: 0, height: 0 },
              person_box: { left: 0, top: 0, width: 0, height: 0 },
              source: 'apacs',
            })
          }
        }
      }
    });
    }

    // Initialize Apollo in background (non-blocking)
    if(ApolloApi){
      // Start initialization without awaiting - server continues starting
      (async () => {
        try {
          const apolloInitialized = await ApolloApi.initialize();
          if(!apolloInitialized){
            console.log('Apollo API initialization failed. Will retry in background. Continuing server startup...');
            updateApolloStatus('offline', 'Initialization failed, retrying...');
          } else {
            updateApolloStatus('connected', 'Connected to Apollo API');
          }
        } catch (err: any) {
          console.error('Apollo API initialization error:', err?.message || err);
          updateApolloStatus('offline', err?.message || 'Initialization error');
        }
      })();
    }
  } else {
    console.log('[DEV] Skipping Apollo API initialization in development mode');
    updateApolloStatus('not_configured', 'Disabled in development mode');
  }

  // Helper function to sync Apollo data (runs in background)
  async function syncApolloData() {
    console.log('Started Apollo sync')
    if (!ApolloApi) return;

    try {
      // Sync Divisions
      const divisions = await ApolloApi.getData('/cardholdergroup');
      const localDivissions = await DivisionsCollection.find({}).fetchAsync();
      if(divisions?.Records){
        for (const division of divisions.Records) {
          const localDivision = localDivissions.find((d: any)=>d.name === division.Label);
          if(!localDivision){
            await DivisionsCollection.insertAsync({name:division.Label, parent:'root'});
          }
        }
        // Sync CardHolders > VisitsSummary
        const cardholders = await ApolloApi.getData('/cardholder');
        
        if(!cardholders?.Records){
          console.log('Apollo API: Could not fetch cardholders. Skipping sync.');
        } else {
          const cardholderIds = cardholders.Records.map((el: CardHolder)=>(`${el.Id}`))
          const records = await Promise.all(cardholders.Records.map(async (cardHolder: CardHolder)=>{
            const cardIssueData = await ApolloApi.getData(`/cardissue?filter={Expressions:[{Property:"Owner.Id",Operation:"Eq", Value:${cardHolder.Id}}]}`);
            cardHolder.CardsIssue = cardIssueData?.Records || [];
            return cardHolder;
          }));
          for (const cardHolder of records) {
            await syncCardHolder(cardHolder);
          }
          //remove all persons that are not in apollo
          const toRemove = await VisitsSummaryCollection.find({$and:[
            {"idInfo.syncId":{$exists:true}}, 
            {"idInfo.syncId":{$ne:''}}, 
            {"idInfo.syncId":{$nin:cardholderIds}}
          ]}).fetchAsync();
          await VisitsCollection.removeAsync({tracking_id:{$in:toRemove.map(p=>p._id)}});
          await VisitsSummaryCollection.removeAsync({_id:{$in:toRemove.map(p=>p._id)}});
        }
      }
      console.log('Apollo sync completed successfully');
    } catch (err: any) {
      console.error('Apollo sync error:', err?.message || err);
    }
  }

  async function syncCardHolder(cardHolder: CardHolder) {
    const queryConditions: any[] = [
      { "idInfo.syncId": `${cardHolder.Id}` }
    ];
    const localPersons = await VisitsSummaryCollection.find({ $or: queryConditions }).fetchAsync();
    if(localPersons.length > 1){
      console.log('Multiple persons found for cardholder: ', cardHolder.Id)
      // we have to merge them under 1 record
      const mainPerson = localPersons.shift()
      if(mainPerson){
        const extra = localPersons.map(c=>c._id)
        const allowedGates = [...new Set(...(mainPerson?.idInfo?.allowedGates || []), ...(localPersons.map(p=>p.idInfo?.allowedGates || [])).flat())]
        await VisitsSummaryCollection.updateAsync(mainPerson?._id, {$set:{'idInfo.allowedGates': allowedGates}})
        await VisitsCollection.updateAsync({tracking_id:{$in:extra}}, {$set:{tracking_id:(mainPerson?._id || '')}}, {multi:true});
        await VisitsSummaryCollection.removeAsync({_id:{$in:extra}});
      }
    }
    const localPerson = await VisitsSummaryCollection.findOneAsync({ $or: queryConditions });
    if(localPerson){
      console.log('update: ', localPerson._id)
      if(localPerson.idInfo) {
        const divission = await DivisionsCollection.findOneAsync({name:cardHolder.Group.Label});
        const accessCards = cardHolder.CardsIssue?.map((card: any) => `${card.CardId}`) || [];
        await VisitsSummaryCollection.updateAsync(localPerson._id, {
          $set:{
            idInfo:{
              ...localPerson.idInfo,
              firstName:cardHolder.FirstName,
              lastName:cardHolder.LastName,
              accessCard: accessCards,
              comment:`Mobile: ${cardHolder.MobilePhoneNumber}, Work:${cardHolder.WorkPhoneNumber}, Department:${cardHolder.Department}, Employee Id:${cardHolder.EmployeeId}`,
              syncId:`${cardHolder.Id}`,
              divission:divission?._id || ''
            }
          }
        });
      }
    }else{
      console.log('insert')
      const divission = await DivisionsCollection.findOneAsync({name:cardHolder.Group.Label});
      const accessCards = cardHolder.CardsIssue?.map((card: any) => `${card.CardId}`) || [];
      await VisitsSummaryCollection.insertAsync({
        idInfo:{
          firstName:cardHolder.FirstName,
          lastName:cardHolder.LastName,
          accessCard: accessCards,
          comment:`Mobile: ${cardHolder.MobilePhoneNumber}, Work:${cardHolder.WorkPhoneNumber}, Department:${cardHolder.Department}, Employee Id:${cardHolder.EmployeeId}`,
          syncId:`${cardHolder.Id}`,
          divission:divission?._id || '',
          alertList:'',
          alertpause:5,
          alertThreshold:80,
          cA:true,
          allowedGates:[],
          bypassFace: false
        },
        face_b64: "",
        person_b64: "",
        face_model: [],
        timestamp: new Date(),
        face_box: { left: 0, top: 0, width: 0, height: 0 },
        person_box: { left: 0, top: 0, width: 0, height: 0 },
        source: 'apacs',
      });

    }
    return true
  }

  
  const pub = redisClient.duplicate();
  await pub.connect();

  // Helper function to build person data for Redis cache
  const buildPersonData = async (id: string, idInfo: any) => {
    const visits = await VisitsCollection.find({tracking_id: id, reference: true}).fetchAsync();
    return {
      _id: id,
      ...idInfo,
      models: visits
        .filter(v => v.face_model?.length === 512 && embeddingStd(v.face_model) > 0.010)
        .map(v => ({_id: v._id, face_model: v.face_model})),
    };
  };

  // Populate Redis persons cache at startup (skip in development mode)
  if (!isDevelopmentMode) {
    console.log('[Redis] Populating persons cache...');
    await pub.del('persons'); // Clear existing cache
    await pub.del('persons_cache_ready'); // Clear ready flag
    const personsWithIdInfo = await VisitsSummaryCollection.find({idInfo: {$exists: true}}).fetchAsync();
    for (const item of personsWithIdInfo) {
      if (item.idInfo) {
        const personData = await buildPersonData(item._id, item.idInfo);
        await pub.hSet('persons', item._id, JSON.stringify(personData));
      }
    }
    // Set ready flag so Python knows cache is populated
    await pub.set('persons_cache_ready', '1');
    console.log(`[Redis] Cached ${personsWithIdInfo.length} persons`);
  } else {
    console.log('[DEV] Skipping Redis persons cache population in development mode');
    // Set ready flag anyway so Python doesn't wait for cache
    await pub.set('persons_cache_ready', '0');
  }

  // ── Frame types (matching Python cmps_cam.py JSON output) ─────────────────
  interface CamFramePerson {
    tid: number;
    bbox: [number, number, number, number];
    emb: string | null;
    has_emb: boolean;
    lines: Record<string, string>;
    zones: Record<string, string>;
    par: number[] | null;
    crop: string | null;
    head_color?: string;
    upper_color?: string;
    lower_color?: string;
  }
  interface CamFrameFace {
    obj_id: number;
    bbox: [number, number, number, number];
    person_tid: number | null;
    frontal: boolean;
    emb: string | null;
    face_crop: string | null;
  }
  interface CamFrame {
    frame: number;
    fps: number;
    source: string;
    persons: CamFramePerson[];
    faces: CamFrameFace[];
  }

  const bboxToBox = ([left, top, right, bottom]: [number, number, number, number]) =>
    ({ left, top, width: right - left, height: bottom - top });

  // ── Person-count occupancy alerts (replaces countListener) ────────────────
  const handlePersonCount = (source: string, count: number) => {
    if (!myCams[source]?.countPerson) return;
    if (count > myCams[source].maxPersonDanger) {
      if (myCams[source].state !== 'danger') {
        CountAlertsCollection.insertAsync({ timestamp: new Date(), count, level: 'danger',
          allowed: myCams[source].maxPersonDanger, seen: false, seenBy: '', seenAt: null, source });
        myCams[source].state = 'danger';
      }
    } else if (count > myCams[source].maxPerson) {
      if (myCams[source].state !== 'warning') {
        CountAlertsCollection.insertAsync({ timestamp: new Date(), count, level: 'warning',
          allowed: myCams[source].maxPerson, seen: false, seenBy: '', seenAt: null, source });
        myCams[source].state = 'warning';
      }
    } else {
      myCams[source].state = 'success';
    }
    myCams[source].count = count;
  };

  // ── Alert / access-control reactions (extracted from the old listener) ─────
  const handleDetectionAlerts = async (visit: Visit & { similarity?: number }, idP: string | number | undefined) => {
    const cam = await CamsCollection.findOneAsync({ _id: visit.source });
    const myGates = cam?.accessControl
      ? Object.values(GatesMap).filter(g => g.interfaces.some(itf => itf.cam === visit.source))
      : [];

    if (idP) {
      if (visit.person_b64 !== '') {
        const person = KnownPersons[idP] as VisitSummary;
        if (person && cam) {
          if (cam.faceAlert && person.idInfo?.alertList) {
            if (!LiveCamAlerts[visit.source]) LiveCamAlerts[visit.source] = {};
            if (!LiveCamAlerts[visit.source][person._id || 'person']) {
              LiveCamAlerts[visit.source][person._id || 'person'] = {
                handler: setTimeout(() => { delete LiveCamAlerts[visit.source][person._id || 'person']; }, 5000)
              };
              const existingAlert = await AlertsArchiveCollection.find({
                seenBy: { $ne: 'root' }, source: visit.source,
                idInfo: { $in: [person._id, String(person._id)] },
                timestamp: { $gt: new Date(Date.now() - person.idInfo.alertpause * 60_000) }
              }).countAsync();
              const alertItem = {
                ...visit, idInfo: idP as any, listId: person.idInfo.alertList, seenAt: null,
                seen: !!existingAlert, seenBy: existingAlert ? 'root' : '',
              };
              await AlertsArchiveCollection.insertAsync(alertItem);
              if (!existingAlert && tgBot) sendAlert(alertItem as any, tgBot);
            }
          }
          if (cam.accessControl) {
            myGates.forEach(async gate => {
              const myif = gate.interfaces.find(itf => itf.cam === visit.source);
              gate._id = gate._id || 'ensure';
              if (!LiveGatePersons[gate._id]) LiveGatePersons[gate._id] = {};
              if (LiveGatePersons[gate._id][person._id])
                clearTimeout(LiveGatePersons[gate._id][person._id].handler);
              LiveGatePersons[gate._id][person._id] = {
                handler: setTimeout(() => { delete LiveGatePersons[gate._id || 'ensure'][person._id]; }, 10_000)
              };
              if (myif?.lockSettings && myif.cmpsaction.includes('unlock') &&
                  person.idInfo?.allowedGates.includes(gate._id || '')) {
                if (!myif.lockSettings.tfa) {
                  if (myif.lockSettings.controller) {
                    const lk = `${myif.lockSettings.controller}_${myif.lockSettings.reader_node}_${myif.lockSettings.reader_lda}`;
                    if (ControllerIfLock[lk] === undefined) {
                      ControllerIfLock[lk] = Meteor.setTimeout(() => { delete ControllerIfLock[lk]; }, 5000);
                      const card = person.idInfo.accessCard[0];
                      if (card) pub.publish('apollo_stream', JSON.stringify({
                        id: myif.lockSettings.controller, node: myif.lockSettings.reader_node,
                        lda: myif.lockSettings.reader_lda, card, decission: 'grant',
                      }));
                    }
                  }
                } else if (LiveGateCards[gate._id]?.[person._id] && myif.lockSettings.controller) {
                  const lk = `${myif.lockSettings.controller}_${myif.lockSettings.reader_node}_${myif.lockSettings.reader_lda}`;
                  if (ControllerIfLock[lk] === undefined) {
                    ControllerIfLock[lk] = Meteor.setTimeout(() => { delete ControllerIfLock[lk]; }, 5000);
                    const card = LiveGateCards[gate._id][person._id].card;
                    if (card) pub.publish('apollo_stream', JSON.stringify({
                      id: myif.lockSettings.controller, node: myif.lockSettings.reader_node,
                      lda: myif.lockSettings.reader_lda, card, decission: 'grant',
                    }));
                  }
                }
              }
              if (myif?.cmpsaction.includes('report')) {
                const acD = { ...visit, type: myif.action, idInfo: person._id, source: gate._id } as AccessReport;
                if (!LiveGateReports[visit.tracking_id]) {
                  LiveGateReports[visit.tracking_id] = { handler: Meteor.setTimeout(() => { delete LiveGateReports[visit.tracking_id]; }, 10_000) };
                  AccessReportCollection.insertAsync(acD);
                }
              }
            });
          }
        }
      }
    } else {
      myGates.forEach(async gate => {
        const myif = gate.interfaces.find(itf => itf.cam === visit.source);
        if (myif?.cmpsaction.includes('report') && myif.reportingSettings?.intruderAlert) {
          const triggerLine = myif.reportingSettings.intruderLine;
          const triggerSide = myif.reportingSettings.intruderSide;
          if (triggerLine && triggerSide && visit.lines?.[triggerLine] === triggerSide) {
            if (!LiveGateIntrudders[visit.tracking_id]) {
              LiveGateIntrudders[visit.tracking_id] = { handler: Meteor.setTimeout(() => { delete LiveGateIntrudders[visit.tracking_id]; }, 10_000) };
              await IntruderAlertsCollection.insertAsync({
                ...visit, triggerLine, triggerSide, seen: false, seenBy: null, seenAt: null,
              });
            }
          }
        }
      });
    }
  };

  // ── Frame processing: face recognition + visit creation ───────────────────
  const MIN_OBS    = 5;    // minimum frontal-face observations before matching
  const CONSEC_GATE = 4;   // consecutive matching frames required before confirming
  const REPUBLISH_MS = 10_000; // minimum ms between visits for the same tracker ID

  const createVisit = async (frame: CamFrame, person: CamFramePerson, face: CamFrameFace,
                             match: { personId: string; similarity: number; modelId: string } | null) => {
    const tracking_id = `${frame.source}-${person.tid}`;
    const rawEmb = decodeEmbedding(face.emb!);
    const faceModel = rawEmb ? Array.from(normalizeEmb(rawEmb)) : [];
    const visit: Visit = {
      face_b64:    await resizeBase64Image(face.face_crop ?? '', 150),
      person_b64:  await resizeBase64Image(person.crop ?? '', 150),
      face_model:  faceModel,
      tracking_id,
      timestamp:   new Date(),
      face_box:    bboxToBox(face.bbox),
      person_box:  bboxToBox(person.bbox),
      source:      frame.source,
      reference:   false,
      lines:       person.lines,
      zones:       person.zones,
      par:         person.par ?? undefined,
      head_color:  person.head_color,
      upper_color: person.upper_color,
      lower_color: person.lower_color,
      ...(match ? { idInfo: match.personId, model_id: match.modelId, similarity: match.similarity } : {}),
    };
    await VisitsCollection.insertAsync(visit);
    // VisitSummary only stores display fields — exclude Visit-only keys whose
    // types are incompatible (idInfo on VisitSummary is IdInfo, not string).
    const summaryFields: Partial<VisitSummary> = {
      face_b64:   visit.face_b64,
      person_b64: visit.person_b64,
      face_model: visit.face_model,
      timestamp:  visit.timestamp,
      face_box:   visit.face_box,
      person_box: visit.person_box,
      source:     visit.source,
    };
    await VisitsSummaryCollection.updateAsync(
      { _id: tracking_id }, { $set: summaryFields }, { upsert: true }
    ).catch(() => {});
    await handleDetectionAlerts(visit, match?.personId);
  };

  const processFrame = async (frame: CamFrame) => {
    handlePersonCount(frame.source, frame.persons.length);
    if (!CamFaceState[frame.source]) CamFaceState[frame.source] = {};
    const state = CamFaceState[frame.source];
    const now = Date.now();

    for (const face of frame.faces) {
      if (!face.frontal || !face.emb || face.person_tid === null) continue;
      const person = frame.persons.find(p => p.tid === face.person_tid);
      if (!person) continue;
      const tid = face.person_tid;
      const fs: FaceState = state[tid] ?? (state[tid] = {
        obsCount: 0, consecutiveId: null, consecutiveHits: 0, lastPublishedTime: 0,
      });
      fs.obsCount++;
      if (fs.obsCount < MIN_OBS) continue;
      const rawEmb = decodeEmbedding(face.emb);
      if (!rawEmb) continue;
      const emb = normalizeEmb(rawEmb);
      const match = matchFace(emb);
      if (match?.personId === fs.consecutiveId) {
        fs.consecutiveHits++;
      } else {
        fs.consecutiveId = match?.personId ?? null;
        fs.consecutiveHits = match ? 1 : 0;
      }
      if (fs.consecutiveHits < CONSEC_GATE) continue;
      if (now - fs.lastPublishedTime < REPUBLISH_MS) continue;
      fs.lastPublishedTime = now;
      await createVisit(frame, person, face, match);
    }

    // Prune state for persons no longer in frame
    const activeTids = new Set(frame.persons.map(p => p.tid));
    for (const k of Object.keys(state)) {
      if (!activeTids.has(Number(k))) delete state[Number(k)];
    }
  };

  // ── Frame consumer: BLPOP across all active camera lists ──────────────────
  const frameReader = redisClient.duplicate();
  await frameReader.connect();

  (async () => {
    while (true) {
      const keys = Array.from(StreamingCams).map(id => `cam:frames:${id}`);
      if (keys.length === 0) { await new Promise(r => setTimeout(r, 500)); continue; }
      const result = await frameReader.blPop(keys, 1).catch(() => null);
      if (result) {
        const frame: CamFrame = JSON.parse(result.element);
        processFrame(frame).catch(e => console.error('[frameConsumer]', e));
      }
    }
  })();

  const startStreamHandler = (id:string, streamurl:string, disableSpoofFilter:boolean = false, lines:any[] = [], zones:any[] = []) => {
    // Skip stream handler in development mode
    if (isDevelopmentMode) {
      console.log(`[DEV] Skipping stream handler for camera ${id}`);
      return;
    }

    try{
      console.log(`Starting stream handler for camera ${id} with URL ${streamurl}, disableSpoofFilter ${disableSpoofFilter}`);
      if(StreamHandler[id]) {
        StreamHandler[id].kill();
        delete StreamHandler[id];
      }
      StreamHandler[id]=spawn(`python3`, [ '/home/devel/deskpass_cam/cmps_cam.py','--id', id, '--stream', streamurl, '--zones', JSON.stringify(zones), '--lines', JSON.stringify(lines)], {
        cwd: '/home/devel/deskpass_cam'
      })
      StreamHandler[id].on('stdout', (_data:Buffer)=>{
        //console.log('stdout', data.toString())
      })
      StreamHandler[id].on('stderr', (_data:Buffer)=>{
        //console.error('stderr', data.toString())
      })
      StreamHandler[id].on('error', (_err:Error)=>{
        //console.error('error', err.message)
      })
      StreamHandler[id].on('close', ()=>{
        startStreamHandler(id, streamurl, disableSpoofFilter, lines, zones);
      })
      StreamHandler[id].stdout.pipe(process.stdout)
      StreamHandler[id].stderr.pipe(process.stderr)
    } catch (error) {}
  }
  const startAspHandler = (id:string, ip:string) => {
    try{
      if(ASPHandler[id]) {
        ASPHandler[id].kill();
        delete ASPHandler[id];
      }

      ASPHandler[id]=spawn(`python3`, [ '/opt/asp/controller-workflow.py','--id', id,'--ip', ip], {
        cwd: '/opt/asp'
      })
      ASPHandler[id].on('stdout', (data:Buffer)=>{
        console.log('stdout', data.toString())
      })
      ASPHandler[id].on('stderr', (data:Buffer)=>{
        console.error('stderr', data.toString())
      })
      ASPHandler[id].on('error', (err:Error)=>{
        console.error('error', err.message)
      })
      ASPHandler[id].on('close', ()=>{
        startAspHandler(id, ip);
      })
    } catch (error) {}
  }
  CamsCollection.find({}).observeChanges({
    added: async (id, fields) => {
      myCams[id]={_id:id, ...fields, count:0, state:'success'} as CamWithCounter
      if(fields.streamurl)
        startStreamHandler(id, fields.streamurl, fields.disableSpoofFilter || false, fields.lines || [], fields.overlayZones || []);
    },
    changed: async(id, fields)=>{
      const allfields = await CamsCollection.findOneAsync({_id:id});
      if(allfields)
        myCams[id]={...allfields, count:0, state:'success'}
      if(fields.streamurl || fields.disableSpoofFilter || fields.lines || fields.overlayZones){
        if(allfields){
          StreamHandler[id].kill();
          delete StreamHandler[id];
          startStreamHandler(id, allfields.streamurl, allfields.disableSpoofFilter || false, allfields.lines || [], allfields.overlayZones || []);
        }
      }
    },
    removed: async (id)=>{
      if(StreamHandler[id]) {
        delete myCams[id]
        StreamHandler[id].kill();
        delete StreamHandler[id];
      }
    }
  })
  ControllersCollection.find({manufacturer:'Apollo security'}).observeChanges({
    added: async (id, fields) => {
      if(fields.address)
        startAspHandler(id, fields.address);
    },
    changed: async(id, fields)=>{
      if(fields.address){
        ASPHandler[id].kill();
        delete ASPHandler[id];
        startAspHandler(id, fields.address);
      }
    },
    removed: async (id)=>{
      if(StreamHandler[id]) {
        ASPHandler[id].kill();
        delete ASPHandler[id];
      }
    }
  })
  VisitsSummaryCollection.find({idInfo:{$exists:true}}).observeChanges({
    added: async (id, fields) => {
      const personData = await buildPersonData(id, fields.idInfo);
      // Update Redis cache
      await pub.hSet('persons', id, JSON.stringify(personData));
      // Notify Python about the new person
      pub.publish('person_added', JSON.stringify({_id: id}));
      // Update in-memory cache for local Meteor use
      KnownPersons[id] = {_id: id, ...fields, models: personData.models};
    },
    changed: async (id, fields) => {
      // Update in-memory cache
      KnownPersons[id] = {...KnownPersons[id], ...fields};
      // Rebuild and update Redis cache
      const currentIdInfo = KnownPersons[id]?.idInfo || fields.idInfo;
      if (currentIdInfo) {
        const personData = await buildPersonData(id, currentIdInfo);
        await pub.hSet('persons', id, JSON.stringify(personData));
        // Notify Python about the update
        pub.publish('person_edited', JSON.stringify({_id: id}));
      }
    },
    removed: async (id) => {
      delete KnownPersons[id];
      // Remove from Redis cache
      await pub.hDel('persons', id);
      // Notify Python about the removal
      pub.publish('person_removed', JSON.stringify({_id: id}));
    }
  })
  // Observer for reference visits - updates Redis cache when face models are added/removed
  VisitsCollection.find({reference: true}).observeChanges({
    added: async (_id, fields) => {
      // A new reference visit was added - update the person's cache if they have idInfo
      const trackingId = fields.tracking_id;
      if (trackingId && KnownPersons[trackingId]?.idInfo) {
        const personData = await buildPersonData(trackingId, KnownPersons[trackingId].idInfo);
        KnownPersons[trackingId].models = personData.models;
        await pub.hSet('persons', trackingId, JSON.stringify(personData));
        pub.publish('person_edited', JSON.stringify({_id: trackingId}));
      }
    },
    removed: async (id) => {
      // A reference visit was removed - need to find which person it belonged to and update
      // Since the visit is already removed, we need to check all known persons
      // This is less efficient but necessary since we don't have the tracking_id anymore
      for (const [personId, person] of Object.entries(KnownPersons)) {
        if (person.idInfo && person.models?.some((m: any) => m._id === id)) {
          const personData = await buildPersonData(personId, person.idInfo);
          KnownPersons[personId].models = personData.models;
          await pub.hSet('persons', personId, JSON.stringify(personData));
          pub.publish('person_edited', JSON.stringify({_id: personId}));
          break;
        }
      }
    }
  })
  GatesCollection.find({}).observeChanges({
    added: async (id, fields) => {
      GatesMap[id] = {_id:id, ...fields} as Gate;
    },
    changed: async(id, fields)=>{
      GatesMap[id] = {...GatesMap[id], ...fields};
    },
    removed: async (id)=>{
      delete GatesMap[id];
    }
  })
  VisitsCollection.rawCollection().createIndex({ timestamp: -1 });
  VisitsCollection.rawCollection().createIndex({ 'source': 1, 'timestamp': -1 });
  VisitsCollection.rawCollection().createIndex({ tracking_id:1 });
  RecordingsCollection.rawCollection().createIndex({ camId: 1, startedAt: -1 });
  RecordingsCollection.rawCollection().createIndex({ startedAt: -1 });
  CountAlertsCollection.rawCollection().createIndex({ timestamp: -1 });
  CountAlertsCollection.rawCollection().createIndex({ seen: -1 });
  CountAlertsCollection.rawCollection().createIndex({ source: -1 });
  VisitsSummaryCollection.rawCollection().createIndex({ 'source': 1, 'timestamp': -1 });
  VisitsSummaryCollection.rawCollection().createIndex({ timestap: 1 });
  VisitsSummaryCollection.rawCollection().createIndex({ idInfo: 1 }, {sparse: true});
  VisitsSummaryCollection.rawCollection().createIndex({ 'idInfo.divission': 1 });
  IntruderAlertsCollection.rawCollection().createIndex({ tracking_id: 1 });
  IntruderAlertsCollection.rawCollection().createIndex({ seen: 1 });
  IntruderAlertsCollection.rawCollection().createIndex({ timestamp: 1 });
  AccessReportCollection.rawCollection().createIndex({ idInfo: 1 });
  AccessReportCollection.rawCollection().createIndex({ timestamp: 1 });
  AccessReportCollection.rawCollection().createIndex({ source: 1 });
  AlertsArchiveCollection.rawCollection().createIndex({ seen: 1 });
  AlertsArchiveCollection.rawCollection().createIndex({ timestamp: 1 });
  AlertsArchiveCollection.rawCollection().createIndex({ idInfo: 1 });
  AlertsArchiveCollection.rawCollection().createIndex({ source: 1});
  AlertsArchiveCollection.rawCollection().createIndex({ source: 1, idInfo:1, timestamp:1 });
  TemporaryCardsCollection.rawCollection().createIndex({ status: 1 });
  TemporaryCardsCollection.rawCollection().createIndex({ personId: 1 });
  TemporaryCardsCollection.rawCollection().createIndex({ attachedAt: 1 });

  // Schedule temporary cards cleanup every hour
  Meteor.setInterval(async () => {
    await cleanupExpiredTemporaryCards();
  }, 60 * 60 * 1000); // Every hour

  // Run cleanup once at startup
  cleanupExpiredTemporaryCards();

  interface VisitExtra extends Visit {
    similarity?: number;
  }
  const listener = async(message:string, channel:string) => {
    if(channel === 'new_detection'){
      const visit = JSON.parse(message) as VisitExtra;
      const res_face = await resizeBase64Image(visit.face_b64, 150)
      const res_person = await resizeBase64Image(visit.person_b64, 150)
      visit.face_b64 = res_face;
      visit.person_b64 = res_person;
      visit.timestamp = new Date(visit.timestamp);
      visit.reference=false;
      VisitsCollection.insertAsync(visit as Visit);
      // Convert idInfo to number if it's a numeric string (person IDs are timestamp-based numbers)
      const IdP = visit.idInfo ? (isNaN(Number(visit.idInfo)) ? visit.idInfo : Number(visit.idInfo)) : undefined;
      delete visit.idInfo
      if(visit.tracking_id) {
         const VisitSummaryItem:VisitSummary = {
          _id: visit.tracking_id,
          face_b64: visit.face_b64,
          person_b64: visit.person_b64,
          face_model: visit.face_model,
          timestamp: visit.timestamp,
          face_box: visit.face_box,
          person_box: visit.person_box,
          source: visit.source,
        };
        try{
          // Exclude _id from the $set document
          const { _id, ...updateFields } = VisitSummaryItem;
          VisitsSummaryCollection.updateAsync(
            { _id: VisitSummaryItem._id },
            { $set: updateFields },
            { upsert: true }
          );
        }catch(e) {
          //i need at least one item in the collection
          console.error('Error updating or inserting visit summary:', e);
        }
      }
      const cam = await CamsCollection.findOneAsync({ _id: visit.source });
      const myGates = cam?.accessControl ? Object.values(GatesMap)
              .filter(g=>
                g.interfaces.filter(itf=>itf.cam === visit.source).length>0
              ):[] 
      if(IdP){
        if (visit.person_b64 !== ''){
          const person = KnownPersons[IdP] as VisitSummary;
          //detected a known person, check with the source what are our further actions
          if(person){
            if(cam){
              if(cam.faceAlert){
                if (person.idInfo?.alertList){
                  if(LiveCamAlerts[visit.source] === undefined){
                    LiveCamAlerts[visit.source] ={}
                  }
                  if(LiveCamAlerts[visit.source][person._id||"person"] === undefined){
                    LiveCamAlerts[visit.source][person._id||"person"] ={
                      handler:setTimeout(()=>{
                        delete LiveCamAlerts[visit.source][person._id||"person"]
                      }, 5000)
                    }
                    // Query with both number and string versions of idInfo for legacy compatibility
                    const existingAlert = await AlertsArchiveCollection.find({seenBy:{$ne:'root'},source:visit.source, idInfo:{$in:[person._id, String(person._id)]}, timestamp: {$gt: new Date(new Date().getTime() - person.idInfo.alertpause * 1000 * 60)}}).countAsync();
                    if(existingAlert){
                      const alertItem = {
                        ...visit,
                        idInfo:IdP as any,
                        seen: true,
                        seenBy: 'root',
                        listId: person.idInfo.alertList,
                        seenAt:null
                      };
                      await AlertsArchiveCollection.insertAsync(alertItem);
                    } else {
                      const alertItem = {
                        ...visit,
                        idInfo:IdP as any,
                        seen: false,
                        seenBy: '',
                        listId: person.idInfo.alertList,
                        seenAt:null
                      };
                      await AlertsArchiveCollection.insertAsync(alertItem);
                      if(tgBot){
                        sendAlert(alertItem as any, tgBot)
                      }
                    }
                  }
                }
              }
              if(cam.accessControl){
                myGates.forEach(async gate=>{
                  const myif  = gate.interfaces.find(itf=>itf.cam === visit.source);
                  gate._id = gate._id || "ensure"
                  if (LiveGatePersons[gate._id] === undefined){
                    LiveGatePersons[gate._id] = {}
                  }
                  if(LiveGatePersons[gate._id][person._id] !== undefined){
                    clearTimeout(LiveGatePersons[gate._id][person._id].handler)
                  }
                  LiveGatePersons[gate._id][person._id] = {handler:setTimeout(()=>{delete LiveGatePersons[gate._id||'ensure'][person._id]}, 10000)}
                  if(myif && myif.lockSettings && myif.cmpsaction.includes('unlock')){
                    //validate if person is allowed to access
                    if(person.idInfo  && person.idInfo.allowedGates.includes(gate._id||'')){
                      if(!myif.lockSettings.tfa){
                        if(myif.lockSettings && myif.lockSettings?.controller){
                          if(ControllerIfLock[myif.lockSettings.controller] === undefined){
                            ControllerIfLock[`${myif.lockSettings.controller}_${myif.lockSettings.reader_node}_${myif.lockSettings.reader_lda}`] = Meteor.setTimeout(()=>{delete ControllerIfLock[`${myif.lockSettings?.controller}_${myif.lockSettings?.reader_node}_${myif.lockSettings?.reader_lda}`]}, 5000)
                            // TFA disabled: send only the first card
                            const firstCard = person.idInfo.accessCard[0];
                            if(firstCard){
                              pub.publish('apollo_stream', JSON.stringify({
                                id: myif.lockSettings.controller,
                                node:myif.lockSettings.reader_node,
                                lda:myif.lockSettings.reader_lda,
                                card: firstCard,
                                decission:'grant',
                              }))
                            }
                          }
                        }
                        //publish to redis  channel access_grant {id:myif.lockSettings.controller, }

                      }else{
                        if(LiveGateCards[gate._id]?.[person._id]){
                          //publish to redis  channel access_grant {id:myif.lockSettings.controller, }
                          if(myif.lockSettings?.controller){
                            if(ControllerIfLock[myif.lockSettings.controller] === undefined){
                              ControllerIfLock[`${myif.lockSettings.controller}_${myif.lockSettings.reader_node}_${myif.lockSettings.reader_lda}`] = Meteor.setTimeout(()=>{delete ControllerIfLock[`${myif.lockSettings?.controller}_${myif.lockSettings?.reader_node}_${myif.lockSettings?.reader_lda}`]}, 5000)
                              // TFA enabled: send the specific card that was scanned
                              const scannedCard = LiveGateCards[gate._id][person._id].card;
                              if(scannedCard){
                                pub.publish('apollo_stream', JSON.stringify({
                                  id: myif.lockSettings.controller,
                                  node:myif.lockSettings.reader_node,
                                  lda:myif.lockSettings.reader_lda,
                                  card: scannedCard,
                                  decission:'grant',
                                }))
                              }
                            }
                          }
                        }
                        // check if person has activeSession of cam than send to redis
                      }
                    }
                    
                  }
                  if(myif && myif.cmpsaction.includes('report')){
                    const acD = {...visit, type:myif.action, idInfo: person._id, source:gate._id} as AccessReport;
                    //check if not insertedAlready
                    if(LiveGateReports[visit.tracking_id] === undefined){
                      LiveGateReports[visit.tracking_id] = {handler: Meteor.setTimeout(()=>{delete LiveGateReports[visit.tracking_id]}, 10000)};
                      AccessReportCollection.insertAsync(acD);
                    }
                  }
                })
              }
            } 
          }
        }
      }else{
        myGates.forEach(async gate=>{
          const myif  = gate.interfaces.find(itf=>itf.cam === visit.source);
          if(myif && myif.cmpsaction.includes('report') && myif.reportingSettings?.intruderAlert){
            const triggerLine = myif.reportingSettings.intruderLine;
            const triggerSide = myif.reportingSettings.intruderSide;
            const triggered = !!(triggerLine && triggerSide && visit.lines?.[triggerLine] === triggerSide);
            if(triggered){
              if(LiveGateIntrudders[visit.tracking_id] === undefined){
                LiveGateIntrudders[visit.tracking_id] = {handler: Meteor.setTimeout(()=>{delete LiveGateIntrudders[visit.tracking_id]}, 10000)};
                const intruderVisit:IntruderVisit = {
                  ...visit,
                  triggerLine,
                  triggerSide,
                  seen: false,
                  seenBy: null,
                  seenAt: null,
                };
                await IntruderAlertsCollection.insertAsync(intruderVisit);
              }
            }
          }
        })
      }
    }
    if(channel === 'card_read'){
      const msg :cardReadMessage = JSON.parse(message);
      const source = msg.source.split('LPAType.Reader.')[1].split('.')
      const lda = parseInt(source[1], 10);
      const node = parseInt(source[0], 10);
      const myGate = Object.entries(GatesMap).find(
        ([_id, gt])=>{
          console.log(_id, gt.interfaces.filter(itf=>
              itf.lockSettings?.reader_node === node && 
              itf.lockSettings?.reader_lda === lda &&
              itf.lockSettings?.controller === msg.controller
            ).length>0)
            return gt.interfaces.filter(itf=>
              itf.lockSettings?.reader_node === node && 
              itf.lockSettings?.reader_lda === lda &&
              itf.lockSettings?.controller === msg.controller
            ).length>0
          })
      if(myGate && myGate[1]){
        const myInterface = myGate[1].interfaces.find(itf=>
          itf.lockSettings?.reader_node === node && 
          itf.lockSettings?.reader_lda === lda &&
          itf.lockSettings?.controller === msg.controller
        );
        //find the operson that posseses this card, look if he's live at the gate, if yes, unlock, if no write to LiveCards
        const myPerson = Object.values(KnownPersons).find(
          p=>p.idInfo && p.idInfo.accessCard.includes(msg.card)
        );
        if(myPerson){
          if(myPerson.idInfo.bypassFace){
            pub.publish('apollo_stream', JSON.stringify({
              id: myInterface?.lockSettings?.controller,
              node:myInterface?.lockSettings?.reader_node,
              lda:myInterface?.lockSettings?.reader_lda,
              card:msg.card,
              decission:'evaluate',
            }))
          }
          if(LiveGatePersons[myGate[0]] && LiveGatePersons[myGate[0]][myPerson._id]){
            //person is live at the gate, unlock if he's allowed
            if(myPerson.idInfo.allowedGates.includes(myGate[0]||'')){
              //publish to redis  channel access_grant {id:myif.lockSettings.controller, }
              pub.publish('apollo_stream', JSON.stringify({
                id: myInterface?.lockSettings?.controller,
                node:myInterface?.lockSettings?.reader_node,
                lda:myInterface?.lockSettings?.reader_lda,
                card:msg.card,
                decission:'grant',
              }))
            }
          }else{
            if(LiveGateCards[myGate[0]] === undefined){
              LiveGateCards[myGate[0]] = {}
            }
            if(LiveGateCards[myGate[0]][myPerson._id] !== undefined){
              clearTimeout(LiveGateCards[myGate[0]][myPerson._id].handler)
            }
            LiveGateCards[myGate[0]][myPerson._id] = {handler:setTimeout(()=>{delete LiveGateCards[myGate[0]||'ensure'][myPerson._id]}, 10000), card: `${msg.card}`}
          }
          
        }
      }
    }
  };
  const cams_listener = async(_message:string, channel:string) => {
    if(channel === 'get_cams'){
      
      CamsCollection.find({}).forEach(async(cam) => {
          pub.publish('add_stream', JSON.stringify({
            id: cam._id,
            url: cam.streamurl
          }))
      })
     
  }
  }

  type countMessage={
    source:string,
    count:number
  }
  const countListener = async(message:string, channel:string)=>{
    if(channel === 'person_count'){
      const {source, count}:countMessage = JSON.parse(message)
      if(myCams[source] && myCams[source].countPerson){
        if(count > myCams[source].maxPersonDanger){
          //insert CountAlert
          if(myCams[source].state !== 'danger'){
            await CountAlertsCollection.insertAsync({
                timestamp:new Date(),
                count,
                level:"danger",
                allowed:myCams[source].maxPersonDanger,
                seen:false,
                seenBy:'',
                seenAt:null,
                source:source
            })
            myCams[source].state='danger'
          }

        }else if(count > myCams[source].maxPerson){
          if(myCams[source].state!=='warning'){

            await CountAlertsCollection.insertAsync({
                timestamp:new Date(),
                count,
                level:"warning",
                allowed:myCams[source].maxPersonDanger,
                seen:false,
                seenBy:'',
                seenAt:null,
                source:source
            })
            myCams[source].state='warning'
          }
        }else{
          myCams[source].state = 'success'
        }
        myCams[source].count = count
      }
    }
  }

  await redisClient.subscribe('new_detection', listener);
  await redisClient.subscribe('person_count', countListener);
  await redisClient.subscribe('card_read', listener);
  await redisClient.subscribe('get_cams', cams_listener);

  let localOnvif:OnvifDevice[] = []
  if(await Meteor.users.find().countAsync() === 0 ){
    const firstacc =await  Accounts.createUser(
      {
        username:'admin',
        password:'admin'
      }
    );
    await RolesCollection.insertAsync({role:'admin', userId:firstacc})
  }
  const devices = await startProbe();
  localOnvif = devices.map(d=>d as OnvifDevice)
  Meteor.publish('allUsers', function(){
    //toDo: add roles check
    if(this.userId){
      return Meteor.users.find({})
    }
  })
  Meteor.publish('workspace', function(){
    if(this.userId){
      return WorkspacesCollection.find({user:this.userId})
    }
    return [];
  })
  Meteor.setInterval(async()=>{
    try{
      const devices = await startProbe();
      localOnvif = devices.map(d=>d as OnvifDevice)
      await stopDiscovery()
    }catch(e){}
    
  }, 10000)
  Meteor.publish('onvifDevices', function(){
    localOnvif.forEach(d=> this.added('onvifdevices', d.urn, {...d}))
    this.ready()
  })
  Meteor.publish("zones", function () {
    return ZonesCollection.find()
  });
  Meteor.publish("divisions", function () {
    return DivisionsCollection.find()
  });
  Meteor.publish("cams", function () {
    return CamsCollection.find()
  });
  Meteor.publish("cam_line_defs", function () {
    return CamLineDefsCollection.find();
  });
  Meteor.publish("cam_zone_defs", function () {
    return CamZoneDefsCollection.find();
  });
  Meteor.publish("alertsArchive", function (filter, limit = 100, skip = 0, sort = {timestamp:-1}) {
    return AlertsArchiveCollection.find(filter, { limit, skip, sort });
  });
  Meteor.publish('unseeCountAlerts', function(){
    return CountAlertsCollection.find({seen:false}, {sort: {timestamp: -1}, limit: 20});
  })
  Meteor.publish('unseenIntruders', function(){
    return IntruderAlertsCollection.find({ seen: false }, {sort: {timestamp: -1}, limit: 20});
  })
  Meteor.publish('unseenAlertsArchive', function(){
    return AlertsArchiveCollection.find({ seen: false }, {sort: {timestamp: -1}, limit: 20});
  })
  Meteor.publish('intruderAlerts', function (filter, limit=100, skip=0, sort={timestamp:-1}) {
    return IntruderAlertsCollection.find(filter, { limit, skip, sort });
  });

  // Apollo status publish - sends status to client-side only collection
  Meteor.publish('apolloStatus', function () {
    const self = this;
    // Add current status
    self.added('apolloStatus', 'apollo-status', { ...apolloStatus });
    // Register this subscription to receive updates
    apolloStatusSubscribers.add(self);
    self.onStop(() => {
      apolloStatusSubscribers.delete(self);
    });
    self.ready();
  });

  Meteor.publish("visitSummaryMeta" , function () {
    const self = this;
    const handler = VisitsSummaryCollection.find({idInfo:{$exists:true} }).observeChanges({
      added(id, fields) {
        self.added('visitSummaryMeta', id, {idInfo: fields.idInfo});
      },
      changed(id, fields) {
        self.changed('visitSummaryMeta', id, {idInfo: fields.idInfo});
      },
      removed(id) {
        self.removed('visitSummaryMeta', id);
      }
    })
    this.onStop(() => {
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
    });
  })
  Meteor.publish("visits", function (filter={}, limit = 100, skip = 0, sort = {timestamp:-1}) {
    console.log('visits filter', filter, limit, skip, sort)
    const options:{skip:number, limit?:number, sort:{[x:string]:any}} ={skip, sort};
    if(limit !== 0){
      options.limit = limit;
    }
    
    return VisitsCollection.find(filter, options);
  });
  Meteor.publish('alertLists', function () {
    if(!this.userId) {
      return [];
    }
    return AlertLists.find();
  });
  Meteor.publish("visitssummary", function (filter:{[key:string]:any}={}, limit = 100, skip = 0) {
    if(!this.userId) {
      return [];
    }
    // Handle legacy string idInfo lookups - convert to number if needed
    if (filter._id && typeof filter._id === 'string' && !isNaN(Number(filter._id))) {
      filter._id = { $in: [filter._id, Number(filter._id)] };
    }
    const self = this;
    const handler = VisitsSummaryCollection.find(filter, { limit, skip , sort:{timestamp:-1}}).observeChanges({
      added(id, fields) {
        VisitsCollection.find({tracking_id:id}).countAsync().then(facesCount => {
          fields.faces = facesCount;
          self.added('visitsSummary', id, fields);
        });
      },
      changed(id, fields) {
        VisitsCollection.find({tracking_id:id}).countAsync().then(facesCount => {
          fields.faces = facesCount;
          self.changed('visitsSummary', id, fields);
        });
      },
      removed(id) {
        self.removed('visitsSummary', id);
      }
    });
    this.onStop(() => {
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
    });
    this.ready();
    
  });
  Meteor.publish('controllers', function () {
    return ControllersCollection.find();
  })
  Meteor.publish('gates', function () {
    return GatesCollection.find();
  });
  Meteor.publish('usersMeta',function(){
    const self = this
    const handler = Meteor.users.find({}, {fields: {username: 1}}).observeChanges({
      added(id, fields) {
        self.added('usersMeta', id, fields)
      },
      changed(id, fields) {
        if(fields.username){
          self.changed('usersMeta', id, fields)
        }
      },
      removed(id) {
        self.removed('usersMeta', id)
      }
  })
    this.onStop(() => {
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
    });
  })
  Meteor.publish('attendanceArchive', function (filter={}, limit = 100, skip = 0, sort = {timestamp:-1}) {
    if(!this.userId) {
      return [];
    }
    return AccessReportCollection.find(filter, { limit, skip, sort });
  });

  Meteor.publish('temporaryCards', function (filter = {}, limit = 100, skip = 0, sort = { attachedAt: -1 }) {
    if (!this.userId) {
      return [];
    }
    return TemporaryCardsCollection.find(filter, { limit, skip, sort });
  });

  Meteor.publish('unseenCountAlertsNewestPerSource', function () {
  const self = this;

  // Track the newest doc ID per source
  const newestPerSource:{[x:string]:{id:string, timestamp:Date}} = {};

  const handler = CountAlertsCollection.find(
    { seen: false },
    { sort: { timestamp: -1 } } // newest first
  ).observeChanges({
    added(id, fields) {
      const source = fields.source;

      if (!source) return;

      // If this source has no entry yet or this alert is newer, replace it
      if (
        !newestPerSource[source] ||
        fields.timestamp || new Date() > newestPerSource[source].timestamp
      ) {
        // Remove the old one if it exists
        if (newestPerSource[source]) {
          self.removed('countAlerts', newestPerSource[source].id);
        }

        newestPerSource[source] = { id, timestamp: fields.timestamp || new Date() };
        self.added('countAlerts', id, fields);
      }
    },

    changed(id, fields) {
      // If seen becomes true, remove it from published set
      if (fields.seen === true) {
        for (const source in newestPerSource) {
          if (newestPerSource[source].id === id) {
            self.removed('countAlerts', id);
            delete newestPerSource[source];
            break;
          }
        }
      }
    },

    removed(id) {
      for (const source in newestPerSource) {
        if (newestPerSource[source].id === id) {
          self.removed('countAlerts', id);
          delete newestPerSource[source];
          break;
        }
      }
    }
  });

  self.ready();

  this.onStop(() => {
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
    });
  });
  Meteor.publish('alertItem', async(alertId : string)=>{
    return IntruderAlertsCollection.find({_id:alertId})
  })
  Meteor.publish('settings', async()=>{
    if (Meteor.userId()) {
      if((await RolesCollection.findOneAsync({userId:String(Meteor.userId())}))?.role === 'admin')
        return SettingsCollection.find()
    }
  })

  // Current user's role entry + all role definitions (used by desktop for app filtering)
  Meteor.publish('userRole', function() {
    if (!this.userId) return this.ready();
    return [
      RolesCollection.find({ userId: this.userId }),
      RoleDefinitionsCollection.find({}),
    ];
  });

  // All role entries for all users (admin-only, used by Operators table)
  Meteor.publish('allRoles', async function() {
    if (!this.userId) return this.ready();
    const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
    if (myRole?.role !== 'admin') return this.ready();
    return RolesCollection.find({});
  });

  // All role definitions (admin-only, used by RoleBuilder and Operators role selector)
  Meteor.publish('roleDefinitions', async function() {
    if (!this.userId) return this.ready();
    const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
    if (myRole?.role !== 'admin') return this.ready();
    return RoleDefinitionsCollection.find({});
  });

  Meteor.publish('tgSessions', function(){
    return TgSessions.find()
  })

  Meteor.publish('recordings', function(camIds: string[] = [], dayStart = 0, dayEnd = 0, limit = 200) {
    if (!this.userId || !camIds.length) return [];
    return RecordingsCollection.find(
      { camId: { $in: camIds }, startedAt: { $gte: new Date(dayStart), $lt: new Date(dayEnd) } },
      { sort: { startedAt: 1 }, limit },
    );
  });

  Meteor.methods({
    async restartCamHandler(id:string){
      const cam = await CamsCollection.findOneAsync({_id:id});
      if(cam && cam._id){
        if(StreamHandler[cam._id]) {
          StreamHandler[cam._id].kill();
          //just killing the process is enough, it will self start
          // delete StreamHandler[cam._id];
        }
        // startStreamHandler(cam._id, cam.streamurl, cam.y_line || 0, cam.disableSpoofFilter || false);
      }
      return true;
    },
    async doApolloSync(){
      syncApolloData();
      return true;
    },
    async setTgBot(token:string){
      await SettingsCollection.removeAsync({type:'telegram'})
      await SettingsCollection.insertAsync({type:'telegram', config:token})
      await TgSessions.removeAsync({})
      tgBot = initBot(token);
    },
    async getBotLink(){
      return tgBot ? (await tgBot.getMe()).username : ''
    },
    async setApacsConfig(config:APIConfig){
      //restart the apollowrapper
      if(ApolloApi){
        ApolloApi.stop()
      }
      await SettingsCollection.removeAsync({type:'apacs'})
      const myApiConfig = {
        server:config.url,
        user:config.username,
        password:config.password,
      }
      await SettingsCollection.insertAsync({type:'apacs', config})
      ApolloApi = new ApolloWrapper(myApiConfig);
      ApolloApi.initialize()
    },
    async unlockGate(gateId: string){
      if (!this.userId) {
        throw new Meteor.Error('not-authorized', 'You must be logged in to unlock a gate.');
      }
      if (!gateId) {
        throw new Meteor.Error('invalid-gate-id', 'Gate ID must be provided.');
      }

      const gate = await GatesCollection.findOneAsync({ _id: gateId });
      if (!gate) {
        throw new Meteor.Error('gate-not-found', 'Gate not found.');
      }

      if (!gate.apacsId) {
        throw new Meteor.Error('no-apacs-id', 'Gate does not have an APACS ID configured.');
      }

      if (!ApolloApi) {
        throw new Meteor.Error('apollo-not-configured', 'Apollo API is not configured.');
      }

      try {
        // Make POST request to unlock the gate
        const response = await ApolloApi.getData(`/ASPReader/${gate.apacsId}/onepass`, {});
        return { success: true, response };
      } catch (error: any) {
        throw new Meteor.Error('unlock-failed', `Failed to unlock gate: ${error.message}`);
      }
    },
    setCountSeen:async function(id:string){
      this.unblock();
      if(this.userId)
        CountAlertsCollection.updateAsync({_id:id}, {$set:{seen:true, seenBy:this.userId, seenAt:new Date()}})
    },
    setCountAllSeen:async function(){
      this.unblock()
      if(this.userId){
        CountAlertsCollection.updateAsync({seen:false},{$set:{seen:true, seenBy:this.userId, seenAt:new Date()}},{multi:true})
      }
    },
    updateWorkspace: async function(apps:App[]){
      if(this.userId) {
        if(await WorkspacesCollection.findOneAsync({user:this.userId}) === undefined){
           await WorkspacesCollection.insertAsync({user:this.userId, apps:apps})
        }
        WorkspacesCollection.updateAsync({user:this.userId}, {$set:{apps}})
      }
    },
    getUserName: async function(userId:string):Promise<string> {
      if(!userId) return '';
      const user = await Meteor.users.findOneAsync({_id:userId});
      return user?.username || '';
    },
    ...CommonMethods,
    ...AccessControllMethods,
    ...PersonAlertmethods,
    ...MetrixMethods
  })
});
