import { Mongo } from 'meteor/mongo';

// Line-crossing event from the perception engine (published on redis channel 'cam_events').
export interface CamEvent {
  _id?: string;
  source: string;                       // cam id / stream id
  tid: number;                          // tracker id of the person
  line: string;                         // lineId that was crossed
  to: 'left' | 'right' | 'above' | 'below'; // destination side
  timestamp: Date;
}

// Live per-cam status, upserted at ~1 Hz from the cam_events heartbeat.
export interface CamLiveStatus {
  _id?: string;                         // cam id / stream id
  fps: number;
  persons: number;
  faces: number;
  lineCounts?: { [lineId: string]: { [dir: string]: number } }; // cumulative crossings
  zoneCounts?: { [zoneId: string]: number };                    // current occupancy
  zoneMotion?: { [zoneId: string]: number };                    // mean motion px
  updatedAt: Date;
}

export const CamEventsCollection     = new Mongo.Collection<CamEvent>('cam_events');
export const CamLiveStatusCollection = new Mongo.Collection<CamLiveStatus>('cam_live_status');
