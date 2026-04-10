import { Mongo } from 'meteor/mongo';

export interface Zone {
  _id?: string;
  name: string;
  parent:string;
}

export const ZonesCollection = new Mongo.Collection<Zone>('zones');
