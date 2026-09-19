import { Meteor } from 'meteor/meteor';
import { Accounts } from "meteor/accounts-base";
import { clampLimit, clampSkip, sanitizeFilter, sanitizeSort } from '/imports/security/queryGuards';
import {
  VISIT_FILTER, INTRUDER_FILTER, ALERTS_FILTER, ACCESS_REPORT_FILTER,
  CAPTION_FILTER, SCENARIO_EVENT_FILTER, TEMPORARY_CARD_FILTER, SUMMARY_FILTER,
} from '/imports/security/filterSpecs';
import { requireUser, requirePermission, isAdmin } from '/imports/security/guards';
import { PERMISSIONS } from '/imports/security/accessPolicy';
import { RolesCollection, RoleDefinitionsCollection } from '../imports/api/roles';
import { ZonesCollection } from '../imports/api/zones';
import { DivisionsCollection } from '../imports/api/divisions';
import { ControllersCollection } from '/imports/api/controllers';
import { CommonMethods } from '/imports/applications/common/methods';
import { PersonAlertmethods } from '/imports/applications/personAlert/methods';
import { startProbe, stopDiscovery } from 'node-onvif-ts';
import { OnvifDevice } from '/imports/api/onvifClient';
import { Cam, CamsCollection } from '/imports/api/cams';
import { CamLineDefsCollection } from '/imports/api/camLineDefs';
import { CamZoneDefsCollection } from '/imports/api/camZoneDefs';
import { VisitsCollection, Visit } from '/imports/api/visits';
import { VisitSummary, VisitsSummaryCollection } from '/imports/api/visitSummary';
import resizeBase64Image from './utils'
import { AccessControllMethods } from '/imports/applications/accessControl/methods';
import { MetrixMethods } from '/imports/applications/metrix/methods';
import { WorkspacesCollection, App } from '/imports/api/workspace';
import { GatesCollection, Gate } from '/imports/api/gates';
import { AlertLists } from '/imports/api/alertLists';
import {spawn} from 'child_process';
import {AlertsArchiveCollection, } from '/imports/api/alertsArchive';
import { AccessReportCollection, AccessReport } from '/imports/api/accessReport';
import {IntruderAlertsCollection} from '/imports/api/intruderAlerts';
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
import './webrtcRelay';
import { CamEventsCollection, CamLiveStatusCollection } from '/imports/api/camEvents';
import { ScenariosCollection, ScenarioEventsCollection } from '/imports/api/scenarios';
import { initScenarioEngine } from './scenarioEngine';
import { ScenariosV2Collection, ScenarioEventsV2Collection } from '/imports/api/scenarioModel';
import { initScenarioEngineV2 } from './scenarioEngineV2';
import { perceptAdd, perceptRemove, perceptSync, perceptSetKeywords } from './perceptControl';
import { CaptionAlertsCollection } from '/imports/api/captionAlerts';
let tgBot :TelegramBot | undefined = undefined;
let ApolloApi : any | undefined = undefined;

