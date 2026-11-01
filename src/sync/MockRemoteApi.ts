import type { ServerItem } from '../domain/types';
import { type PushResult, type RemoteApi, TransientNetworkError } from './RemoteApi';

interface Options {
  latencyMs?: number;
  /** 0..1 probability that a request fails with a transient error. */
  failureRate?: number;
  random?: () => number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * In-memory stand-in for a warehouse backend. It enforces the same rules a real
 * server must: idempotent movements and no negative stock.
 */
export class MockRemoteApi implements RemoteApi {
  private items = new Map<string, ServerItem>();
  private applied = new Set<string>();
  private readonly latencyMs: number;
  failureRate: number;
  private readonly random: () => number;

  constructor(seed: ServerItem[], opts: Options = {}) {
    seed.forEach((i) => this.items.set(i.id, { ...i }));
    this.latencyMs = opts.latencyMs ?? 0;
    this.failureRate = opts.failureRate ?? 0;
    this.random = opts.random ?? Math.random;
  }

  private async roundTrip() {
    if (this.latencyMs) await sleep(this.latencyMs);
    if (this.random() < this.failureRate) throw new TransientNetworkError('Simulated network failure');
  }

  /** Simulates another device changing stock directly on the server. */
  externalAdjust(itemId: string, delta: number) {
    const item = this.items.get(itemId)!;
    this.items.set(itemId, { ...item, quantity: item.quantity + delta, version: item.version + 1, updatedAt: Date.now() });
  }

  async pullItems() {
    await this.roundTrip();
    return [...this.items.values()].map((i) => ({ ...i }));
  }

  async pushMovements(batch: Parameters<RemoteApi['pushMovements']>[0]) {
    await this.roundTrip();
    return batch.map((m): PushResult => {
      const item = this.items.get(m.itemId);
      if (!item) throw new Error(`Unknown item ${m.itemId}`);
      if (this.applied.has(m.id)) return { id: m.id, status: 'duplicate', item: { ...item } };
      if (item.quantity + m.delta < 0) {
        return { id: m.id, status: 'rejected', reason: `Insufficient stock (${item.quantity} on server)`, item: { ...item } };
      }
      const next = { ...item, quantity: item.quantity + m.delta, version: item.version + 1, updatedAt: Date.now() };
      this.items.set(m.itemId, next);
      this.applied.add(m.id);
      return { id: m.id, status: 'applied', item: { ...next } };
    });
  }
}
