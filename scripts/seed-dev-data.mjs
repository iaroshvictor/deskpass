/**
 * Fill a development database with enough data to exercise the UI.
 *
 *   node scripts/seed-dev-data.mjs          # insert
 *   node scripts/seed-dev-data.mjs --clean  # remove everything this created
 *
 * Every document carries `__seed: true`, so --clean removes exactly what was
 * seeded and leaves real data alone. Operator accounts are created through the
 * app's own `operators.insert` method rather than by writing to the users
 * collection, so passwords are hashed the way Meteor expects.
 *
 * Volumes are chosen to make the guards visible: more rows than one page, so
 * pagination and the server-side limit actually do something, and two
 * operators with different roles so the permission checks can be tried from
 * the UI.
 *
 * Requires the app to be running (the DDP part) and Mongo reachable.
 */
import { MongoClient } from 'mongodb';
import { anonymousClient } from '../tests/helpers/ddp-client.mjs';

const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';
const ADMIN_USER = process.env.DESKPASS_TEST_USER || 'admin';
const ADMIN_PASS = process.env.DESKPASS_TEST_PASS || 'admin';
const MARKER = '__seed';

const CLEAN = process.argv.includes('--clean');
// Operator accounts need the app running and its methods registered, which
// happens a few seconds after boot; this flag retries just that part without
// duplicating the data.
const OPERATORS_ONLY = process.argv.includes('--operators-only');
// Rebuild scenarios and their events without touching anything else — the
// cameras keep their ids and their stream URLs.
const SCENARIOS_ONLY = process.argv.includes('--scenarios-only');

// Collections this script writes to, in the order they should be cleaned.
const COLLECTIONS = [
  'zones', 'divisions', 'cams', 'cam_line_defs', 'cam_zone_defs', 'cam_events',
  'cam_live_status', 'controllers', 'gates', 'alertlists', 'visitsSummary',
  'visits', 'accessReports', 'intruderalerts', 'alertsArchive', 'captionAlerts',
  'scenarios_v2', 'scenario_events_v2', 'temporaryCards', 'recordings',
  'roleDefinitions',
];

// An 8x8 grey PNG: the screens expect a base64 image, and a real photo would
// make this script enormous.
const PLACEHOLDER_IMAGE =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAJUlEQVQoU2NkYGD4z0AEYBxVSF' +
  'JCjEQpJMoQog0i2mjiHQMAxPwD/a7Zr48AAAAASUVORK5CYII=';

const FIRST_NAMES = ['Anna', 'Boris', 'Clara', 'Dmitri', 'Elena', 'Fyodor', 'Galina', 'Igor',
  'Katya', 'Leonid', 'Marina', 'Nikolai', 'Olga', 'Pavel', 'Raisa', 'Sergei', 'Tatiana', 'Yuri'];
const LAST_NAMES = ['Antonov', 'Belov', 'Chernov', 'Dubov', 'Egorov', 'Fomin', 'Gurov',
  'Ivanov', 'Kuznetsov', 'Lebedev', 'Morozov', 'Novikov', 'Orlov', 'Petrov', 'Sokolov', 'Volkov'];

const pick = (arr, i) => arr[i % arr.length];
const daysAgo = (d) => new Date(Date.now() - d * 24 * 3600 * 1000);
const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);
const box = () => ({ left: 0.3, top: 0.2, width: 0.2, height: 0.3 });
const vector = (seed) => Array.from({ length: 16 }, (_, i) => Math.sin(seed + i) / 2 + 0.5);

// Meteor generates string _ids and queries collections with them. Letting the
// Mongo driver assign an ObjectId instead produces documents the application
// cannot find by id: gates fail to open, role definitions never resolve. So
// every seeded document gets a Meteor-shaped id.
const ID_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz';
const newId = () =>
  Array.from({ length: 17 }, () => ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)]).join('');

function seeded(doc) {
  return { _id: newId(), ...doc, [MARKER]: true };
}

async function clean(db) {
  let total = 0;
  for (const name of COLLECTIONS) {
    const { deletedCount } = await db.collection(name).deleteMany({ [MARKER]: true });
    if (deletedCount) console.log(`  removed ${String(deletedCount).padStart(4)} from ${name}`);
    total += deletedCount;
  }
  // Seeded operators, identified by the same marker on their roles entry.
  const roles = await db.collection('roles').find({ [MARKER]: true }).toArray();
  for (const role of roles) {
    await db.collection('users').deleteOne({ _id: role.userId });
  }
  const { deletedCount } = await db.collection('roles').deleteMany({ [MARKER]: true });
  if (deletedCount) console.log(`  removed ${deletedCount} operator account(s)`);
  console.log(`removed ${total + deletedCount} seeded document(s)`);
}

