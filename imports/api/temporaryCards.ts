import { Mongo } from 'meteor/mongo';

export interface TemporaryCard {
    _id?: string;
    personId: string;
    cardNumber: string;
    status: 'attached' | 'removed';
    attachedAt: Date;
    removedAt?: Date;
    attachedBy: string;
}

export const TemporaryCardsCollection = new Mongo.Collection<TemporaryCard>('temporaryCards');

