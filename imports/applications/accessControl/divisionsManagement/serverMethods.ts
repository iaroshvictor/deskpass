import { Division, DivisionsCollection } from '/imports/api/divisions';
import { Meteor } from 'meteor/meteor';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const DivisionMethods : {[x:string]:MeteorMethod} = {
    insertDivision: async function(Division:Division){
            console.log('insertDivision called with:', Division, 7);
            if (!this.userId) {
                throw new Meteor.Error('not-authorized', 'You must be logged in to insert a Division.');
            }
            if (!Division || !Division.name || !Division.parent) {
                throw new Meteor.Error('invalid-Division', 'Division must have a name, parent.');
            }
            return DivisionsCollection.insertAsync(Division);
        },
        updateDivision: async function(DivisionId: string, Division: Partial<Division>) {
            if (!this.userId) {
                throw new Meteor.Error('not-authorized', 'You must be logged in to update a Division.');
            }
            if (!DivisionId || !Division || !Division.name ){
                throw new Meteor.Error('invalid-Division', 'Division must have a valid ID, name, parent.');
            }
            return DivisionsCollection.updateAsync(DivisionId, { $set: Division });
        },
        removeDivision: async function(DivisionId: string) {
            if (!this.userId) {
                throw new Meteor.Error('not-authorized', 'You must be logged in to remove a Division.');
            }
            if (!DivisionId) {
                throw new Meteor.Error('invalid-Division-id', 'Division ID must be provided.');
            }
            // Recursively chnage parent of child to this parent all child divisions
            const division = await DivisionsCollection.findOneAsync(DivisionId);
            if (!division) {
                throw new Meteor.Error('Division-not-found', 'Division not found.');
            }
            await DivisionsCollection.updateAsync({ parent: DivisionId }, { $set: { parent: division.parent } }, { multi: true });
            //ToDo: update all Visit Summary Items divisionId
            return DivisionsCollection.removeAsync(DivisionId);
        }
}


export default DivisionMethods;