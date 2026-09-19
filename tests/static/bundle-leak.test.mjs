// Server code must not reach the browser.
//
// imports/applications/**/index.ts imports both the UI components and the
// serverMethods modules, and the UI index is imported by the client. Bundlers
// keep the whole module, so server method bodies end up in the client bundle.
// This test downloads the bundle the dev server actually serves and looks for
// server-only markers.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BUNDLE_URL = process.env.DESKPASS_BUNDLE_URL || 'http://127.0.0.1:8889/client-rspack.js';

// Strings that only make sense on the server. Each one is a distinct symptom.
//
// Picked to match an implementation, never a reference: the client legitimately
// names the methods it calls (`Meteor.call('operators.insert', …)`) and renders
// fields like `gate.apacsId`, so a bare method name or the word "apacs" would
// flag healthy code. A method *definition* is the name followed by a colon.
const SERVER_ONLY_MARKERS = [
  { needle: "operators.insert':", why: 'a server method body (operator creation) is defined in the browser bundle' },
  { needle: 'Accounts.createUser', why: 'account-creation code is shipped to the browser' },
  { needle: 'RolesCollection.findOneAsync', why: 'server-side role lookups are shipped to the browser' },
  { needle: 'requirePermission(', why: 'the server-side authorisation guard is shipped to the browser' },
];

describe('client bundle contains no server code', () => {
  let bundle = '';

  before(async () => {
    const res = await fetch(BUNDLE_URL, { signal: AbortSignal.timeout(180000) });
    assert.ok(res.ok, `could not fetch the client bundle from ${BUNDLE_URL} (HTTP ${res.status})`);
    bundle = await res.text();
  });

  for (const { needle, why } of SERVER_ONLY_MARKERS) {
    test(`bundle does not contain ${needle}`, () => {
      assert.ok(!bundle.includes(needle), `${why} (found "${needle}" in the served bundle)`);
    });
  }

  test('bundle carries no server-side integration client', () => {
    // Note on what is *not* asserted here: the settings screen legitimately
    // queries SettingsCollection for `type: "apacs"` and renders the gate's
    // apacsId, so those strings in the bundle are healthy. Whether an
    // unprivileged viewer can actually read those documents is a publication
    // question, covered by tests/security/publications.test.mjs. What must
    // never ship is the server's own integration client.
    for (const needle of ['ApolloWrapper', 'node-onvif-ts', 'child_process']) {
      assert.ok(!bundle.includes(needle), `found "${needle}" in the client bundle`);
    }
  });
});
