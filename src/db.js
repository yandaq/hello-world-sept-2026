import { DatabaseSync } from 'node:sqlite';

const DB_PATH = new URL('../data/hello.db', import.meta.url);

/**
 * Reads the first message body from the database.
 * Returns null when the database file, table or row is missing; throws on
 * any other SQLite failure.
 */
export function getMessage() {
  let db;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
  } catch (err) {
    // No database file yet — an unseeded app must not throw and must not
    // create a schema.
    if (err.code === 'ERR_SQLITE_ERROR' && /unable to open database file/i.test(err.message)) {
      return null;
    }
    throw err;
  }

  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get('messages');
    if (!table) return null;

    const row = db.prepare('SELECT body FROM messages ORDER BY id LIMIT 1').get();
    return row ? row.body : null;
  } finally {
    db.close();
  }
}
