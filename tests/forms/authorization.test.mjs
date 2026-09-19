// Can a stranger submit these forms?
//
// Every screen in the application sits behind a login, but the login is in
// the interface, not on the wire: a Meteor method is a public endpoint that
// anyone who can reach the server can call. This suite calls each method a
// form submits from a session that never logged in, and expects a refusal.
//
// It needs the application running (npm start).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousClient, waitForServer } from '../helpers/ddp-client.mjs';
import { SCREENS, FORM_METHODS } from './screens.mjs';

// Sending no arguments is the harshest case for the server and the kindest
// for the test: a method that answers anything other than a refusal has
// either run without a session or crashed on its own arguments.
const NO_ARGUMENTS = [];

// Two methods are known to check their arguments before the session. They
// still refuse an outsider, just with a different code, so they are asserted
// on "refused" alone rather than on the reason.
const CHECKS_ARGUMENTS_FIRST = new Set(['webrtcOffer']);

describe('form methods refuse a caller who never logged in', () => {
  let client;

  before(async () => {
    await waitForServer();
    client = await anonymousClient();
  });

  after(() => client?.close());

  for (const method of FORM_METHODS) {
    test(`${method}`, async () => {
      const res = await client.call(method, NO_ARGUMENTS, 20000);

      assert.ok(!res.timedOut, `${method} never answered; a timeout is not a refusal`);
      assert.ok(res.error, `${method} accepted a call from an anonymous session`);

      if (!CHECKS_ARGUMENTS_FIRST.has(method)) {
        assert.equal(
          res.error.error, 'not-authorized',
          `${method} refused with ${JSON.stringify(res.error.error)} rather than checking the session; ` +
          'reaching any other branch means the work started before authorisation was decided',
        );
      }
    });
  }
});

describe('probing a camera address is not open to outsiders', () => {
  // validateRtspLink makes the server dial an address the caller chooses and
  // reports what happened. Without a session check that is an unauthenticated
  // port scan of whatever the server can reach, one ffmpeg process per call.
  let client;

  before(async () => {
    await waitForServer();
    client = await anonymousClient();
  });

  after(() => client?.close());

  test('a well-formed link is refused before anything is dialled', async () => {
    const started = Date.now();
    const res = await client.call('validateRtspLink', ['rtsp://127.0.0.1:8554/probe'], 30000);

    assert.ok(!res.timedOut, 'the call never answered');
    assert.equal(res.error?.error, 'not-authorized');
    // A refusal is immediate; dialling the address takes seconds and times out.
    assert.ok(Date.now() - started < 5000, 'the server appears to have dialled the address before refusing');
  });

  test('so is an ONVIF discovery', async () => {
    const res = await client.call('validateOnvifDevice', ['127.0.0.1', 'user', 'pass'], 30000);
    assert.ok(!res.timedOut, 'the call never answered');
    assert.equal(res.error?.error, 'not-authorized');
  });
});

describe('the refusal covers every kind of form', () => {
  // A sanity check on the list itself: if a whole category disappeared from
  // screens.mjs the loop above would still pass, silently testing less.
  for (const kind of ['entity', 'action', 'config', 'query', 'probe']) {
    test(`at least one ${kind} form is covered`, () => {
      assert.ok(SCREENS.some((s) => s.kind === kind), `no ${kind} screen is listed any more`);
    });
  }
});
