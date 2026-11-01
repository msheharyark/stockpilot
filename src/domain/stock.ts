import type { Item, Movement, MovementReason } from './types';

export class StockError extends Error {}

const MAX_BACKOFF_MS = 5 * 60_000;

const DIRECTION: Record<MovementReason, 'in' | 'out' | 'any'> = {
  receive: 'in',
  pick: 'out',
  damage: 'out',
  'count-adjust': 'any',
};

/** Validates a movement against what the user can currently see. */
export function assertMovementAllowed(item: Item, delta: number, reason: MovementReason): void {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new StockError('Quantity change must be a non-zero whole number.');
  }
  const direction = DIRECTION[reason];
  if ((direction === 'in' && delta < 0) || (direction === 'out' && delta > 0)) {
    throw new StockError(`A "${reason}" movement cannot be ${delta > 0 ? 'positive' : 'negative'}.`);
  }
  if (item.quantity + delta < 0) {
    throw new StockError(`Only ${item.quantity} of ${item.sku} on hand.`);
  }
}

/**
 * Visible quantity = server truth + every movement the server has not acknowledged.
 * Recomputing (instead of incrementing) keeps the device correct after the server
 * rejects a movement or another device changed the same item.
 */
export function rebaseQuantity(serverQuantity: number, pending: Pick<Movement, 'delta'>[]): number {
  return pending.reduce((qty, m) => qty + m.delta, serverQuantity);
}

/** Exponential backoff with full jitter, capped. `random` is injectable for tests. */
export function nextBackoffMs(attempts: number, random: () => number = Math.random): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** Math.max(0, attempts - 1));
  return Math.floor(random() * ceiling);
}
