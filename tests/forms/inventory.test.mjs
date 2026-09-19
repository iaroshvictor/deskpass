// Are all the forms accounted for?
//
// The other files in this directory test the forms listed in screens.mjs.
// That list is worth nothing if it quietly falls behind the application, so
// this suite compares it against the source on every run: a new form, a
// renamed file or a new submit button fails here until it is classified.
//
// It reads the repository only, so it runs without the app.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formScreens, serverMethodNames } from '../helpers/app-surface.mjs';
import { SCREENS, FORM_METHODS } from './screens.mjs';

const found = formScreens();
const listed = new Map(SCREENS.map((s) => [s.file, s]));

describe('every form in the application is listed', () => {
  test('no form screen is missing from screens.mjs', () => {
    const missing = found.filter((s) => !listed.has(s.file)).map((s) => s.file);
    assert.deepEqual(missing, [], 'these screens submit a form but are not covered by the form tests');
  });

  test('no screen is listed that no longer exists', () => {
    const paths = new Set(found.map((s) => s.file));
    const stale = SCREENS.filter((s) => !paths.has(s.file)).map((s) => s.file);
    assert.deepEqual(stale, [], 'these entries are stale: the file is gone, or it no longer submits anything');
  });

  test('each screen lists exactly the methods it submits', () => {
    const drift = [];
    for (const screen of found) {
      const entry = listed.get(screen.file);
      if (!entry) continue;
      const added = screen.methods.filter((m) => !entry.submits.includes(m));
      const gone = entry.submits.filter((m) => !screen.methods.includes(m));
      if (added.length || gone.length) drift.push({ file: screen.file, added, gone });
    }
    assert.deepEqual(drift, [], 'the listed methods no longer match the screen');
  });

  test('every screen says what kind of form it is', () => {
    const kinds = new Set(['entity', 'action', 'config', 'query', 'probe']);
    const wrong = SCREENS.filter((s) => !kinds.has(s.kind)).map((s) => `${s.file}: ${s.kind}`);
    assert.deepEqual(wrong, []);
  });
});

describe('no form submits into thin air', () => {
  const registered = serverMethodNames();

  // A submit button wired to a method name the server does not register fails
  // silently in the interface: the user fills the form, presses save, and
  // nothing happens.
  for (const method of FORM_METHODS) {
    test(`${method} is registered on the server`, () => {
      assert.ok(
        registered.has(method),
        `${method} is called by a form but no server method answers to that name`,
      );
    });
  }
});
