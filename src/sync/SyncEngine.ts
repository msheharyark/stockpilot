import type { InventoryRepository } from '../data/InventoryRepository';
import { nextBackoffMs } from '../domain/stock';
import { type RemoteApi, TransientNetworkError } from './RemoteApi';

export interface SyncReport {
  pushed: number;
  rejected: { id: string; reason: string }[];
  failed: boolean;
}

interface Deps {
  repo: InventoryRepository;
  api: RemoteApi;
  now?: () => number;
  random?: () => number;
  batchSize?: number;
}

/**
 * Drains the movement outbox to the server, then pulls fresh server state.
 *
 * Guarantees:
 * - Single flight: concurrent `sync()` calls share one run.
 * - At-most-once effect: movement ids are idempotency keys.
 * - Transient errors back off with jitter; business rejections are final and rolled back locally.
 */
export class SyncEngine {
  private inFlight: Promise<SyncReport> | null = null;
  private readonly repo: InventoryRepository;
  private readonly api: RemoteApi;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly batchSize: number;

  constructor({ repo, api, now = Date.now, random = Math.random, batchSize = 25 }: Deps) {
    this.repo = repo;
    this.api = api;
    this.now = now;
    this.random = random;
    this.batchSize = batchSize;
  }

  sync(): Promise<SyncReport> {
    if (!this.inFlight) {
      this.inFlight = this.run().finally(() => {
        this.inFlight = null;
      });
    }
    return this.inFlight;
  }

  private async run(): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, rejected: [], failed: false };
    try {
      await this.push(report);
      await this.repo.applyServerItems(await this.api.pullItems());
    } catch (error) {
      if (!(error instanceof TransientNetworkError)) throw error;
      report.failed = true;
    }
    return report;
  }

  private async push(report: SyncReport) {
    for (;;) {
      const batch = await this.repo.dueMovements(this.now(), this.batchSize);
      if (batch.length === 0) return;

      let results;
      try {
        results = await this.api.pushMovements(batch);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const m of batch) {
          await this.repo.scheduleRetry(m.id, this.now() + nextBackoffMs(m.attempts + 1, this.random), message);
        }
        throw error;
      }

      const accepted = results.filter((r) => r.status !== 'rejected').map((r) => r.id);
      // Acknowledge first, then apply server state, so the rebase never double-counts.
      await this.repo.markSynced(accepted);
      for (const r of results) {
        if (r.status === 'rejected') {
          await this.repo.markRejected(r.id, r.reason);
          report.rejected.push({ id: r.id, reason: r.reason });
        }
      }
      await this.repo.applyServerItems(results.map((r) => r.item));
      report.pushed += accepted.length;
    }
  }
}
