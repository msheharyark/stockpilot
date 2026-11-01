import type { Movement, ServerItem } from '../src/domain/types';

export const seedItems = (): ServerItem[] => [
  { id: 'i1', sku: 'GLV-NIT-M', barcode: '0001', name: 'Nitrile gloves (M)', location: 'A-01', quantity: 10, version: 1, updatedAt: 0 },
  { id: 'i2', sku: 'TAPE-48', barcode: '0002', name: 'Packing tape 48mm', location: 'B-04', quantity: 3, version: 1, updatedAt: 0 },
];

let counter = 0;
export const movement = (overrides: Partial<Movement>): Movement => ({
  id: `m${++counter}`,
  itemId: 'i1',
  delta: -1,
  reason: 'pick',
  createdAt: counter,
  status: 'pending',
  attempts: 0,
  nextAttemptAt: 0,
  lastError: null,
  ...overrides,
});
