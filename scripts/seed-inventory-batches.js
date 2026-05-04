/**
 * Inventory Batch Seeder
 *
 * Seeds inventory_batches for products. Use --backfill to create one batch per
 * product that has none (fixes legacy products after batch tracking was added).
 *
 * Usage:
 *   node scripts/seed-inventory-batches.js
 *   node scripts/seed-inventory-batches.js --clear
 *   node scripts/seed-inventory-batches.js --batches=3
 *   node scripts/seed-inventory-batches.js --backfill    (only products with zero batch rows)
 *   node scripts/seed-inventory-batches.js --db=C:\\path\\to\\pos_inventory.db
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

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
  return date.toISOString().slice(0, 10);
}

function generateBatchNumber(productName, receivedDate, index) {
  const prefix = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const datePart = formatDate(receivedDate).replace(/-/g, '');
  const suffix = String.fromCharCode(65 + index);
  return `${prefix}-${datePart}-${suffix}`;
}

function getDatabasePath() {
  const fromEnv = process.env.DB_PATH || getArgValue('db');
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  const dataDb = path.join(process.cwd(), 'data', 'pos_inventory.db');
  const rootDb = path.join(process.cwd(), 'pos_inventory.db');
  if (fs.existsSync(dataDb)) return dataDb;
  return rootDb;
}

const CATEGORY_SHELF_LIFE = {
  foods: { min: 30, max: 90 },
  food: { min: 30, max: 90 },
  beverages: { min: 60, max: 180 },
  dairy: { min: 14, max: 30 },
  bakery: { min: 3, max: 14 },
  produce: { min: 5, max: 21 },
  frozen: { min: 90, max: 365 },
  meat: { min: 3, max: 14 },
  seafood: { min: 3, max: 10 },
  snacks: { min: 90, max: 365 },
  candy: { min: 180, max: 540 },
  medicines: { min: 365, max: 1095 },
  medicine: { min: 365, max: 1095 },
  pharmacy: { min: 365, max: 1095 },
  vitamins: { min: 365, max: 730 },
  cosmetics: { min: 365, max: 730 },
  personal: { min: 365, max: 730 },
  household: { min: 730, max: 1825 },
  cleaning: { min: 730, max: 1825 },
  clothing: { min: null, max: null },
  electronics: { min: null, max: null },
  tools: { min: null, max: null },
  default: { min: 180, max: 730 },
};

function getShelfLife(categoryName) {
  const key = (categoryName || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(CATEGORY_SHELF_LIFE)) {
    if (k !== 'default' && key.includes(k)) return v;
  }
  return CATEGORY_SHELF_LIFE.default;
}

/** Must match server inventory_batches INSERT shape (received_date + nullable extras). */
function prepareInsertBatch(db) {
  return db.prepare(`
    INSERT INTO inventory_batches (
      id, product_id, batch_number, quantity, initial_quantity,
      unit_cost, unit_price, expiry_date, received_date, supplier_id, notes, storage_location,
      source_type, source_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?)
  `);
}

function backfillMissingBatches(db) {
  const insertBatch = prepareInsertBatch(db);
  const products = db.prepare(`
    SELECT p.id, p.name, p.quantity, p.cost, p.price, p.category_name, p.batch_number, p.expiry_date
    FROM products p
    WHERE p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM inventory_batches ib WHERE ib.product_id = p.id)
    ORDER BY p.name
  `).all();

  if (products.length === 0) {
    console.log('  No products need backfill (every product already has at least one batch).');
    return { inserted: 0, skipped: 0 };
  }

  const now = new Date();
  let inserted = 0;

  const run = db.transaction(() => {
    for (const p of products) {
      const qty = Math.max(0, Number(p.quantity) || 0);
      const productCost = Number(p.cost) || 0;
      const productPrice = Number(p.price) || 0;
      const shelfLife = getShelfLife(p.category_name);
      const receivedDate = addDays(now, -randomInt(1, 14));

      let expiryDate = null;
      if (shelfLife.min !== null && shelfLife.max !== null) {
        const shelfDays = randomInt(shelfLife.min, shelfLife.max);
        expiryDate = formatDate(addDays(receivedDate, shelfDays));
      }
      if (p.expiry_date) {
        try {
          expiryDate = String(p.expiry_date).slice(0, 10);
        } catch (_) { /* keep computed */ }
      }

      const batchNumber =
        (p.batch_number && String(p.batch_number).trim()) ||
        generateBatchNumber(p.name, receivedDate, 0);
      const batchId = uuidv4();
      const status = qty <= 0 ? 'depleted' : 'active';
      const sourceId = `backfill-${batchId.slice(0, 8)}`;

      insertBatch.run(
        batchId,
        p.id,
        batchNumber,
        qty,
        qty,
        productCost,
        productPrice,
        expiryDate,
        null,
        null,
        null,
        'seeder',
        sourceId,
        status
      );

      db.prepare(`UPDATE products SET batch_number = COALESCE(NULLIF(TRIM(batch_number), ''), ?) WHERE id = ?`).run(
        batchNumber,
        p.id
      );
      inserted += 1;
    }
  });

  run();
  return { inserted, skipped: 0 };
}

