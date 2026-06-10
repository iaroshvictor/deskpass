import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';

export interface RoleDefinition {
  _id?: string;
  name: string;
  permissions: string[]; // app names the role can access
  createdAt: Date;
}

export interface Role {
  _id?: string;
  userId: string;
  role: string;    // 'admin' | 'custom'
  roleId?: string; // references RoleDefinitionsCollection._id (undefined for admin)
}

export const RolesCollection = new Mongo.Collection<Role>('roles');
export const RoleDefinitionsCollection = new Mongo.Collection<RoleDefinition>('roleDefinitions');

export async function requireAdmin(userId: string | null): Promise<void> {
  if (!userId) throw new Meteor.Error('not-authorized', 'You must be logged in.');
  const role = await RolesCollection.findOneAsync({ userId, role: 'admin' });
  if (!role) throw new Meteor.Error('not-authorized', 'Admin role required.');
}