import { createClient } from 'redis';
import {
  Scenario, ScenariosCollection, ScenarioEventsCollection,
} from '/imports/api/scenarios';
import { CamsCollection } from '/imports/api/cams';

// Scenario watcher engine.
//
// Evaluates enabled Scenarios against the live perception-engine feeds:
//   - redis channel 'cam_events'   → 1 Hz status (persons, zone counts, zone
//     motion) + immediate line-crossing events
//   - redis channel 'new_detection' → recognized/unknown persons + PAR attrs
//   - redis list cam:frames:<camId> → per-track zone membership (dwell)
// Triggers write a ScenarioEvent (drives the UI notifications) and bump the
// scenario's counters.  All state is in-memory and rebuilt on restart.

interface Runtime {
  holdStart: number | null;            // sustained-condition timer
  lastTrigger: number;                 // global cooldown anchor (ms epoch)
  perTrack: Map<string | number, number>; // track id → dwell start / cooldown expiry
  offline: boolean;                    // camera_offline edge state
}

const active  = new Map<string, Scenario>();
const runtime = new Map<string, Runtime>();
const camStatus = new Map<string, { at: number; persons: number; analytics: any }>();
let engineStartedAt = Date.now();

const rt = (id: string): Runtime => {
  let r = runtime.get(id);
  if (!r) { r = { holdStart: null, lastTrigger: 0, perTrack: new Map(), offline: false }; runtime.set(id, r); }
  return r;
};

async function zoneLabel(camId: string, zoneId?: string): Promise<string> {
  if (!zoneId) return '';
  const cam = await CamsCollection.findOneAsync({ _id: camId });
  return cam?.overlayZones?.find(z => z.zoneId === zoneId)?.label ?? zoneId;
}

async function lineLabel(camId: string, lineId?: string): Promise<string> {
  if (!lineId) return '';
  const cam = await CamsCollection.findOneAsync({ _id: camId });
  return cam?.lines?.find(l => l.lineId === lineId)?.label ?? lineId;
}

async function fire(s: Scenario, message: string, details: Record<string, any>) {
  const r = rt(s._id!);
  r.lastTrigger = Date.now();
  await ScenarioEventsCollection.insertAsync({
    scenarioId: s._id!, scenarioName: s.name, trigger: s.trigger,
    severity: s.severity, camId: s.camId, message, details,
    triggeredAt: new Date(), seen: false,
  });
  await ScenariosCollection.updateAsync({ _id: s._id }, {
    $set: { lastTriggeredAt: new Date() }, $inc: { triggerCount: 1 },
  });
  console.log(`[scenario] "${s.name}" fired: ${message}`);
}

const inCooldown = (s: Scenario) =>
  Date.now() - rt(s._id!).lastTrigger < (s.cooldownSec ?? 30) * 1000;

// per-track edge trigger (arrivals, attributes): one alert per track id per cooldown
async function fireOncePerTrack(s: Scenario, trackId: string | number, message: string, details: any) {
  const r = rt(s._id!);
  const until = r.perTrack.get(trackId) ?? 0;
  if (Date.now() < until) return;
  r.perTrack.set(trackId, Date.now() + (s.cooldownSec ?? 30) * 1000);
  if (r.perTrack.size > 2000) {          // bounded: drop expired entries
    for (const [k, v] of r.perTrack) if (v < Date.now()) r.perTrack.delete(k);
  }
  await fire(s, message, details);
}

// sustained condition: true for holdSec continuously → fire (then cooldown)
async function sustain(s: Scenario, cond: boolean, holdSec: number, message: () => string, details: () => any) {
  const r = rt(s._id!);
  if (!cond) { r.holdStart = null; return; }
  if (r.holdStart === null) r.holdStart = Date.now();
  if (Date.now() - r.holdStart >= holdSec * 1000 && !inCooldown(s)) {
    r.holdStart = Date.now();            // require a fresh hold before re-fire
    await fire(s, message(), details());
  }
}

// ── feed handlers ────────────────────────────────────────────────────────────

async function onStatus(msg: any) {
  camStatus.set(msg.source, { at: Date.now(), persons: msg.persons, analytics: msg.analytics });
  for (const s of active.values()) {
    if (s.camId !== msg.source) continue;
    const p = s.params ?? {};
    if (s.trigger === 'person_count_at_least') {
      const n = msg.persons ?? 0;
      await sustain(s, n >= (p.count ?? 1), p.holdSec ?? 0,
        () => `${n} persons at "${s.name}"`, () => ({ persons: n }));
    } else if (s.trigger === 'zone_occupancy_at_least') {
      const n = msg.analytics?.zone_counts?.[s.zoneId ?? ''] ?? 0;
      await sustain(s, n >= (p.count ?? 1), p.holdSec ?? 0,
        () => `${n} persons in zone`, () => ({ occupancy: n }));
    } else if (s.trigger === 'motion_present' || s.trigger === 'motion_absent') {
      const score = msg.analytics?.zone_motion?.[s.zoneId ?? ''];
      if (score === undefined) continue;
      const th = p.motionThreshold ?? 1.0;
      const cond = s.trigger === 'motion_present' ? score >= th : score < th;
      await sustain(s, cond, p.holdSec ?? 10,
        () => s.trigger === 'motion_present'
          ? `Motion in zone (score ${score.toFixed(1)})`
          : `No motion in zone (score ${score.toFixed(1)})`,
        () => ({ motionScore: score, threshold: th }));
    }
  }
}

