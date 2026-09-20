// Do the forms actually save?
//
// For each screen that creates, edits or deletes records, this submits what
// the form submits and then reads the database directly to see whether the
// record is really there, really changed, and really gone. A method that
// resolves without writing anything looks identical to a working one from
// the interface, which is how a broken form survives review.
//
// Everything created here carries MARKER in its name and is removed again in
// `after`, whether the run passed or failed.
//
// It needs the application running (npm start) and an admin account.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient, ObjectId } from 'mongodb';
import { anonymousClient, waitForServer } from '../helpers/ddp-client.mjs';

const ADMIN_USER = process.env.DESKPASS_TEST_USER || 'admin';
const ADMIN_PASS = process.env.DESKPASS_TEST_PASS || 'admin';
const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';

export const MARKER = 'FORMTEST';
const named = (what) => `${MARKER} ${what} ${Math.random().toString(36).slice(2, 8)}`;

// Collections the forms below write into, cleaned up by name.
const TOUCHED = {
  zones: 'name', gates: 'name', divisions: 'name', controllers: 'name',
  alertlists: 'name', roleDefinitions: 'name', scenarios_v2: 'name',
  cams: 'name', cam_line_defs: 'label', cam_zone_defs: 'label',
};

let client, mongo, db, skipReason = null;

/** Mongo accepts either a Meteor-style string id or an ObjectId. */
const byId = (id) => (/^[0-9a-f]{24}$/i.test(id) ? { _id: new ObjectId(id) } : { _id: id });

const find = (collection, id) => db.collection(collection).findOne(byId(id));

/** Call as the signed-in admin, failing the test with the server's own message. */
async function submit(method, args, what) {
  const res = await client.call(method, args, 20000);
  assert.ok(!res.timedOut, `${method} never answered`);
  assert.ok(!res.error, `${method} refused ${what}: ${res.error?.error} ${res.error?.reason || ''}`);
  return res.result;
}

before(async () => {
  await waitForServer();
  mongo = new MongoClient(MONGO_URL);
  await mongo.connect();
  db = mongo.db();
  client = await anonymousClient();
  const login = await client.login(ADMIN_USER, ADMIN_PASS);
  if (login.error) skipReason = `cannot log in as ${ADMIN_USER}: ${login.error.reason || login.error.error}`;
});

after(async () => {
  for (const [collection, field] of Object.entries(TOUCHED)) {
    try { await db?.collection(collection).deleteMany({ [field]: { $regex: `^${MARKER} ` } }); } catch { /* collection may not exist */ }
  }
  try {
    const probe = await db?.collection('users').findOne({ username: { $regex: `^${MARKER.toLowerCase()}-` } });
    if (probe) {
      await db.collection('roles').deleteMany({ userId: String(probe._id) });
      await db.collection('users').deleteOne({ _id: probe._id });
    }
  } catch { /* nothing to undo */ }
  client?.close();
  await mongo?.close();
});

describe('Zones', () => {
  test('a zone can be added, renamed and deleted', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('zone');

    const id = await submit('addZoneItem', [{ parent: 'root', name }], 'a new zone');
    assert.ok(id, 'addZoneItem returned no id');
    assert.equal((await find('zones', id))?.name, name, 'the zone was not written');

    const renamed = `${name} renamed`;
    await submit('editZone', [{ id, name: renamed }], 'a rename');
    assert.equal((await find('zones', id))?.name, renamed, 'the rename did not reach the database');

    await submit('deleteZone', [id], 'a delete');
    assert.equal(await find('zones', id), null, 'the zone is still there after deleting it');
  });

  test('a zone without a name is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const before = await db.collection('zones').countDocuments();
    const res = await client.call('addZoneItem', [{ parent: 'root', name: '   ' }], 15000);
    assert.equal(res.error?.error, 'invalid-zone');
    assert.equal(await db.collection('zones').countDocuments(), before, 'a blank zone was written anyway');
  });
});