function seedBatches(db, { maxBatchesPerProduct, clearExisting }) {
  const products = db
    .prepare(
      `
    SELECT id, name, category_name, quantity, cost, price
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY name
  `
    )
    .all();

  if (products.length === 0) {
    throw new Error('No active products found. Add products before seeding batches.');
  }

  if (clearExisting) {
    console.log('  Clearing existing inventory_batches …');
    db.prepare('DELETE FROM inventory_batches').run();
  }

  const insertBatch = prepareInsertBatch(db);

  let totalBatches = 0;
  let productsWithBatches = 0;
  const now = new Date();

  const run = db.transaction(() => {
    for (const product of products) {
      const productQty = Math.max(0, Number(product.quantity) || 0);
      const productCost = Number(product.cost) || 0;
      const productPrice = Number(product.price) || 0;
      const shelfLife = getShelfLife(product.category_name);
      const numBatches = randomInt(1, maxBatchesPerProduct);

      let quantities = [];
      if (productQty > 0) {
        let remaining = productQty;
        for (let i = 0; i < numBatches; i++) {
          if (i === numBatches - 1) {
            quantities.push(Math.max(1, remaining));
          } else {
            const fraction = randomFloat(0.15, 0.55);
            const share = Math.max(1, Math.round(remaining * fraction));
            const capped = Math.min(share, remaining - (numBatches - i - 1));
            quantities.push(Math.max(1, capped));
            remaining -= capped;
          }
        }
      } else {
        for (let i = 0; i < numBatches; i++) {
          quantities.push(0);
        }
      }

      for (let i = 0; i < numBatches; i++) {
        const qty = quantities[i];
        const daysAgoMin = (numBatches - 1 - i) * 15;
        const daysAgoMax = (numBatches - i) * 30;
        const daysAgoReceived = randomInt(Math.max(0, daysAgoMin), Math.max(daysAgoMin + 1, daysAgoMax));
        const receivedDate = addDays(now, -daysAgoReceived);

        let expiryDate = null;
        if (shelfLife.min !== null && shelfLife.max !== null) {
          const shelfDays = randomInt(shelfLife.min, shelfLife.max);
          expiryDate = formatDate(addDays(receivedDate, shelfDays));
          if (i === 0 && Math.random() < 0.15) {
            expiryDate = formatDate(addDays(now, randomInt(-10, 30)));
          }
        }

        const batchNumber = generateBatchNumber(product.name, receivedDate, i);
        const batchId = uuidv4();
        const variationPct = randomFloat(-0.05, 0.05);
        const unitCost = parseFloat(Math.max(0, productCost * (1 + variationPct)).toFixed(2));
        const priceVariationPct = randomFloat(-0.03, 0.03);
        const unitPrice = parseFloat(Math.max(0, productPrice * (1 + priceVariationPct)).toFixed(2));
        const status = qty <= 0 ? 'depleted' : 'active';
        const sourceId = `seed-${batchId.slice(0, 8)}`;

        insertBatch.run(
          batchId,
          product.id,
          batchNumber,
          qty,
          qty,
          unitCost,
          unitPrice,
          expiryDate,
          null,
          null,
          null,
          'seeder',
          sourceId,
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

function main() {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found: ${dbPath}`);
    console.error('  Tip: copy your pos_inventory.db here or pass --db=FULL_PATH');
    console.error('  Or set DB_PATH environment variable.');
    process.exit(1);
  }

  const clearExisting = hasFlag('clear');
  const backfillOnly = hasFlag('backfill');
  const maxBatchesRaw = getArgValue('batches');
  const maxBatchesPerProduct = Math.max(1, Math.min(10, maxBatchesRaw ? parseInt(maxBatchesRaw, 10) || 3 : 3));

  console.log('');
  console.log('INVENTRA — Inventory batch seeder');
  console.log(`  Database : ${dbPath}`);
  console.log('');

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  try {
    if (backfillOnly) {
      console.log('  Mode: --backfill (products with no inventory_batches rows)');
      const { inserted } = backfillMissingBatches(db);
      const totalInDb = db.prepare('SELECT COUNT(*) AS count FROM inventory_batches').get();
      console.log('');
      console.log(`  Done. Rows inserted: ${inserted}`);
      console.log(`  Total batches in DB: ${totalInDb.count}`);
      console.log('');
      process.exit(0);
    }

    console.log(`  Max batches/product: ${maxBatchesPerProduct}`);
    console.log(`  Clear existing     : ${clearExisting ? 'yes' : 'no'}`);
    console.log('');

    const result = seedBatches(db, { maxBatchesPerProduct, clearExisting });
    const totalInDb = db.prepare('SELECT COUNT(*) AS count FROM inventory_batches').get();

    console.log('  Seeding complete.');
    console.log(`  Products processed     : ${result.productCount}`);
    console.log(`  Products with batches  : ${result.productsWithBatches}`);
    console.log(`  New batches inserted   : ${result.totalBatches}`);
    console.log(`  Total batches in DB    : ${totalInDb.count}`);
    console.log('');
    console.log('  If legacy products still show no batches, run:');
    console.log('    node scripts/seed-inventory-batches.js --backfill');
    console.log('');
  } catch (err) {
    console.error('Seeder failed:', err.message || err);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
