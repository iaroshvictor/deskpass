# deskpass

Access control and video surveillance front end: cameras, gates, visitor
records, scenario rules and a Telegram bot, built on Meteor 3 + React.

The application is only one part of a running system. It talks to several
external pieces, and it will start without most of them — quietly degrading
rather than failing loudly — so the list below is worth reading before
wondering why a screen is empty.

## What it needs

| Dependency | Required | Default | What breaks without it |
|---|---|---|---|
| Node + Meteor 3.4 | yes | pinned in `.meteor/release` | nothing runs |
| MongoDB | yes | bundled with Meteor in dev (`.meteor/local/db`, port 3001) | nothing runs |
| Redis | **yes** | `redis://127.0.0.1:6379` | the server exits at startup |
| Perception service | for video analytics | `http://localhost:9010` (`PERCEPT_URL`) | no detections, no overlays, no captions |
| `bdvr_mux` binary | for recording | none — set `DVR_BIN` | recording is skipped, with a message in the log |
| APACS / Apollo server | for real access control | configured in the UI | gates cannot be opened; skipped entirely when `isDevelopment` is set |
| ONVIF cameras | for camera discovery | discovered on the LAN | the camera picker stays empty |
| Telegram bot token | for notifications | configured in the UI | no bot |

Redis is the one hard dependency people miss. On Windows there is no official
build; [Memurai](https://www.memurai.com/) is a drop-in replacement and
installs as a service on the default port.

## Running it

```bash
meteor npm install --include=dev
meteor run --settings settings-development.json
```

`--include=dev` matters: without it npm has been observed to skip the whole
build toolchain (`@meteorjs/rspack`, `typescript`, `@rspack/*`), and the build
then fails with the misleading `Could not find rspack.config.ts` — the file is
in the repository, but the plugin looks for its copy inside
`node_modules/@meteorjs/rspack`.

`settings-development.json` is not in the repository. Copy the example:

```bash
cp settings-development.example.json settings-development.json
```

`isDevelopment: true` skips the APACS integration and the Redis person-cache
warm-up, which is what you want on a workstation with no access-control
hardware attached.

## Configuration

Server-side settings come from the environment:

| Variable | Default | Purpose |
|---|---|---|
| `MONGO_URL` | Meteor's bundled instance in dev | database |
| `REDIS_URL` | `redis://127.0.0.1:6379` | frame, caption and detection bus |
| `PERCEPT_URL` | `http://localhost:9010` | perception service REST API |
| `DVR_BIN` | unset | path to the `bdvr_mux` recorder |
| `ASP_DIR` | `/opt/asp` | Apollo integration directory |
| `RSPACK_DEVSERVER_PORT` | `8077 + digit sum of the app port` | client dev server |

Client-visible settings live in `settings-development.json` under `public`.

## Tests

```bash
npm run test:audit      # unit + static + security + forms
npm run test:forms      # every screen that submits a form, needs the app running
npm run test:e2e        # browser, needs Playwright installed
```

See [tests/README.md](tests/README.md) for what each suite covers, the
environment variables they accept, and why the security suite speaks raw DDP
instead of using the app's own client.

## Known rough edges in development

* **Port 8080.** The client dev server port is derived as `8077 + digit sum of
  the Meteor port`, so the default 3000 lands on 8080 — a port Windows often
  reserves (`netsh interface ipv4 show excludedportrange protocol=tcp`) and
  which `http.sys` may already hold. Symptom: `listen EACCES 0.0.0.0:8080` and
  a blank page. Set `RSPACK_DEVSERVER_PORT` to something free.

* **The client dev server dies on an aborted request.** Interrupting a download
  of the ~9 MB dev bundle raises an unhandled `ECONNRESET` inside the rspack
  dev server, which exits. Meteor keeps serving HTML, so the app answers 200
  while every page stays blank. Restart `meteor run`.

* **First build is slow.** A cold `prepareProjectForBuild` copies tens of
  thousands of files; twenty minutes on a loaded machine is normal. Memory
  pressure makes it dramatically worse — check the commit charge before
  concluding the build has hung.