describe('Gates', () => {
  test('a gate can be created, edited and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('gate');
    const gate = { name, zone: 'root', interfaces: [{ cam: 'formtest-cam', action: 'entrance' }] };

    const id = await submit('insertGate', [gate], 'a new gate');
    assert.equal((await find('gates', id))?.name, name);

    await submit('updateGate', [id, { ...gate, name: `${name} edited` }], 'an edit');
    assert.equal((await find('gates', id))?.name, `${name} edited`);

    await submit('removeGate', [id], 'a removal');
    assert.equal(await find('gates', id), null);
  });

  test('a gate with no interfaces is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('insertGate', [{ name: named('bad gate'), zone: 'root', interfaces: [] }], 15000);
    assert.equal(res.error?.error, 'invalid-gate', 'a gate that opens nothing was accepted');
  });
});

describe('Divisions', () => {
  test('a division can be created, renamed and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('division');

    const id = await submit('insertDivision', [{ name, parent: 'root' }], 'a new division');
    assert.equal((await find('divisions', id))?.name, name);

    await submit('updateDivision', [id, { name: `${name} edited` }], 'a rename');
    assert.equal((await find('divisions', id))?.name, `${name} edited`);

    await submit('removeDivision', [id], 'a removal');
    assert.equal(await find('divisions', id), null);
  });

  test('a division without a parent is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('insertDivision', [{ name: named('orphan') }], 15000);
    assert.equal(res.error?.error, 'invalid-Division');
  });
});

describe('Controllers', () => {
  test('a controller can be added, edited and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('controller');
    const data = { name, manufacturer: 'FORMTEST make', address: '127.0.0.1' };

    const id = await submit('addController', [data], 'a new controller');
    assert.equal((await find('controllers', id))?.name, name);

    await submit('editController', [id, { ...data, address: '127.0.0.2' }], 'an edit');
    assert.equal((await find('controllers', id))?.address, '127.0.0.2');

    await submit('removeController', [id], 'a removal');
    assert.equal(await find('controllers', id), null);
  });

  test('a controller without an address is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('addController', [{ name: named('c'), manufacturer: 'x' }], 15000);
    assert.equal(res.error?.error, 'invalid-data');
  });
});

describe('Person lists', () => {
  test('a list can be added and edited', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('list');

    const id = await submit('addAlertList', [{ name, color: '#ff0000' }], 'a new list');
    assert.equal((await find('alertlists', id))?.name, name);

    await submit('editAlertList', [{ _id: id, name: `${name} edited`, color: '#00ff00' }], 'an edit');
    const after = await find('alertlists', id);
    assert.equal(after?.name, `${name} edited`);
    assert.equal(after?.color, '#00ff00');
  });

  test('a list without a colour is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('addAlertList', [{ name: named('nocolour') }], 15000);
    assert.equal(res.error?.error, 'invalid-item');
  });
});

describe('Camera lines and zones', () => {
  test('a line definition can be created and renamed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const label = named('line');

    const id = await submit('insertCamLineDef', [{ label }], 'a new line');
    assert.equal((await find('cam_line_defs', id))?.label, label);

    await submit('updateCamLineDef', [id, { label: `${label} edited` }], 'a rename');
    assert.equal((await find('cam_line_defs', id))?.label, `${label} edited`);
  });

  test('a zone definition can be created and renamed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const label = named('zonedef');

    const id = await submit('insertCamZoneDef', [{ label }], 'a new zone definition');
    assert.equal((await find('cam_zone_defs', id))?.label, label);

    await submit('updateCamZoneDef', [id, { label: `${label} edited` }], 'a rename');
    assert.equal((await find('cam_zone_defs', id))?.label, `${label} edited`);
  });

  test('a line definition with a blank label is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('insertCamLineDef', [{ label: '  ' }], 15000);
    assert.equal(res.error?.error, 'invalid-data');
  });
});

