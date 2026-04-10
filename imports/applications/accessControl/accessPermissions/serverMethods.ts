import { Meteor } from 'meteor/meteor';
import { VisitsSummaryCollection } from '/imports/api/visitSummary';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const AccessPermissionsMethods: { [x: string]: MeteorMethod } = {
    updatePersonAllowedGates: async function (personId: string, allowedGates: string[]) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to update permissions.');
        }
        if (!personId) {
            throw new Meteor.Error('invalid-person', 'Person ID is required.');
        }
        
        const person = await VisitsSummaryCollection.findOneAsync({ _id: personId });
        if (!person) {
            throw new Meteor.Error('person-not-found', 'Person not found.');
        }

        // Update the person's allowed gates
        return await VisitsSummaryCollection.updateAsync(
            { _id: personId },
            {
                $set: {
                    'idInfo.allowedGates': allowedGates
                }
            }
        );
    }
};

export default AccessPermissionsMethods;

