import { Mongo } from 'meteor/mongo';

export interface AlertList {
  _id?: string;
  name: string;
  color: string;
}

export const AlertLists = new Mongo.Collection<AlertList>('alertlists');
