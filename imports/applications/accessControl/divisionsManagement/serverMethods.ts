import { Division, DivisionsCollection } from '/imports/api/divisions';
import { VisitsSummaryCollection } from '/imports/api/visitSummary';
import { AlertLists } from '/imports/api/alertLists';
import { GatesCollection } from '/imports/api/gates';
import { Meteor } from 'meteor/meteor';
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any
type ExportField = 'firstName' | 'lastName' | 'divisionName' | 'cardNumbers' | 'alertListName' | 'allowedGates';

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
        },

        exportPersons: async function(filter: Record<string, any>, fields: ExportField[]) {
            if (!this.userId) throw new Meteor.Error('not-authorized', 'Must be logged in');
            this.unblock();

            const [persons, divisions, alertLists, gates] = await Promise.all([
                VisitsSummaryCollection.find(filter, { fields: { idInfo: 1 } }).fetchAsync(),
                DivisionsCollection.find({}).fetchAsync(),
                AlertLists.find({}).fetchAsync(),
                GatesCollection.find({}).fetchAsync(),
            ]);

            const divMap = new Map(divisions.map(d => [d._id ?? '', d.name]));
            const alertMap = new Map(alertLists.map(a => [a._id ?? '', a.name]));
            const gateMap = new Map(gates.map(g => [g._id ?? '', g.name]));

            return persons.map(p => {
                const row: Record<string, string> = {};
                for (const field of fields) {
                    switch (field) {
                        case 'firstName':
                            row.firstName = p.idInfo?.firstName ?? '';
                            break;
                        case 'lastName':
                            row.lastName = p.idInfo?.lastName ?? '';
                            break;
                        case 'divisionName':
                            row.divisionName = divMap.get(p.idInfo?.divission ?? '') ?? p.idInfo?.divission ?? '';
                            break;
                        case 'cardNumbers':
                            row.cardNumbers = (p.idInfo?.accessCard ?? []).join(', ');
                            break;
                        case 'alertListName':
                            row.alertListName = alertMap.get(p.idInfo?.alertList ?? '') ?? p.idInfo?.alertList ?? '';
                            break;
                        case 'allowedGates':
                            row.allowedGates = (p.idInfo?.allowedGates ?? [])
                                .map(id => gateMap.get(id) ?? id)
                                .join(', ');
                            break;
                    }
                }
                return row;
            });
        },
}


export default DivisionMethods;