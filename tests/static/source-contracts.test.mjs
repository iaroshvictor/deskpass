// Source-level contracts.
//
// These cover defects a request against a running server cannot show: a guard
// that must exist before a destructive call, writes whose result is never
// awaited, silently swallowed errors. They read the repository, so they run
// without the app.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => readFileSync(p, 'utf8');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) { if (entry !== 'node_modules') walk(p, out); }
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const sourceFiles = [...walk('server'), ...walk('imports')];

// A method is guarded either by checking the session inline or by calling one
// of the helpers in imports/security/guards.ts, which throw on their own.
const GUARD_CALL = /this\.userId|requireUser\(this|requirePermission\(this/;

describe('destructive methods carry an authorisation guard', () => {
  const main = read('server/main.ts');

  const mustGuard = {
    setTgBot: 'replaces the Telegram bot token and deletes every session',
    setApacsConfig: 'overwrites the APACS credentials and reconnects the integration',
    restartCamHandler: 'restarts a camera pipeline',
    doApolloSync: 'triggers a full APACS synchronisation',
    getUserName: 'resolves account ids to usernames',
  };

  for (const [method, risk] of Object.entries(mustGuard)) {
    test(`${method} is guarded`, () => {
      let start = main.indexOf(`async ${method}(`);
      if (start < 0) start = main.indexOf(`${method}:`);
      assert.ok(start > 0, `method ${method} not found in server/main.ts`);
      const body = main.slice(start, start + 1200);
      const end = body.indexOf('\n    },');
      const scoped = end > 0 ? body.slice(0, end) : body;
      assert.match(scoped, GUARD_CALL, `${method} (${risk}) has no authorisation guard`);
    });
  }
});

describe('zone methods are guarded', () => {
  const src = read('imports/applications/common/zones/serverMethods.ts');
  for (const m of ['addZoneItem', 'editZone', 'deleteZone']) {
    test(`${m} is guarded`, () => {
      const start = src.indexOf(m);
      assert.ok(start >= 0, `${m} not found in zones/serverMethods.ts`);
      assert.match(src.slice(start, start + 400), GUARD_CALL,
        `${m} writes to the database without an authorisation guard`);
    });
  }
});

describe('database writes are awaited', () => {
  const offenders = [];
  for (const file of sourceFiles) {
    read(file).split('\n').forEach((line, i) => {
      const isWrite = /^\s*[A-Za-z_][\w.]*\.(insertAsync|updateAsync|removeAsync|upsertAsync)\(/.test(line);
      if (isWrite && !/await|return|=>/.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
    });
  }
  test('no unawaited insert/update/remove/upsert calls', () => {
    assert.equal(offenders.length, 0,
      `${offenders.length} database write(s) are never awaited:\n  ${offenders.join('\n  ')}`);
  });
});

describe('errors are not silently swallowed', () => {
  // Ignoring a failure is sometimes right — a socket being torn down, a redis
  // frame arriving malformed ten times a second. What is never right is doing
  // it without saying so, which leaves the next reader unable to tell a
  // deliberate decision from an oversight. A catch must therefore either
  // handle the error or carry a comment explaining why it does not.
  const BUDGET = Number(process.env.DESKPASS_EMPTY_CATCH_BUDGET || 0);
  const offenders = [];
  for (const file of sourceFiles) {
    const src = read(file);
    const re = /catch\s*(\([^)]*\))?\s*\{\s*\}/g;   // nothing at all between the braces
    let m;
    while ((m = re.exec(src))) offenders.push(`${file}:${src.slice(0, m.index).split('\n').length}`);
  }
  test(`at most ${BUDGET} unexplained catch blocks`, () => {
    assert.ok(offenders.length <= BUDGET,
      `${offenders.length} catch block(s) swallow a failure with no handling and no explanation:\n  ${offenders.join('\n  ')}`);
  });
});

describe('hand-fed publications signal readiness', () => {
  // A publication that pushes documents itself with observeChanges/this.added
  // must call this.ready(): Meteor only does that automatically for a
  // returned cursor. Without it the client's subscription never completes and
  // every screen gated on isLoading() spins forever, even though the data
  // arrived.
  const src = read('server/main.ts');
  const lines = src.split('\n');
  const offenders = [];

  for (let i = 0; i < lines.length; i++) {
    const name = lines[i].match(/Meteor\.publish\(\s*['"]([^'"]+)['"]/)?.[1];
    if (!name) continue;

    let depth = 0, started = false, body = '';
    for (let j = i; j < lines.length; j++) {
      body += lines[j] + '\n';
      for (const ch of lines[j]) {
        if (ch === '{') { depth++; started = true; }
        if (ch === '}') depth--;
      }
      if (started && depth <= 0) break;
    }

    const pushesByHand = /observeChanges|\.added\(/.test(body);
    // The anonymous guard does not count: it is the empty, refusing path.
    const signalsReady = /\.ready\(\)/.test(body.replace(/if \(!this\.userId\) return this\.ready\(\);/, ''));
    if (pushesByHand && !signalsReady) offenders.push(`${name} (server/main.ts:${i + 1})`);
  }

  test('every publication that pushes documents by hand calls this.ready()', () => {
    assert.equal(offenders.length, 0,
      `${offenders.length} publication(s) never complete for the client:\n  ${offenders.join('\n  ')}`);
  });
});

describe('indexes reference fields that exist', () => {
  test('no index on the misspelled timestap field', () => {
    assert.ok(!read('server/main.ts').includes('timestap'),
      'createIndex({ timestap: 1 }) builds a useless index; the field is timestamp');
  });
});

describe('deployment assumptions are configurable', () => {
  test('the DVR binary path is not hardcoded to one developer machine', () => {
    assert.ok(!read('server/dvrManager.ts').includes('/home/devel/'),
      'DVR_BIN falls back to /home/devel/... so recording fails silently on any other host');
  });
});

describe('the repository documents how to run the system', () => {
  test('a README exists', () => {
    const found = readdirSync('.').some((f) => /^readme(\.|$)/i.test(f));
    assert.ok(found, 'no README: Redis, the perception service, DVR_BIN, APACS and ONVIF are undocumented');
  });
});
