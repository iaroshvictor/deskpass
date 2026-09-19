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

describe('live camera feeds answer a signed-in subscriber', () => {
  // cam_overlay and cam_captions poll redis rather than Mongo, and several
  // subscribers now share one poller per camera. The shape to protect: the
  // subscription completes and the initial document arrives, whether or not
  // the perception engine is running (it usually is not, in development).
  const USER = process.env.DESKPASS_TEST_USER || 'admin';
  const PASS = process.env.DESKPASS_TEST_PASS || 'admin';

  for (const [pub, collection] of [['cam_overlay', 'cam_overlay'], ['cam_captions', 'cam_captions'], ['onvifDevices', 'onvifdevices']]) {
    test(`${pub} completes for a signed-in subscriber`, async () => {
      const client = await anonymousClient();
      try {
        const login = await client.login(USER, PASS);
        assert.ok(!login.error, `cannot sign in as ${USER}`);
        const res = await client.subscribe(pub, pub === 'onvifDevices' ? [] : ['probe-cam-id']);
        assert.ok(!res.timedOut, `"${pub}" never answered a signed-in subscriber`);
        assert.ok(res.ok !== false || !res.error, `"${pub}" refused a signed-in subscriber: ${JSON.stringify(res.error)}`);
        if (collection !== 'onvifdevices') {
          assert.equal(client.received(collection).length, 1,
            `"${pub}" should push exactly one document for the camera it was asked about`);
        }
      } finally {
        client.close();
      }
    });
  }

  test('two subscribers can watch the same camera at once', async () => {
    // The shared poller must serve both, not trip over the second join.
    const a = await anonymousClient();
    const b = await anonymousClient();
    try {
      await a.login(USER, PASS);
      await b.login(USER, PASS);
      const ra = await a.subscribe('cam_overlay', ['shared-probe-cam']);
      const rb = await b.subscribe('cam_overlay', ['shared-probe-cam']);
      assert.ok(!ra.timedOut && !rb.timedOut, 'a second subscriber to the same camera was left hanging');
      assert.equal(a.received('cam_overlay').length, 1);
      assert.equal(b.received('cam_overlay').length, 1);
    } finally {
      a.close(); b.close();
    }
  });
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
