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
    par?: number[]
    head_color?: string
    upper_color?: string
    lower_color?: string
}
export const VisitsCollection = new Mongo.Collection<Visit>('visits');