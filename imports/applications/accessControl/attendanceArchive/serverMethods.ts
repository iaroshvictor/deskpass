// countAccessReport

import { Meteor } from 'meteor/meteor';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
import { AccessReportCollection } from '/imports/api/accessReport';
import { checkedFilter } from '/imports/security/checkedFilter';
import { ACCESS_REPORT_FILTER } from '/imports/security/filterSpecs';


const AttendanceMethods : {[x:string]:MeteorMethod} = {
    countAccessReport: function (filter) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to count access reports.');
        }
        return AccessReportCollection.find(checkedFilter(filter, ACCESS_REPORT_FILTER)).countAsync();
    }
}
export default AttendanceMethods;