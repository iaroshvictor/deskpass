import { Mongo } from 'meteor/mongo';
export interface AccessReport {
    _id?: string
    face_b64: string
    face_model: number[]
    tracking_id: string
    timestamp: Date
    source: string
    reference:boolean
    idInfo:string,
    type: 'entrance' | 'exit';
    similarity?: number;
    model_id: string;
}
export const AccessReportCollection = new Mongo.Collection<AccessReport>('accessReports');