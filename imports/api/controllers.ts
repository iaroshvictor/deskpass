import { Mongo } from 'meteor/mongo';

export interface Controller {
  _id?: string;
  name: string;
  manufacturer: string;
  address: string;
}

export const ControllersCollection = new Mongo.Collection<Controller>('controllers');
