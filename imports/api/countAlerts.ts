
import { Mongo } from 'meteor/mongo';

export interface CountAlert{
    _id?:string,
    timestamp:Date,
    count:number,
    level:"warning"|"danger",
    allowed:number,
    seen:boolean,
    seenBy:string,
    seenAt:Date | null,
    source:string
}

export const CountAlertsCollection= new Mongo.Collection<CountAlert>('countAlerts');