/**
 * Scenarios and the events they fired.
 *
 * Separate from seed() so `--scenarios-only` can rebuild just these: the
 * cameras outlive a reseed here, which matters when one of them has been
 * pointed at a real stream by hand.
 */
async function seedScenarios(db, camIds, camNames) {
// --- scenarios -----------------------------------------------------------
// The conditions below are the ones the engine and the builder actually
// speak (imports/api/scenarioModel.ts). An invented shape would seed a
// database no running system could produce, and the screens that read the
// condition — the archive's filters among them — would have nothing to show.
const scenarioIds = [];
const scenarioDefs = [
  {
    name: 'Unknown person in server room', severity: 'critical', enabled: true,
    condition: { kind: 'person_arrived', person: { identity: 'unknown' } },
    details: (i) => ({ tracking_id: 1000 + i, idInfo: null, similarity: 0 }),
    message: (cam) => `Unknown person arrived on ${cam}`,
  },
  {
    name: 'Crowd at the main entrance', severity: 'warning', enabled: true,
    condition: { kind: 'count', op: 'gte', value: 3 },
    details: (i) => ({ count: 3 + (i % 4) }),
    message: (cam) => `Too many people on ${cam}`,
  },
  {
    name: 'Movement after hours', severity: 'info', enabled: false,
    condition: { kind: 'motion', state: 'present', threshold: 1.0 },
    schedule: { days: [], from: '22:00', to: '06:00' },
    details: () => ({}),
    message: (cam) => `Movement after hours on ${cam}`,
  },
  {
    name: 'Weapon mentioned in scene', severity: 'critical', enabled: true,
    condition: { kind: 'scene', keywords: ['gun', 'knife', 'fight'] },
    details: (i) => ({ keyword: ['gun', 'knife', 'fight'][i % 3], caption: 'a person holding something' }),
    message: (cam) => `Scene keyword on ${cam}`,
  },
  {
    name: 'Known visitor at reception', severity: 'info', enabled: true,
    condition: { kind: 'person_arrived', person: { identity: 'known', similarity: 0.7 } },
    details: (i) => ({ tracking_id: 2000 + i, idInfo: null, similarity: 0.8 }),
    message: (cam) => `Recognised visitor arrived on ${cam}`,
  },
  {
    name: 'Camera stopped responding', severity: 'warning', enabled: true,
    condition: { kind: 'camera', state: 'offline' },
    details: (i) => ({ silentSec: 30 + i }),
    message: (cam) => `Camera offline (${30}s silent) on ${cam}`,
  },
];
for (let i = 0; i < scenarioDefs.length; i++) {
  const d = scenarioDefs[i];
  const { insertedId } = await db.collection('scenarios_v2').insertOne(seeded({
    name: d.name,
    enabled: d.enabled,
    scope: { kind: 'cams', camIds: [camIds[i % camIds.length]] },
    rule: { condition: d.condition },
    ...(d.schedule ? { schedule: d.schedule } : {}),
    severity: d.severity,
    cooldownSec: 60,
    createdAt: daysAgo(10 - i),
    triggerCount: 0,
  }));
  scenarioIds.push(String(insertedId));
}

const events = [];
for (let i = 0; i < 55; i++) {
  const n = i % scenarioIds.length;
  const d = scenarioDefs[n];
  const cam = pick(camNames, i);
  events.push(seeded({
    scenarioId: scenarioIds[n],
    scenarioName: d.name,
    severity: d.severity,
    camId: camIds[i % camIds.length],
    message: d.message(cam),
    details: d.details(i),
    triggeredAt: minutesAgo(i * 19),
    seen: i % 3 !== 0,
  }));
}
await db.collection('scenario_events_v2').insertMany(events);
}

