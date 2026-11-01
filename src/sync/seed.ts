import type { ServerItem } from '../domain/types';

/** Demo catalog served by the mock backend. Barcodes are made up. */
const rows: [string, string, string, string, number][] = [
  ['GLV-NIT-M', '4006381333931', 'Nitrile gloves, medium (100)', 'A-01-1', 42],
  ['GLV-NIT-L', '4006381333948', 'Nitrile gloves, large (100)', 'A-01-2', 18],
  ['TAPE-48', '5012345678900', 'Packing tape 48mm', 'B-04-1', 120],
  ['BOX-S', '5012345678917', 'Shipping box, small', 'C-02-1', 300],
  ['BOX-M', '5012345678924', 'Shipping box, medium', 'C-02-2', 175],
  ['LBL-4X6', '0012345678905', 'Thermal labels 4x6 (roll)', 'D-01-3', 9],
  ['WRAP-STR', '0012345678912', 'Stretch wrap 18in', 'D-03-1', 24],
  ['BAG-ZIP', '0012345678929', 'Zip bags 6x9 (500)', 'B-01-4', 6],
  ['MARK-BLK', '0012345678936', 'Permanent markers, black (12)', 'E-02-1', 31],
  ['CUTTER', '0012345678943', 'Box cutter, retractable', 'E-02-2', 14],
];

export const seedCatalog = (): ServerItem[] =>
  rows.map(([sku, barcode, name, location, quantity], i) => ({
    id: `item-${i + 1}`,
    sku,
    barcode,
    name,
    location,
    quantity,
    version: 1,
    updatedAt: Date.now(),
  }));
