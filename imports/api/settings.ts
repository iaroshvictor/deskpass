import { Mongo } from 'meteor/mongo';

export type APIConfig = {
    url:string;
    username:string;
    password:string;
}
export interface Settings {
    _id?: string;
    type:string;
    config:string | APIConfig;
}

export const SettingsCollection = new Mongo.Collection<Settings>('settings');