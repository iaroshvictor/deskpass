// Fixtures for the security suite.
//
// Every security assertion here is "an outsider must NOT receive X". On an
// empty database that assertion passes for the wrong reason, so each guarded
// collection gets one canary document first. Every canary carries MARKER so
// teardown can remove exactly what the tests created and nothing else.
import { MongoClient } from 'mongodb';

export const MARKER = '__deskpass_security_fixture';
const MONGO_URL = process.env.DESKPASS_MONGO_URL || 'mongodb://127.0.0.1:3001/meteor';

/** collection -> canary document. Shapes only need to satisfy publication filters. */
function canaries() {
  const now = new Date();
  const seen = { seen: false };            // satisfies the "unseen" publications
  return {
    zones:                { name: 'CANARY zone', parent: 'root' },
    divisions:            { name: 'CANARY division' },
    cams:                 { name: 'CANARY cam', streamurl: 'rtsp://canary/stream' },
    cam_line_defs:        { camId: 'canary', label: 'CANARY line' },
    cam_zone_defs:        { camId: 'canary', label: 'CANARY zone def' },
    cam_events:           { source: 'canary', timestamp: now, kind: 'CANARY' },
    cam_live_status:      { camId: 'canary', online: true },
    captionAlerts:        { camId: 'canary', text: 'CANARY caption', timestamp: now, ...seen },
    scenarios:            { name: 'CANARY scenario v1' },
    scenario_events:      { scenarioId: 'canary', triggeredAt: now, ...seen },
    scenarios_v2:         { name: 'CANARY scenario v2' },
    scenario_events_v2:   { scenarioId: 'canary', triggeredAt: now, ...seen },
    alertsArchive:        { timestamp: now, label: 'CANARY alert', ...seen },
    intruderalerts:       { timestamp: now, tracking_id: 'canary', ...seen },
    visits:               { timestamp: now, source: 'canary', par: { name: 'CANARY person' } },
    visitsSummary:        { timestamp: now, source: 'canary' },
    visitSummaryMeta:     { source: 'canary', count: 1 },
    controllers:          { name: 'CANARY controller', apacsId: 'canary' },
    gates:                { name: 'CANARY gate', apacsId: 'canary' },
    usersMeta:            { userId: 'canary', displayName: 'CANARY operator' },
    tgsessions:           { chatId: 123456789, token: 'CANARY-telegram-session' },
    temporaryCards:       { card: 'CANARY', attachedAt: now },
    accessReports:        { timestamp: now, source: 'canary' },
    recordings:           { camId: 'canary', startedAt: now },
    alertlists:           { name: 'CANARY list' },
    roles:                { userId: 'canary', role: 'custom' },
    roleDefinitions:      { name: 'CANARY role' },
    settings:             { type: 'canary', config: 'CANARY-secret-value' },
  };
}

export async function seed() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db();
  const created = {};
  for (const [name, doc] of Object.entries(canaries())) {
    const res = await db.collection(name).insertOne({ ...doc, [MARKER]: true });
    created[name] = res.insertedId;
  }
  return { client, db, created, async cleanup() {
    for (const name of Object.keys(canaries())) {
      await db.collection(name).deleteMany({ [MARKER]: true });
    }
    await client.close();
  } };
}

/** Publication -> collection it must not leak, plus any params it needs. */
export const GUARDED_PUBLICATIONS = [
  { pub: 'zones',                      collection: 'zones' },
  { pub: 'divisions',                  collection: 'divisions' },
  { pub: 'cams',                       collection: 'cams' },
  { pub: 'cam_line_defs',              collection: 'cam_line_defs' },
  { pub: 'cam_zone_defs',              collection: 'cam_zone_defs' },
  { pub: 'cam_events',                 collection: 'cam_events' },
  { pub: 'cam_live_status',            collection: 'cam_live_status' },
  { pub: 'caption_alerts',             collection: 'captionAlerts' },
  { pub: 'caption_alerts_unseen',      collection: 'captionAlerts' },
  { pub: 'scenarios',                  collection: 'scenarios' },
  { pub: 'scenario_events',            collection: 'scenario_events' },
  { pub: 'scenario_events_unseen',     collection: 'scenario_events' },
  { pub: 'scenarios_v2',               collection: 'scenarios_v2' },
  { pub: 'scenario_events_v2',         collection: 'scenario_events_v2' },
  { pub: 'scenario_events_v2_unseen',  collection: 'scenario_events_v2' },
  { pub: 'alertsArchive',              collection: 'alertsArchive', params: [{}] },
  { pub: 'unseenAlertsArchive',        collection: 'alertsArchive' },
  { pub: 'intruderAlerts',             collection: 'intruderalerts', params: [{}] },
  { pub: 'unseenIntruders',            collection: 'intruderalerts' },
  { pub: 'visits',                     collection: 'visits', params: [{}] },
  { pub: 'visitSummaryMeta',           collection: 'visitSummaryMeta' },
  { pub: 'controllers',                collection: 'controllers' },
  { pub: 'gates',                      collection: 'gates' },
  { pub: 'usersMeta',                  collection: 'usersMeta' },
  { pub: 'tgSessions',                 collection: 'tgsessions' },
];

/**
 * Bulk canaries, for assertions about page size.
 *
 * A cap test is meaningless against a handful of documents: "returned fewer
 * than the cap" is true either way. These seed more rows than the expected
 * page size so an uncapped query is visibly different from a capped one.
 */
export async function seedMany(db, collection, count, makeDoc) {
  const docs = Array.from({ length: count }, (_, i) => ({ ...makeDoc(i), [MARKER]: true }));
  await db.collection(collection).insertMany(docs);
}
