import {Meteor} from 'meteor/meteor';
import { AlertsArchiveCollection } from '/imports/api/alertsArchive';
import {Visit, VisitsCollection} from '/imports/api/visits'
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
const alertsArchiveMethods : {[x:string]:MeteorMethod} = {
    setSeenAlert(alertId){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set an alert as seen.');
        }
        if (!alertId) {
            throw new Meteor.Error('invalid-id', 'Alert ID must be provided.');
        }
        return AlertsArchiveCollection.updateAsync(alertId, { $set: { seen: true, seenBy: this.userId, seenAt:new Date() } });
    },
    setAllAlertsSeen(){
        this.unblock()
       if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to set an alert as seen.');
        } 
        return AlertsArchiveCollection.updateAsync({seen:false}, { $set: { seen: true, seenBy: this.userId, seenAt:new Date() } },{ multi: true });
    },
    addFaceToSummary:async function (alertId){
        if (!this.userId) throw new Meteor.Error('not-authorized', 'You must be logged in.');
        const myAlert = await AlertsArchiveCollection.findOneAsync({_id:alertId})
        if(myAlert){
            const { _id, seen, seenBy, seenAt, listId, attached, ...alertFields } = myAlert;
            const visitItem = {...alertFields, reference:true, tracking_id: myAlert.idInfo} as Visit
            await VisitsCollection.insertAsync(visitItem);
            await AlertsArchiveCollection.updateAsync(alertId, {
                $set: { seen: true, seenBy: this.userId, seenAt: new Date(), attached: true }
            });
        }
    }
}
export default alertsArchiveMethods