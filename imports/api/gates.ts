import { Mongo } from 'meteor/mongo';

type cmpsaction = 'report' | 'unlock'

export interface Interface {
    cam:string;
    action: 'entrance' | 'exit';
    lockSettings?:{
        enabled: boolean;
        reader_id:string;
        reader_node:number;
        reader_lda:number;
        tfa: boolean;
        singlePerson: boolean;
        unknownPerson: boolean;
        controller?: string;
    }
    reportingSettings?:{
        enabled: boolean;
        intruderAlert: boolean;
        intruderLine?: string;
        intruderSide?: string;
        spoofAlert: boolean;
        alertCallBack: number;
    }
    cmpsaction : cmpsaction[];
}
export interface Gate {
    _id?: string;
    name: string;
    zone: string;
    interfaces: Interface[];
    apacsId?: string;
}

export const GatesCollection = new Mongo.Collection<Gate>('gates');
