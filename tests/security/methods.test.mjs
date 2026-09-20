// Method access control.
//
// Two kinds of methods are covered:
//   * read/trigger methods — called for real, they must answer 'not-authorized'
//   * destructive methods  — calling them unauthenticated would actually
//     rewrite integration credentials or wipe sessions, so by default we only
//     assert the guard exists in source (see source-contracts.test.mjs) and
//     run the live call solely when DESKPASS_ALLOW_DESTRUCTIVE=1 against a
//     throwaway database.
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { anonymousClient } from '../helpers/ddp-client.mjs';

const NOT_AUTHORIZED = 'not-authorized';
const PROBE_NAME = 'ANON-WRITE-PROBE';
const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';

// While the write guards hold, the probes below create nothing. If one ever
// regresses they will, and the leftovers show up in the operator's zone tree —
// so sweep them up regardless of the outcome.
after(async () => {
  const mongo = new MongoClient(MONGO_URL);
  try {
    await mongo.connect();
    await mongo.db().collection('zones').deleteMany({ name: PROBE_NAME });
  } finally {
    await mongo.close();
  }
});

/** Every method an outsider must not be able to invoke. */
const SAFE_TO_CALL = [
  { method: 'restartCamHandler', params: ['nonexistent-cam-id'],
    why: 'restarts a camera pipeline' },
  { method: 'doApolloSync', params: [],
    why: 'triggers a full APACS synchronisation' },
  { method: 'getBotLink', params: [],
    why: 'discloses the Telegram bot identity' },
  { method: 'getUserName', params: ['nonexistent-user-id'],
    why: 'allows account enumeration' },
  { method: 'addZoneItem', params: [{ parent: 'root', name: PROBE_NAME }],
    why: 'creates a zone — an anonymous write' },
  { method: 'editZone', params: [{ id: 'nonexistent', name: PROBE_NAME }],
    why: 'renames a zone — an anonymous write' },
  { method: 'deleteZone', params: ['nonexistent'],
    why: 'deletes a zone — an anonymous write' },
  { method: 'countVisits', params: [{}],
    why: 'counts visit records' },
];

const DESTRUCTIVE = [
  { method: 'setTgBot', params: ['000000:CANARY'],
    why: 'replaces the Telegram bot token and wipes every stored session' },
  { method: 'setApacsConfig', params: [{ url: 'http://canary.invalid', username: 'x', password: 'y' }],
    why: 'repoints the access-control integration at an attacker-controlled server' },
];

function assertRefused(res, method, why) {
  assert.ok(res.error, `"${method}" (${why}) answered an unauthenticated caller without an error`);
  assert.equal(
    res.error.error, NOT_AUTHORIZED,
    `"${method}" (${why}) failed with "${res.error.error}" instead of "${NOT_AUTHORIZED}" — ` +
    `it must reject before doing any work`,
  );
}

describe('methods reject anonymous callers', () => {
  for (const { method, params, why } of SAFE_TO_CALL) {
    test(`${method} requires a session`, async () => {
      const client = await anonymousClient();
      try {
        assertRefused(await client.call(method, params), method, why);
      } finally {
        client.close();
      }
    });
  }
});

describe('destructive methods reject anonymous callers', { skip: process.env.DESKPASS_ALLOW_DESTRUCTIVE !== '1'
  ? 'set DESKPASS_ALLOW_DESTRUCTIVE=1 to run these against a throwaway database' : false }, () => {
  for (const { method, params, why } of DESTRUCTIVE) {
    test(`${method} requires a session`, async () => {
      const client = await anonymousClient();
      try {
        assertRefused(await client.call(method, params), method, why);
      } finally {
        client.close();
      }
    });
  }
});

// Gate authorisation is covered properly in gate-authorization.test.mjs, which
// logs in as a deliberately unprivileged operator instead of probing with a
// bogus gate id (that older probe passed for the wrong reason).
