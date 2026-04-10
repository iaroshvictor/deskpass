// countAccessReport

import { Meteor } from 'meteor/meteor';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
import { AccessReportCollection } from '/imports/api/accessReport';


const AttendanceMethods : {[x:string]:MeteorMethod} = {
    countAccessReport: function (filter) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to count access reports.');
        }
        return AccessReportCollection.find(filter).countAsync();
    }
}
export default AttendanceMethods;