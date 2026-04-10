import { Meteor } from 'meteor/meteor';
import { VisitsCollection, Visit } from '/imports/api/visits';
import { VisitsSummaryCollection, VisitSummary } from '/imports/api/visitSummary';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const personMethods : {[x:string]:MeteorMethod} = {
    countVisits :async function(filter:{cam?:string, timestamp?:{ $gte?: Date, $lte?: Date }} = {}): Promise<number> {
        return await VisitsSummaryCollection.find(filter).countAsync();
    },
    removeVisit: async function(visitId: string): Promise<void> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to remove a visit.');
        }
        if (!visitId) {
            throw new Meteor.Error('invalid-visit-id', 'Visit ID must be provided.');
        }
        // Remove the visit from the VisitsCollection
        await VisitsCollection.removeAsync({tracking_id: visitId});
        // Remove the visit from the VisitsSummaryCollection
        await VisitsSummaryCollection.removeAsync(visitId);
    },
    removeVisitItems: async function(items:string[]) : Promise<void> {
         if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to remove a visit.');
        }
        if (items.length === 0) {
            throw new Meteor.Error('invalid-visit-id', 'No faces provided.');
        }
        await VisitsCollection.removeAsync({ _id: { $in: items } });
    },
    mergeVisits:async function(items:string[]) : Promise<void> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to merge visits.');
        }
        if (!items || items.length < 2) {
            throw new Meteor.Error('invalid-items', 'At least two visit IDs must be provided for merging.');
        }
        
        // Fetch the visits to be merged
        await VisitsCollection.updateAsync({ tracking_id: { $in: items } }, 
            { $set: { tracking_id: items[0] } }, 
            { multi: true }
        );
        // Remove the other visits from the VisitsSummaryCollection
        await VisitsSummaryCollection.removeAsync({ _id: { $in: items.slice(1) } });
        //Update the first visit to trigger onchanged in publication
        const existingItem = await VisitsSummaryCollection.findOneAsync({_id: items[0] });
        if( existingItem) 
        await VisitsSummaryCollection.updateAsync({_id: items[0] },
            { $set: { timestamp: new Date(existingItem.timestamp.getTime()+1)}}
        );
    
    },
    async reposessModels(personId:string, items:string[]) : Promise<number> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to reposess models.');
        }
        if (!personId || !items || items.length === 0) {
            throw new Meteor.Error('invalid-arguments', 'Person ID and at least one visit ID must be provided.');
        }
        // Update the visits to set the personId
       await VisitsCollection.updateAsync(
            { _id: { $in: items } },
            { $set: { reference:true, tracking_id:personId } },
            { multi: true }
        );
        // Check if the visitsummary has a profile photo, is not attach the first from visits
        const summary = await VisitsSummaryCollection.findOneAsync({_id: personId });
        if(!summary?.face_b64){
            const visit = await VisitsCollection.findOneAsync({tracking_id: personId});
            if(visit?.face_b64){
                await VisitsSummaryCollection.updateAsync({_id: personId }, {$set: {face_b64: visit.face_b64}});
            }
        };
        return items.length;
    },
    optimizeVisits: async function(trackingId:string, coef=0.85){
        this.unblock();
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to optimize visits.');
        }
        if (!trackingId) {
            throw new Meteor.Error('invalid-tracking-id', 'Tracking ID must be provided.');
        }
        // Remove all visits with the specified tracking ID
        const visits = await VisitsCollection.find({ tracking_id: trackingId }).fetchAsync()
        function cosineSimilarity(a: number[], b: number[]): number {
            if (a.length !== b.length) return -1;
            let dot = 0;
            for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
            return dot;
        }

        function filterEmbeddings(items: Visit[], threshold: number): Visit[] {
            const result: Visit[] = [];
            for (const item of items) {
                if (!item.face_model?.length) continue;
                let tooSimilar = false;
                for (const kept of result) {
                    if (cosineSimilarity(item.face_model, kept.face_model) >= threshold) {
                        tooSimilar = true;
                        break;
                    }
                }
                if (!tooSimilar) result.push(item);
            }
            return result;
        }
        const tostore = filterEmbeddings(visits, coef);
        await VisitsCollection.removeAsync({ tracking_id: trackingId, _id: { $nin: tostore.map(v => v._id) } });
        //Update the first visit to trigger onchanged in publication
        const existingItem = await VisitsSummaryCollection.findOneAsync({_id: trackingId });
        if( existingItem) 
        await VisitsSummaryCollection.updateAsync({_id:trackingId},
            { $set: { timestamp: new Date(existingItem.timestamp.getTime()+1)}}
        );
        
    },
    setSummaryPhoto: async function (visitSummaryId: string, photo: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set summary photo.');
        }
        if (!visitSummaryId || !photo) {
            throw new Meteor.Error('invalid-arguments', 'Visit summary ID and photo must be provided.');
        }
        // Update the visit summary with the new photo
        await VisitsSummaryCollection.updateAsync(
            { _id: visitSummaryId },
            { $set: { face_b64: photo } }
        );
    },
    editVisitSummary: async function (trackingId: string, updateFields: Partial<VisitSummary>) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to update visit summary.');
        }
        if (!trackingId || !updateFields) {
            throw new Meteor.Error('invalid-arguments', 'Tracking ID and update fields must be provided.');
        }
        // Update the visit summary with the new fields
        await VisitsSummaryCollection.updateAsync(
            { _id: trackingId },
            { $set: updateFields }
        );
    },
    setRefereceModels: async function (items: string[]) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set reference models.');
        }
        if (!items || items.length === 0) {
            throw new Meteor.Error('invalid-items', 'At least one visit ID must be provided.');
        }
        // Set the reference models for the visits
        await VisitsCollection.updateAsync(
            { _id: { $in: items } },
            { $set: { reference: true } },
            { multi: true }
        );
    }
}

export default personMethods;