// Global Apollo status tracking
let apolloStatus: { status: ApolloStatusType; message?: string; lastUpdated: Date } = {
  status: 'not_configured',
  message: 'Apollo API not configured',
  lastUpdated: new Date()
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
const ASPHandler:{[x:string]:any} ={}
// ASP (Apollo access-control) integration dir — overridable for deployment.
const ASP_DIR = process.env.ASP_DIR || '/opt/asp'
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

import redisClient from './redisclient';
Meteor.startup(async () => {

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
              await VisitsSummaryCollection.updateAsync(localPerson._id, {
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
        .filter(v => {
          if (v.face_model?.length !== 512) return false;
          const mean = v.face_model.reduce((a: number, b: number) => a + b, 0) / 512;
          const std = Math.sqrt(v.face_model.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / 512);
          return std > 0.010;
        })
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
                  await AccessReportCollection.insertAsync(acD);
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

  const startAspHandler = (id:string, ip:string) => {
    try{
      if(ASPHandler[id]) {
        ASPHandler[id].kill();
        delete ASPHandler[id];
      }

      ASPHandler[id]=spawn(`python3`, [ `${ASP_DIR}/controller-workflow.py`,'--id', id,'--ip', ip], {
        cwd: ASP_DIR
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
    } catch (error) {
      console.error(`[ASP] handler for controller ${id} (${ip}) failed to start:`, error);
    }
  }
  // All cameras run on the unified C++ perception engine (deskpass_percept).
  CamsCollection.find({}).observeChanges({
    added: async (id, fields) => {
      myCams[id]={_id:id, ...fields, count:0, state:'success'} as CamWithCounter
      if(fields.streamurl) await perceptAdd({_id:id, ...fields} as Cam);
    },
    changed: async(id, fields)=>{
      const allfields = await CamsCollection.findOneAsync({_id:id});
      if(allfields)
        myCams[id]={...allfields, count:0, state:'success'}
      if(fields.streamurl || fields.lines || fields.overlayZones){
        if(allfields?.streamurl) await perceptSync(allfields);
      }
    },
    removed: async (id)=>{
      const url = myCams[id]?.streamurl;   // capture before delete — remove needs the url
      delete myCams[id]
      await perceptRemove(id, url);
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
      if(ASPHandler[id]) {
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
VisitsSummaryCollection.rawCollection().createIndex({ 'source': 1, 'timestamp': -1 });
  VisitsSummaryCollection.rawCollection().createIndex({ timestamp: 1 });
  VisitsSummaryCollection.rawCollection().createIndex({ idInfo: 1 }, {sparse: true});
  VisitsSummaryCollection.rawCollection().createIndex({ 'idInfo.divission': 1 });
  VisitsSummaryCollection.rawCollection().createIndex({ 'par.$**': 1 });
  VisitsCollection.rawCollection().createIndex({ 'par.$**': 1 });
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
  CaptionAlertsCollection.rawCollection().createIndex({ seen: 1 });
  CaptionAlertsCollection.rawCollection().createIndex({ timestamp: -1 });
  CaptionAlertsCollection.rawCollection().createIndex({ source: 1 });
  CamEventsCollection.rawCollection().createIndex({ timestamp: 1 });
  CamEventsCollection.rawCollection().createIndex({ source: 1, timestamp: -1 });
  ScenarioEventsCollection.rawCollection().createIndex({ triggeredAt: -1 });
  ScenarioEventsCollection.rawCollection().createIndex({ seen: 1 });
  ScenarioEventsCollection.rawCollection().createIndex({ scenarioId: 1, triggeredAt: -1 });
  ScenarioEventsV2Collection.rawCollection().createIndex({ triggeredAt: -1 });
  ScenarioEventsV2Collection.rawCollection().createIndex({ seen: 1 });
  ScenarioEventsV2Collection.rawCollection().createIndex({ scenarioId: 1, triggeredAt: -1 });
  TemporaryCardsCollection.rawCollection().createIndex({ status: 1 });
  TemporaryCardsCollection.rawCollection().createIndex({ personId: 1 });
  TemporaryCardsCollection.rawCollection().createIndex({ attachedAt: 1 });

  // Schedule temporary cards cleanup every hour
  Meteor.setInterval(async () => {
    await cleanupExpiredTemporaryCards();
  }, 60 * 60 * 1000); // Every hour

  // Run cleanup once at startup
  cleanupExpiredTemporaryCards();

  const listener = async (message: string, channel: string) => {
    if (channel === 'new_detection') {
      const payload = JSON.parse(message) as Visit & { similarity?: number };
      payload.face_b64   = await resizeBase64Image(payload.face_b64, 150);
      payload.person_b64 = await resizeBase64Image(payload.person_b64, 150);
      payload.timestamp  = new Date(payload.timestamp as unknown as string);
      payload.reference  = false;
      const idP = payload.idInfo
        ? (isNaN(Number(payload.idInfo as unknown as string))
            ? payload.idInfo as unknown as string
            : Number(payload.idInfo as unknown as string))
        : undefined;
      await VisitsCollection.insertAsync(payload);
      if (payload.tracking_id) {
        await VisitsSummaryCollection.updateAsync(
          { _id: payload.tracking_id },
          { $set: {
              face_b64:   payload.face_b64,
              person_b64: payload.person_b64,
              face_model: payload.face_model,
              timestamp:  payload.timestamp,
              face_box:   payload.face_box,
              person_box: payload.person_box,
              source:     payload.source,
              ...(payload.par && Object.keys(payload.par).length > 0 ? { par: payload.par } : {}),
          }},
          { upsert: true }
        ).catch(() => {});
      }
      await handleDetectionAlerts(payload, idP);
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
  // perception-engine events: line crossings (persisted) + 1 Hz live status (upserted)
  const cam_events_listener = async (message: string, channel: string) => {
    if (channel !== 'cam_events') return;
    try {
      const ev = JSON.parse(message);
      if (ev.type === 'crossing') {
        await CamEventsCollection.insertAsync({
          source: ev.source, tid: ev.tid, line: ev.line, to: ev.to,
          timestamp: new Date(),
        });
      } else if (ev.type === 'status') {
        await CamLiveStatusCollection.upsertAsync(
          { _id: ev.source },
          { $set: {
              fps:        ev.fps,
              persons:    ev.persons,
              faces:      ev.faces,
              lineCounts: ev.analytics?.line_counts ?? {},
              zoneCounts: ev.analytics?.zone_counts ?? {},
              zoneMotion: ev.analytics?.zone_motion ?? {},
              updatedAt:  new Date(),
          }},
        );
      }
    } catch (e) {
      console.log('cam_events parse error', e);
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

  // VLM caption keyword hit (fall/fight/gun/…) from percept_caption.py
  const caption_alert_listener = async (message: string, channel: string) => {
    if (channel !== 'caption_alert') return;
    try {
      const a = JSON.parse(message) as { source: string; text: string; keyword: string; ts: number };
      await CaptionAlertsCollection.insertAsync({
        source: a.source, text: a.text, keyword: a.keyword,
        timestamp: new Date(a.ts || Date.now()), seen: false, seenBy: '', seenAt: null,
      });
    } catch (e) { console.warn('[caption] alert parse failed', e); }
  };

  await redisClient.subscribe('new_detection', listener);
  await redisClient.subscribe('card_read', listener);
  await redisClient.subscribe('get_cams', cams_listener);
  await redisClient.subscribe('cam_events', cam_events_listener);
  await redisClient.subscribe('caption_alert', caption_alert_listener);

  initScenarioEngine().catch((e) => console.error('[scenario] engine failed to start:', e));
  initScenarioEngineV2().catch((e) => console.error('[scenario2] engine failed to start:', e));

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
  // ONVIF discovery is no longer awaited here. It took seconds, and the
  // publications and methods below are only registered once this callback
  // reaches them — until then a connected client is told its perfectly valid
  // method does not exist. Discovery now runs only while someone is watching
  // the camera picker (see the onvifDevices publication).

  // Page sizes the server enforces regardless of what the client asks for.
  // `visits` keeps a high ceiling because the models screen legitimately pulls
  // every reference visit in one subscription.
  const PAGE = { fallback: 100, max: 500 };
  const VISITS_PAGE = { fallback: 100, max: 100000 };

  Meteor.publish('allUsers', function(){
    if (!this.userId) return this.ready();
    // Field list on purpose: publishing users unrestricted ships the password
    // service block — bcrypt hashes included — to every signed-in client.
    return Meteor.users.find({}, { fields: { username: 1, createdAt: 1, profile: 1 } });
  })
  Meteor.publish('workspace', function(){
    if(this.userId){
      return WorkspacesCollection.find({user:this.userId})
    }
    return [];
  })
  // ONVIF discovery broadcasts on the local network. It used to run every ten
  // seconds for the lifetime of the server, whether or not anyone was looking
  // at the camera picker; now it runs only while that picker is open.
  const ONVIF_PROBE_MS = Number(process.env.ONVIF_PROBE_MS || 15000);
  // Do not tear discovery down the instant the last viewer leaves: opening a
  // second screen, or a page reload, would otherwise thrash the UDP sockets
  // the library binds for each probe.
  const ONVIF_LINGER_MS = Number(process.env.ONVIF_LINGER_MS || 60000);

  let onvifSubscribers = 0;
  let onvifTimer: number | undefined;
  let onvifStopTimer: number | undefined;
  let onvifProbeInFlight = false;

  async function probeOnvifOnce() {
    // startProbe binds sockets; running two at once, or starting a new one
    // before the previous finished, is asking for trouble.
    if (onvifProbeInFlight) return;
    onvifProbeInFlight = true;
    try {
      const devices = await startProbe();
      localOnvif = devices.map((d) => d as OnvifDevice);
    } catch (e) {
      // A camera that is briefly unreachable is normal; a persistent failure
      // should still be visible.
      console.error('[ONVIF] discovery probe failed:', e instanceof Error ? e.message : e);
    } finally {
      // Always release the discovery sockets, including after a failure.
      try { await stopDiscovery(); } catch { /* discovery was not running */ }
      onvifProbeInFlight = false;
    }
  }

  function startOnvifDiscovery() {
    if (onvifStopTimer !== undefined) {
      Meteor.clearTimeout(onvifStopTimer);
      onvifStopTimer = undefined;
    }
    if (onvifTimer !== undefined) return;
    void probeOnvifOnce();
    onvifTimer = Meteor.setInterval(() => void probeOnvifOnce(), ONVIF_PROBE_MS);
  }

  function stopOnvifDiscovery() {
    if (onvifTimer === undefined || onvifStopTimer !== undefined) return;
    onvifStopTimer = Meteor.setTimeout(() => {
      onvifStopTimer = undefined;
      if (onvifSubscribers > 0) return;   // someone came back while we waited
      if (onvifTimer !== undefined) {
        Meteor.clearInterval(onvifTimer);
        onvifTimer = undefined;
      }
    }, ONVIF_LINGER_MS);
  }

  Meteor.publish('onvifDevices', function () {
    if (!this.userId) return this.ready();
    const self: any = this;

    onvifSubscribers += 1;
    startOnvifDiscovery();

    // Devices found before this subscription started, then anything discovery
    // turns up afterwards. The old version pushed a one-off snapshot, so a
    // camera found a second later never appeared until the screen reopened.
    const sent = new Set<string>();
    const flush = () => {
      for (const d of localOnvif) {
        if (sent.has(d.urn)) continue;
        sent.add(d.urn);
        self.added('onvifdevices', d.urn, { ...d });
      }
    };
    flush();
    self.ready();

    const pushTimer = Meteor.setInterval(flush, 2000);
    self.onStop(() => {
      Meteor.clearInterval(pushTimer);
      onvifSubscribers -= 1;
      if (onvifSubscribers <= 0) {
        onvifSubscribers = 0;
        stopOnvifDiscovery();
      }
    });
  })
  Meteor.publish("zones", function () {
    if (!this.userId) return this.ready();
    return ZonesCollection.find()
  });
  Meteor.publish("divisions", function () {
    if (!this.userId) return this.ready();
    return DivisionsCollection.find()
  });
  Meteor.publish("cams", function () {
    if (!this.userId) return this.ready();
    return CamsCollection.find()
  });
  Meteor.publish("cam_line_defs", function () {
    if (!this.userId) return this.ready();
    return CamLineDefsCollection.find();
  });
  Meteor.publish("cam_zone_defs", function () {
    if (!this.userId) return this.ready();
    return CamZoneDefsCollection.find();
  });
  Meteor.publish("cam_events", function (source?: string, limit: number = 50) {
    if (!this.userId) return this.ready();
    return CamEventsCollection.find(
      source ? { source } : {},
      { sort: { timestamp: -1 }, limit });
  });
  Meteor.publish("cam_live_status", function () {
    if (!this.userId) return this.ready();
    return CamLiveStatusCollection.find();
  });

  /**
   * One redis poller per camera, shared by everyone watching it.
   *
   * Each subscription used to start its own interval, so two operators on the
   * same camera meant twice the redis traffic — and the overlay feed polls ten
   * times a second. Now the first subscriber starts the poller, the rest
   * attach to it, and the last one to leave stops it. A late joiner gets the
   * most recent payload immediately instead of an empty document.
   */
  function sharedCameraFeed(
    collection: string,
    intervalMs: number,
    initial: Record<string, unknown>,
    read: (camId: string, state: { last: any }) => Promise<Record<string, unknown> | null>,
  ) {
    interface Room {
      subscribers: Set<any>;
      timer: number;
      latest: Record<string, unknown>;
      state: { last: any };
    }
    const rooms = new Map<string, Room>();

    return function join(camId: string, sub: any) {
      let room = rooms.get(camId);
      if (!room) {
        const fresh: Room = {
          subscribers: new Set(), timer: 0, latest: { ...initial }, state: { last: null },
        };
        fresh.timer = Meteor.setInterval(async () => {
          let update: Record<string, unknown> | null = null;
          try {
            update = await read(camId, fresh.state);
          } catch {
            // Polled up to ten times a second: a malformed or missing redis
            // frame is normal and self-corrects on the next tick, and logging
            // it would flood the console.
          }
          if (!update) return;
          fresh.latest = { ...fresh.latest, ...update };
          for (const s of fresh.subscribers) s.changed(collection, camId, update);
        }, intervalMs);
        rooms.set(camId, fresh);
        room = fresh;
      }

      room.subscribers.add(sub);
      sub.added(collection, camId, room.latest);
      sub.ready();

      sub.onStop(() => {
        const current = rooms.get(camId);
        if (!current) return;
        current.subscribers.delete(sub);
        if (current.subscribers.size === 0) {
          Meteor.clearInterval(current.timer);
          rooms.delete(camId);
        }
      });
    };
  }

  // Per-frame overlay data for the annotated livestream: LIGHT metadata
  // (boxes, faces, landmarks, pose, colors, face thumbnails) from the redis
  // cam:frames:<id> tail — no Mongo, heavy fields (embeddings, person crops)
  // stripped.
  const joinOverlay = sharedCameraFeed(
    'cam_overlay', 100, { persons: [], faces: [], fps: 0 },
    async (camId, state) => {
      const raw = await pub.lIndex(`cam:frames:${camId}`, -1);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d.frame === state.last) return null;
      state.last = d.frame;
      return {
        frame: d.frame,
        fps: d.fps,
        persons: (d.persons || []).map((p: any) => ({
          tid: p.tid, bbox: p.bbox, known: !!p.has_emb,
          hc: p.head_color, uc: p.upper_color, lc: p.lower_color,
          pose: p.pose,
        })),
        faces: (d.faces || []).map((f: any) => ({
          bbox: f.bbox, lm5: f.lm5, frontal: f.frontal, thumb: f.face_crop,
        })),
      };
    },
  );

  Meteor.publish("cam_overlay", function (camId: string) {
    if (!this.userId) return this.ready();
    if (typeof camId !== 'string' || !camId) return this.ready();
    joinOverlay(camId, this);
  });

  // Live VLM caption feed for one camera: the redis rolling list
  // cam:captions:<id> (written by percept_caption.py), pushed as a single
  // reactive doc { items: [{t, text}] }.
  const joinCaptions = sharedCameraFeed(
    'cam_captions', 1000, { items: [] },
    async (camId, state) => {
      const raw: string[] = await pub.lRange(`cam:captions:${camId}`, -40, -1);
      const signature = `${raw.length}:${raw.length ? raw[raw.length - 1] : ''}`;
      if (signature === state.last) return null;   // nothing new
      state.last = signature;
      const items = raw.map((s) => { try { return JSON.parse(s); } catch { return null; } })
                       .filter(Boolean);
      return { items };
    },
  );

  Meteor.publish("cam_captions", function (camId: string) {
    if (!this.userId) return this.ready();
    if (typeof camId !== 'string' || !camId) return this.ready();
    joinCaptions(camId, this);
  });
  Meteor.publish("caption_alerts", function (filter: any = {}, limit: number = 100) {
    if (!this.userId) return this.ready();
    return CaptionAlertsCollection.find(sanitizeFilter(filter, CAPTION_FILTER), {
      sort: { timestamp: -1 },
      limit: clampLimit(limit, PAGE),
    });
  });
  Meteor.publish("caption_alerts_unseen", function () {
    if (!this.userId) return this.ready();
    return CaptionAlertsCollection.find({ seen: false }, { sort: { timestamp: -1 }, limit: 20 });
  });
  Meteor.publish("scenarios", function () {
    if (!this.userId) return this.ready();
    return ScenariosCollection.find();
  });
  Meteor.publish("scenario_events", function (filter: any = {}, limit: number = 100) {
    if (!this.userId) return this.ready();
    return ScenarioEventsCollection.find(filter, { sort: { triggeredAt: -1 }, limit });
  });
  Meteor.publish("scenario_events_unseen", function () {
    if (!this.userId) return this.ready();
    return ScenarioEventsCollection.find({ seen: false }, { sort: { triggeredAt: -1 }, limit: 200 });
  });
  Meteor.publish("scenarios_v2", function () {
    if (!this.userId) return this.ready();
    return ScenariosV2Collection.find();
  });
  Meteor.publish("scenario_events_v2", function (filter: any = {}, limit: number = 100, skip: number = 0, sort: any = { triggeredAt: -1 }) {
    if (!this.userId) return this.ready();
    return ScenarioEventsV2Collection.find(sanitizeFilter(filter, SCENARIO_EVENT_FILTER), {
      sort: sanitizeSort(sort, ['triggeredAt', 'severity'], { triggeredAt: -1 }),
      limit: clampLimit(limit, PAGE),
      skip: clampSkip(skip),
    });
  });
  Meteor.publish("scenario_events_v2_unseen", function () {
    if (!this.userId) return this.ready();
    return ScenarioEventsV2Collection.find({ seen: false }, { sort: { triggeredAt: -1 }, limit: 200 });
  });
  Meteor.publish("alertsArchive", function (filter, limit = 100, skip = 0, sort = {timestamp:-1}) {
    if (!this.userId) return this.ready();
    return AlertsArchiveCollection.find(sanitizeFilter(filter, ALERTS_FILTER), {
      limit: clampLimit(limit, PAGE),
      skip: clampSkip(skip),
      sort: sanitizeSort(sort, ['timestamp'], { timestamp: -1 }),
    });
  });
  Meteor.publish('unseenIntruders', function(){
    if (!this.userId) return this.ready();
    return IntruderAlertsCollection.find({ seen: false }, {sort: {timestamp: -1}, limit: 20});
  })
  Meteor.publish('unseenAlertsArchive', function(){
    if (!this.userId) return this.ready();
    return AlertsArchiveCollection.find({ seen: false }, {sort: {timestamp: -1}, limit: 20});
  })
  Meteor.publish('intruderAlerts', function (filter, limit=100, skip=0, sort={timestamp:-1}) {
    if (!this.userId) return this.ready();
    return IntruderAlertsCollection.find(sanitizeFilter(filter, INTRUDER_FILTER), {
      limit: clampLimit(limit, PAGE),
      skip: clampSkip(skip),
      sort: sanitizeSort(sort, ['timestamp'], { timestamp: -1 }),
    });
  });

  // Apollo status publish - sends status to client-side only collection
  Meteor.publish('apolloStatus', function () {
    if (!this.userId) return this.ready();
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

  Meteor.publish("visitSummaryMeta" , async function () {
    if (!this.userId) return this.ready();
    const self = this;
    // Awaited so the observer is fully attached before ready() is sent.
    // Measured caveat: the initial documents still arrive shortly *after*
    // ready on this Meteor version, so treat the collection reactively rather
    // than assuming it is populated the moment the subscription completes.
    //
    // The cast is needed because the npm @types/meteor package is behind the
    // runtime — Meteor 3's mongo package does ship observeChangesAsync.
    const summaryCursor = VisitsSummaryCollection.find({ idInfo: { $exists: true } }) as any;
    const handler = await summaryCursor.observeChangesAsync({
      added(id: string, fields: Partial<VisitSummary>) {
        self.added('visitSummaryMeta', id, {idInfo: fields.idInfo});
      },
      changed(id: string, fields: Partial<VisitSummary>) {
        self.changed('visitSummaryMeta', id, {idInfo: fields.idInfo});
      },
      removed(id: string) {
        self.removed('visitSummaryMeta', id);
      }
    })
    // observeChanges pushes documents by hand, so Meteor never marks the
    // subscription ready on its own: without this the client waits forever
    // and any screen gated on isLoading() keeps spinning.
    this.ready();
    this.onStop(() => {
      if (handler && typeof handler.stop === 'function') {
        handler.stop();
      }
    });
  })
  Meteor.publish("visits", function (filter={}, limit = 100, skip = 0, sort = {timestamp:-1}) {
    if (!this.userId) return this.ready();
    return VisitsCollection.find(sanitizeFilter(filter, VISIT_FILTER), {
      limit: clampLimit(limit, VISITS_PAGE),
      skip: clampSkip(skip),
      sort: sanitizeSort(sort, ['timestamp', 'tracking_id'], { timestamp: -1 }),
    });
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
    const query = sanitizeFilter(filter, SUMMARY_FILTER);
    const page = { limit: clampLimit(limit, PAGE), skip: clampSkip(skip), sort: { timestamp: -1 as const } };
    const self = this;
    const handler = VisitsSummaryCollection.find(query, page).observeChanges({
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
    if (!this.userId) return this.ready();
    return ControllersCollection.find();
  })
  Meteor.publish('gates', function () {
    if (!this.userId) return this.ready();
    return GatesCollection.find();
  });
  Meteor.publish('usersMeta', async function(){
    if (!this.userId) return this.ready();
    const self = this
    // Awaited for the same reason, and cast for the same reason, as
    // visitSummaryMeta above.
    const usersCursor = Meteor.users.find({}, { fields: { username: 1 } }) as any;
    const handler = await usersCursor.observeChangesAsync({
      added(id: string, fields: { username?: string }) {
        self.added('usersMeta', id, fields)
      },
      changed(id: string, fields: { username?: string }) {
        if(fields.username){
          self.changed('usersMeta', id, fields)
        }
      },
      removed(id: string) {
        self.removed('usersMeta', id)
      }
  })
    // Same as visitSummaryMeta: a hand-fed publication has to say when the
    // initial batch is done.
    this.ready();
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
    return AccessReportCollection.find(sanitizeFilter(filter, ACCESS_REPORT_FILTER), {
      limit: clampLimit(limit, PAGE),
      skip: clampSkip(skip),
      sort: sanitizeSort(sort, ['timestamp'], { timestamp: -1 }),
    });
  });

  Meteor.publish('temporaryCards', function (filter = {}, limit = 100, skip = 0, sort = { attachedAt: -1 }) {
    if (!this.userId) {
      return [];
    }
    return TemporaryCardsCollection.find(sanitizeFilter(filter, TEMPORARY_CARD_FILTER), {
      limit: clampLimit(limit, PAGE),
      skip: clampSkip(skip),
      sort: sanitizeSort(sort, ['attachedAt'], { attachedAt: -1 }),
    });
  });

  Meteor.publish('alertItem', function (alertId: string) {
    if (!this.userId) return this.ready();
    if (typeof alertId !== 'string' || !alertId) return this.ready();
    return IntruderAlertsCollection.find({ _id: alertId });
  })
  Meteor.publish('settings', async function () {
    // Written as a normal function so a non-admin gets a finished, empty
    // subscription. The arrow version returned undefined, which Meteor never
    // marks ready — the settings screen span forever for anyone but an admin.
    if (!this.userId) return this.ready();
    if (!(await isAdmin(this.userId))) return this.ready();
    return SettingsCollection.find();
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
    if (!this.userId) return this.ready();
    return TgSessions.find()
  })

  Meteor.publish('recordings', function(camIds: string[] = [], dayStart = 0, dayEnd = 0, limit = 200) {
    if (!this.userId) return this.ready();
    const ids = Array.isArray(camIds) ? camIds.filter((id) => typeof id === 'string').slice(0, 200) : [];
    if (!ids.length) return this.ready();
    const from = new Date(typeof dayStart === 'number' ? dayStart : 0);
    const to = new Date(typeof dayEnd === 'number' ? dayEnd : 0);
    return RecordingsCollection.find(
      { camId: { $in: ids }, startedAt: { $gte: from, $lt: to } },
      { sort: { startedAt: 1 }, limit: clampLimit(limit, { fallback: 200, max: 2000 }) },
    );
  });

  Meteor.methods({
    async restartCamHandler(id:string){
      await requirePermission(this, PERMISSIONS.CAMERA_CONTROL);
      const cam = await CamsCollection.findOneAsync({_id:id});
      if(cam && cam._id && cam.streamurl){
        // restart = re-sync the camera's source on the perception engine
        await perceptSync(cam as Cam);
      }
      return true;
    },
    // Update a camera's VLM caption watch-words. Persists to Mongo and pushes
    // them to redis (cam:keywords:<id>) so percept_caption.py picks them up live.
    async setCaptionKeywords(camId: string, keywords: string[]) {
      if (!this.userId) throw new Meteor.Error('not-authorized');
      const clean = (Array.isArray(keywords) ? keywords : [])
        .map((k) => String(k).trim()).filter(Boolean).slice(0, 40);
      await CamsCollection.updateAsync({ _id: camId }, { $set: { captionKeywords: clean } });
      await perceptSetKeywords(camId, clean);
      return clean;
    },
    async markCaptionAlertSeen(alertId: string) {
      if (!this.userId) throw new Meteor.Error('not-authorized');
      await CaptionAlertsCollection.updateAsync(
        { _id: alertId }, { $set: { seen: true, seenBy: 'root', seenAt: new Date() } });
      return true;
    },
    async doApolloSync(){
      await requirePermission(this, PERMISSIONS.INTEGRATION_CONFIGURE);
      syncApolloData();
      return true;
    },
    async setTgBot(token:string){
      // Replaces the bot identity and drops every stored chat session, so it
      // is an administrator action, not merely a signed-in one.
      await requirePermission(this, PERMISSIONS.INTEGRATION_CONFIGURE);
      if (typeof token !== 'string' || !token.trim()) {
        throw new Meteor.Error('invalid-token', 'A Telegram bot token is required.');
      }
      await SettingsCollection.removeAsync({type:'telegram'})
      await SettingsCollection.insertAsync({type:'telegram', config:token})
      await TgSessions.removeAsync({})
      tgBot = initBot(token);
    },
    async getBotLink(){
      requireUser(this);
      return tgBot ? (await tgBot.getMe()).username : ''
    },
    async setApacsConfig(config:APIConfig){
      // Repoints the access-control integration: administrator only.
      await requirePermission(this, PERMISSIONS.INTEGRATION_CONFIGURE);
      if (!config || typeof config.url !== 'string' || typeof config.username !== 'string') {
        throw new Meteor.Error('invalid-config', 'An APACS url and username are required.');
      }
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
      // Opening a door is a capability, not a side effect of having an
      // account: authorisation is checked before the gate is even looked up.
      await requirePermission(this, PERMISSIONS.GATE_UNLOCK);
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
    updateWorkspace: async function(apps:App[]){
      const userId = requireUser(this);
      if (await WorkspacesCollection.findOneAsync({ user: userId }) === undefined) {
        await WorkspacesCollection.insertAsync({ user: userId, apps });
        return;
      }
      await WorkspacesCollection.updateAsync({ user: userId }, { $set: { apps } });
    },
    getUserName: async function(userId:string):Promise<string> {
      // Resolving ids to usernames is account enumeration for anyone who can
      // reach the socket, so it needs a session.
      requireUser(this);
      if(!userId || typeof userId !== 'string') return '';
      const user = await Meteor.users.findOneAsync({_id:userId});
      return user?.username || '';
    },
    ...CommonMethods,
    ...AccessControllMethods,
    ...PersonAlertmethods,
    ...MetrixMethods
  })
});
