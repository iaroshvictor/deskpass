import {Visit} from './visits';
import { Mongo } from 'meteor/mongo';

export interface AlertItem extends Visit {
    seen:boolean,
    seenBy:string,
    seenAt:Date | null,
    listId:string,
}

export const AlertsArchiveCollection = new Mongo.Collection<AlertItem>('alertsArchive');