describe('Scenarios', () => {
  const scenario = (name) => ({
    name,
    scope: { kind: 'cams', camIds: ['formtest-cam'] },
    rule: { condition: { kind: 'personCount', op: 'gt', value: 1 } },
    severity: 'warning',
  });

  test('a scenario can be created, disabled, edited and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('scenario');

    const id = await submit('insertScenarioV2', [scenario(name)], 'a new scenario');
    assert.equal((await find('scenarios_v2', id))?.name, name);

    await submit('setScenarioV2Enabled', [id, false], 'disabling it');
    assert.equal((await find('scenarios_v2', id))?.enabled, false, 'the switch did not reach the database');

    await submit('updateScenarioV2', [id, { ...scenario(`${name} edited`) }], 'an edit');
    assert.equal((await find('scenarios_v2', id))?.name, `${name} edited`);

    await submit('removeScenarioV2', [id], 'a removal');
    assert.equal(await find('scenarios_v2', id), null);
  });

  test('a scenario without a condition is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('insertScenarioV2',
      [{ name: named('no rule'), scope: { kind: 'cams', camIds: ['formtest-cam'] } }], 15000);
    assert.equal(res.error?.error, 'invalid-scenario');
  });

  test('a scenario scoped to no camera is refused', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const res = await client.call('insertScenarioV2',
      [{ name: named('no cams'), scope: { kind: 'cams', camIds: [] },
         rule: { condition: { kind: 'personCount', op: 'gt', value: 1 } } }], 15000);
    assert.equal(res.error?.error, 'invalid-scenario');
  });
});

describe('Cameras', () => {
  test('a camera can be created and edited', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('cam');
    const cam = {
      name, streamurl: 'rtsp://127.0.0.1:8554/formtest', zone: 'root',
      faceAlert: false, accessControl: false, disableSpoofFilter: false,
      snapshot: '', lines: [], overlayZones: [],
    };

    const id = await submit('insertCam', [cam], 'a new camera');
    assert.equal((await find('cams', id))?.name, name);

    await submit('updateCam', [id, { ...cam, name: `${name} edited` }], 'an edit');
    assert.equal((await find('cams', id))?.name, `${name} edited`);
  });
});

describe('Operators', () => {
  test('an operator can be created, updated and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const username = `${MARKER.toLowerCase()}-operator`;
    const password = `pw-${Math.random().toString(36).slice(2)}`;

    // A leftover from an interrupted run would make the insert fail for the
    // wrong reason.
    const existing = await db.collection('users').findOne({ username });
    if (existing) await db.collection('users').deleteOne({ _id: existing._id });

    const created = await client.call('operators.insert', [{ username, password }], 20000);
    assert.ok(!created.error, `operators.insert refused: ${created.error?.reason || created.error?.error}`);

    const user = await db.collection('users').findOne({ username });
    assert.ok(user, 'the operator was not written');

    const updated = await client.call('operators.update', [String(user._id), { username: `${username}-2` }], 20000);
    assert.ok(!updated.error, `operators.update refused: ${updated.error?.reason || updated.error?.error}`);
    assert.ok(await db.collection('users').findOne({ username: `${username}-2` }), 'the rename did not land');

    const removed = await client.call('operators.remove', [String(user._id)], 20000);
    assert.ok(!removed.error, `operators.remove refused: ${removed.error?.reason || removed.error?.error}`);
    assert.equal(await db.collection('users').findOne({ _id: user._id }), null, 'the operator survived removal');
  });
});

describe('Roles', () => {
  test('a role definition can be created, edited and removed', async (t) => {
    if (skipReason) { t.skip(skipReason); return; }
    const name = named('role');

    const created = await client.call('roleDefinitions.insert', [{ name, permissions: ['zone.edit'] }], 20000);
    if (created.error?.error === 'not-authorized') {
      t.skip(`${ADMIN_USER} is not an admin, so role editing cannot be exercised`);
      return;
    }
    assert.ok(!created.error, `roleDefinitions.insert refused: ${created.error?.reason || created.error?.error}`);
    const id = created.result;
    assert.equal((await find('roleDefinitions', id))?.name, name);

    await submit('roleDefinitions.update', [id, { name: `${name} edited`, permissions: [] }], 'an edit');
    const after = await find('roleDefinitions', id);
    assert.equal(after?.name, `${name} edited`);
    assert.deepEqual(after?.permissions, []);

    await submit('roleDefinitions.remove', [id], 'a removal');
    assert.equal(await find('roleDefinitions', id), null);
  });
});