async function seed(db) {
  // --- structure -----------------------------------------------------------
  const zoneIds = [];
  for (const name of ['Main building', 'Warehouse', 'Parking', 'Server room']) {
    const { insertedId } = await db.collection('zones').insertOne(seeded({ parent: 'root', name }));
    zoneIds.push(String(insertedId));
  }

  const divisionIds = [];
  for (const name of ['Engineering', 'Logistics', 'Security']) {
    const { insertedId } = await db.collection('divisions').insertOne(seeded({ parent: 'root', name }));
    divisionIds.push(String(insertedId));
  }

  const camIds = [];
  const camNames = ['Lobby', 'Warehouse gate', 'Parking north', 'Server room door'];
  for (let i = 0; i < camNames.length; i++) {
    const { insertedId } = await db.collection('cams').insertOne(seeded({
      name: camNames[i],
      streamurl: `rtsp://camera-${i + 1}.local:554/stream`,
      faceAlert: i % 2 === 0,
      accessControl: i !== 2,
      zone: zoneIds[i % zoneIds.length],
      captionKeywords: i === 0 ? ['fire', 'smoke'] : [],
    }));
    camIds.push(String(insertedId));
  }

  for (let i = 0; i < camIds.length; i++) {
    await db.collection('cam_line_defs').insertOne(seeded({
      camId: camIds[i], label: `Line ${i + 1}`, orientation: i % 2 ? 'h' : 'v',
    }));
    await db.collection('cam_zone_defs').insertOne(seeded({
      camId: camIds[i], label: `Area ${i + 1}`,
      points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
    }));
    await db.collection('cam_live_status').insertOne(seeded({
      camId: camIds[i], online: i !== 3, lastSeen: minutesAgo(i * 3),
    }));
  }

  const controllerIds = [];
  for (const [name, address] of [['Controller A', '192.168.10.11'], ['Controller B', '192.168.10.12']]) {
    const { insertedId } = await db.collection('controllers').insertOne(seeded({
      name, manufacturer: 'Apollo', address,
    }));
    controllerIds.push(String(insertedId));
  }

  const gateIds = [];
  const gateNames = ['Main entrance', 'Warehouse gate', 'Server room'];
  for (let i = 0; i < gateNames.length; i++) {
    const { insertedId } = await db.collection('gates').insertOne(seeded({
      name: gateNames[i],
      zone: zoneIds[i % zoneIds.length],
      apacsId: `apacs-${1000 + i}`,
      interfaces: [{
        cam: camIds[i % camIds.length],
        action: i % 2 === 0 ? 'entrance' : 'exit',
        lockSettings: {
          enabled: true, reader_id: `reader-${i}`, reader_node: i, reader_lda: 1,
          tfa: false, singlePerson: true, unknownPerson: false, controller: controllerIds[i % controllerIds.length],
        },
      }],
    }));
    gateIds.push(String(insertedId));
  }

  const { insertedId: alertListId } = await db.collection('alertlists').insertOne(seeded({
    name: 'Watch list', color: '#FF4444',
  }));

  // --- people and their traffic -------------------------------------------
  const PEOPLE = 60;
  const personIds = [];
  for (let i = 0; i < PEOPLE; i++) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i * 3 + 1);
    const { insertedId } = await db.collection('visitsSummary').insertOne(seeded({
      face_b64: PLACEHOLDER_IMAGE,
      person_b64: PLACEHOLDER_IMAGE,
      face_model: vector(i),
      timestamp: minutesAgo(i * 17),
      face_box: box(),
      person_box: box(),
      source: camIds[i % camIds.length],
      idInfo: {
        firstName: first,
        lastName: last,
        comment: i % 9 === 0 ? 'Contractor' : '',
        alertList: i % 11 === 0 ? String(alertListId) : '',
        alertpause: 60,
        alertThreshold: 0.6,
        cA: i % 3 !== 0,                       // has access control rights
        divission: divisionIds[i % divisionIds.length],
        accessCard: [`CARD-${2000 + i}`],
        allowedGates: gateIds.slice(0, (i % gateIds.length) + 1),
        syncId: undefined,
        bypassFace: false,
      },
    }));
    personIds.push(String(insertedId));
  }

  const visits = [];
  for (let i = 0; i < 420; i++) {
    const personId = personIds[i % personIds.length];
    visits.push(seeded({
      face_b64: PLACEHOLDER_IMAGE,
      person_b64: PLACEHOLDER_IMAGE,
      face_model: vector(i),
      tracking_id: personId,
      timestamp: minutesAgo(i * 7),
      face_box: box(),
      person_box: box(),
      source: camIds[i % camIds.length],
      reference: i % 37 === 0,
      similarity: 0.7 + (i % 30) / 100,
      par: { gender: i % 2 ? 1 : 0, head_color: 'dark', upper_color: 'blue', lower_color: 'black' },
    }));
  }
  await db.collection('visits').insertMany(visits);

  const reports = [];
  for (let i = 0; i < 120; i++) {
    reports.push(seeded({
      face_b64: PLACEHOLDER_IMAGE,
      face_model: vector(i),
      tracking_id: personIds[i % personIds.length],
      timestamp: minutesAgo(i * 23),
      source: camIds[i % camIds.length],
      reference: false,
      idInfo: personIds[i % personIds.length],
      type: i % 2 === 0 ? 'entrance' : 'exit',
      similarity: 0.8,
      model_id: `model-${i % 5}`,
    }));
  }
  await db.collection('accessReports').insertMany(reports);

  // --- alerts --------------------------------------------------------------
  const intruders = [];
  for (let i = 0; i < 45; i++) {
    intruders.push(seeded({
      face_b64: PLACEHOLDER_IMAGE,
      person_b64: PLACEHOLDER_IMAGE,
      face_model: vector(i),
      tracking_id: `unknown-${i}`,
      timestamp: minutesAgo(i * 31),
      face_box: box(),
      person_box: box(),
      source: camIds[i % camIds.length],
      seen: i % 3 !== 0,
      seenBy: i % 3 !== 0 ? 'admin' : null,
      seenAt: i % 3 !== 0 ? minutesAgo(i * 30) : null,
    }));
  }
  await db.collection('intruderalerts').insertMany(intruders);

  const archive = [];
  for (let i = 0; i < 40; i++) {
    archive.push(seeded({
      face_b64: PLACEHOLDER_IMAGE,
      person_b64: PLACEHOLDER_IMAGE,
      face_model: vector(i),
      tracking_id: personIds[i % personIds.length],
      timestamp: minutesAgo(i * 41),
      face_box: box(),
      person_box: box(),
      source: camIds[i % camIds.length],
      reference: false,
      seen: i % 4 !== 0,
      seenBy: i % 4 !== 0 ? 'admin' : 'root',
      seenAt: i % 4 !== 0 ? minutesAgo(i * 40) : null,
      listId: String(alertListId),
    }));
  }
  await db.collection('alertsArchive').insertMany(archive);

  const captions = [];
  for (let i = 0; i < 18; i++) {
    captions.push(seeded({
      source: camIds[i % camIds.length],
      text: `A person is standing near the ${pick(['door', 'window', 'shelf', 'gate'], i)}`,
      keyword: pick(['fire', 'smoke', 'crowd'], i),
      timestamp: minutesAgo(i * 53),
      // Deliberately not a multiple of the camera count: tying both to the
      // same counter left every camera either all-seen or all-unseen.
      seen: i % 3 === 0,
      seenBy: i % 3 === 0 ? 'admin' : undefined,
      seenAt: i % 3 === 0 ? minutesAgo(i * 52) : null,
    }));
  }
  await db.collection('captionAlerts').insertMany(captions);

  await seedScenarios(db, camIds, camNames);

  // --- misc ----------------------------------------------------------------
  const cards = [];
  for (let i = 0; i < 12; i++) {
    cards.push(seeded({
      personId: personIds[i],
      cardNumber: `TMP-${500 + i}`,
      status: i % 4 === 0 ? 'removed' : 'attached',
      attachedAt: minutesAgo(i * 120),
      removedAt: i % 4 === 0 ? minutesAgo(i * 60) : undefined,
      attachedBy: 'admin',
    }));
  }
  await db.collection('temporaryCards').insertMany(cards);

  const recordings = [];
  for (let i = 0; i < 36; i++) {
    const startedAt = minutesAgo(i * 45);
    recordings.push(seeded({
      camId: camIds[i % camIds.length],
      camName: camNames[i % camNames.length],
      filename: `segment-${i}.mp4`,
      path: `/var/lib/deskpass/dvr/${camIds[i % camIds.length]}/segment-${i}.mp4`,
      source: 'ai',
      streamUrl: `rtsp://camera-${(i % 4) + 1}.local:554/stream`,
      startedAt,
      endedAt: new Date(startedAt.getTime() + 15 * 60 * 1000),
      duration: 900,
      sizeBytes: 40_000_000 + i * 1000,
      status: 'completed',
    }));
  }
  await db.collection('recordings').insertMany(recordings);

  const camEvents = [];
  for (let i = 0; i < 60; i++) {
    camEvents.push(seeded({
      source: camIds[i % camIds.length],
      timestamp: minutesAgo(i * 11),
      kind: pick(['motion', 'line-cross', 'zone-enter'], i),
      payload: { trackingId: personIds[i % personIds.length] },
    }));
  }
  await db.collection('cam_events').insertMany(camEvents);

  return { zoneIds, camIds, gateIds, personIds, scenarioIds, alertListId };
}

