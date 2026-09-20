// Filters must actually filter.
//
// The publications now build their Mongo query from a whitelist of fields and
// operators. A field the whitelist forgets is dropped rather than rejected,
// which keeps the screen working but makes it show *more* than it asked for —
// a silent correctness bug that no "is it guarded" test would catch.
//
// So: send the filter shapes the real screens send, and assert every returned
// document satisfies the filter. Each case names the screen it came from, so
// a failure points straight at the code that has to change.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { anonymousClient } from '../helpers/ddp-client.mjs';

const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';
const USER = process.env.DESKPASS_TEST_USER || 'admin';
const PASS = process.env.DESKPASS_TEST_PASS || 'admin';
// Grace period for publications that push documents after signalling ready.
const SETTLE_MS = Number(process.env.DESKPASS_SETTLE_MS || 4000);

describe('publications honour the filters the screens send', () => {
  let mongo, db, client, fixtures = {};

  before(async () => {
    mongo = new MongoClient(MONGO_URL);
    await mongo.connect();
    db = mongo.db();

    // Anchor the assertions to data that is actually present, whatever the
    // database happens to hold.
    fixtures.cam = (await db.collection('cams').findOne({}))?._id;
    fixtures.person = (await db.collection('visitsSummary').findOne({}))?._id;
    // Taken from a message that exists rather than written in: the wording of
    // a seeded event is not a contract, and a word that has fallen out of it
    // fails this test for the wrong reason.
    const anyEvent = await db.collection('scenario_events_v2').findOne({ message: { $type: 'string' } });
    fixtures.scenarioWord = anyEvent?.message.split(/\s+/).find((w) => /^[A-Za-z]{4,}$/.test(w)) ?? null;
    // Pick a camera that actually has an unseen caption, rather than assuming
    // the first one does: an empty result would fail for lack of data rather
    // than for a lost filter.
    fixtures.captionCam = (await db.collection('captionAlerts').findOne({ seen: false }))?.source;

    client = await anonymousClient();
    const login = await client.login(USER, PASS);
    assert.ok(!login.error, `cannot sign in as ${USER}: ${JSON.stringify(login.error)}`);
  });

  after(async () => {
    client?.close();
    await mongo?.close();
  });

  /** Subscribe and assert every document satisfies `predicate`. */
  async function check({ screen, pub, collection, params, predicate, needs }) {
    if (needs && !needs()) {
      // Nothing to compare against; skip rather than pass vacuously.
      return { skipped: true };
    }
    const fresh = await anonymousClient();
    try {
      await fresh.login(USER, PASS);
      const res = await fresh.subscribe(pub, params);
      assert.ok(!res.timedOut, `${screen}: subscription to "${pub}" never answered`);

      // Publications that push documents by hand send them shortly after
      // ready, so reading immediately can see an empty collection.
      await new Promise((r) => setTimeout(r, SETTLE_MS));

      const docs = fresh.received(collection);
      assert.ok(docs.length > 0, `${screen}: "${pub}" returned nothing, so the filter proves nothing`);

      const wrong = docs.filter((d) => !predicate(d));
      if (wrong.length) {
        assert.fail(
          `${screen}: ${wrong.length} of ${docs.length} documents from "${pub}" do not match the filter — ` +
          `the field is probably missing from the publication's whitelist. First offender: ` +
          `${JSON.stringify(wrong[0]).slice(0, 200)}`,
        );
      }
    } finally {
      fresh.close();
    }
  }

  test('persons database: visits filtered by tracking_id', async (t) => {
    if (!fixtures.person) return t.skip('no people in the database');
    await check({
      screen: 'Persons Database',
      pub: 'visits', collection: 'visits',
      params: [{ tracking_id: fixtures.person }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.tracking_id === fixtures.person,
    });
  });

  test('models management: visits filtered by reference', async () => {
    await check({
      screen: 'Models Management',
      pub: 'visits', collection: 'visits',
      params: [{ reference: true }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.reference === true,
    });
  });

  test('intruder alerts: filtered by camera', async (t) => {
    if (!fixtures.cam) return t.skip('no cameras in the database');
    await check({
      screen: 'Intruder Alerts',
      pub: 'intruderAlerts', collection: 'intruderalerts',
      params: [{ source: { $in: [fixtures.cam] } }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.source === fixtures.cam,
    });
  });

  test('intruder alerts: unseen only', async () => {
    await check({
      screen: 'Intruder Alerts (unseen switch)',
      pub: 'intruderAlerts', collection: 'intruderalerts',
      params: [{ seen: false }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.seen === false,
    });
  });

  test('alerts archive: seenBy is not "root"', async () => {
    await check({
      screen: 'Alerts Archive',
      pub: 'alertsArchive', collection: 'alertsArchive',
      params: [{ seenBy: { $ne: 'root' } }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.seenBy !== 'root',
    });
  });

  test('attendance archive: filtered by camera', async (t) => {
    if (!fixtures.cam) return t.skip('no cameras in the database');
    await check({
      screen: 'Attendance Archive',
      pub: 'attendanceArchive', collection: 'accessReports',
      params: [{ source: { $in: [fixtures.cam] } }, 100, 0, { timestamp: -1 }],
      predicate: (d) => d.source === fixtures.cam,
    });
  });

  test('scenario archive: free-text search on the message', async (t) => {
    if (!fixtures.scenarioWord) return t.skip('no scenario events with a message in the database');
    await check({
      screen: 'Scenario Archive (search box)',
      pub: 'scenario_events_v2', collection: 'scenario_events_v2',
      params: [{ message: { $regex: fixtures.scenarioWord, $options: 'i' } }, 100, 0, { triggeredAt: -1 }],
      predicate: (d) => new RegExp(fixtures.scenarioWord, 'i').test(d.message || ''),
    });
  });

  test('access permissions: people flagged for access control', async () => {
    await check({
      screen: 'Access Permissions',
      pub: 'visitssummary', collection: 'visitsSummary',
      params: [{ 'idInfo.cA': true }, 100, 0],
      predicate: (d) => d.idInfo?.cA === true,
    });
  });

  test('divisions management: people that have an idInfo record', async () => {
    await check({
      screen: 'Divisions Management',
      pub: 'visitssummary', collection: 'visitsSummary',
      params: [{ idInfo: { $exists: true } }, 100, 0],
      predicate: (d) => d.idInfo !== undefined,
    });
  });

  test('caption alerts: one camera, unseen only', async (t) => {
    if (!fixtures.captionCam) return t.skip('no unseen caption alerts in the database');
    await check({
      screen: 'Live Stream (captions)',
      pub: 'caption_alerts', collection: 'captionAlerts',
      params: [{ source: fixtures.captionCam, seen: false }, 50],
      predicate: (d) => d.source === fixtures.captionCam && d.seen === false,
    });
  });
});
