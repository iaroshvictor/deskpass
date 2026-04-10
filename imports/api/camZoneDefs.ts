import { Mongo } from 'meteor/mongo';

export interface CamZoneDef {
  _id?: string;
  label: string;
}

export const CamZoneDefsCollection = new Mongo.Collection<CamZoneDef>('cam_zone_defs');
