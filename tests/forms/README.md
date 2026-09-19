# Form tests

Every screen in the application that takes input and submits it, covered from
the outside.

A form has three ways to be broken that the interface hides:

- the submit button calls a method name the server does not register, so
  pressing save does nothing and says nothing;
- the method answers happily without writing anything;
- the method writes for anyone who can reach the server, login or not.

These suites look for all three.

## The files

| File | Needs the app | What it does |
| --- | --- | --- |
| `screens.mjs` | — | The list of form screens, what each submits, and what kind of form it is. Data, not a test. |
| `inventory.test.mjs` | no | Compares that list against the source, and checks every submitted method exists on the server. |
| `authorization.test.mjs` | yes | Calls each method from a session that never logged in and expects a refusal. |
| `submission.test.mjs` | yes | Creates, edits and deletes through the forms that own records, reading the database back each time. |
| `actions.test.mjs` | yes | The screens that act rather than create: mark seen, watch-words, the counters behind the filter bars. |

## Running them

```bash
npm run test:forms
```

The three suites that need the app expect it on `http://localhost:3000` with
an admin account. Both are configurable:

```bash
DESKPASS_URL=ws://host:3000/websocket DESKPASS_TEST_USER=admin DESKPASS_TEST_PASS=admin npm run test:forms
```

Without a working admin login the database-facing tests skip rather than fail,
so a wrong password does not look like a broken application.

## Adding a form

`inventory.test.mjs` fails the moment a screen submits something that is not
described in `screens.mjs` — that is the point of the list. Add the entry, then
cover the new method where it belongs: in `submission.test.mjs` if it writes a
record, in `actions.test.mjs` otherwise. The authorization suite picks it up on
its own.

## What they leave alone

- **Settings** (`setTgBot`, `setApacsConfig`, `doApolloSync`) reconfigure live
  integrations and drop sessions. They are covered for authorization only; a
  round trip would need a disposable Telegram bot and an APACS endpoint.
- **The browser.** These tests drive the server, not the screen: they prove the
  submit reaches the database, not that the button is wired to the submit. The
  Playwright suite in `tests/e2e` covers the rendering side.
- **`admin`/`admin`.** Accepted as a known risk, so nothing asserts the default
  credentials are gone.