async function onCrossing(msg: any) {
  for (const s of active.values()) {
    if (s.trigger !== 'line_crossing' || s.camId !== msg.source || s.lineId !== msg.line) continue;
    const dir = s.params?.direction ?? 'any';
    if (dir !== 'any' && dir !== msg.to) continue;
    if (inCooldown(s)) continue;
    await fire(s, `Person #${msg.tid} crossed "${await lineLabel(s.camId, s.lineId)}" → ${msg.to}`,
      { tid: msg.tid, to: msg.to });
  }
}

async function onDetection(msg: any) {
  for (const s of active.values()) {
    if (s.camId !== msg.source) continue;
    const p = s.params ?? {};
    const known = !!msg.idInfo;
    if (s.trigger === 'known_person_arrived' && known) {
      if (p.personIds?.length && !p.personIds.includes(String(msg.idInfo))) continue;
      await fireOncePerTrack(s, msg.tracking_id,
        `Known person "${msg.idInfo}" arrived`, { idInfo: msg.idInfo, tracking_id: msg.tracking_id });
    } else if (s.trigger === 'unknown_person_arrived' && !known) {
      await fireOncePerTrack(s, msg.tracking_id,
        `Unknown person arrived`, { tracking_id: msg.tracking_id });
    } else if (s.trigger === 'attribute_person_present' && p.attribute) {
      const score = msg.par?.[p.attribute];
      if (typeof score === 'number' && score >= (p.attrThreshold ?? 0.5)) {
        await fireOncePerTrack(s, msg.tracking_id,
          `Person with "${p.attribute}" present`, { attribute: p.attribute, score, tracking_id: msg.tracking_id });
      }
    }
  }
}

// ── 1 Hz tick: camera_offline + zone dwell ───────────────────────────────────

let frameClient: ReturnType<typeof createClient> | null = null;

async function tick() {
  const now = Date.now();

  // camera_offline — edge-triggered on heartbeat age
  for (const s of active.values()) {
    if (s.trigger !== 'camera_offline') continue;
    const last = camStatus.get(s.camId)?.at ?? engineStartedAt;
    const holdMs = (s.params?.holdSec ?? 15) * 1000;
    const r = rt(s._id!);
    if (now - last > holdMs) {
      if (!r.offline && !inCooldown(s)) {
        r.offline = true;
        await fire(s, `Camera offline (${Math.round((now - last) / 1000)}s without data)`,
          { silentForSec: Math.round((now - last) / 1000) });
      }
    } else {
      r.offline = false;
    }
  }

  // person_dwell_in_zone — needs per-track zone membership from cam:frames
  const dwellCams = new Set([...active.values()]
    .filter(s => s.trigger === 'person_dwell_in_zone').map(s => s.camId));
  for (const camId of dwellCams) {
    let frame: any;
    try {
      const raw = await frameClient!.lIndex(`cam:frames:${camId}`, -1);
      if (!raw) continue;
      frame = JSON.parse(raw);
    } catch { continue; }
    for (const s of active.values()) {
      if (s.trigger !== 'person_dwell_in_zone' || s.camId !== camId) continue;
      const r = rt(s._id!);
      const dwellMs = (s.params?.dwellSec ?? 60) * 1000;
      const insideNow = new Set<number>();
      for (const person of frame.persons ?? []) {
        if (person.zones?.[s.zoneId ?? ''] !== 'inside') continue;
        insideNow.add(person.tid);
        const start = r.perTrack.get(person.tid);
        if (start === undefined) {
          r.perTrack.set(person.tid, now);
        } else if (start > 0 && now - start >= dwellMs) {
          r.perTrack.set(person.tid, -1);      // fired for this track
          await fire(s, `Person #${person.tid} in zone "${await zoneLabel(camId, s.zoneId)}" for ${Math.round((now - start) / 1000)}s`,
            { tid: person.tid, dwellSec: Math.round((now - start) / 1000) });
        }
      }
      for (const tid of [...r.perTrack.keys()]) {   // left the zone → reset
        if (!insideNow.has(tid as number)) r.perTrack.delete(tid);
      }
    }
  }
}

// ── lifecycle ────────────────────────────────────────────────────────────────

export async function initScenarioEngine() {
  engineStartedAt = Date.now();

  frameClient = await createClient()
    .on('error', (e) => console.log('[scenario] redis error', e)).connect();
  const sub = await createClient()
    .on('error', (e) => console.log('[scenario] redis sub error', e)).connect();

  await sub.subscribe('cam_events', (message: string) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'status') onStatus(msg).catch(console.error);
      else if (msg.type === 'crossing') onCrossing(msg).catch(console.error);
    } catch { /* malformed */ }
  });
  await sub.subscribe('new_detection', (message: string) => {
    try { onDetection(JSON.parse(message)).catch(console.error); }
    catch { /* malformed */ }
  });

  // maintain the active set from the collection (enabled scenarios only)
  await ScenariosCollection.find({}).observe({
    added(doc)   { if (doc.enabled) active.set(doc._id!, doc); },
    changed(doc) {
      runtime.delete(doc._id!);          // params may have changed — reset state
      if (doc.enabled) active.set(doc._id!, doc); else active.delete(doc._id!);
    },
    removed(doc) { active.delete(doc._id!); runtime.delete(doc._id!); },
  });

  setInterval(() => { tick().catch(console.error); }, 1000);
  console.log('[scenario] engine started');
}
