import { Meteor } from 'meteor/meteor';
import { Gate, GatesCollection } from "/imports/api/gates";
type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const GateMethods : {[x:string]:MeteorMethod} = {
    insertGate: async function(gate:Gate){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to insert a gate.');
        }
        if (!gate || !gate.name || !gate.zone || !gate.interfaces || gate.interfaces.length === 0) {
            throw new Meteor.Error('invalid-gate', 'Gate must have a name, zone, and at least one interface.');
        }
        return GatesCollection.insertAsync(gate);
    },
    updateGate: async function(gateId: string, gate: Gate) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to update a gate.');
        }
        if (!gateId || !gate || !gate.name || !gate.zone || !gate.interfaces || gate.interfaces.length === 0) {
            throw new Meteor.Error('invalid-gate', 'Gate must have a valid ID, name, zone, and at least one interface.');
        }
        return GatesCollection.updateAsync(gateId, { $set: gate });
    },
    removeGate: async function(gateId: string) {
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to remove a gate.');
        }
        if (!gateId) {
            throw new Meteor.Error('invalid-gate-id', 'Gate ID must be provided.');
        }
        return GatesCollection.removeAsync(gateId);
    }
}

export default GateMethods;