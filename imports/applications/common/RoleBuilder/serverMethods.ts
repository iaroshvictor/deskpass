import { Meteor } from 'meteor/meteor';
import { RoleDefinitionsCollection, RolesCollection } from '/imports/api/roles';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

const Methods: { [x: string]: MeteorMethod } = {
    'roleDefinitions.insert': async function(data: { name: string; permissions: string[] }) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        const { name, permissions } = data;
        return await RoleDefinitionsCollection.insertAsync({ name, permissions, createdAt: new Date() });
    },
    'roleDefinitions.update': async function(id: string, data: { name: string; permissions: string[] }) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        const { name, permissions } = data;
        return await RoleDefinitionsCollection.updateAsync(id, { $set: { name, permissions } });
    },
    'roleDefinitions.remove': async function(id: string) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        return await RoleDefinitionsCollection.removeAsync(id);
    },
};

export default Methods;
