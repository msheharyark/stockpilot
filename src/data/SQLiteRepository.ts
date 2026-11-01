import type { SQLiteDatabase } from 'expo-sqlite';
import type { Item, ItemId, Movement, ServerItem } from '../domain/types';
import type { InventoryRepository } from './InventoryRepository';

const MIGRATIONS: string[] = [
  `CREATE TABLE items (
     id TEXT PRIMARY KEY NOT NULL,
     sku TEXT NOT NULL,
     barcode TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     location TEXT NOT NULL,
     quantity INTEGER NOT NULL,
     serverQuantity INTEGER NOT NULL,
     version INTEGER NOT NULL,
     updatedAt INTEGER NOT NULL
   );
   CREATE TABLE movements (
     id TEXT PRIMARY KEY NOT NULL,
     itemId TEXT NOT NULL REFERENCES items(id),
     delta INTEGER NOT NULL,
     reason TEXT NOT NULL,
     createdAt INTEGER NOT NULL,
     status TEXT NOT NULL,
     attempts INTEGER NOT NULL DEFAULT 0,
     nextAttemptAt INTEGER NOT NULL,
     lastError TEXT
   );
   CREATE INDEX idx_movements_due ON movements(status, nextAttemptAt, createdAt);
   CREATE INDEX idx_movements_item ON movements(itemId, createdAt);`,
];

/** Runs pending migrations, tracked with SQLite's built-in user_version. */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

const REBASE_SQL = `
  UPDATE items SET quantity = serverQuantity + COALESCE(
    (SELECT SUM(delta) FROM movements WHERE movements.itemId = items.id AND status = 'pending'), 0)
  WHERE id = ?`;

export class SQLiteRepository implements InventoryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  listItems() {
    return this.db.getAllAsync<Item>('SELECT * FROM items ORDER BY name');
  }
  getItem(id: ItemId) {
    return this.db.getFirstAsync<Item>('SELECT * FROM items WHERE id = ?', id);
  }
  findByBarcode(barcode: string) {
    return this.db.getFirstAsync<Item>('SELECT * FROM items WHERE barcode = ?', barcode);
  }

  async applyServerItems(items: ServerItem[]) {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      for (const s of items) {
        await txn.runAsync(
          `INSERT INTO items (id, sku, barcode, name, location, quantity, serverQuantity, version, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             sku = excluded.sku, barcode = excluded.barcode, name = excluded.name,
             location = excluded.location, serverQuantity = excluded.serverQuantity,
             version = excluded.version, updatedAt = excluded.updatedAt
           WHERE excluded.version >= items.version`,
          s.id, s.sku, s.barcode, s.name, s.location, s.quantity, s.quantity, s.version, s.updatedAt,
        );
        await txn.runAsync(REBASE_SQL, s.id);
      }
    });
  }

  async recordMovement(m: Movement) {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO movements (id, itemId, delta, reason, createdAt, status, attempts, nextAttemptAt, lastError)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        m.id, m.itemId, m.delta, m.reason, m.createdAt, m.status, m.attempts, m.nextAttemptAt, m.lastError,
      );
      await txn.runAsync(REBASE_SQL, m.itemId);
    });
  }

  listMovements(itemId: ItemId, limit = 50) {
    return this.db.getAllAsync<Movement>(
      'SELECT * FROM movements WHERE itemId = ? ORDER BY createdAt DESC LIMIT ?', itemId, limit,
    );
  }
  dueMovements(now: number, limit: number) {
    return this.db.getAllAsync<Movement>(
      `SELECT * FROM movements WHERE status = 'pending' AND nextAttemptAt <= ?
       ORDER BY createdAt ASC LIMIT ?`, now, limit,
    );
  }
  async pendingCount() {
    const row = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM movements WHERE status = 'pending'`,
    );
    return row?.n ?? 0;
  }
  async markSynced(ids: string[]) {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.runAsync(`UPDATE movements SET status = 'synced' WHERE id IN (${placeholders})`, ...ids);
  }
  async markRejected(id: string, error: string) {
    await this.db.withExclusiveTransactionAsync(async (txn) => {
      const m = await txn.getFirstAsync<{ itemId: string }>('SELECT itemId FROM movements WHERE id = ?', id);
      await txn.runAsync(`UPDATE movements SET status = 'rejected', lastError = ? WHERE id = ?`, error, id);
      if (m) await txn.runAsync(REBASE_SQL, m.itemId);
    });
  }
  async scheduleRetry(id: string, nextAttemptAt: number, error: string) {
    await this.db.runAsync(
      'UPDATE movements SET attempts = attempts + 1, nextAttemptAt = ?, lastError = ? WHERE id = ?',
      nextAttemptAt, error, id,
    );
  }
}
