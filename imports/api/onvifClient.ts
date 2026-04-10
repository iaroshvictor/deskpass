import { Mongo } from 'meteor/mongo';

export interface OnvifDevice {
  _id?:string;
  urn:string;
  name:string;
  hardware:string;
  types:string[];
  xaddrs:string[];
  scopes:string[];
}

export const OnvifDeviceCollection = new Mongo.Collection<OnvifDevice>('onvifdevices');