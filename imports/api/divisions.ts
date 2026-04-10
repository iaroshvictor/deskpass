import { Mongo } from 'meteor/mongo';

export interface Division {
  _id?: string;
  name: string;
  parent:string;
}

export const DivisionsCollection = new Mongo.Collection<Division>('divisions');
