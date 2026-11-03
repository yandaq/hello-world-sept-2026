# Architecture

Modules of the `hello-world` webapp, their responsibilities and the dependencies allowed between
them. Record architectural compromises and their trade-offs here.

The runtime is plain Node.js >= 22 ESM with **zero npm dependencies** (`CONTRACT.md` §1): no build
step, no framework, no bundler, no TypeScript. `CONTRACT.md` is binding — where code and contract
disagree, the contract wins and the conflict is raised rather than silently resolved.

## Runtime modules

| Module | Responsibility | Depends on |
| --- | --- | --- |
| `src/db.js` | Open `data/hello.db` read-side and return the stored message. Sole owner of SQLite access. | `node:sqlite` |
| `src/seed.js` | Create `data/` and the `messages` table if absent, ensure exactly one `hello world` row. Idempotent; run via `npm run seed`. | `node:sqlite` |
| `src/server.js` | HTTP surface: `GET /api/message` plus static serving from `public/`. Sole owner of the socket and routing. | `node:http`, `node:fs/promises`, `./db.js` |

Allowed dependency direction is one-way:

```text
src/server.js  →  src/db.js  →  node:sqlite
                                   ↑
src/seed.js ───────────────────────┘   (schema + seed only; never imported by the server)
```

- The server **never** opens SQLite itself; it calls `getMessage()` (`CONTRACT.md` §5).
- `src/db.js` exports exactly one named function, `getMessage()`. It is synchronous and returns
  the row body, or `null` when there is no message to return — the `messages` table is absent, the
  table is empty, **or the database file does not exist yet**. An unseeded app is a `null`, not a
  thrown error; opening the file read-only is what makes a missing file detectable rather than
  silently created. Any other SQLite failure throws and the server maps it to a 500.
- Both `src/db.js` and `src/seed.js` resolve the same file as
  `new URL('../data/hello.db', import.meta.url)`, so the app is independent of the current working
  directory.
- `npm start` is `node src/seed.js && node src/server.js`: seeding happens on every start so a
  fresh deployment serves the message without a separate step (`npm run seed` remains available
  and stays idempotent).

## HTTP behaviour

| Route | Behaviour |
| --- | --- |
| `GET /api/message` | `200 {"message":"hello world"}`; `503 {"error":"no message in database"}` when `getMessage()` returns `null`; `500 {"error":…}` when it throws, with the stack `console.error`ed. The process must never crash on a request. |
| `GET /` and other `public/` paths | Served from `public/` with the extension → MIME map in `CONTRACT.md` §5. Paths that resolve outside `public/` (e.g. `..` traversal) are rejected. |
| Anything else, unknown extension, non-`GET` | `404 {"error":"not found"}` as `application/json`. |

`PORT` comes from `process.env.PORT`, defaulting to 3000. On listen the server logs exactly
`listening on http://localhost:${port}`.

## Presentation layer

The browser side is three static files under `public/`, served verbatim:

- `index.html` — the fixed DOM hook tree of `CONTRACT.md` §6 (`body.page` ›
  `div.backdrop` + `main.hero` › `section.card`). Card state is expressed **only** by
  `data-state="loading" | "ready" | "error"`.
- `app.js` — `fetch('/api/message')`, then assign `#message` `textContent`, update `#status`, and
  set `data-state`. Text assignment only; never injects HTML. Also initializes a mouse-only
  decorative trail before fetching: at most one particle per 45ms, at most 16 live particles,
  each removed after 700ms (its CSS animation ends at 650ms). Per-particle timers are the only
  pending effect work; reduced motion, hidden documents and pagehide clear nodes and timers.
  Runtime motion-preference changes permit emission again only on subsequent mouse movement.
- `styles.css` — every visual rule. Self-contained by contract: system font stacks, no `@import`,
  no web fonts, no image/icon/font files; all imagery is generated from gradients, shadows and
  filters (`CONTRACT.md` §8).

### Stylesheet organisation

`public/styles.css` is one file with an 11-section index in its header comment; keep that index
accurate when sections change:

1. Tokens (`:root`, dark-first) · 2. Reset & base · 3. Backdrop (aurora orbs, sunrise, grain,
   vignette, mouse sparkles) · 4. Layout (hero) · 5. Card (glass) · 6. Typography · 7. States (loading / ready /
   error) · 8. Keyframes · 9. Responsive · 10. Light palette (`prefers-color-scheme: light`) ·
   11. Reduced motion (`prefers-reduced-motion: reduce`).

