import { Mongo } from 'meteor/mongo';

// ── Scenario definitions (the rules) ─────────────────────────────────────────
//
// A scenario watches ONE source (cam / zone / line) for ONE trigger condition.
// The server-side engine (server/scenarioEngine.ts) evaluates them against the
// live perception-engine feeds (redis 'cam_events' + 'new_detection' + cam:frames) and
// on trigger writes a ScenarioEvent and bumps the scenario counters.

export type ScenarioTrigger =
  | 'known_person_arrived'     // recognized person detected (optionally from a list)
  | 'unknown_person_arrived'   // detection with no identity → intruder
  | 'attribute_person_present' // person with a PAR attribute (backpack, hat, …)
  | 'person_count_at_least'    // ≥ N persons in cam view, sustained holdSec
  | 'zone_occupancy_at_least'  // ≥ N persons inside zone, sustained holdSec
  | 'person_dwell_in_zone'     // any person stays inside zone ≥ dwellSec (loitering)
  | 'line_crossing'            // tripwire crossed (optional direction)
  | 'motion_present'           // zone motion ≥ threshold sustained holdSec
  | 'motion_absent'            // zone motion < threshold sustained holdSec (fan/conveyor stopped)
  | 'camera_offline';          // no status heartbeat for holdSec

export const TRIGGER_LABELS: Record<ScenarioTrigger, string> = {
  known_person_arrived:     'Known person arrived',
  unknown_person_arrived:   'Unknown person arrived (intruder)',
  attribute_person_present: 'Person with attribute present',
  person_count_at_least:    'Person count at least N',
  zone_occupancy_at_least:  'Zone occupancy at least N',
  person_dwell_in_zone:     'Person stays in zone (loitering)',
  line_crossing:            'Line crossed',
  motion_present:           'Motion present in zone',
  motion_absent:            'Motion missing in zone',
  camera_offline:           'Camera offline',
};

// which source kind each trigger needs
export const TRIGGER_SOURCE: Record<ScenarioTrigger, 'cam' | 'zone' | 'line'> = {
  known_person_arrived:     'cam',
  unknown_person_arrived:   'cam',
  attribute_person_present: 'cam',
  person_count_at_least:    'cam',
  zone_occupancy_at_least:  'zone',
  person_dwell_in_zone:     'zone',
  line_crossing:            'line',
  motion_present:           'zone',
  motion_absent:            'zone',
  camera_offline:           'cam',
};

export interface ScenarioParams {
  count?: number;        // person_count_at_least / zone_occupancy_at_least
  holdSec?: number;      // sustained-condition triggers / camera_offline
  dwellSec?: number;     // person_dwell_in_zone
  direction?: 'any' | 'left' | 'right' | 'above' | 'below'; // line_crossing
  motionThreshold?: number; // motion_present / motion_absent (px, ~1.0 separates)
  attribute?: string;    // attribute_person_present (PAR attribute name)
  attrThreshold?: number;   // PAR score threshold, default 0.5
  personIds?: string[];  // known_person_arrived: restrict to these ids ([] = any)
}

export type ScenarioSeverity = 'info' | 'warning' | 'critical';

export interface Scenario {
  _id?: string;
  name: string;
  enabled: boolean;
  camId: string;
  zoneId?: string;       // when TRIGGER_SOURCE is 'zone'
  lineId?: string;       // when TRIGGER_SOURCE is 'line'
  trigger: ScenarioTrigger;
  params: ScenarioParams;
  cooldownSec: number;   // min seconds between triggers (per track where applicable)
  severity: ScenarioSeverity;
  createdAt: Date;
  lastTriggeredAt?: Date;
  triggerCount?: number;
}

// ── Triggered situations (the log) ───────────────────────────────────────────
export interface ScenarioEvent {
  _id?: string;
  scenarioId: string;
  scenarioName: string;
  trigger: ScenarioTrigger;
  severity: ScenarioSeverity;
  camId: string;
  message: string;                    // human-readable, ready for the UI
  details: { [k: string]: any };      // raw values at trigger time
  triggeredAt: Date;
  seen: boolean;
}

export const ScenariosCollection      = new Mongo.Collection<Scenario>('scenarios');
export const ScenarioEventsCollection = new Mongo.Collection<ScenarioEvent>('scenario_events');
