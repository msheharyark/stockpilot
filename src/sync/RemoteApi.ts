import type { Movement, ServerItem } from '../domain/types';

export type PushResult =
  | { id: string; status: 'applied' | 'duplicate'; item: ServerItem }
  | { id: string; status: 'rejected'; reason: string; item: ServerItem };

/** Network boundary. Swap MockRemoteApi for a real HTTP client without touching the sync engine. */
export interface RemoteApi {
  /** Full catalog snapshot. Per-item versions let the device ignore stale data. */
  pullItems(): Promise<ServerItem[]>;
  pushMovements(batch: Pick<Movement, 'id' | 'itemId' | 'delta' | 'reason'>[]): Promise<PushResult[]>;
}

/** Thrown for failures worth retrying (timeouts, 5xx, offline). */
export class TransientNetworkError extends Error {}
