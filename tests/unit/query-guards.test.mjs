// Unit tests for the query guards used by publications.
//
// Written before the module exists: they specify the API that server/main.ts
// publications will call instead of passing the client's filter to find().
// Pure functions, no Meteor, no database.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clampLimit, clampSkip, sanitizeFilter, sanitizeSort } from '../../imports/security/queryGuards.ts';

describe('clampLimit', () => {
  test('keeps a sane page size', () => {
    assert.equal(clampLimit(50, { max: 500, fallback: 100 }), 50);
  });

  test('caps an oversized page', () => {
    assert.equal(clampLimit(1000000, { max: 500, fallback: 100 }), 500);
  });

  test('treats 0 as "use the default", never as "unlimited"', () => {
    // The current code does the opposite: `if (limit !== 0) options.limit = limit`.
    assert.equal(clampLimit(0, { max: 500, fallback: 100 }), 100);
  });

  test('rejects negatives, NaN and non-numbers by falling back', () => {
    for (const bad of [-1, -1000, NaN, Infinity, '50', null, undefined, {}]) {
      assert.equal(clampLimit(bad, { max: 500, fallback: 100 }), 100, `input: ${String(bad)}`);
    }
  });

  test('never exceeds max even when the fallback is larger', () => {
    assert.equal(clampLimit(undefined, { max: 10, fallback: 100 }), 10);
  });
});

describe('sanitizeFilter', () => {
  const allowed = ['source', 'timestamp', 'tracking_id'];

  test('passes whitelisted equality fields through', () => {
    assert.deepEqual(sanitizeFilter({ source: 'cam-1' }, allowed), { source: 'cam-1' });
  });

  test('drops fields that are not whitelisted', () => {
    assert.deepEqual(sanitizeFilter({ source: 'cam-1', secret: 'x' }, allowed), { source: 'cam-1' });
  });

  test('rejects top-level query operators', () => {
    assert.throws(() => sanitizeFilter({ $where: 'true' }, allowed), /operator/i);
    assert.throws(() => sanitizeFilter({ $or: [{ source: 'a' }] }, allowed), /operator/i);
  });

  test('rejects operator objects as values', () => {
    assert.throws(() => sanitizeFilter({ source: { $ne: null } }, allowed), /operator/i);
    assert.throws(() => sanitizeFilter({ source: { $regex: '.*' } }, allowed), /operator/i);
  });

  test('allows an explicit date range on a whitelisted field', () => {
    const from = new Date('2026-01-01'), to = new Date('2026-02-01');
    assert.deepEqual(
      sanitizeFilter({ timestamp: { from, to } }, allowed),
      { timestamp: { $gte: from, $lte: to } },
    );
  });

  test('rejects dotted paths that could reach into nested documents', () => {
    assert.throws(() => sanitizeFilter({ 'par.name': 'x' }, allowed), /field/i);
  });

  test('returns an empty filter for empty or non-object input', () => {
    for (const input of [undefined, null, {}, 'string', 42, []]) {
      assert.deepEqual(sanitizeFilter(input, allowed), {}, `input: ${String(input)}`);
    }
  });

  test('does not mutate the caller object', () => {
    const input = { source: 'cam-1', secret: 'x' };
    sanitizeFilter(input, allowed);
    assert.deepEqual(input, { source: 'cam-1', secret: 'x' });
  });
});

describe('sanitizeSort', () => {
  const allowed = ['timestamp', 'source'];

  test('accepts a whitelisted field in either direction', () => {
    assert.deepEqual(sanitizeSort({ timestamp: -1 }, allowed, { timestamp: -1 }), { timestamp: -1 });
    assert.deepEqual(sanitizeSort({ source: 1 }, allowed, { timestamp: -1 }), { source: 1 });
  });

  test('falls back when the field is not whitelisted', () => {
    assert.deepEqual(sanitizeSort({ password: 1 }, allowed, { timestamp: -1 }), { timestamp: -1 });
  });

  test('falls back on a malformed direction', () => {
    assert.deepEqual(sanitizeSort({ timestamp: 'asc' }, allowed, { timestamp: -1 }), { timestamp: -1 });
  });
});

