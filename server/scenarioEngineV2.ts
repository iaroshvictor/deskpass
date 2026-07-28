import { createClient } from 'redis';
import {
  ScenarioV2, ScenariosV2Collection, ScenarioEventsV2Collection,
  PersonFilter, ScenarioSchedule,
} from '/imports/api/scenarioModel';
import { CamsCollection } from '/imports/api/cams';

// Scenario engine v2.
//
// SCOPE is expanded into concrete watch units (camId [+ zone/line def id]);
// shared zone/line definitions resolve to every cam where they are placed.
// CONDITIONS are instantaneous predicates or edge events; TIME operators wrap
// them generically:  sustain ("for T")  and  window ("N within T").
// A SCHEDULE gates the whole scenario.

interface Unit { camId: string; }                 // one watchable placement
interface UnitState {
  condSince: number | null;                       // sustain timer
  lastFire: number;                               // cooldown anchor
  perTrack: Map<string | number, number>;         // dwell starts / arrival cooldowns
  events: number[];                               // window: occurrence timestamps
  offline: boolean;
}

interface Watch { scenario: ScenarioV2; units: Unit[]; }

const watches   = new Map<string, Watch>();       // scenarioId → resolved watch
const unitState = new Map<string, UnitState>();   // `${scenarioId}:${camId}` → state
const camStatus = new Map<string, { at: number; persons: number; analytics: any }>();
let engineStart = Date.now();

const stateOf = (sid: string, camId: string): UnitState => {
  const k = `${sid}:${camId}`;
  let s = unitState.get(k);
  if (!s) { s = { condSince: null, lastFire: 0, perTrack: new Map(), events: [], offline: false }; unitState.set(k, s); }
  return s;
};

// ── schedule gate ────────────────────────────────────────────────────────────
function isArmed(sched: ScenarioSchedule | undefined, now = new Date()): boolean {
  if (!sched?.from || !sched?.to) return true;
  if (sched.days?.length && !sched.days.includes(now.getDay())) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = sched.from.split(':').map(Number);
  const [th, tm] = sched.to.split(':').map(Number);
  const from = fh * 60 + fm, to = th * 60 + tm;
  return from <= to ? cur >= from && cur < to : cur >= from || cur < to; // midnight wrap
}

// ── firing ───────────────────────────────────────────────────────────────────
async function fire(w: Watch, camId: string, message: string, details: any) {
  const s = w.scenario;
  const st = stateOf(s._id!, camId);
  st.lastFire = Date.now();
  await ScenarioEventsV2Collection.insertAsync({
    scenarioId: s._id!, scenarioName: s.name, severity: s.severity,
    camId, zoneDefId: s.scope.zoneDefId, lineDefId: s.scope.lineDefId,
    message, details, triggeredAt: new Date(), seen: false,
  });
  await ScenariosV2Collection.updateAsync({ _id: s._id }, {
    $set: { lastTriggeredAt: new Date() }, $inc: { triggerCount: 1 },
  });
  console.log(`[scenario2] "${s.name}" @${camId}: ${message}`);
}

const cooledDown = (w: Watch, camId: string) =>
  Date.now() - stateOf(w.scenario._id!, camId).lastFire >= (w.scenario.cooldownSec ?? 30) * 1000;

// ── generic time operators ───────────────────────────────────────────────────

// state condition evaluated on every sample (status tick)
async function evalState(w: Watch, camId: string, cond: boolean, message: () => string, details: () => any) {
  if (!isArmed(w.scenario.schedule)) return;
  const st = stateOf(w.scenario._id!, camId);
  const forMs = (w.scenario.rule.time?.forSec ?? 0) * 1000;
  if (!cond) { st.condSince = null; return; }
  if (st.condSince === null) st.condSince = Date.now();
  if (Date.now() - st.condSince >= forMs && cooledDown(w, camId)) {
    st.condSince = Date.now();                    // fresh hold before re-fire
    await fire(w, camId, message(), details());
  }
}

// edge event; window operator ("N within T") applies here when configured
async function evalEvent(w: Watch, camId: string, message: string, details: any) {
  if (!isArmed(w.scenario.schedule)) return;
  const t = w.scenario.rule.time ?? {};
  const st = stateOf(w.scenario._id!, camId);
  if (t.count && t.withinSec) {
    const now = Date.now();
    st.events.push(now);
    const cutoff = now - t.withinSec * 1000;
    while (st.events.length && st.events[0] < cutoff) st.events.shift();
    if (st.events.length >= t.count && cooledDown(w, camId)) {
      st.events = [];
      await fire(w, camId, `${message} (${t.count}× within ${t.withinSec}s)`, details);
    }
  } else if (cooledDown(w, camId)) {
    await fire(w, camId, message, details);
  }
}

