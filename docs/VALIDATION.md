# Validation — hello-world

The validation methodology — feedback loop, categories, failure evidence, "do not game
validation", blocked-validation rules and completion evidence — is defined once, authoritatively,
in [`../VALIDATION.md`](../VALIDATION.md). That file governs; this one does not restate it.

This document adds only what is specific to the `hello-world` app: the commands that make up the
mandatory fast check set, and how the generic categories map onto this repository.

## Fast check set (executable fence)

Run from the repository root. Every command is non-interactive and self-terminating: a line that
starts the server also probes it and kills it before returning.

**One fence line = one shell.** The gate that runs this set (`sf`'s validation stage, i.e.
`sf.target.validation_commands`) takes every non-comment, non-blank line of every `sh` / `bash` /
`shell` fence in this file and executes each line in a *separate* `/bin/sh -c` process, stopping at
the first non-zero exit. Consequences, which every command added here must respect:

- a line may not read a variable, function or `set` option established by an earlier line;
- no construct may span lines (`for … done`, `if … fi`, backslash line-continuations) — a
  multi-step check is written as one `;`-separated line;
- inside such a line, failure is signalled by the line's last command, so probes accumulate into a
  `fail` flag and the line ends with `[ "$fail" -eq 0 ]` after its cleanup, which its own `trap`
  covers as well (`trap … EXIT` fires when that line's shell exits);
- every command inside a cleanup `trap` is guarded with `|| :`, because a failing command inside a
  trap aborts the rest of that cleanup under `set -e` — the symptom is `data/hello.db` stranded in
  a `mktemp -d` directory instead of back in `data/`.

```sh
# Static gate — the app has no build step, so parse each module instead.
node --check src/db.js
node --check src/seed.js
node --check src/server.js
node --check public/app.js

# Seed must be idempotent: two runs, same single row, no error.
npm run --silent seed
npm run --silent seed

# The fence owns :3199 and its assertions only prove anything about the process it starts itself, so
# refuse to run against somebody else's server (a foreign one answers the probes and has no listen log).
if curl -s -o /dev/null --max-time 2 http://localhost:3199/api/message; then echo "FAIL port 3199 is already serving; stop it before running the fence"; exit 1; fi

# Boot on :3199, poll for readiness rather than sleeping a fixed amount, probe every contract
# route, print the server log and stop the server. One line because each line gets its own shell.
LOG=$(mktemp); PORT=3199 node src/server.js >"$LOG" 2>&1 & PID=$!; trap 'kill "$PID" 2>/dev/null || true' EXIT INT TERM; i=0; while [ "$i" -lt 50 ]; do curl -sf http://localhost:3199/api/message >/dev/null 2>&1 && break; i=$((i+1)); sleep 0.1; done; fail=0; probe() { if [ "$2" != "$3" ]; then echo "FAIL $1: expected [$3], got [$2]"; fail=1; fi; }; probe "GET /api/message body" "$(curl -sf http://localhost:3199/api/message)" '{"message":"hello world"}'; probe "GET /" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/)" 200; probe "GET /styles.css" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/styles.css)" 200; probe "GET /app.js" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/app.js)" 200; probe "GET /nope" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/nope)" 404; probe "listen log line count" "$(grep -c 'listening on http://localhost:3199' "$LOG")" 1; kill "$PID"; wait "$PID" 2>/dev/null || true; cat "$LOG"; [ "$fail" -eq 0 ]
```

Expected result: on a fresh clone the first seed run prints `seeded 'hello world' into
data/hello.db` (the database file is gitignored, so a clean checkout has none) and every later run
prints `data/hello.db already contains 1 message(s), nothing to do`; every probe holds, and the
printed server log contains `listening on http://localhost:3199`. The fence leaves a seeded
`data/hello.db` in place (the empty-database line below re-seeds first, so it does not depend on
what ran before it).

On Node.js 22 `node:sqlite` additionally prints an `ExperimentalWarning` on stderr. Per
`CONTRACT.md` §1 that line is expected and is not a failure; newer Node versions do not print it.

A port other than 3000 is used so the fence does not collide with a manually started dev server, and
the port pre-flight makes that collision a loud failure instead of a misleading one: a foreign
server on 3199 answers the route probes but has no listen log, so without the guard the only clue is
`FAIL listen log line count: expected [1], got [0]`.

## Probe expectations

These are the contract statements behind the fences (`CONTRACT.md` §5, §9). What the fences actually
execute is narrower: the status codes of the routes they name — `/api/message` seeded and empty,
`/`, `/styles.css`, `/app.js`, `/nope` — plus the two JSON bodies and the listen-log line. The
remaining statements (`Content-Type` values, non-`GET` methods, path traversal) are contract
behaviour the server implements but the fence does not probe; re-check them by review when
`src/server.js` or `CONTRACT.md` §5 changes.

| Probe | Expected |
| --- | --- |
| `GET /api/message` with a seeded DB | `200 application/json`, `{"message":"hello world"}` |
| `GET /api/message` with `data/hello.db` absent or unseeded | `503` `{"error":"no message in database"}`, server stays up |
| `GET /` | `200 text/html; charset=utf-8` |
| `GET /styles.css`, `GET /app.js` | `200`, correct `Content-Type` |
| `GET /nope`, any non-`GET` method, path traversal | `404 application/json` `{"error":"not found"}` |

The empty-database case needs the seeded file moved out of the way, so it is its own line, and that
line restores the file through its own `EXIT` trap even when a probe fails (it also re-seeds first,
so it is independent of what ran before it and can be run on its own when `src/db.js` or
`src/server.js` changes):

```sh
# With no db file the API answers 503 and the server stays up. Poll for the expected error status.
BAK=$(mktemp -d); npm run --silent seed; mv data/hello.db "$BAK/hello.db"; trap 'if [ -n "${PID:-}" ]; then kill "$PID" 2>/dev/null || :; fi; mv "$BAK/hello.db" data/hello.db 2>/dev/null || :; rmdir "$BAK" 2>/dev/null || :; :' EXIT INT TERM; PORT=3199 node src/server.js >/tmp/hw-503.log 2>&1 & PID=$!; i=0; while [ "$i" -lt 50 ]; do [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/api/message)" = 503 ] && break; i=$((i+1)); sleep 0.1; done; fail=0; probe() { if [ "$2" != "$3" ]; then echo "FAIL $1: expected [$3], got [$2]"; fail=1; fi; }; probe "GET /api/message without a db" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/api/message)" 503; probe "GET /api/message body without a db" "$(curl -s http://localhost:3199/api/message)" '{"error":"no message in database"}'; probe "GET / after the 503 (server stays up)" "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3199/)" 200; kill "$PID"; wait "$PID" 2>/dev/null || true; cat /tmp/hw-503.log; [ "$fail" -eq 0 ]
```

## Category mapping for this repository

| Category (`../VALIDATION.md`) | Applies here | How |
| --- | --- | --- |
| Build / Runtime | Yes | The fence: `node --check`, `npm run seed`, server boots and logs its listen line, empty-DB 503 |
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
  failures. A stylesheet-only change must add **no** new requests beyond `/`, `/styles.css`,
  `/app.js` and the `GET /api/message` the page already makes, which is the observable form of
  `CONTRACT.md` §8's self-contained / no-assets rule. One console entry is expected and is not a
  failure: `index.html` carries no icon link (`CONTRACT.md` §6 fixes the head tags), so Chromium
  fetches `/favicon.ico` on the first navigation and the static handler answers it with the
  contract `404 {"error":"not found"}`. It is a browser-initiated fetch, so it does not appear in
  the page's own request list; anything else in the console is a failure.
- Check that the glass card's text remains legible over the backdrop in both colour schemes
  (target WCAG AA). Measure it rather than eyeballing it: sample the composited glass from a
  screenshot in a text-free part of the card padding (what the translucent, blurred card actually
  paints over the backdrop) and compare against the computed `color` of `.title`, `.status`,
  `.eyebrow` and `.meta__text`. Known baseline, measured on the committed design: the muted ink
  (`--ink-mute`, 0.82rem) already sits at 2.9:1–4.6:1 in dark and 4.2:1–4.5:1 in light depending on
  which orb is behind the card, below the 4.5:1 AA target wherever an orb is brightest. That is a
  pre-existing property of the palette, not something a backdrop change introduces; what a
  presentational change must not do is move those numbers materially further down.
- To measure what a backdrop layer actually contributes, capture the same page twice — once as
  served and once with the layer forced off (`.backdrop::before { background-image: none !important }`
  via `page.addStyleTag`) — and diff the screenshots per region. Pass `animations: 'disabled'` to
  `page.screenshot()` so both images are on the same animation phase; without it the shimmering
  gradient text and the drifting orbs dominate the difference. Numeric per-region deltas (mean
  luminance, red-minus-blue warmth) are stronger evidence than a screenshot claim and stay
  checkable by an agent that cannot view images.

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
