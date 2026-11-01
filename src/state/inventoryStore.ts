import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import type { InventoryRepository } from '../data/InventoryRepository';
import { assertMovementAllowed } from '../domain/stock';
import type { Item, MovementReason } from '../domain/types';
import type { SyncEngine, SyncReport } from '../sync/SyncEngine';

type SyncState = 'idle' | 'syncing' | 'offline' | 'error';

interface InventoryState {
  ready: boolean;
  items: Item[];
  pending: number;
  syncState: SyncState;
  lastSyncedAt: number | null;
  lastReport: SyncReport | null;
  init(repo: InventoryRepository, engine: SyncEngine): Promise<void>;
  refresh(): Promise<void>;
  sync(): Promise<void>;
  adjust(itemId: string, delta: number, reason: MovementReason): Promise<void>;
}

let repo: InventoryRepository;
let engine: SyncEngine;

export const useInventory = create<InventoryState>((set, get) => ({
  ready: false,
  items: [],
  pending: 0,
  syncState: 'idle',
  lastSyncedAt: null,
  lastReport: null,

  async init(r, e) {
    repo = r;
    engine = e;
    await get().refresh();
    set({ ready: true });
    void get().sync();
  },

  async refresh() {
    const [items, pending] = await Promise.all([repo.listItems(), repo.pendingCount()]);
    set({ items, pending });
  },

  async sync() {
    set({ syncState: 'syncing' });
    try {
      const report = await engine.sync();
      set({
        syncState: report.failed ? 'offline' : 'idle',
        lastReport: report,
        lastSyncedAt: report.failed ? get().lastSyncedAt : Date.now(),
      });
    } catch {
      set({ syncState: 'error' });
    } finally {
      await get().refresh();
    }
  },

  /** Optimistic: writes locally first, so it works with no signal. */
  async adjust(itemId, delta, reason) {
    const item = await repo.getItem(itemId);
    if (!item) throw new Error('Item not found');
    assertMovementAllowed(item, delta, reason);
    const now = Date.now();
    await repo.recordMovement({
      id: randomUUID(),
      itemId,
      delta,
      reason,
      createdAt: now,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: now,
      lastError: null,
    });
    await get().refresh();
    void get().sync();
  },
}));

export const getRepository = () => repo;
