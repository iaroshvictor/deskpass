import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

export interface Role {
  _id?:string;
  userId:string;
  role:string;
}

export const RolesCollection = new Mongo.Collection<Role>('roles');

/**
 * Throws `not-authorized` unless the given userId has the 'admin' role.
 * Call this at the top of any Meteor method that should be admin-only.
 */
export async function requireAdmin(userId: string | null): Promise<void> {
  if (!userId) {
    throw new Meteor.Error('not-authorized', 'You must be logged in.');
  }
  const role = await RolesCollection.findOneAsync({ userId, role: 'admin' });
  if (!role) {
    throw new Meteor.Error('not-authorized', 'Admin role required.');
  }
}