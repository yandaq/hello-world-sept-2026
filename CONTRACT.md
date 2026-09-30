# CONTRACT.md

Binding contract for the `hello-world` webapp. Every agent builds against this file and only
edits the files it owns. If reality and this document disagree, this document wins — raise the
conflict instead of silently deviating.

## 1. Stack

- **Runtime:** Node.js >= 22 (v22.21.1 verified installed). ESM only (`"type": "module"`).
- **Dependencies:** none. **No `npm install`, no Express, no better-sqlite3, no bundler, no TypeScript.**
- **Database driver:** built-in `node:sqlite` → `import { DatabaseSync } from 'node:sqlite';`
- **Server:** built-in `node:http` → `import { createServer } from 'node:http';`
- `node:sqlite` emits an `ExperimentalWarning` on stderr. Expected; do not suppress it and do not
  treat it as a failure.

## 2. File ownership

No agent may create or edit a file it does not own.

| File                 | Owner                | Status                    |
| -------------------- | -------------------- | ------------------------- |
| `package.json`       | project-scaffolder   | done                      |
| `.gitignore`         | project-scaffolder   | done                      |
| `README.md`          | project-scaffolder   | done                      |
| `CONTRACT.md`        | project-scaffolder   | done                      |
| `data/.gitkeep`      | project-scaffolder   | done                      |
| `src/db.js`          | sqlite-data agent    | **to create**             |
| `src/seed.js`        | sqlite-data agent    | **to create**             |
| `data/hello.db`      | sqlite-data agent    | generated, gitignored     |
| `src/server.js`      | backend-api agent    | **to create**             |
| `public/index.html`  | frontend-ui agent    | **to create**             |
| `public/app.js`      | frontend-ui agent    | **to create**             |
| `public/styles.css`  | visual-design agent  | **to create**             |

The visual-design agent must not touch HTML or JS. The frontend agent must not write inline
styles or `<style>` blocks; all visual rules live in `public/styles.css`.

## 3. `src/db.js` — data access (sqlite-data agent)

```js
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = new URL('../data/hello.db', import.meta.url);

export function getMessage() { /* ... */ }
```

- Exactly one named export: `getMessage`. No default export.
- Database path: **must** be resolved as `new URL('../data/hello.db', import.meta.url)` so the app
  works regardless of the current working directory. Both `src/db.js` and `src/seed.js` resolve the
  same file: `data/hello.db` at the project root.
- `getMessage()` is **synchronous** and returns:
  - `string` — the `body` of the message row (e.g. `'hello world'`), when a row exists;
  - `null` — when the table is empty **or does not exist yet** (an unseeded database must yield
    `null`, not a thrown error);
  - it **throws** on any other unexpected SQLite failure. Do not swallow errors; the server turns
    them into a 500.
- Reading from a not-yet-created DB file must not create a bogus schema. Opening read-only, or
  guarding the query with a `sqlite_master` check / try-catch that maps "no such table" to `null`,
  are both acceptable.

## 4. `src/seed.js` — schema + seed (sqlite-data agent)

- Run via `npm run seed`. **Idempotent**: running it twice must leave exactly one row and must not
  error.
- Creates the `data/` directory if missing, then:

```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  body TEXT NOT NULL
);
```

- Ensures exactly one row with `body = 'hello world'` (e.g. `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM messages)`).
- Logs what it did to stdout, e.g. `seeded 'hello world' into data/hello.db` or
  `data/hello.db already contains 1 message, nothing to do`.
- Exits non-zero and prints the error on failure.

## 5. `src/server.js` — HTTP server (backend-api agent)

- `import { getMessage } from './db.js';` — the server never opens SQLite itself.
- Port: `process.env.PORT || 3000`. Base URL `http://localhost:3000`.
- On listen, log exactly: `listening on http://localhost:${port}`.

### API

`GET /api/message`

| Case                        | Status | `Content-Type`     | Body                                   |
| --------------------------- | ------ | ------------------ | -------------------------------------- |
| row found                   | 200    | `application/json` | `{"message":"hello world"}`            |
| `getMessage()` returns null | 503    | `application/json` | `{"error":"no message in database"}`   |
| `getMessage()` throws       | 500    | `application/json` | `{"error":"<human readable string>"}`  |

On the 500 path also `console.error` the error **including its stack**. The process must never
crash on a request.

### Static files

