// Publication access control.
//
// Threat model: someone who can reach the HTTP port but has no account. They
// speak DDP directly, so the browser login screen protects nothing.
//
// Expected BEFORE the remediation plan: most of these fail.
// Expected AFTER: all pass.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousClient } from '../helpers/ddp-client.mjs';
import { seed, GUARDED_PUBLICATIONS } from '../helpers/fixtures.mjs';

// A subscription that never answers proves nothing. Without this guard the
// assertions below would pass on a slow machine simply because no data
// arrived in time — the worst possible failure mode for a security suite.
function assertAnswered(res, pub) {
  // Two different defects hide behind a hang. For an unguarded publication a
  // timeout means the probe proved nothing. For a guarded one it means the
  // publication returns undefined instead of calling this.ready(), so the
  // client waits forever — a real bug, not an inconclusive run.
  assert.ok(!res.timedOut,
    `publication "${pub}" never answered an anonymous subscriber: no data, no error, no ready. ` +
    `A publish function that returns undefined must call this.ready() instead.`);
}

describe('publications reject anonymous subscribers', () => {
  let fixture;

  before(async () => { fixture = await seed(); });
  after(async () => { await fixture?.cleanup(); });

  for (const { pub, collection, params = [] } of GUARDED_PUBLICATIONS) {
    test(`${pub} leaks no documents to an anonymous client`, async () => {
      const client = await anonymousClient();
      try {
        assertAnswered(await client.subscribe(pub, params), pub);
        const docs = client.received(collection);
        assert.equal(
          docs.length, 0,
          `anonymous subscriber received ${docs.length} document(s) from "${collection}" ` +
          `via publication "${pub}" — it must return this.ready() without data when this.userId is null`,
        );
      } finally {
        client.close();
      }
    });
  }
});

describe('publications that already guard correctly stay guarded', () => {
  // Regression cover: these were correct at audit time and must not regress.
  const NEEDS_FILTER = ['visitssummary', 'attendanceArchive', 'temporaryCards'];
  const GUARDED = ['allUsers', 'workspace', 'alertLists', 'visitssummary', 'settings',
                   'userRole', 'allRoles', 'roleDefinitions', 'attendanceArchive', 'temporaryCards'];

  for (const pub of GUARDED) {
    test(`${pub} still refuses anonymous access`, async () => {
      const client = await anonymousClient();
      try {
        assertAnswered(await client.subscribe(pub, NEEDS_FILTER.includes(pub) ? [{}] : []), pub);
        const total = [...client.docs.values()].reduce((n, m) => n + m.size, 0);
        assert.equal(total, 0, `anonymous subscriber received ${total} document(s) from "${pub}"`);
      } finally {
        client.close();
      }
    });
  }
});
