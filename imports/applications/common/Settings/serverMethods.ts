import { Meteor } from 'meteor/meteor';
import { DVRConfig, SettingsCollection } from '/imports/api/settings';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
const Methods : {[x:string]:MeteorMethod} = {
    async setDvrConfig(config: DVRConfig) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        await SettingsCollection.removeAsync({ type: 'dvr' });
        await SettingsCollection.insertAsync({ type: 'dvr', config });
    },
}
export default Methods;