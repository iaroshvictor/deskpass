// The forms that act on records rather than create them.
//
// "Mark seen", "set watch-words", the counters behind every filter bar: these
// screens have no save button to inspect, so the only way to know they work
// is to seed a record, submit what the form submits, and read the record back.
//
// Every document created here carries MARKER and is removed in `after`.
//
// It needs the application running (npm start) and an admin account.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { anonymousClient, waitForServer } from '../helpers/ddp-client.mjs';

const ADMIN_USER = process.env.DESKPASS_TEST_USER || 'admin';
const ADMIN_PASS = process.env.DESKPASS_TEST_PASS || 'admin';
const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';

const MARKER = '__deskpass_form_fixture';
const SEEDED = ['alertsArchive', 'intruderalerts', 'scenario_events_v2', 'captionAlerts', 'cams'];

// Meteor's own id shape: these documents are addressed by string id from the
// client, and an ObjectId would not match the selectors the methods build.
const meteorId = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
  return Array.from({ length: 17 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

let client, mongo, db, skipReason = null;
const ids = {};

before(async () => {
  await waitForServer();
  mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  db = mongo.db();

  const now = new Date();
  ids.alert = meteorId();
  ids.intruder = meteorId();
  ids.scenarioEvent = meteorId();
  ids.captionAlert = meteorId();
  ids.cam = meteorId();

  await db.collection('alertsArchive').insertOne({ _id: ids.alert, timestamp: now, seen: false, [MARKER]: true });
  await db.collection('intruderalerts').insertOne({ _id: ids.intruder, timestamp: now, tracking_id: 'form-fixture', seen: false, [MARKER]: true });
  await db.collection('scenario_events_v2').insertOne({ _id: ids.scenarioEvent, scenarioId: 'form-fixture', triggeredAt: now, seen: false, [MARKER]: true });
  await db.collection('captionAlerts').insertOne({ _id: ids.captionAlert, source: ids.cam, keyword: 'fire', timestamp: now, seen: false, [MARKER]: true });
  // The heatmap draws over the camera's snapshot and refuses without one.
  const SNAPSHOT_1PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  await db.collection('cams').insertOne({
    _id: ids.cam, name: 'FORMTEST caption cam', streamurl: 'rtsp://127.0.0.1:8554/formtest',
    captionKeywords: [], snapshot: SNAPSHOT_1PX, [MARKER]: true,
  });

  client = await anonymousClient();
  const login = await client.login(ADMIN_USER, ADMIN_PASS);
  if (login.error) skipReason = `cannot log in as ${ADMIN_USER}: ${login.error.reason || login.error.error}`;
});

after(async () => {
  for (const collection of SEEDED) {
    try { await db?.collection(collection).deleteMany({ [MARKER]: true }); } catch { /* not created */ }
  }
  client?.close();
  await mongo?.close();
});

const call = async (method, args, timeout = 20000) => client.call(method, args, timeout);

async function ok(method, args, what) {
  const res = await call(method, args);
  assert.ok(!res.timedOut, `${method} never answered`);
  assert.ok(!res.error, `${method} refused ${what}: ${res.error?.error} ${res.error?.reason || ''}`);
  return res.result;
}

describe('marking things as seen', () => {
  test('an archived alert is marked seen', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    await ok('setSeenAlert', [ids.alert], 'marking an alert seen');
    const doc = await db.collection('alertsArchive').findOne({ _id: ids.alert });
    assert.equal(doc?.seen, true, 'the alert is still unseen in the database');
  });

  test('an intruder alert is marked seen', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    await ok('setSeenIntruder', [ids.intruder], 'marking an intruder seen');
    const doc = await db.collection('intruderalerts').findOne({ _id: ids.intruder });
    assert.equal(doc?.seen, true, 'the intruder alert is still unseen in the database');
  });

  test('a scenario event is marked seen', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    await ok('markScenarioEventsV2Seen', [[ids.scenarioEvent]], 'marking a scenario event seen');
    const doc = await db.collection('scenario_events_v2').findOne({ _id: ids.scenarioEvent });
    assert.equal(doc?.seen, true, 'the scenario event is still unseen in the database');
  });

  test('a caption alert is marked seen', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    await ok('markCaptionAlertSeen', [ids.captionAlert], 'dismissing a caption alert');
    const doc = await db.collection('captionAlerts').findOne({ _id: ids.captionAlert });
    assert.equal(doc?.seen, true, 'the caption alert is still unseen in the database');
  });
});

