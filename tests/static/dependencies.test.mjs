// Dependency vulnerabilities.
//
// A gate rather than a report: the suite fails while critical or high
// advisories are outstanding. Raise the thresholds deliberately, never by
// accident.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const MAX = {
  critical: Number(process.env.DESKPASS_MAX_CRITICAL || 0),
  high: Number(process.env.DESKPASS_MAX_HIGH || 0),
};

describe('npm audit', () => {
  test(`no more than ${MAX.critical} critical and ${MAX.high} high advisories`, () => {
    let out;
    try {
      out = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', shell: true });
    } catch (e) {
      out = e.stdout || '';   // npm exits non-zero whenever it finds anything
    }
    const found = JSON.parse(out).metadata?.vulnerabilities ?? {};
    assert.ok(found.critical <= MAX.critical, `${found.critical} critical advisories (allowed ${MAX.critical})`);
    assert.ok(found.high <= MAX.high, `${found.high} high advisories (allowed ${MAX.high})`);
  });
});
