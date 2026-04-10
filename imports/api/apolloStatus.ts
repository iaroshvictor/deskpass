import { Mongo } from 'meteor/mongo';

export type ApolloStatusType = 'connected' | 'offline' | 'auth_error' | 'connecting' | 'not_configured';

export interface ApolloStatus {
    _id?: string;
    status: ApolloStatusType;
    message?: string;
    lastUpdated: Date;
}

// Collection to receive Apollo status from server publication
// Note: This collection has no MongoDB backing on the server - it's populated via publish/subscribe
export const ApolloStatusCollection = new Mongo.Collection<ApolloStatus>('apolloStatus');