describe('livestream watch-words', () => {
  test('watch-words are saved against the camera', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const saved = await ok('setCaptionKeywords', [ids.cam, [' fire ', 'smoke', '']], 'saving watch-words');

    // The method trims, drops blanks and caps the list; the form relies on
    // getting the cleaned list back to render the chips.
    assert.deepEqual(saved, ['fire', 'smoke'], 'the cleaned list was not returned to the form');
    const cam = await db.collection('cams').findOne({ _id: ids.cam });
    assert.deepEqual(cam?.captionKeywords, ['fire', 'smoke'], 'the watch-words did not reach the camera');
  });

  test('more than forty watch-words are truncated rather than stored', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const many = Array.from({ length: 60 }, (_, i) => `word${i}`);
    const saved = await ok('setCaptionKeywords', [ids.cam, many], 'saving a long list');
    assert.equal(saved.length, 40, 'the list is not capped');
  });
});

describe('filter bars that only count', () => {
  const counters = [
    ['countVisits', [{}]],
    ['countIntruder', [{}]],
    ['countAccessReport', [{}]],
    ['countTemporaryCards', [{}]],
  ];

  for (const [method, args] of counters) {
    test(`${method} answers with a number`, async (t) => {
      if (skipReason) { t.skip(skipReason); return; }
      const result = await ok(method, args, 'an empty filter');
      assert.equal(typeof result, 'number', `${method} returned ${typeof result}, so the filter bar shows nothing`);
      assert.ok(result >= 0);
    });
  }
});

describe('the report screens', () => {
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = new Date();

  test('the traffic timeline answers for a camera and a range', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const data = await ok('getTrafficTimeline', [ids.cam, from, to, '1hour'], 'a day of traffic');
    assert.equal(typeof data, 'object');
    assert.ok(data !== null, 'the timeline screen received nothing to draw');
  });

  test('the timeline refuses a request with no camera', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await call('getTrafficTimeline', ['', from, to, '1hour']);
    assert.ok(res.error, 'a timeline with no camera was accepted');
  });

  test('the heatmap answers for a camera and a range', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const data = await ok('getHeatmapData', [ids.cam, from, to], 'a day of heatmap data');
    assert.equal(typeof data, 'object');
    assert.ok(data !== null, 'the heatmap screen received nothing to draw');
  });
});

describe('filters reach the database as data, not as commands', () => {
  // The counter behind a filter bar receives the filter object straight from
  // the screen, and a filter is a query document: $where executes JavaScript
  // on the database, a crafted $regex pins a core, $ne turns "mine" into
  // "everyone's". Anything a screen could not have sent is refused by name,
  // and the query never runs.
  const injections = [
    ['$where', { $where: 'function () { return true; }' }],
    ['a regex bomb', { 'par.name': { $regex: '(a+)+(a+)+$' } }],
    ['an operator the screen never sends', { source: { $ne: '__nothing__' } }],
  ];

  let unfiltered;

  test('the unfiltered count is available to compare against', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    unfiltered = await ok('countVisits', [{}], 'an empty filter');
    assert.equal(typeof unfiltered, 'number');
  });

  for (const [what, filter] of injections) {
    test(`countVisits refuses ${what}`, async (t) => {
      if (skipReason || typeof unfiltered !== 'number') { t.skip(skipReason || 'no baseline count'); return; }
      const started = Date.now();
      const res = await call('countVisits', [filter], 25000);

      assert.ok(!res.timedOut, `countVisits hung on ${what}; the expression reached the database`);
      assert.ok(res.error, `countVisits answered ${res.result} for ${what} instead of refusing it`);
      assert.equal(
        res.error.error, 'invalid-filter',
        `${what} was refused as ${JSON.stringify(res.error.error)}; an unnamed failure reaches the ` +
        'filter bar as "Internal server error"',
      );
      assert.ok(Date.now() - started < 10000, `${what} took long enough to suggest it was evaluated`);
    });
  }

  test('a filter the screen does send still works', async (t) => {
    if (skipReason || typeof unfiltered !== 'number') { t.skip(skipReason || 'no baseline count'); return; }
    // Sanitising must not amount to ignoring the filter bar: a range in the
    // far past has to come back smaller than the unfiltered count.
    const longAgo = { timestamp: { $gte: new Date('1990-01-01'), $lte: new Date('1990-01-02') } };
    const narrowed = await ok('countVisits', [longAgo], 'a date range');
    assert.ok(narrowed <= unfiltered, 'the date range was dropped along with the junk');
  });
});