Colours are not hard-coded at the point of use. The palette lives in the `:root` custom properties
of §1, and §10 overrides **only those tokens**, so a scheme change never means editing component
rules. Both colour schemes must look deliberately designed rather than inverted. §11 collapses
`animation-duration` globally to ~0, and any layer whose animation does not end on its intended
resting appearance gets an explicit static override there: `.message` (the shimmer's
`background-position`, plus a static skeleton gradient for the loading state), `.card::after` and
the sunrise `.backdrop::before`, pinned at `--sun-alpha` with no transform. Layers whose base rule
already *is* their resting appearance — the orb drifts, which revert to their unanimated positions
once the collapsed animation finishes — need no override.

### Backdrop composition and stacking order

`.backdrop` is `position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none`, so
it forms one stacking context. `main.hero` is `position: relative; z-index: 1`, which puts the
whole backdrop behind the content; `.card` then opens its own stacking context with
`isolation: isolate` so its internal `z-index: -1` layers stay inside it. Backdrop layers, back to
front:

| Layer | Paints | Notes |
| --- | --- | --- |
| `.backdrop` background | base stacking level | radial canvas wash from `--bg-cast` to `--bg` |
| `.orb--1/2/3`, `.grain` | DOM order, `z-index: auto` | blurred, blended aurora lights and the CSS-only film grain |
| `.backdrop::before` — **sunrise** | `z-index: 1` | above the orbs it lights |
| `.backdrop::after` — vignette | `z-index: 2` | above the ambient lights |
| `.sparkle` — mouse trail | `z-index: 3` | clipped, non-interactive spans inside the aria-hidden backdrop; below the entire hero |

The **sunrise** is a single bottom-left light source drawn on `.backdrop::before`: rays
(`repeating-conic-gradient`), the disc, a halo, a corner-to-corner `to top right` throw and a
horizon wash, stacked in one `background-image`. The rays, the disc and the halo are each drawn at
the same `--sun-x` / `--sun-y` point, and the throw and the horizon wash run out of that corner, so
the stack reads as one source rather than separate blobs. Its tunables are §1 tokens
— `--sun-x`/`--sun-y` (anchor), `--sun-core`/`--sun-glow`/`--sun-ray` (derived from `--amber` and
`--ember`), `--sun-alpha` (full strength), `--sun-blend` (`screen` dark, `multiply` light),
`--sun-cycle` and `--sun-breathe` (dim phase as a fraction of `--sun-alpha`). A radial
`mask-image` (with `-webkit-` prefix) fades the layer with distance from the source while keeping
a floor so the far corner stays lit. The layer breathes: `@keyframes sun-breathe` runs over
`--sun-cycle`, swelling opacity from `calc(var(--sun-alpha) * var(--sun-breathe))` to
`--sun-alpha` and `scale(1.04)` at mid-cycle, with `transform-origin` at the anchor so the swell
expands out of the corner rather than the viewport centre. §10 re-tunes the tokens to a low-alpha
warm wash for the light scheme; §11 pins the layer at `--sun-alpha` with no transform for reduced
motion. The sunrise is decorative: no DOM node, no text, no interaction, no extra request.

**Trade-off — the vignette versus the sunrise.** The vignette pseudo-element is painted after the
sunrise in DOM order, and its darkest region is exactly the corners where the sun sits, so the warm
glow was being crushed. This was resolved in two parts rather than by removing the vignette, which
carves out the card and is pre-existing behaviour: (a) explicit `z-index` values inside the
`.backdrop` stacking context (`1` for the sunrise, `2` for the vignette) make the order a stated
decision instead of an accident of source order, and (b) the vignette's mid stop was split into its
own token, `--vignette-mid`, and lightened relative to `--vignette`, so the corner still darkens
but stops eating the light source. The cost is two tokens where one used to be and a stacking order
that now has to be considered whenever a new `.backdrop` layer is added.

**Trade-off — paint cost.** Several viewport-sized layers are composited with `mix-blend-mode`, and
the orbs carry a large `filter: blur()`. The sunrise deliberately uses gradient alpha falloff and a
mask instead of adding a third full-viewport `filter: blur()` layer, and keeps alpha low in the
light scheme, trading a slightly softer edge for materially less paint on mobile.

Sparkle appearance lives in CSS, with placement and lifetime owned by `app.js`. Reduced motion
explicitly hides sparkles and disables their animation in addition to JavaScript cleanup.
`CONTRACT.md` is absent from this checkout; the mouse-trail request authorizes this client-side
extension without reconstructing that missing document.

Because visual styling lives in CSS, stylesheet changes cannot be validated with `curl`
alone — see [`VALIDATION.md`](VALIDATION.md) → "Rendered validation" for the browser evidence
expected.

## Out of scope for this document

`docs/plans/` holds dated, historical plans; they record what was intended at the time and are not
current architecture. `.pi/sub-agents/` are pipeline agent instructions, not runtime modules.
