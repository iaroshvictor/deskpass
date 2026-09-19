import { Mongo } from 'meteor/mongo';

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

// A requireAdmin helper used to live here, which put a server-side role
// lookup into a module the client imports for its collections. It had no
// callers. The authorisation helpers in imports/security/guards.ts replace
// it and stay on the server.