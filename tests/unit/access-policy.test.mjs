// Unit tests for the authorisation policy.
//
// Also written before the module exists. The policy is kept free of Meteor so
// it can be tested as a pure function: it takes who the caller is and what
// they want, and answers whether it is allowed. The Meteor-facing wrapper only
// looks up the role and throws Meteor.Error when this says no.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { canAccess, PERMISSIONS } from '../../imports/security/accessPolicy.ts';

const anonymous = { userId: null, role: null };
const operator = { userId: 'u1', role: 'custom', permissions: ['gates.view'] };
const admin = { userId: 'u2', role: 'admin' };

describe('canAccess', () => {
  test('anonymous callers are denied everything', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      const verdict = canAccess(anonymous, permission);
      assert.equal(verdict.allowed, false, `anonymous was allowed ${permission}`);
      assert.equal(verdict.reason, 'not-authorized');
    }
  });

  test('admins are allowed everything', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      assert.equal(canAccess(admin, permission).allowed, true, `admin was denied ${permission}`);
    }
  });

  test('an operator gets only the permissions granted to their role', () => {
    assert.equal(canAccess(operator, 'gates.view').allowed, true);
    assert.equal(canAccess(operator, PERMISSIONS.GATE_UNLOCK).allowed, false);
  });

  test('unlocking a gate is a distinct permission from being logged in', () => {
    // The current unlockGate only checks that a session exists.
    const loggedInButUnprivileged = { userId: 'u3', role: 'custom', permissions: [] };
    assert.equal(canAccess(loggedInButUnprivileged, PERMISSIONS.GATE_UNLOCK).allowed, false);
  });

  test('integration settings are admin-only', () => {
    const power = { userId: 'u4', role: 'custom', permissions: ['gates.view', 'cams.edit'] };
    assert.equal(canAccess(power, PERMISSIONS.INTEGRATION_CONFIGURE).allowed, false);
    assert.equal(canAccess(admin, PERMISSIONS.INTEGRATION_CONFIGURE).allowed, true);
  });

  test('an unknown permission is denied, not silently allowed', () => {
    assert.equal(canAccess(admin, 'made.up.permission').allowed, true); // admin bypass is explicit
    assert.equal(canAccess(operator, 'made.up.permission').allowed, false);
  });

  test('a malformed caller is denied', () => {
    for (const bad of [undefined, null, {}, { userId: '' }, { userId: 0 }]) {
      assert.equal(canAccess(bad, PERMISSIONS.GATE_UNLOCK).allowed, false, `caller: ${JSON.stringify(bad)}`);
    }
  });
});

describe('PERMISSIONS catalogue', () => {
  test('covers every capability the audit flagged', () => {
    for (const key of ['GATE_UNLOCK', 'INTEGRATION_CONFIGURE', 'CAMERA_CONTROL', 'ZONE_EDIT', 'OPERATOR_MANAGE']) {
      assert.ok(PERMISSIONS[key], `missing permission constant ${key}`);
    }
  });
});
