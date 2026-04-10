import { Mongo } from 'meteor/mongo';

type BoundingBox={
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface IntruderVisit {
    _id?: string
    face_b64: string
    person_b64: string
    face_model: number[]
    tracking_id: string
    timestamp: Date
    face_box: BoundingBox
    person_box: BoundingBox
    source: string
    seen: boolean
    seenBy: string | null
    seenAt: Date | null
    lines?: Record<string, string>
    zones?: Record<string, string>
    triggerLine?: string
    triggerSide?: string
}
export const IntruderAlertsCollection = new Mongo.Collection<IntruderVisit>('intruderalerts');