/**
 * Guards for queries that arrive from a client.
 *
 * Publications used to hand the client's `filter` straight to find() and let
 * the client pick `limit`, so any connected party could run an arbitrary Mongo
 * query and ask for the whole collection.
 *
 * The screens in this app legitimately send operators — `$in` for multi-select
 * pickers, `$gte`/`$lte` for date ranges, `$regex` for a search box — so the
 * rule is not "no operators" but "only these operators, only on these fields,
 * only with operands of the right shape". A field the spec does not mention is
 * dropped rather than rejected: a screen that filters on something we missed
 * shows unfiltered data instead of breaking.
 *
 * Deliberately free of Meteor imports so the logic can be unit tested as plain
 * functions — see tests/unit/query-guards.test.mjs.
 */

export interface LimitBounds {
  /** Largest page the server will ever return. */
  max: number;
  /** Page size used when the client sends nothing usable. */
  fallback: number;
}

/** A date window the client may ask for on a whitelisted field. */
export interface DateRange {
  from?: Date;
  to?: Date;
}

/** Per-field operator whitelist. An empty list means equality only. */
export interface FilterSpec {
  fields: Readonly<Record<string, readonly string[]>>;
  /** Allow a top-level `$or` whose branches are validated the same way. */
  allowOr?: boolean;
}

/** Operators this module knows how to validate. Anything else is refused. */
const KNOWN_OPERATORS = new Set([
  '$in', '$nin', '$gte', '$lte', '$gt', '$lt', '$exists', '$ne', '$regex', '$options',
]);

const MAX_IN_LENGTH = 500;
const MAX_REGEX_LENGTH = 200;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);

const isScalar = (v: unknown): boolean =>
  v === null || v instanceof Date ||
  ['string', 'number', 'boolean'].includes(typeof v);

/**
 * Clamp a client-supplied page size.
 *
 * Anything that is not a positive integer — including 0, which the old code
 * treated as "no limit at all" — falls back to the default page, and nothing
 * ever exceeds `max`.
 */
export function clampLimit(value: unknown, { max, fallback }: LimitBounds): number {
  const ceiling = Math.max(1, Math.floor(max));
  const usable = typeof value === 'number' && Number.isInteger(value) && value > 0;
  const wanted = usable ? (value as number) : Math.floor(fallback);
  return Math.min(Math.max(1, wanted), ceiling);
}

/** Clamp a client-supplied offset: never negative, never absurd. */
export function clampSkip(value: unknown, max = 1000000): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return 0;
  return Math.min(value, max);
}

/** Turn user text into a literal pattern: a search box must not ship a regex engine. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, (match) => '\\' + match);
}

function validateOperand(field: string, operator: string, operand: unknown): unknown {
  switch (operator) {
    case '$in':
    case '$nin': {
      if (!Array.isArray(operand)) throw new Error(`operator "${operator}" on "${field}" needs an array`);
      if (operand.length > MAX_IN_LENGTH) throw new Error(`operator "${operator}" on "${field}" has too many values`);
      if (!operand.every(isScalar)) throw new Error(`operator "${operator}" on "${field}" accepts scalars only`);
      return operand;
    }
    case '$gte': case '$lte': case '$gt': case '$lt': {
      if (!(operand instanceof Date) && typeof operand !== 'number' && typeof operand !== 'string') {
        throw new Error(`operator "${operator}" on "${field}" needs a date, number or string`);
      }
      return operand;
    }
    case '$exists': {
      if (typeof operand !== 'boolean') throw new Error(`operator "$exists" on "${field}" needs a boolean`);
      return operand;
    }
    case '$ne': {
      if (!isScalar(operand)) throw new Error(`operator "$ne" on "${field}" accepts scalars only`);
      return operand;
    }
    case '$regex': {
      if (typeof operand !== 'string') throw new Error(`operator "$regex" on "${field}" needs a string`);
      if (operand.length > MAX_REGEX_LENGTH) throw new Error(`search text on "${field}" is too long`);
      // Escaped on purpose: the search boxes want a literal substring match,
      // and an unescaped pattern from a text input is a denial-of-service
      // waiting to happen.
      return escapeRegex(operand);
    }
    case '$options': {
      if (operand !== 'i' && operand !== '') throw new Error(`only case-insensitive search is supported on "${field}"`);
      return operand;
    }
    default:
      throw new Error(`operator "${operator}" is not accepted from a client`);
  }
}

function sanitizeValue(field: string, value: unknown, allowedOperators: readonly string[]): unknown {
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    const operatorKeys = keys.filter((k) => k.startsWith('$'));

    // Sugar kept for callers that prefer it over raw operators.
    if (!operatorKeys.length && ('from' in value || 'to' in value)) {
      const range = value as DateRange;
      const bounds: Record<string, Date> = {};
      if (range.from instanceof Date) bounds.$gte = range.from;
      if (range.to instanceof Date) bounds.$lte = range.to;
      return Object.keys(bounds).length ? bounds : undefined;
    }

    if (operatorKeys.length !== keys.length) {
      throw new Error(`field "${field}" mixes operators with plain keys`);
    }

    const out: Record<string, unknown> = {};
    for (const operator of operatorKeys) {
      if (!KNOWN_OPERATORS.has(operator) || !allowedOperators.includes(operator)) {
        throw new Error(`operator "${operator}" is not accepted on field "${field}"`);
      }
      out[operator] = validateOperand(field, operator, value[operator]);
    }
    return out;
  }

  if (!isScalar(value)) throw new Error(`field "${field}" must be a scalar value`);
  return value;
}

/**
 * Build a Mongo filter from client input.
 *
 * `spec` is either a list of fields that accept equality only, or a
 * {@link FilterSpec} naming the operators each field allows.
 */
export function sanitizeFilter(
  filter: unknown,
  spec: readonly string[] | FilterSpec,
): Record<string, unknown> {
  if (!isPlainObject(filter)) return {};

  const fields: Record<string, readonly string[]> = Array.isArray(spec)
    ? Object.fromEntries((spec as readonly string[]).map((f) => [f, [] as readonly string[]]))
    : (spec as FilterSpec).fields;
  const allowOr = !Array.isArray(spec) && Boolean((spec as FilterSpec).allowOr);

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or' && allowOr) {
      if (!Array.isArray(value)) throw new Error('"$or" needs an array of sub-filters');
      const branches = value
        .map((branch) => sanitizeFilter(branch, spec))
        .filter((branch) => Object.keys(branch).length);
      if (branches.length) out.$or = branches;
      continue;
    }
    if (key.startsWith('$')) {
      throw new Error(`top-level operator "${key}" is not accepted from a client`);
    }
    if (key.includes('.') && !(key in fields)) {
      throw new Error(`field "${key}" uses a dotted path, which is not accepted from a client`);
    }
    if (!(key in fields)) continue;   // unknown fields are dropped, not an error

    const sanitized = sanitizeValue(key, value, fields[key]);
    if (sanitized !== undefined) out[key] = sanitized;
  }

  return out;
}

/** Keep a client-chosen sort only when it names a whitelisted field. */
export function sanitizeSort(
  sort: unknown,
  allowedFields: readonly string[],
  fallback: Record<string, 1 | -1>,
): Record<string, 1 | -1> {
  if (!isPlainObject(sort)) return fallback;

  const allowed = new Set(allowedFields);
  const entries = Object.entries(sort);
  if (entries.length !== 1) return fallback;

  const [field, direction] = entries[0];
  if (!allowed.has(field)) return fallback;
  if (direction !== 1 && direction !== -1) return fallback;

  return { [field]: direction };
}
