// setSeenIntruder
import { Meteor } from 'meteor/meteor';
import { IntruderAlertsCollection } from "/imports/api/intruderAlerts";
import { Visit, VisitsCollection } from '/imports/api/visits';
import { VisitsSummaryCollection } from '/imports/api/visitSummary';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
const IntruderMethods: { [x: string]: MeteorMethod } = {
    setSeenIntruder: async function (intruderId: string) {
        this.unblock();
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set an intruder as seen.');
        }
        if (!intruderId) {
            throw new Meteor.Error('invalid-intruder-id', 'Intruder ID must be provided.');
        }
        const updateResult = await IntruderAlertsCollection.updateAsync(intruderId, {
            $set: { seen: true, seenBy: this.userId, seenAt: new Date() }
        });
        return updateResult;
    },
    seenAllIntruders(){
        this.unblock();
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set all intruders as seen.');
        }
        IntruderAlertsCollection.updateAsync(
            { seen: false },
            { $set: { seen: true, seenBy: this.userId, seenAt: new Date() } },
            { multi: true }
        );
        return true
    },
    countIntruder(filter){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to count intruders.');
        }
        if (!filter || typeof filter !== 'object') {
            throw new Meteor.Error('invalid-filter', 'Filter must be an object.');
        }
        return IntruderAlertsCollection.find(filter).countAsync();
    },
    findBestMatch: async function (intruderId:string) {
        const myModel = await IntruderAlertsCollection.findOneAsync(intruderId);
        if (!myModel) {
            throw new Meteor.Error('not-found', 'Intruder not found');
        }
        const model_item = myModel.face_model;
        if (!model_item || model_item.length === 0) return null;
        const otherModels = await VisitsCollection.find({reference: true}).fetchAsync();
        function cosineSimilarity(a: number[], b: number[]): number {
            if (a.length !== b.length) return -1;
            let dot = 0;
            for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
            return dot;
        }
        const candidates = otherModels
            .filter(item => item.face_model?.length === model_item.length)
            .map(item => ({ item, dist: cosineSimilarity(model_item, item.face_model) }))
            .sort((a, b) => b.dist - a.dist);

        if (candidates.length === 0) return null;
        const summaryItem = await VisitsSummaryCollection.findOneAsync({ _id: candidates[0].item.tracking_id });
        if (summaryItem) {
            return { item: summaryItem, dist: candidates[0].dist };
        }
        return null;
    },
    reposessIntruder: async function (personId: string, intruderId: string | undefined) {
        this.unblock();
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to repossess an intruder.');
        }
        if (!personId || !intruderId) {
            throw new Meteor.Error('invalid-ids', 'Person ID and Intruder ID must be provided.');
        }
        // Find the intruder alert
        const intruderAlert = await IntruderAlertsCollection.findOneAsync(intruderId);
        if (!intruderAlert) {
            throw new Meteor.Error('not-found', 'Intruder alert not found');
        }
        // Reject degenerate face embeddings (near-zero/constant vector = bad crop).
        // Valid L2-normalized ArcFace embeddings have component std ≈ sqrt(1/512) ≈ 0.044;
        // only truly degenerate embeddings (all-zero, near-constant) fall below 0.010.
        if (intruderAlert.face_model?.length === 512) {
            const mean = intruderAlert.face_model.reduce((a: number, b: number) => a + b, 0) / 512;
            const std = Math.sqrt(intruderAlert.face_model.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / 512);
            if (std <= 0.010) {
                throw new Meteor.Error('bad-model', 'Face embedding quality too low — the face crop was blurry or misaligned. Ask the person to stand closer and face the camera directly, then try again.');
            }
        }
        // Strip intruder-only fields and insert as a reference visit
        const { seen, seenBy, seenAt, triggerLine, triggerSide, ...visitFields } = intruderAlert;
        const visitItem: Visit = { ...visitFields, reference: true, tracking_id: personId };
        await VisitsCollection.insertAsync(visitItem);
        await IntruderAlertsCollection.removeAsync(intruderId);
    }
}
export default IntruderMethods;