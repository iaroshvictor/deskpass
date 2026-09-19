/**
 * Which fields a screen may filter on, and with which operators.
 *
 * A filter arrives from the client as a query document, so anything not
 * whitelisted here would run on the database as written: `$where` executes
 * JavaScript, a crafted `$regex` pins a core, `$ne` turns "my own records"
 * into "everyone's". `sanitizeFilter` keeps only what is listed and drops the
 * rest, so an overlooked screen shows unfiltered data rather than erroring.
 *
 * The publications and the counters behind the same screen share one spec:
 * they receive the same filter object from the same filter bar, and if they
 * disagreed the count would not match the list.
 */
export const VISIT_FILTER = { fields: {
  tracking_id: [], source: ['$in'], reference: [], _id: ['$in'],
  timestamp: ['$gte', '$lte'],
} };

export const INTRUDER_FILTER = { fields: {
  source: ['$in'], seen: [], tracking_id: [], timestamp: ['$gte', '$lte'],
} };

export const ALERTS_FILTER = { fields: {
  source: ['$in'], seen: [], seenBy: ['$ne'], label: [], timestamp: ['$gte', '$lte'],
} };

export const ACCESS_REPORT_FILTER = { fields: {
  idInfo: ['$in'], source: ['$in'], timestamp: ['$gte', '$lte'],
} };

export const CAPTION_FILTER = { fields: {
  source: [], camId: [], seen: [], timestamp: ['$gte', '$lte'],
} };

export const SCENARIO_EVENT_FILTER = { fields: {
  scenarioId: ['$in'], camId: ['$in'], seen: [], severity: ['$in'],
  message: ['$regex', '$options'], triggeredAt: ['$gte', '$lte'],
} };

export const TEMPORARY_CARD_FILTER = { fields: {
  card: [], idInfo: ['$in'], source: ['$in'], attachedAt: ['$gte', '$lte'],
} };

export const SUMMARY_FILTER = {
  fields: {
    _id: ['$in'], source: [], face_b64: ['$exists'], idInfo: ['$exists', '$in'],
    'idInfo.cA': [], 'idInfo.divission': ['$in'], timestamp: ['$gte', '$lte'],
  },
  allowOr: true,
};
