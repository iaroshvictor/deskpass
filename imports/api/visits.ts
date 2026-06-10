import { Mongo } from 'meteor/mongo';

type BoundingBox={
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface Visit {
    _id?: string
    face_b64: string
    person_b64: string
    face_model: number[]
    tracking_id: string
    timestamp: Date
    face_box: BoundingBox
    person_box: BoundingBox
    source: string
    reference: boolean
    idInfo?: string | number
    model_id?: string
    similarity?: number
    lines?: Record<string, string>
    zones?: Record<string, string>
    // PAR & appearance attributes from new pipeline
    // dict keyed by attribute name (26 numeric scores) + optional head/upper/lower_color strings
    par?: Record<string, number | string>
}
export const VisitsCollection = new Mongo.Collection<Visit>('visits');