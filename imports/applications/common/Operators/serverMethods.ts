import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { RolesCollection } from '/imports/api/roles';

type MeteorMethod = (this: Meteor.MethodThisType, ...args: any[]) => any;

const Methods: { [x: string]: MeteorMethod } = {
    'operators.insert': async function(data: { username: string; password: string; roleId?: string }) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        const { username, password, roleId } = data;
        const userId = await Accounts.createUser({ username, password }) as string;
        if (roleId === 'admin') {
            await RolesCollection.insertAsync({ userId, role: 'admin' });
        } else if (roleId) {
            await RolesCollection.insertAsync({ userId, role: 'custom', roleId });
        }
    },
    'operators.update': async function(id: string, data: { username: string; password: string; roleId?: string }) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        const { username, password, roleId } = data;
        try {
            await Meteor.users.updateAsync(id, { $set: { username } });
            if (password) {
                if (Meteor.isServer) Accounts.setPassword(id, password);
            }
            if (roleId) {
                const newRoleDoc = roleId === 'admin'
                    ? { userId: id, role: 'admin' as const }
                    : { userId: id, role: 'custom' as const, roleId };
                const existing = await RolesCollection.findOneAsync({ userId: id });
                if (existing) {
                    await RolesCollection.updateAsync({ userId: id }, { $set: newRoleDoc });
                } else {
                    await RolesCollection.insertAsync(newRoleDoc);
                }
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    },
    'operators.remove': async function(id: string) {
        if (!this.userId) throw new Meteor.Error('not-authorized');
        const myRole = await RolesCollection.findOneAsync({ userId: this.userId });
        if (myRole?.role !== 'admin') throw new Meteor.Error('not-authorized');
        await Meteor.users.removeAsync(id);
        await RolesCollection.removeAsync({ userId: id });
    },
};

export default Methods;
