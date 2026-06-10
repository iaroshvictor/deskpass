import { Mongo } from 'meteor/mongo';

type BoundingBox={
    left: number;
    top: number;
    width: number;
    height: number;
}
export type IdInfo={
    firstName:string;
    lastName:string;
    comment:string;
    alertList:string;
    alertpause:number;
    alertThreshold:number;
    cA:boolean;
    divission:string;
    accessCard:string[];
    allowedGates:string[];
    syncId:string | undefined;
    bypassFace:boolean;
}
export interface VisitSummary {
    _id: string
    face_b64: string
    person_b64: string
    face_model: number[]
    timestamp: Date
    face_box: BoundingBox
    person_box: BoundingBox
    source: string,
    faces?:number,
    idInfo?: IdInfo,
    par?: Record<string, number | string>,
}
export interface SummaryMeta {
    _id:string,
    idInfo: IdInfo
}
export const VisitSummaryMetaCollection = new Mongo.Collection<SummaryMeta>('visitSummaryMeta');
export const VisitsSummaryCollection = new Mongo.Collection<VisitSummary>('visitsSummary');