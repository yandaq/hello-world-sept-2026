# Validation — hello-world

The validation methodology — feedback loop, categories, failure evidence, "do not game
validation", blocked-validation rules and completion evidence — is defined once, authoritatively,
in [`../VALIDATION.md`](../VALIDATION.md). That file governs; this one does not restate it.

This document adds only what is specific to the `hello-world` app: the commands that make up the
mandatory fast check set, and how the generic categories map onto this repository.

## Fast check set (executable fence)

Run from the repository root. Every command is non-interactive and self-terminating: the block
starts the server, probes it, and kills it (via `trap`) before returning.

```bash
set -euo pipefail
PORT=3199
LOG=$(mktemp)

# Static gate — the app has no build step, so parse each module instead.
node --check src/db.js
node --check src/seed.js
node --check src/server.js
node --check public/app.js

# Seed must be idempotent: two runs, same single row, no error.
npm run --silent seed
npm run --silent seed

PORT=$PORT node src/server.js >"$LOG" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT INT TERM

# Poll for readiness rather than sleeping a fixed amount.
for _ in $(seq 1 50); do
  curl -sf "http://localhost:$PORT/api/message" >/dev/null 2>&1 && break
  sleep 0.1
done

[ "$(curl -sf "http://localhost:$PORT/api/message")" = '{"message":"hello world"}' ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/")"            = 200 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/styles.css")"  = 200 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/app.js")"      = 200 ]
[ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/nope")"        = 404 ]

kill "$PID"; wait "$PID" 2>/dev/null || true
cat "$LOG"
```

Expected result: both seed runs report the row already present (second run prints
`data/hello.db already contains 1 message(s), nothing to do`), every assertion holds, and the
server log contains exactly `listening on http://localhost:3199`.

On Node.js 22 `node:sqlite` additionally prints an `ExperimentalWarning` on stderr. Per
`CONTRACT.md` §1 that line is expected and is not a failure; newer Node versions do not print it.

A port other than 3000 is used so the fence does not collide with a manually started dev server.

## Probe expectations

These are the contract statements the fence above exercises (`CONTRACT.md` §5, §9).

| Probe | Expected |
| --- | --- |
| `GET /api/message` with a seeded DB | `200 application/json`, `{"message":"hello world"}` |
| `GET /api/message` with `data/hello.db` absent or unseeded | `503` `{"error":"no message in database"}`, server stays up |
| `GET /` | `200 text/html; charset=utf-8` |
| `GET /styles.css`, `GET /app.js` | `200`, correct `Content-Type` |
| `GET /nope`, any non-`GET` method, path traversal | `404 application/json` `{"error":"not found"}` |

The empty-database case cannot run inside the fence above without deleting the seeded file; run it
separately when `src/db.js` or `src/server.js` changes:

```bash
npm run --silent seed
mv data/hello.db /tmp/hello.db.bak
PORT=3199 node src/server.js >/tmp/hw-503.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT INT TERM
# Poll for *any* HTTP response: the expected answer here is an error status.
for _ in $(seq 1 50); do
  curl -s -o /dev/null "http://localhost:3199/api/message" && break
  sleep 0.1
done
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3199/api/message   # 503
kill "$PID"; wait "$PID" 2>/dev/null || true
mv /tmp/hello.db.bak data/hello.db
```

## Category mapping for this repository

| Category (`../VALIDATION.md`) | Applies here | How |
| --- | --- | --- |
| Build / Runtime | Yes | The fence: `node --check`, `npm run seed`, server boots and logs its listen line |
| Observability | Yes | Server stdout/stderr in `$LOG`; the `500` path `console.error`s the stack |
| Integration | Yes | Fence covers HTTP → `getMessage()` → SQLite and static routing |
| End-to-End (browser) | Yes, for anything user-visible | See "Rendered validation" below |
| Unit tests | No suite exists | No test runner is installed; see "Tooling absent from the repository" |
| Linting / Type checking / Complexity / Duplication | No tooling configured | Nothing to run; do not add a linter or type checker for a scoped change |
| Security | Only if the HTTP or file layer changes | Static handler must keep rejecting paths that escape `public/` |
| Architectural conformance | Yes | `CONTRACT.md` file ownership (§2) and the stylesheet selector allow-list (§8) |
| Acceptance criteria | Yes | State each criterion with its evidence, per `../VALIDATION.md` |

## Rendered validation (presentational changes)

`public/styles.css` drives the whole visual result, and its effects are not observable from
`curl`. For any change to it:

- Use Pi's built-in Playwright-compatible browser automation. **Do not install Playwright,
  Chromium or any browser-testing dependency** — `CONTRACT.md` §1 forbids new dependencies and
  there is no build step.
- Capture, writing to `/tmp` rather than overwriting committed images: desktop dark (~1440×900),
  desktop `prefers-color-scheme: light`, mobile (390×844), `prefers-reduced-motion: reduce`, and
  the `loading` / `ready` / `error` card states.
- Compare state captures against the committed references `screenshots/state-loading.png` and
  `screenshots/state-error.png` for card-state behaviour. Note that the committed images
  (`desktop-dark.png`, `desktop-light.png`, `mobile-dark.png`, `state-loading.png`,
  `state-error.png`) predate the sunrise layer, so they are the reference for the card, layout and
  state treatment — **not** for the backdrop, which has changed deliberately since they were taken.
  Do not overwrite them as part of validating a presentational change.
- Record browser console output and the network log. Unexpected console or page errors are
  failures. A stylesheet-only change must add **no** new requests: the page must fetch only `/`,
  `/styles.css` and `/app.js`, which is the observable form of `CONTRACT.md` §8's
  self-contained / no-assets rule.
- Check that the glass card's text remains legible over the backdrop in both colour schemes
  (target WCAG AA).

If no browser automation is available, treat this as a disclosed blocker
(`../VALIDATION.md` → Blocked Validation): run the fence, review the selector and stacking change
statically, and state the method actually used rather than claiming the page was seen.

## Tooling absent from the repository

The repository intentionally has no test runner, linter, formatter, type checker or build step
(`CONTRACT.md` §1: no dependencies, no bundler, no TypeScript). Nothing above creates one, and
`../VALIDATION.md`'s lint/type/complexity/duplication categories are not applicable rather than
un-satisfied. That gap is recorded here as fact; it does not relax the standard that behaviour
changes need evidence — for this app that evidence is the fence plus, for anything user-visible,
rendered browser evidence.