describe('sanitizeFilter with a per-field operator whitelist', () => {
  // The real screens send operators: multi-select pickers produce $in, date
  // pickers produce $gte/$lte, the scenario archive search box produces
  // $regex. The spec form allows exactly those, per field.
  const spec = {
    fields: {
      source: ['$in'],
      timestamp: ['$gte', '$lte'],
      seen: [],
      seenBy: ['$ne'],
      message: ['$regex', '$options'],
      'idInfo.cA': [],
    },
    allowOr: true,
  };

  test('accepts $in on a field that allows it', () => {
    assert.deepEqual(
      sanitizeFilter({ source: { $in: ['a', 'b'] } }, spec),
      { source: { $in: ['a', 'b'] } },
    );
  });

  test('accepts a date range', () => {
    const from = new Date('2026-01-01'), to = new Date('2026-02-01');
    assert.deepEqual(
      sanitizeFilter({ timestamp: { $gte: from, $lte: to } }, spec),
      { timestamp: { $gte: from, $lte: to } },
    );
  });

  test('refuses an operator the field does not allow', () => {
    assert.throws(() => sanitizeFilter({ source: { $ne: null } }, spec), /not accepted on field/);
    assert.throws(() => sanitizeFilter({ seen: { $in: [true] } }, spec), /not accepted on field/);
  });

  test('refuses operators nobody is allowed to send', () => {
    assert.throws(() => sanitizeFilter({ $where: 'true' }, spec), /top-level operator/);
    assert.throws(() => sanitizeFilter({ source: { $function: {} } }, spec), /not accepted/);
  });

  test('allows a dotted field only when the spec names it', () => {
    assert.deepEqual(sanitizeFilter({ 'idInfo.cA': true }, spec), { 'idInfo.cA': true });
    assert.throws(() => sanitizeFilter({ 'idInfo.secret': true }, spec), /dotted path/);
  });

  test('escapes a search pattern into a literal match', () => {
    const out = sanitizeFilter({ message: { $regex: 'a.*b', $options: 'i' } }, spec);
    // The stored pattern matches the literal text "a.*b", not "any a, then
    // anything, then b".
    assert.deepEqual(out, { message: { $regex: 'a\\.\\*b', $options: 'i' } });
  });

  test('caps the size of a search pattern and of an $in list', () => {
    assert.throws(() => sanitizeFilter({ message: { $regex: 'x'.repeat(500) } }, spec), /too long/);
    assert.throws(
      () => sanitizeFilter({ source: { $in: Array.from({ length: 501 }, (_, i) => String(i)) } }, spec),
      /too many values/,
    );
  });

  test('validates operand types', () => {
    assert.throws(() => sanitizeFilter({ source: { $in: 'not-an-array' } }, spec), /needs an array/);
    assert.throws(() => sanitizeFilter({ timestamp: { $gte: {} } }, spec), /needs a date/);
  });

  test('keeps a whitelisted $or and sanitises every branch', () => {
    const out = sanitizeFilter(
      { $or: [{ seen: false }, { secret: 'dropped' }, { source: { $in: ['x'] } }] },
      spec,
    );
    assert.deepEqual(out, { $or: [{ seen: false }, { source: { $in: ['x'] } }] });
  });

  test('refuses $or when the publication does not allow it', () => {
    assert.throws(
      () => sanitizeFilter({ $or: [{ seen: false }] }, { fields: spec.fields }),
      /top-level operator/,
    );
  });
});

describe('clampSkip', () => {
  test('passes a sane offset through', () => {
    assert.equal(clampSkip(200), 200);
  });

  test('refuses a negative or malformed offset', () => {
    for (const bad of [-1, -1000, NaN, Infinity, '10', null, undefined, {}]) {
      assert.equal(clampSkip(bad), 0, `input: ${String(bad)}`);
    }
  });

  test('caps an absurd offset', () => {
    assert.equal(clampSkip(50_000_000), 1_000_000);
  });
});
