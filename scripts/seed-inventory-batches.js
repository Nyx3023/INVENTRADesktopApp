/**
 * Inventory Batch Seeder
 *
 * Seeds realistic inventory batches for all existing active products, including
 * batch numbers, quantities, unit costs, and expiration dates.
 *
 * Each product gets 1-3 batches with staggered receive and expiry dates so that
 * the FIFO / FEFO deduction logic has multiple batches to work through.
 *
 * Usage:
 *   node scripts/seed-inventory-batches.js
 *   node scripts/seed-inventory-batches.js --clear        (wipe existing batches first)
 *   node scripts/seed-inventory-batches.js --batches=3    (max batches per product, default 3)
 *
 * NOTE: Running without --clear will APPEND new batches on top of any that
 *       already exist. Pass --clear to start fresh.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getArgValue(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  const value = arg.slice(name.length + 3).trim();
  return value.length > 0 ? value : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

/** Generates a human-readable batch number like ABCD-20240315-A */
function generateBatchNumber(productName, receivedDate, index) {
  const prefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const datePart = formatDate(receivedDate).replace(/-/g, '');
  const suffix = String.fromCharCode(65 + index); // A, B, C …
  return `${prefix}-${datePart}-${suffix}`;
}

function getDatabasePath() {
  const dataDb = path.join(process.cwd(), 'data', 'pos_inventory.db');
  const rootDb = path.join(process.cwd(), 'pos_inventory.db');
  return fs.existsSync(dataDb) ? dataDb : rootDb;
}

// ─── Category shelf-life map (days until expiry from received date) ───────────
// Adjust ranges to fit your store's product types.
const CATEGORY_SHELF_LIFE = {
  // Perishable / short shelf-life
  foods:       { min: 30,   max: 90   },
  food:        { min: 30,   max: 90   },
  beverages:   { min: 60,   max: 180  },
  dairy:       { min: 14,   max: 30   },
  bakery:      { min: 3,    max: 14   },
  produce:     { min: 5,    max: 21   },
  frozen:      { min: 90,   max: 365  },
  meat:        { min: 3,    max: 14   },
  seafood:     { min: 3,    max: 10   },
  snacks:      { min: 90,   max: 365  },
  candy:       { min: 180,  max: 540  },

  // Health / beauty
  medicines:   { min: 365,  max: 1095 },
  medicine:    { min: 365,  max: 1095 },
  pharmacy:    { min: 365,  max: 1095 },
  vitamins:    { min: 365,  max: 730  },
  cosmetics:   { min: 365,  max: 730  },
  personal:    { min: 365,  max: 730  },

  // Longer shelf-life / non-perishable
  household:   { min: 730,  max: 1825 },
  cleaning:    { min: 730,  max: 1825 },
  clothing:    { min: null, max: null },  // No expiry
  electronics: { min: null, max: null },  // No expiry
  tools:       { min: null, max: null },  // No expiry

  default:     { min: 180,  max: 730  },  // Fallback for unknown categories
};

function getShelfLife(categoryName) {
  const key = (categoryName || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(CATEGORY_SHELF_LIFE)) {
    if (key.includes(k)) return v;
  }
  return CATEGORY_SHELF_LIFE.default;
}

// ─── Core seeder ─────────────────────────────────────────────────────────────

