import { StockError, assertMovementAllowed, nextBackoffMs, rebaseQuantity } from '../src/domain/stock';
import type { Item } from '../src/domain/types';

const item: Item = {
  id: 'i1', sku: 'SKU', barcode: '1', name: 'Item', location: 'A', quantity: 5, serverQuantity: 5, version: 1, updatedAt: 0,
};

describe('assertMovementAllowed', () => {
  it('allows a pick within stock', () => {
    expect(() => assertMovementAllowed(item, -5, 'pick')).not.toThrow();
  });
  it('blocks a pick that would go negative', () => {
    expect(() => assertMovementAllowed(item, -6, 'pick')).toThrow(StockError);
  });
  it('blocks movements in the wrong direction', () => {
    expect(() => assertMovementAllowed(item, -1, 'receive')).toThrow(/cannot be negative/);
    expect(() => assertMovementAllowed(item, 1, 'damage')).toThrow(/cannot be positive/);
  });
  it('lets count adjustments go either way', () => {
    expect(() => assertMovementAllowed(item, 2, 'count-adjust')).not.toThrow();
    expect(() => assertMovementAllowed(item, -2, 'count-adjust')).not.toThrow();
  });
  it('rejects zero and fractional deltas', () => {
    expect(() => assertMovementAllowed(item, 0, 'count-adjust')).toThrow(StockError);
    expect(() => assertMovementAllowed(item, 1.5, 'receive')).toThrow(StockError);
  });
});

describe('rebaseQuantity', () => {
  it('adds unsynced deltas to the server quantity', () => {
    expect(rebaseQuantity(10, [{ delta: -2 }, { delta: 5 }])).toBe(13);
  });
});

describe('nextBackoffMs', () => {
  it('grows exponentially and caps at five minutes', () => {
    const max = () => 0.999999;
    expect(nextBackoffMs(1, max)).toBeLessThan(1_000);
    expect(nextBackoffMs(4, max)).toBeLessThan(8_000);
    expect(nextBackoffMs(4, max)).toBeGreaterThan(7_000);
    expect(nextBackoffMs(30, max)).toBeLessThanOrEqual(5 * 60_000);
  });
});
