import {Meteor} from 'meteor/meteor';
import { AlertList, AlertLists } from '/imports/api/alertLists';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
const personListsMethods : {[x:string]:MeteorMethod} = {
    addAlertList:async function(item:AlertList): Promise<string> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to add a person list.');
        }
        if (!item.name || !item.color) {
            throw new Meteor.Error('invalid-item', 'Name and color are required.');
        }
        return AlertLists.insertAsync(item);
    },
    editAlertList:async function(item:AlertList): Promise<void> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to edit a person list.');
        }
        if (!item._id || !item.name || !item.color) {
            throw new Meteor.Error('invalid-item', 'ID, name and color are required.');
        }
        await AlertLists.updateAsync(item._id, { $set: item });
    },
    deleteAlertList:async function(id:string): Promise<void> {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to delete a person list.');
        }
        if (!id) {
            throw new Meteor.Error('invalid-id', 'ID must be provided.');
        }
        await AlertLists.removeAsync(id);
    }
}
export default personListsMethods;