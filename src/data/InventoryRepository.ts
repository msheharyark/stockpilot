import type { Item, ItemId, Movement, ServerItem } from '../domain/types';

/** Storage boundary. The app uses SQLite; tests use the in-memory version. */
export interface InventoryRepository {
  listItems(): Promise<Item[]>;
  getItem(id: ItemId): Promise<Item | null>;
  findByBarcode(barcode: string): Promise<Item | null>;
  /** Store server state (ignoring stale versions) and rebase visible quantity on pending movements. */
  applyServerItems(items: ServerItem[]): Promise<void>;
  /** Atomically record a movement and apply it to the visible quantity. */
  recordMovement(movement: Movement): Promise<void>;
  listMovements(itemId: ItemId, limit?: number): Promise<Movement[]>;
  /** Pending movements whose retry time has passed, oldest first. */
  dueMovements(now: number, limit: number): Promise<Movement[]>;
  pendingCount(): Promise<number>;
  markSynced(ids: string[]): Promise<void>;
  /** Permanently reject a movement and undo its effect on the visible quantity. */
  markRejected(id: string, error: string): Promise<void>;
  scheduleRetry(id: string, nextAttemptAt: number, error: string): Promise<void>;
}
