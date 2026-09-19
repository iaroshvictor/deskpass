// Authorisation for physical access.
//
// unlockGate currently checks only that a session exists, so every operator
// can open every door. This test creates a deliberately unprivileged account
// and proves it cannot unlock anything. It needs an admin session to create
// that account, so it skips when no admin credentials are supplied.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { anonymousClient } from '../helpers/ddp-client.mjs';

const ADMIN_USER = process.env.DESKPASS_TEST_USER || 'admin';
const ADMIN_PASS = process.env.DESKPASS_TEST_PASS || 'admin';
const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';

const PROBE_USER = 'audit-probe-operator';
const PROBE_PASS = 'probe-pass-' + Math.random().toString(36).slice(2);
const GATE_MARKER = '__deskpass_security_fixture';

describe('opening a gate requires a permission, not just a session', () => {
  let mongo, db, gateId, skipReason = null;

  before(async () => {
    mongo = new MongoClient(MONGO_URL);
    await mongo.connect();
    db = mongo.db();

    // A gate that looks real enough to reach the authorisation branch.
    const res = await db.collection('gates').insertOne({
      name: 'CANARY gate', apacsId: 'canary-apacs-id', [GATE_MARKER]: true,
    });
    gateId = String(res.insertedId);

    const admin = await anonymousClient();
    try {
      const login = await admin.login(ADMIN_USER, ADMIN_PASS);
      if (login.error) { skipReason = `cannot log in as ${ADMIN_USER}`; return; }
      const created = await admin.call('operators.insert', [{ username: PROBE_USER, password: PROBE_PASS }]);
      if (created.error && created.error.error !== 403) {
        // Account may survive from an interrupted run; that is fine.
        if (!String(created.error.reason || '').includes('exists')) skipReason = `cannot create probe operator: ${created.error.error}`;
      }
    } finally { admin.close(); }
  });

  after(async () => {
    if (db) {
      await db.collection('gates').deleteMany({ [GATE_MARKER]: true });
      const u = await db.collection('users').findOne({ username: PROBE_USER });
      if (u) {
        await db.collection('roles').deleteMany({ userId: String(u._id) });
        await db.collection('users').deleteOne({ _id: u._id });
      }
    }
    await mongo?.close();
  });

  test('an operator with no role cannot unlock a gate', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const client = await anonymousClient();
    try {
      const login = await client.login(PROBE_USER, PROBE_PASS);
      assert.ok(!login.error, `probe operator could not log in: ${JSON.stringify(login.error)}`);

      const res = await client.call('unlockGate', [gateId]);
      assert.ok(res.error, 'an operator with no role unlocked a gate');
      // Two distinct denials, deliberately: "not-authorized" means no session
      // at all, "forbidden" means a session without the gates.unlock
      // capability. Either proves the door stayed shut; anything else means
      // the call reached the gate lookup or Apollo.
      assert.ok(
        ['not-authorized', 'forbidden'].includes(res.error.error),
        `unlockGate answered "${res.error.error}" — an unprivileged operator must be refused ` +
        `on authorisation, before the gate is looked up or Apollo is called`,
      );
    } finally { client.close(); }
  });
});
