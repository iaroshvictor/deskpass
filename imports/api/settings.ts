import { Mongo } from 'meteor/mongo';

export type APIConfig = {
    url:string;
    username:string;
    password:string;
}

export type DVRConfig = {
    enabled: boolean;
    storagePath: string;
    streamSource: 'original' | 'ai';
    camFallback: boolean;
    retentionDays: number;
    maxStorageGB: number;
}

export const DVR_DEFAULTS: DVRConfig = {
    enabled: false,
    storagePath: '/var/recordings',
    streamSource: 'original',
    camFallback: true,
    retentionDays: 30,
    maxStorageGB: 100,
}

export interface Settings {
    _id?: string;
    type:string;
    config:string | APIConfig | DVRConfig;
}

export const SettingsCollection = new Mongo.Collection<Settings>('settings');