// ── person filter against a new_detection payload ────────────────────────────
function matchDetection(p: PersonFilter, det: any): boolean {
  const known = !!det.idInfo;
  if (p.identity === 'known' && !known) return false;
  if (p.identity === 'unknown' && known) return false;
  if (p.identity === 'ids' && (!known || !(p.ids ?? []).includes(String(det.idInfo)))) return false;
  if (p.similarity !== undefined && known && (det.similarity ?? 0) < p.similarity) return false;
  for (const a of p.attributes ?? []) {
    if ((det.par?.[a.attr] ?? 0) < a.min) return false;
  }
  return true;
}

const personLabel = (p: PersonFilter, det: any) =>
  p.identity === 'unknown' ? 'Unknown person'
  : det?.idInfo ? `Known person "${det.idInfo}"` : 'Person';

// ── feed handlers ────────────────────────────────────────────────────────────

async function onStatus(msg: any) {
  camStatus.set(msg.source, { at: Date.now(), persons: msg.persons, analytics: msg.analytics });
  for (const w of watches.values()) {
    if (!w.units.some(u => u.camId === msg.source)) continue;
    const s = w.scenario, c = s.rule.condition;
    if (c.kind === 'count') {
      const n = s.scope.kind === 'zone'
        ? msg.analytics?.zone_counts?.[s.scope.zoneDefId ?? ''] ?? 0
        : msg.persons ?? 0;
      const cond = c.op === 'gte' ? n >= c.value : n <= c.value;
      await evalState(w, msg.source, cond, () => `${n} persons`, () => ({ count: n }));
    } else if (c.kind === 'motion' && s.scope.kind === 'zone') {
      const score = msg.analytics?.zone_motion?.[s.scope.zoneDefId ?? ''];
      if (score === undefined) continue;
      const cond = c.state === 'present' ? score >= c.threshold : score < c.threshold;
      await evalState(w, msg.source, cond,
        () => `Motion ${c.state} (score ${score.toFixed(1)}, threshold ${c.threshold})`,
        () => ({ motionScore: score, threshold: c.threshold }));
    } else if (c.kind === 'person_present' && s.scope.kind !== 'zone' && c.person.identity === 'any') {
      await evalState(w, msg.source, (msg.persons ?? 0) > 0,
        () => `Person present`, () => ({ persons: msg.persons }));
    }
  }
}

async function onCrossing(msg: any) {
  for (const w of watches.values()) {
    const s = w.scenario, c = s.rule.condition;
    if (c.kind !== 'crossing' || s.scope.lineDefId !== msg.line) continue;
    if (!w.units.some(u => u.camId === msg.source)) continue;
    if (c.direction !== 'any' && c.direction !== msg.to) continue;
    await evalEvent(w, msg.source, `Line crossed → ${msg.to} (person #${msg.tid})`,
      { tid: msg.tid, to: msg.to });
  }
}

async function onDetection(det: any) {
  for (const w of watches.values()) {
    const s = w.scenario, c = s.rule.condition;
    if (c.kind !== 'person_arrived') continue;
    if (!w.units.some(u => u.camId === det.source)) continue;
    if (!matchDetection(c.person, det)) continue;
    if (!isArmed(s.schedule)) continue;
    // one alert per track id per cooldown
    const st = stateOf(s._id!, det.source);
    const until = st.perTrack.get(det.tracking_id) ?? 0;
    if (Date.now() < until) continue;
    st.perTrack.set(det.tracking_id, Date.now() + (s.cooldownSec ?? 30) * 1000);
    await evalEvent(w, det.source, `${personLabel(c.person, det)} arrived`,
      { tracking_id: det.tracking_id, idInfo: det.idInfo || null, similarity: det.similarity });
  }
}

// ── 1 Hz tick: camera on/offline + zone dwell/presence ──────────────────────

let redisGet: ReturnType<typeof createClient> | null = null;

