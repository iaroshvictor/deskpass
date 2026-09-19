# Test suites

Four suites, written against the audit findings **before** any code is changed.
A failing test here is a defect that still exists; the remediation plan is done
when `npm run test:audit` is green.

| Suite | Command | Needs a running app | What it covers |
|---|---|---|---|
| unit | `npm run test:unit` | no | pure guard logic (query sanitising, authorisation policy) |
| static | `npm run test:static` | only for the bundle test | source contracts, client-bundle leakage, dependency advisories |
| security | `npm run test:security` | **yes** | live DDP probes: publications, methods, query injection, default credentials |
| forms | `npm run test:forms` | **yes** | every screen that submits a form: the method exists, refuses a stranger, and actually writes ([details](forms/README.md)) |
| e2e | `npm run test:e2e` | **yes** + Playwright | the login screen in a real browser |

Run everything except e2e:

```bash
npm run test:audit
```

## Why DDP and not the app's own client

`tests/helpers/ddp-client.mjs` speaks raw DDP to `/websocket`. The tests must
see the server the way an outsider does — the login screen in the browser is
not an access control, it is a UI. Anything reachable over DDP without a
session is public, whatever the interface shows.

## Fixtures

`tests/helpers/fixtures.mjs` seeds one canary document per guarded collection
straight into Mongo (`mongodb://127.0.0.1:3001/meteor` by default) and removes
them afterwards. Without this, "the anonymous client received no data" would
pass on an empty database for the wrong reason.

**Run against a throwaway database.** The suite writes to Mongo and, with
`DESKPASS_ALLOW_DESTRUCTIVE=1`, calls methods that overwrite integration
settings.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `DESKPASS_URL` | `ws://localhost:3000/websocket` | DDP endpoint |
| `DESKPASS_HTTP_URL` | `http://localhost:3000` | app URL for e2e |
| `DESKPASS_MONGO_URL` | `mongodb://127.0.0.1:3001/meteor` | fixture target |
| `DESKPASS_BUNDLE_URL` | `http://127.0.0.1:8889/client-rspack.js` | client bundle to scan |
| `DESKPASS_TEST_USER` / `DESKPASS_TEST_PASS` | `admin` / `admin` | account for tests that need a session |
| `DESKPASS_ALLOW_DESTRUCTIVE` | unset | run method probes that really do overwrite settings |
| `DESKPASS_MAX_LIMIT` | `500` | page size the server is expected to enforce |
| `DESKPASS_EMPTY_CATCH_BUDGET` | `0` | tolerated empty `catch` blocks |
| `DESKPASS_MAX_CRITICAL` / `DESKPASS_MAX_HIGH` | `0` / `0` | tolerated npm advisories |

## Modules the unit tests expect

The unit suite imports two modules that do not exist yet. They are the
deliverable of stage 1 of the plan, and their API is defined by the tests:

- `imports/security/queryGuards.ts` — `clampLimit`, `sanitizeFilter`, `sanitizeSort`
- `imports/security/accessPolicy.ts` — `canAccess`, `PERMISSIONS`

Both must stay free of Meteor imports so they can be tested as pure functions.
