import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = new URL('../data/', import.meta.url);
const DB_PATH = new URL('../data/hello.db', import.meta.url);
const MESSAGE = 'hello world';

try {
  mkdirSync(DATA_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        body TEXT NOT NULL
      );
    `);

    const inserted = db
      .prepare('INSERT INTO messages (body) SELECT ? WHERE NOT EXISTS (SELECT 1 FROM messages)')
      .run(MESSAGE).changes;

    const { count } = db.prepare('SELECT COUNT(*) AS count FROM messages').get();

    console.log(
      inserted
        ? `seeded '${MESSAGE}' into data/hello.db`
        : `data/hello.db already contains ${count} message(s), nothing to do`
    );
  } finally {
    db.close();
  }
} catch (err) {
  console.error(err);
  process.exit(1);
}