- Served from `public/`. `GET /` → `public/index.html`.
- Extensions and content types that must be supported:

  | ext     | Content-Type               |
  | ------- | -------------------------- |
  | `.html` | `text/html; charset=utf-8` |
  | `.css`  | `text/css; charset=utf-8`  |
  | `.js`   | `text/javascript; charset=utf-8` |
  | `.svg`  | `image/svg+xml`            |
  | `.woff2`| `font/woff2`               |

- URL paths map directly onto `public/`: `/styles.css` → `public/styles.css`,
  `/app.js` → `public/app.js`. Requests must not escape `public/` (reject `..` traversal).
- Anything else (unknown path, unknown extension, non-GET): **404** with
  `{"error":"not found"}` and `Content-Type: application/json`.

## 6. `public/index.html` — markup (frontend-ui agent)

Required, exact DOM hooks — the stylesheet targets these and nothing else:

```
body.page
├── div.backdrop[aria-hidden="true"]          (decorative only)
│   ├── span.orb.orb--1
│   ├── span.orb.orb--2
│   ├── span.orb.orb--3
│   └── span.grain
└── main.hero
    └── section.card[data-state="loading"]
        ├── p.eyebrow
        ├── h1.title
        ├── p#message.message
        ├── p#status.status[aria-live="polite"]
        └── footer.meta
            ├── span.meta__dot
            └── span.meta__text
```

- `<body class="page">` is the root wrapper.
- `<div class="backdrop" aria-hidden="true">` holds purely decorative layers: three
  `<span class="orb orb--1|orb--2|orb--3">` and one `<span class="grain">`. They carry no text
  and no behaviour.
- `<main class="hero">` wraps the content and contains exactly one
  `<section class="card" data-state="loading">`.
- Inside `.card`, in order: `<p class="eyebrow">` (kicker text), `<h1 class="title">`,
  `<p id="message" class="message">` — the element whose `textContent` becomes the fetched
  string — `<p id="status" class="status" aria-live="polite">` for status / error text, and
  `<footer class="meta">` containing `<span class="meta__dot">` and `<span class="meta__text">`.
- Head/script tags, exactly:
  - `<link rel="stylesheet" href="/styles.css">` in `<head>`
  - `<script type="module" src="/app.js"></script>` as the last element in `<body>`

State is expressed **only** via the `data-state` attribute on `.card`, with the values
`"loading"`, `"ready"`, `"error"`. No other state classes. Initial markup ships with
`data-state="loading"`. Use semantic, accessible HTML (`lang`, `<title>`, the `<h1>` above, and
`aria-live="polite"` on `#status`).

## 7. `public/app.js` — behaviour (frontend-ui agent)

- ES module, no imports, no dependencies.
- `fetch('/api/message')`:
  - HTTP 200 → set `#message`'s `textContent` to `data.message`, clear `#status`, set
    `.card` `data-state="ready"`.
  - non-2xx or network error → set `#status` `textContent` to a readable message (use the
    response's `error` field when present), set `.card` `data-state="error"`, and `console.error`
    the failure.
- Never injects HTML; assign `textContent` only.

## 8. `public/styles.css` — visual design (visual-design agent)

- Styles **only** these hooks: `.page`, `.backdrop`, `.orb`, `.orb--1`, `.orb--2`, `.orb--3`,
  `.grain`, `.hero`, `.card`, `.eyebrow`, `.title`, `.message` / `#message`, `.status` /
  `#status`, `.meta`, `.meta__dot`, `.meta__text`, and `[data-state="loading"|"ready"|"error"]`
  selectors on `.card` — plus their descendants and pseudo-elements, `:root` custom properties,
  `@media`, `@supports` and `@keyframes`.
- Must not require any new HTML element, id, class or attribute.
- Must be **self-contained**: system font stacks only, no `@import`, no web fonts, no external or
  local asset files (no images, icons or fonts). Everything is CSS-generated (gradients, shadows,
  filters).
- Responsive, plus a palette that supports **both dark and light** via `prefers-color-scheme`,
  and must honour `prefers-reduced-motion` (reduce or remove animation and transitions).

## 9. Run & verification sequence

```bash
npm run seed
npm start                      # logs: listening on http://localhost:3000
curl -s http://localhost:3000/api/message      # {"message":"hello world"}
curl -s http://localhost:3000/ | head          # index.html containing the hooks above
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/styles.css   # 200
curl -s http://localhost:3000/nope             # {"error":"not found"}, status 404
```

Empty-DB check: delete `data/hello.db`, start the server, `GET /api/message` → 503
`{"error":"no message in database"}` and the server stays up.
