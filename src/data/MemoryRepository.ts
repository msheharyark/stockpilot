import { rebaseQuantity } from '../domain/stock';
import type { Item, ItemId, Movement, ServerItem } from '../domain/types';
import type { InventoryRepository } from './InventoryRepository';

/** In-memory implementation with the same semantics as SQLite. Used in tests. */
export class MemoryRepository implements InventoryRepository {
  items = new Map<ItemId, Item>();
  movements = new Map<string, Movement>();

  private pendingFor(itemId: ItemId) {
    return [...this.movements.values()].filter((m) => m.itemId === itemId && m.status === 'pending');
  }

  private rebase(itemId: ItemId) {
    const item = this.items.get(itemId);
    if (item) item.quantity = rebaseQuantity(item.serverQuantity, this.pendingFor(itemId));
  }

  async listItems() {
    return [...this.items.values()].map((i) => ({ ...i })).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getItem(id: ItemId) {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }
  async findByBarcode(barcode: string) {
    const item = [...this.items.values()].find((i) => i.barcode === barcode);
    return item ? { ...item } : null;
  }
  async applyServerItems(items: ServerItem[]) {
    for (const s of items) {
      const existing = this.items.get(s.id);
      if (existing && existing.version > s.version) continue;
      this.items.set(s.id, { ...s, serverQuantity: s.quantity, quantity: s.quantity });
      this.rebase(s.id);
    }
  }
  async recordMovement(movement: Movement) {
    this.movements.set(movement.id, { ...movement });
    this.rebase(movement.itemId);
  }
  async listMovements(itemId: ItemId, limit = 50) {
    return [...this.movements.values()]
      .filter((m) => m.itemId === itemId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }
  async dueMovements(now: number, limit: number) {
    return [...this.movements.values()]
      .filter((m) => m.status === 'pending' && m.nextAttemptAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit)
      .map((m) => ({ ...m }));
  }
  async pendingCount() {
    return [...this.movements.values()].filter((m) => m.status === 'pending').length;
  }
  async markSynced(ids: string[]) {
    for (const id of ids) {
      const m = this.movements.get(id);
      if (m) m.status = 'synced';
    }
  }
  async markRejected(id: string, error: string) {
    const m = this.movements.get(id);
    if (!m) return;
    m.status = 'rejected';
    m.lastError = error;
    this.rebase(m.itemId);
  }
  async scheduleRetry(id: string, nextAttemptAt: number, error: string) {
    const m = this.movements.get(id);
    if (!m) return;
    m.attempts += 1;
    m.nextAttemptAt = nextAttemptAt;
    m.lastError = error;
  }
}
