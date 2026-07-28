import { Mongo } from 'meteor/mongo';

// ── Scenario model v2 ─────────────────────────────────────────────────────────
//
// A scenario is:   SCOPE (where) + SCHEDULE (when armed) + RULE (what)
//
// RULE is a condition node wrapped by generic time operators:
//   - sustain  ("for T seconds")   — condition continuously true for T
//   - window   ("N within T")      — N occurrences inside a sliding window
// Entities carry their own thresholds (motion px, PAR confidence, counts).
//
// Evaluated by server/scenarioEngine.ts against the live perception-engine feeds.

// ── scope ────────────────────────────────────────────────────────────────────
// Zone/line scenarios target the SHARED definition (CamZoneDefsCollection /
// CamLineDefsCollection id); the engine expands it to every cam where the
// definition is placed, optionally narrowed by camIds.
export interface ScenarioScope {
  kind: 'cams' | 'zone' | 'line';
  camIds?: string[];      // kind 'cams': required; zone/line: optional narrowing
  zoneDefId?: string;     // kind 'zone'
  lineDefId?: string;     // kind 'line'
}

// ── schedule (arming window) ─────────────────────────────────────────────────
export interface ScenarioSchedule {
  days: number[];         // 0=Sun … 6=Sat; empty/undefined = every day
  from: string;           // "HH:MM" — range may wrap midnight (22:00 → 06:00)
  to: string;
}

// ── subjects (who/what) with their thresholds ────────────────────────────────
export type PersonFilter = {
  identity: 'any' | 'known' | 'unknown' | 'ids';
  ids?: string[];                    // identity 'ids'
  similarity?: number;               // recognition similarity ≥ (known/ids)
  attributes?: { attr: string; min: number }[];  // PAR filters, min = confidence ≥
};

// ── condition nodes (instantaneous predicates / events) ─────────────────────
export type Condition =
  | { kind: 'person_present'; person: PersonFilter }         // in view / in zone (per scope)
  | { kind: 'person_arrived'; person: PersonFilter }         // edge event, per track
  | { kind: 'person_dwell';   person: PersonFilter }         // presence per track — use with sustain
  | { kind: 'count'; op: 'gte' | 'lte'; value: number }      // persons in view / zone
  | { kind: 'motion'; state: 'present' | 'absent'; threshold: number }  // px, ~1.0
  | { kind: 'crossing'; direction: 'any' | 'left' | 'right' | 'above' | 'below' }
  | { kind: 'camera'; state: 'offline' | 'online' };

// time operators wrapping the condition
export interface RuleTime {
  forSec?: number;        // sustain: condition true continuously for T
  count?: number;         // window: N occurrences …
  withinSec?: number;     // … inside T (requires count)
}

export interface ScenarioRule {
  condition: Condition;
  time?: RuleTime;
  // phase 3: sequences — [{condition, time}, …] with 'then'/'and-not' combinators
}

export type ScenarioSeverity = 'info' | 'warning' | 'critical';

export interface ScenarioV2 {
  _id?: string;
  name: string;
  enabled: boolean;
  scope: ScenarioScope;
  schedule?: ScenarioSchedule;
  rule: ScenarioRule;
  severity: ScenarioSeverity;
  cooldownSec: number;
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount?: number;
}

export interface ScenarioEventV2 {
  _id?: string;
  scenarioId: string;
  scenarioName: string;
  severity: ScenarioSeverity;
  camId: string;          // which cam of the scope actually saw it
  zoneDefId?: string;
  lineDefId?: string;
  message: string;
  details: { [k: string]: any };
  triggeredAt: Date;
  seen: boolean;
}

export const ScenariosV2Collection      = new Mongo.Collection<ScenarioV2>('scenarios_v2');
export const ScenarioEventsV2Collection = new Mongo.Collection<ScenarioEventV2>('scenario_events_v2');

// human-readable sentence for a scenario — single source of truth used by both
// the builder preview and the scenario list
export function scenarioSentence(s: ScenarioV2, names: {
  cams?: string[], zone?: string, line?: string,
}): string {
  const c = s.rule.condition;
  const t = s.rule.time ?? {};
  const person = (p: PersonFilter) =>
    p.identity === 'unknown' ? 'an unknown person'
    : p.identity === 'known' ? 'a known person'
    : p.identity === 'ids' ? `person [${(p.ids ?? []).join(', ')}]`
    : 'a person';
  const attrs = (p: PersonFilter) =>
    p.attributes?.length ? ` with ${p.attributes.map(a => a.attr).join(', ')}` : '';

  let what = '';
  switch (c.kind) {
    case 'person_arrived': what = `${person(c.person)}${attrs(c.person)} arrives`; break;
    case 'person_present': what = `${person(c.person)}${attrs(c.person)} is present`; break;
    case 'person_dwell':   what = `${person(c.person)}${attrs(c.person)} stays`; break;
    case 'count':          what = `${c.op === 'gte' ? 'at least' : 'at most'} ${c.value} persons`; break;
    case 'motion':         what = `motion is ${c.state} (≥${c.threshold}px)`; break;
    case 'crossing':       what = `the line is crossed${c.direction !== 'any' ? ` → ${c.direction}` : ''}`; break;
    case 'camera':         what = `the camera goes ${c.state}`; break;
  }
  const where =
    s.scope.kind === 'zone' ? ` in zone “${names.zone ?? s.scope.zoneDefId}”`
    : s.scope.kind === 'line' ? ` on line “${names.line ?? s.scope.lineDefId}”`
    : '';
  const cams = names.cams?.length ? ` on ${names.cams.length > 2 ? `${names.cams.length} cams` : names.cams.join(', ')}` : '';
  const dur = t.forSec ? ` for ${t.forSec}s` : '';
  const win = t.count && t.withinSec ? ` ×${t.count} within ${Math.round(t.withinSec / 60)}min` : '';
  const sched = s.schedule ? ` (${s.schedule.from}–${s.schedule.to})` : '';
  return `When ${what}${where}${cams}${dur}${win}${sched}`;
}