function seedBatches(db, { maxBatchesPerProduct, clearExisting }) {
  const products = db.prepare(`
    SELECT id, name, category_name, quantity, cost
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY name
  `).all();

  if (products.length === 0) {
    throw new Error('No active products found. Add products before seeding batches.');
  }

  if (clearExisting) {
    console.log('  Clearing existing inventory_batches …');
    db.prepare('DELETE FROM inventory_batches').run();
  }

  // Matches the INSERT in addInventoryBatch() in server/index.js
  // Columns: id, product_id, batch_number, quantity, initial_quantity,
  //          unit_cost, expiry_date, source_type, source_id, status
  const insertBatch = db.prepare(`
    INSERT INTO inventory_batches (
      id, product_id, batch_number, quantity, initial_quantity,
      unit_cost, expiry_date, source_type, source_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalBatches = 0;
  let productsWithBatches = 0;

  const now = new Date();

  const run = db.transaction(() => {
    for (const product of products) {
      const productQty  = Math.max(0, Number(product.quantity) || 0);
      const productCost = Number(product.cost) || 0;
      const shelfLife   = getShelfLife(product.category_name);

      // How many batches will this product have?
      const numBatches = randomInt(1, maxBatchesPerProduct);

      // Distribute quantity across batches.
      // Older batches (lower index) may have less stock (partially consumed).
      let quantities = [];
      if (productQty > 0) {
        let remaining = productQty;
        for (let i = 0; i < numBatches; i++) {
          if (i === numBatches - 1) {
            quantities.push(Math.max(1, remaining));
          } else {
            const fraction  = randomFloat(0.15, 0.55);
            const share     = Math.max(1, Math.round(remaining * fraction));
            const capped    = Math.min(share, remaining - (numBatches - i - 1));
            quantities.push(Math.max(1, capped));
            remaining -= capped;
          }
        }
      } else {
        // Zero-stock product – create depleted/empty historical batches
        for (let i = 0; i < numBatches; i++) {
          quantities.push(0);
        }
      }

      for (let i = 0; i < numBatches; i++) {
        const qty = quantities[i];

        // Older batches received further in the past (FIFO order)
        // batch 0 = oldest, batch numBatches-1 = newest
        const daysAgoMin = (numBatches - 1 - i) * 15;
        const daysAgoMax = (numBatches - i) * 30;
        const daysAgoReceived = randomInt(
          Math.max(0, daysAgoMin),
          Math.max(daysAgoMin + 1, daysAgoMax)
        );
        const receivedDate = addDays(now, -daysAgoReceived);

        // Expiry date derived from received date + category shelf life
        let expiryDate = null;
        if (shelfLife.min !== null && shelfLife.max !== null) {
          const shelfDays = randomInt(shelfLife.min, shelfLife.max);
          expiryDate = addDays(receivedDate, shelfDays);

          // ~15% chance the oldest batch is near/past expiry (realism)
          if (i === 0 && Math.random() < 0.15) {
            expiryDate = addDays(now, randomInt(-10, 30));
          }
        }

        const batchNumber = generateBatchNumber(product.name, receivedDate, i);
        const batchId     = uuidv4();

        // Slight cost variation per batch (±5%) to reflect price fluctuations
        const variationPct = randomFloat(-0.05, 0.05);
        const unitCost     = parseFloat(Math.max(0, productCost * (1 + variationPct)).toFixed(2));

        const status        = qty <= 0 ? 'depleted' : 'active';
        const expiryDateStr = expiryDate ? formatDate(expiryDate) : null;

        insertBatch.run(
          batchId,
          product.id,
          batchNumber,
          qty,
          qty,           // initial_quantity same as current quantity at seed time
          unitCost,
          expiryDateStr,
          'seeder',
          `seed-${batchId.slice(0, 8)}`,
          status
        );

        totalBatches++;
      }

      productsWithBatches++;
    }
  });

  run();

  return { totalBatches, productsWithBatches, productCount: products.length };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.error(`❌  Database file not found: ${dbPath}`);
    console.error('    Start the application at least once so the database is initialized.');
    process.exit(1);
  }

  const clearExisting       = hasFlag('clear');
  const maxBatchesRaw       = getArgValue('batches');
  const maxBatchesPerProduct = Math.max(1, Math.min(10,
    maxBatchesRaw ? parseInt(maxBatchesRaw, 10) || 3 : 3
  ));

  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║       INVENTRA  –  Inventory Batch Seeder        ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Database           : ${dbPath}`);
  console.log(`  Max batches/product: ${maxBatchesPerProduct}`);
  console.log(`  Clear existing     : ${clearExisting ? 'YES – all batches will be deleted first' : 'no'}`);
  console.log('');

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  try {
    const result = seedBatches(db, { maxBatchesPerProduct, clearExisting });
    const totalInDb = db.prepare('SELECT COUNT(*) AS count FROM inventory_batches').get();

    console.log('  ✅  Seeding complete!');
    console.log('');
    console.log('  Summary');
    console.log('  ─────────────────────────────────────────');
    console.log(`  Products processed     : ${result.productCount}`);
    console.log(`  Products with batches  : ${result.productsWithBatches}`);
    console.log(`  New batches inserted   : ${result.totalBatches}`);
    console.log(`  Total batches in DB    : ${totalInDb.count}`);
    console.log('');
    console.log('  Tip: Open Inventory → Batches tab to review the seeded data.');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('  ❌  Seeder failed:', err.message || err);
    console.error('');
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
