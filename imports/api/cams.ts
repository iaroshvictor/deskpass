import { Mongo } from 'meteor/mongo';

export interface CamLine {
  lineId: string;          // references CamLineDefsCollection._id
  label: string;           // denormalized label
  orientation: 'v' | 'h'; // 'v' = vertical, classifies persons left/right
                           // 'h' = horizontal, classifies persons above/below
  top?: number;            // x at top edge (y=0), used when orientation='v'
  bottom?: number;         // x at bottom edge (y=1), used when orientation='v'
  left?: number;           // y at left edge (x=0), used when orientation='h'
  right?: number;          // y at right edge (x=1), used when orientation='h'
  lineColor: string;       // hex color e.g. '#FF4444'
}

export interface CamOverlayZone {
  zoneId: string;              // references CamZoneDefsCollection._id
  label: string;               // denormalized label
  points: [number, number][];  // polygon vertices, normalized [x, y], min 3
  borderColor: string;         // hex color e.g. '#44AAFF'
  zoneMarking: boolean;        // true = draw 10% opacity fill inside polygon
}

export interface Cam {
  _id?: string;
  name: string;
  streamurl: string;
  faceAlert: boolean;
  accessControl: boolean;
  zone: string;
  disableSpoofFilter: boolean;
  snapshot: string;
  lines: CamLine[];
  overlayZones: CamOverlayZone[];
  captionKeywords?: string[];   // VLM caption watch-words (fall, fight, gun, ...)
}

export const CamsCollection = new Mongo.Collection<Cam>('cams');
