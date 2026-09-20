import { Meteor } from 'meteor/meteor';
import { sanitizeFilter } from '/imports/security/queryGuards';

/**
 * sanitizeFilter for a method call.
 *
 * The guard throws a plain Error when a filter carries something a screen
 * could never have sent — a top-level operator, a dotted path, an operator
 * the field does not allow. From a publication that surfaces as a refused
 * subscription, but from a method Meteor turns any non-Meteor.Error into
 * "Internal server error", which the filter bars then show to the operator.
 * This names the problem instead, and keeps the detail server-side.
 */
export function checkedFilter<T>(filter: unknown, spec: T): Record<string, unknown> {
  try {
    return sanitizeFilter(filter, spec as never);
  } catch (error: any) {
    console.warn('[security] rejected a filter from a client:', error?.message);
    throw new Meteor.Error('invalid-filter', 'That filter is not accepted.');
  }
}
