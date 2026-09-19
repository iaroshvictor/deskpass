// Client-supplied Mongo queries.
//
// Several publications forward the client's `filter` straight into find() and
// let the client choose `limit`. Even once a session is required, an operator
// must not be able to hand the server an arbitrary query or an unbounded page.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousClient } from '../helpers/ddp-client.mjs';
import { seed, seedMany } from '../helpers/fixtures.mjs';

// What the server is expected to enforce once the guards are in place.
const DEFAULT_PAGE = Number(process.env.DESKPASS_DEFAULT_LIMIT || 100);
const MAX_PAGE = Number(process.env.DESKPASS_MAX_LIMIT || 500);
const BULK = MAX_PAGE + 100;   // more rows than any cap, so an uncapped query stands out

describe('publications constrain client-supplied queries', () => {
  let fixture;

  before(async () => {
    fixture = await seed();
    const now = Date.now();
    await seedMany(fixture.db, 'visits', BULK, (i) => ({
      timestamp: new Date(now - i * 1000), source: 'canary-bulk', par: { name: `CANARY ${i}` },
    }));
    await seedMany(fixture.db, 'intruderalerts', BULK, (i) => ({
      timestamp: new Date(now - i * 1000), tracking_id: `canary-${i}`, seen: false,
    }));
  });

  after(async () => { await fixture?.cleanup(); });

  test('visits treats limit:0 as the default page, not as unlimited', async () => {
    // server/main.ts: `if (limit !== 0) options.limit = limit` — passing 0
    // removes the cap entirely and streams the whole collection.
    const client = await anonymousClient();
    try {
      const res = await client.subscribe('visits', [{}, 0, 0, { timestamp: -1 }]);
      assert.ok(!res.timedOut, 'subscription to "visits" never answered');
      const n = client.received('visits').length;
      assert.ok(n <= DEFAULT_PAGE,
        `limit:0 returned ${n} documents out of ${BULK} seeded — the server must apply its own default page size`);
    } finally { client.close(); }
  });

  test('intruderAlerts caps an absurd page size', async () => {
    const client = await anonymousClient();
    try {
      const res = await client.subscribe('intruderAlerts', [{}, 1000000, 0, { timestamp: -1 }]);
      assert.ok(!res.timedOut, 'subscription to "intruderAlerts" never answered');
      const n = client.received('intruderalerts').length;
      assert.ok(n <= MAX_PAGE,
        `a page size of 1000000 returned ${n} documents — the server must clamp it to at most ${MAX_PAGE}`);
    } finally { client.close(); }
  });

  test('visits rejects operator objects inside the filter', async () => {
    // $ne:null matches every document, whatever the UI would have sent.
    const client = await anonymousClient();
    try {
      const res = await client.subscribe('visits', [{ _id: { $ne: null } }, 10, 0, { timestamp: -1 }]);
      assert.ok(!res.timedOut, 'subscription to "visits" never answered');
      assert.equal(client.received('visits').length, 0,
        'an arbitrary Mongo operator was accepted — filters must be built from a field whitelist');
    } finally { client.close(); }
  });

  test('alertsArchive rejects $where javascript', async () => {
    const client = await anonymousClient();
    try {
      const res = await client.subscribe('alertsArchive', [{ $where: 'true' }, 10, 0, { timestamp: -1 }]);
      assert.ok(!res.timedOut, 'subscription to "alertsArchive" never answered');
      assert.equal(client.received('alertsArchive').length, 0,
        '$where was accepted from the client — server-side javascript evaluation must never be reachable');
    } finally { client.close(); }
  });
});
