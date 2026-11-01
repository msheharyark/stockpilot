export type ItemId = string;

export interface Item {
  id: ItemId;
  sku: string;
  barcode: string;
  name: string;
  location: string;
  /** Quantity shown to the user: last server quantity + unsynced local deltas. */
  quantity: number;
  /** Last quantity confirmed by the server. */
  serverQuantity: number;
  /** Server-side version, used to ignore stale pulls. */
  version: number;
  updatedAt: number;
}

/** Item as the server sends it. The device derives `quantity` from it. */
export type ServerItem = Omit<Item, 'quantity' | 'serverQuantity'> & { quantity: number };

export type MovementReason = 'receive' | 'pick' | 'count-adjust' | 'damage';

export type MovementStatus = 'pending' | 'synced' | 'rejected';

/**
 * A stock movement doubles as the outbox entry.
 * `id` is generated on device and used as the server idempotency key,
 * so a retried request can never be applied twice.
 */
export interface Movement {
  id: string;
  itemId: ItemId;
  delta: number;
  reason: MovementReason;
  createdAt: number;
  status: MovementStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}
