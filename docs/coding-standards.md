# Coding standards

- Keep functions small and single-purpose; name things for what they mean.
- No dead code, commented-out code or speculative abstractions.
- Every behaviour change has a test that exercises it.
- Errors are surfaced, never silently swallowed.
- Follow the language's standard formatter and linter.

## Repository notes

These record how the standards above apply in this repository. They do not relax them.

### Dependencies and build

- Zero npm dependencies and no build step. No framework, bundler, TypeScript, test runner, linter
  or formatter is installed, and none may be added to satisfy a check for a scoped change. Use
  what Node >= 22 and the repository already provide.
- Because there is no compiler or linter, `node --check` on each touched module plus the executable
  fence in `docs/VALIDATION.md` is the baseline static gate. `docs/VALIDATION.md` is authoritative
  for how that gate runs fence lines — one `/bin/sh` process per line — and for the
  self-containment rules that follow from it.

### Evidence for behaviour changes

The repository has no automated test suite, so "every behaviour change has a test that exercises
it" is currently met by deterministic executable checks rather than test files. `docs/VALIDATION.md`
is authoritative for which checks those are — the fast check set for HTTP, seed and routing
behaviour, and rendered browser evidence for anything user-visible. That gap is a known limitation
of the repository, not a licence to skip evidence — do not describe an unverified change as done.

### Node and module style

- ESM only (`"type": "module"`), built-in `node:` imports.
- Keep SQLite access inside `src/db.js` and the socket/routing inside `src/server.js`; the server
  must not open the database itself.
- Resolve data files from module URLs (`new URL('../data/hello.db', import.meta.url)`), never from
  the current working directory.
- Surface failures. `src/db.js` throws on unexpected SQLite errors and the server logs them with
  stack; only the documented "no message" case maps to a non-error result.

### Stylesheet (`public/styles.css`)

- Style only the listed DOM hooks and their descendants / pseudo-elements, plus `:root` custom
  properties, `@media`, `@supports` and `@keyframes`. No change may require a new HTML element,
  id, class or attribute, and HTML and JS are not this file's to edit. This ownership restriction
  describes the earlier stylesheet-only task; the mouse-trail request explicitly permits `app.js`
  behavior and decorative descendants of the existing backdrop. Preserve the original HTML hooks
  and message-state semantics.
- Self-contained: system font stacks only — no `@import`, no web fonts, no external or local
  image, icon or font files. All imagery is generated from gradients, shadows and filters.
- Palette values live in the §1 `:root` tokens; the light-scheme block in §10 overrides tokens
  only, so component rules are not duplicated per scheme. Derive new colours from the existing
  accent tokens before introducing another hue.
- Keep the numbered section index in the file header accurate when sections or their contents move.
- Every animated layer needs an explicit static treatment in §11; the global reduced-motion rule
  collapses durations, which would otherwise freeze a layer on whatever keyframe it lands on
  instead of its intended resting state.
- Blend and filter layers are expensive: prefer gradient alpha falloff and masks over adding further
  full-viewport `filter: blur()` layers, and keep alpha low in the light scheme.
