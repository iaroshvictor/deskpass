/**
 * Meteor-facing authorisation helpers.
 *
 * The decision itself lives in accessPolicy.ts as a pure function; this module
 * only loads the caller's role from the database and turns a denial into a
 * Meteor.Error. Keep it server-side: it reads the roles collections.
 */
import { Meteor } from 'meteor/meteor';
import { RolesCollection, RoleDefinitionsCollection } from '/imports/api/roles';
import { canAccess, type Caller, type Permission } from './accessPolicy';

/** Shape shared by method and publication contexts. */
interface SessionContext {
  userId: string | null;
}

/**
 * Assert that a session exists.
 *
 * Use at the top of every method that touches data. Publications should
 * instead return `this.ready()` so the client sees an empty, finished
 * subscription rather than a hanging one.
 */
export function requireUser(context: SessionContext): string {
  if (!context?.userId) {
    throw new Meteor.Error('not-authorized', 'You must be signed in.');
  }
  return context.userId;
}

/** Load the caller's role and the capabilities their role definition grants. */
export async function loadCaller(userId: string | null): Promise<Caller> {
  if (!userId) return { userId: null, role: null, permissions: [] };

  const role = await RolesCollection.findOneAsync({ userId });
  if (!role) return { userId, role: null, permissions: [] };
  if (role.role === 'admin') return { userId, role: 'admin', permissions: [] };

  const definition = role.roleId
    ? await RoleDefinitionsCollection.findOneAsync({ _id: role.roleId })
    : undefined;

  return { userId, role: role.role, permissions: definition?.permissions ?? [] };
}

/**
 * Assert that the caller holds a capability.
 *
 * Fails closed: no session, no role record or a role without the capability
 * all raise. Admins pass unconditionally.
 */
export async function requirePermission(
  context: SessionContext,
  permission: Permission,
): Promise<string> {
  const userId = requireUser(context);
  const verdict = canAccess(await loadCaller(userId), permission);
  if (!verdict.allowed) {
    throw new Meteor.Error(
      verdict.reason ?? 'forbidden',
      `This action requires the "${permission}" permission.`,
    );
  }
  return userId;
}

/** True when the caller is an administrator. */
export async function isAdmin(userId: string | null): Promise<boolean> {
  return (await loadCaller(userId)).role === 'admin';
}
