import { Mongo } from 'meteor/mongo';

export interface OperatorMeta {
    _id:string;
    username:string;
}

export const UsersMetaCollection = new Mongo.Collection<OperatorMeta>('usersMeta');