async function tick() {
  const now = Date.now();

  for (const w of watches.values()) {
    const s = w.scenario, c = s.rule.condition;

    if (c.kind === 'camera') {
      for (const u of w.units) {
        const st = stateOf(s._id!, u.camId);
        const last = camStatus.get(u.camId)?.at ?? engineStart;
        const silentMs = now - last;
        const holdMs = (s.rule.time?.forSec ?? 15) * 1000;
        if (c.state === 'offline') {
          if (silentMs > holdMs) {
            if (!st.offline && cooledDown(w, u.camId)) {
              st.offline = true;
              await fire(w, u.camId, `Camera offline (${Math.round(silentMs / 1000)}s silent)`, { silentSec: Math.round(silentMs / 1000) });
            }
          } else st.offline = false;
        } else {                                   // 'online' — recovery edge
          if (silentMs < 3000 && st.offline) {
            st.offline = false;
            if (cooledDown(w, u.camId)) await fire(w, u.camId, 'Camera back online', {});
          } else if (silentMs > holdMs) st.offline = true;
        }
      }
    }

    // person presence/dwell inside a zone — per-track from cam:frames
    if ((c.kind === 'person_dwell' || c.kind === 'person_present') && s.scope.kind === 'zone') {
      for (const u of w.units) {
        let frame: any;
        try {
          const raw = await redisGet!.lIndex(`cam:frames:${u.camId}`, -1);
          if (!raw) continue;
          frame = JSON.parse(raw);
        } catch { continue; }
        const zoneId = s.scope.zoneDefId ?? '';
        const inside = (frame.persons ?? []).filter((p: any) => p.zones?.[zoneId] === 'inside');
        // NOTE: identity filters on dwell need the tid→identity map (phase 3);
        // v2 evaluates presence/dwell for any person.
        if (c.kind === 'person_present') {
          await evalState(w, u.camId, inside.length > 0,
            () => `Person present in zone (${inside.length})`, () => ({ inside: inside.length }));
        } else {
          if (!isArmed(s.schedule)) continue;
          const st = stateOf(s._id!, u.camId);
          const dwellMs = (s.rule.time?.forSec ?? 60) * 1000;
          const seen = new Set<number>();
          for (const p of inside) {
            seen.add(p.tid);
            const start = st.perTrack.get(p.tid);
            if (start === undefined) st.perTrack.set(p.tid, now);
            else if (start > 0 && now - start >= dwellMs && cooledDown(w, u.camId)) {
              st.perTrack.set(p.tid, -1);
              await fire(w, u.camId, `Person #${p.tid} in zone for ${Math.round((now - start) / 1000)}s`,
                { tid: p.tid, dwellSec: Math.round((now - start) / 1000) });
            }
          }
          for (const tid of [...st.perTrack.keys()]) if (!seen.has(tid as number)) st.perTrack.delete(tid);
        }
      }
    }
  }
}

// ── scope resolution ─────────────────────────────────────────────────────────

async function resolveUnits(s: ScenarioV2): Promise<Unit[]> {
  const scope = s.scope;
  if (scope.kind === 'cams') return (scope.camIds ?? []).map(camId => ({ camId }));
  const cams = await CamsCollection.find({}).fetchAsync();
  const placed = cams.filter(cam =>
    scope.kind === 'zone'
      ? cam.overlayZones?.some(z => z.zoneId === scope.zoneDefId)
      : cam.lines?.some(l => l.lineId === scope.lineDefId));
  const narrowed = scope.camIds?.length
    ? placed.filter(c => scope.camIds!.includes(c._id!))
    : placed;
  return narrowed.map(c => ({ camId: c._id! }));
}

async function rebuild() {
  const scenarios = await ScenariosV2Collection.find({ enabled: true }).fetchAsync();
  const next = new Map<string, Watch>();
  for (const s of scenarios) next.set(s._id!, { scenario: s, units: await resolveUnits(s) });
  // drop state for removed/disabled scenarios
  for (const key of [...unitState.keys()]) {
    if (!next.has(key.split(':')[0])) unitState.delete(key);
  }
  watches.clear();
  for (const [k, v] of next) watches.set(k, v);
}

// ── lifecycle ────────────────────────────────────────────────────────────────

export async function initScenarioEngineV2() {
  engineStart = Date.now();
  redisGet = await createClient()
    .on('error', (e) => console.log('[scenario2] redis error', e)).connect();
  const sub = await createClient()
    .on('error', (e) => console.log('[scenario2] redis sub error', e)).connect();

  await sub.subscribe('cam_events', (message: string) => {
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'status') onStatus(msg).catch(console.error);
      else if (msg.type === 'crossing') onCrossing(msg).catch(console.error);
    } catch { /* malformed */ }
  });
  await sub.subscribe('new_detection', (message: string) => {
    try { onDetection(JSON.parse(message)).catch(console.error); } catch { /* malformed */ }
  });

  const requeue = () => { rebuild().catch(console.error); };
  await ScenariosV2Collection.find({}).observe({ added: requeue, changed: requeue, removed: requeue });
  await CamsCollection.find({}).observe({ added: requeue, changed: requeue, removed: requeue });

  setInterval(() => { tick().catch(console.error); }, 1000);
  console.log('[scenario2] engine started');
}
