import { Mongo } from 'meteor/mongo';

export interface CamLineDef {
  _id?: string;
  label: string;
}

export const CamLineDefsCollection = new Mongo.Collection<CamLineDef>('cam_line_defs');
