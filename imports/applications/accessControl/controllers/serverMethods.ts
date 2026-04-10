import { Controller, ControllersCollection } from "/imports/api/controllers"
import { Meteor } from 'meteor/meteor';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any

const ControllerMethods : {[x:string]:MeteorMethod} = {
    addController:async function(data:Controller){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to add a controller.');
        }
        if(!data.name || !data.manufacturer || !data.address){
            throw new Meteor.Error('invalid-data', 'Name, Manufacturer and Address are required');
        }
        return await ControllersCollection.insertAsync(data);
    },
    editController:async function(id:string, data:Controller){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to add a controller.');
        }
        if(!id || !data.name || !data.manufacturer || !data.address){
            throw new Meteor.Error('invalid-data', 'ID, Name, Manufacturer and Address are required');
        }
        return await ControllersCollection.updateAsync({_id:id}, {$set: data});
    },
    removeController:async function(id:string){
        if (!this.userId) {
            throw new Meteor.Error('not-authorized', 'You must be logged in to add a controller.');
        }
        if(!id){
            throw new Meteor.Error('invalid-id', 'ID is required');
        }
        return await ControllersCollection.removeAsync(id);
    }
}

export default ControllerMethods