/**
 * Two operators with different capabilities, so the authorisation work can be
 * checked from the UI: `shift-operator` may look at gates but not open them,
 * `shift-lead` may do both.
 */
async function seedOperators(db) {
  const definitions = [
    { name: 'Shift operator', permissions: ['gates.view'] },
    { name: 'Shift lead', permissions: ['gates.view', 'gates.unlock'] },
  ];
  const created = [];

  const client = await anonymousClient();
  try {
    const login = await client.login(ADMIN_USER, ADMIN_PASS);
    if (login.error) {
      console.log(`  ! could not sign in as ${ADMIN_USER}: operators not created`);
      return created;
    }

    for (const def of definitions) {
      const { insertedId } = await db.collection('roleDefinitions').insertOne(seeded({
        name: def.name, permissions: def.permissions, createdAt: new Date(),
      }));
      const username = def.name.toLowerCase().replace(/\s+/g, '-');
      const password = `${username}-pass`;

      // The app registers its methods inside an async Meteor.startup, after
      // awaiting the DVR and ONVIF setup, so for a few seconds after boot it
      // answers "Method not found" to a perfectly valid call. Retry rather
      // than fail the seed.
      let res;
      for (let attempt = 1; attempt <= 10; attempt++) {
        res = await client.call('operators.insert', [{ username, password, roleId: String(insertedId) }]);
        if (!res.error || !String(res.error.error).includes('404')) break;
        if (!/not found/i.test(res.error.reason || '')) break;
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (res.error) {
        console.log(`  ! could not create ${username}: ${res.error.reason || res.error.error}`);
        continue;
      }
      const user = await db.collection('users').findOne({ username });
      if (user) await db.collection('roles').updateOne({ userId: String(user._id) }, { $set: { [MARKER]: true } });
      created.push({ username, password, permissions: def.permissions });
    }
  } finally {
    client.close();
  }
  return created;
}

const mongo = new MongoClient(MONGO_URL);
await mongo.connect();
const db = mongo.db();

if (CLEAN) {
  console.log('removing seeded data...');
  await clean(db);
} else if (SCENARIOS_ONLY) {
  console.log('rebuilding scenarios and their events...');
  for (const name of ['scenarios_v2', 'scenario_events_v2']) {
    const { deletedCount } = await db.collection(name).deleteMany({ [MARKER]: true });
    console.log(`  ${name}: removed ${deletedCount}`);
  }
  const cams = await db.collection('cams').find({ [MARKER]: true }).toArray();
  if (!cams.length) throw new Error('no seeded cameras to attach scenarios to; run a full seed first');
  await seedScenarios(db, cams.map(c => String(c._id)), cams.map(c => c.name));
  console.log(`  scenarios rebuilt against ${cams.length} cameras`);
} else if (OPERATORS_ONLY) {
  console.log('creating operator accounts...');
  for (const op of await seedOperators(db)) {
    console.log(`  operator: ${op.username} / ${op.password}  (${op.permissions.join(', ')})`);
  }
} else {
  console.log('seeding development data...');
  const summary = await seed(db);
  const operators = await seedOperators(db);

  console.log('');
  console.log(`  zones            ${summary.zoneIds.length}`);
  console.log(`  cameras          ${summary.camIds.length}`);
  console.log(`  gates            ${summary.gateIds.length}`);
  console.log(`  people           ${summary.personIds.length}`);
  console.log('  visits           420');
  console.log('  access reports   120');
  console.log('  intruder alerts  45');
  console.log('  archive alerts   40');
  console.log('  caption alerts   18');
  console.log('  scenario events  55');
  console.log('  recordings       36');
  console.log('');
  for (const op of operators) {
    console.log(`  operator: ${op.username} / ${op.password}  (${op.permissions.join(', ')})`);
  }
  console.log('');
  console.log('run with --clean to remove all of it');
}

await mongo.close();
