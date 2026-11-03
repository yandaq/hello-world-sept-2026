# hello-world

A tiny webapp that reads the string `hello world` from a SQLite database and displays it on a
visually stunning page — a full-viewport CSS backdrop (aurora orbs, a bottom-left sunrise, film
grain and a vignette) behind a glass card. It uses plain Node.js with **zero npm dependencies**: the
built-in `node:sqlite` driver for the database and `node:http` for the server. There is no build
step, and the backdrop and mouse sparkles are CSS-generated — no image, icon or font files.

Moving a mouse adds a brief decorative twinkle trail behind the card; touch and pen movement do
not emit sparkles. The normal cursor and message loading remain unchanged. The trail is disabled
by `prefers-reduced-motion: reduce` (including preference changes while the page is open), and
existing sparkles are cleared when the page is hidden or left. No setting or extra request is needed.

Requires Node.js >= 22 (for `node:sqlite`).

## Run

```bash
npm run seed     # creates data/hello.db and ensures the 'hello world' row exists (idempotent)
npm start        # seeds first (same idempotent step), then starts the server
```

Then open <http://localhost:3000>.

Set a different port with `PORT=4000 npm start`.

## Verify

```bash
npm run seed
npm start &
curl -s http://localhost:3000/api/message   # {"message":"hello world"}
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/   # 200
```

`docs/VALIDATION.md` holds the full self-terminating check set (syntax gate, seed idempotency,
API and static-route assertions, the empty-database 503 case and the rendered-browser evidence
expected for visual and pointer-behaviour changes) together with `VALIDATION.md`, which defines the validation
methodology. Those checks start the server on port **3199** and refuse to run while another process
is already serving it, so they can be run alongside a dev server on 3000.

## Layout

| Path                       | Purpose                                             |
| -------------------------- | --------------------------------------------------- |
| `src/db.js`                | Opens SQLite, exports `getMessage()`                |
| `src/seed.js`              | Idempotent schema + seed script                     |
| `src/server.js`            | HTTP server: `/api/message` + static files          |
| `public/index.html`        | Page markup                                         |
| `public/app.js`            | Fetches/renders the message; manages mouse-trail lifecycle |
| `public/styles.css`        | All styling, including backdrop, sparkles and card states |
| `data/hello.db`            | Generated SQLite database (gitignored)              |
| `screenshots/`             | Reference renders of the page and its card states   |
| `CONTRACT.md`              | Referenced binding contract; absent from this checkout |
| `VALIDATION.md`            | Validation methodology for coding agents            |
| `docs/VALIDATION.md`       | This repo's executable checks and evidence rules    |
| `docs/architecture.md`     | Modules, allowed dependencies, recorded trade-offs  |
| `docs/coding-standards.md` | Standards as they apply in this repository          |
| `docs/plans/`              | Dated historical plans (not current architecture)   |

Note: on Node.js 22, `node:sqlite` prints an `ExperimentalWarning` on stderr. That is expected and
harmless; newer Node versions do not print it.
