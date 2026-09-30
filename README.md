# hello-world

A tiny webapp that reads the string `hello world` from a SQLite database and displays it on a
visually stunning page. It uses plain Node.js with **zero npm dependencies**: the built-in
`node:sqlite` driver for the database and `node:http` for the server. There is no build step.

Requires Node.js >= 22 (for `node:sqlite`).

## Run

```bash
npm run seed     # creates data/hello.db and ensures the 'hello world' row exists (idempotent)
npm start        # starts the server
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

## Layout

| Path                | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `src/db.js`         | Opens SQLite, exports `getMessage()`                 |
| `src/seed.js`       | Idempotent schema + seed script                      |
| `src/server.js`     | HTTP server: `/api/message` + static files           |
| `public/index.html` | Page markup                                          |
| `public/app.js`     | Fetches `/api/message` and renders it                |
| `public/styles.css` | All styling                                          |
| `data/hello.db`     | Generated SQLite database (gitignored)               |
| `CONTRACT.md`       | Binding interface contract between all of the above  |

Note: `node:sqlite` prints an `ExperimentalWarning` on stderr. That is expected and harmless.
