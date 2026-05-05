/**
 * Inventory Batch Seeder (FIFO / FEFO demo data)
 *
 * Creates 2-3 inventory_batches rows for every active product so the FIFO
 * deduction and batch-management UI have meaningful data to display.
 *
 * For each product:
 *   - 2 or 3 batches are created (3 is more common, biased for richer demos).
 *   - The product's current quantity is distributed across those batches so
 *     SUM(batches.quantity) == products.quantity.
 *   - received_date values are staggered (oldest → newest) so FIFO order is
 *     visually obvious in the Batches screen.
 *   - expiry_date is derived from category shelf-life ranges.
 *   - ~1 in 7 products gets an "oldest batch is near/past expiry" twist so the
 *     critical / near_expiry / expired statuses light up in the UI.
 *
 * Default targets:
 *   - Primary  : %APPDATA%/INVENTRA/runtime/data/pos_inventory.db (live Electron DB)
 *   - Mirror   : <repo>/database-electron/pos_inventory.db        (workspace copy)
 *
 * Usage (run from repo root):
 *   npm run seed:batches
 *   npm run seed:batches -- --skip-existing
 *   npm run seed:batches -- --clear-all
 *   npm run seed:batches -- --db="C:\\custom\\path\\pos_inventory.db" --no-mirror
 *
 * Flags:
 *   --skip-existing   Skip products that already have >= 2 active batches.
 *   --clear-all       DELETE every row in inventory_batches before seeding.
 *   --db=PATH         Override the primary DB path.
 *   --mirror=PATH     Override the mirror DB path (default database-electron/...).
 *   --no-mirror       Do not copy the seeded DB to the mirror location.
 *   --min=N           Minimum batches per product (default 2, clamped 1..10).
 *   --max=N           Maximum batches per product (default 3, clamped >=min).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

// ---------- arg parsing ----------------------------------------------------

function getArgValue(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return null;
  const value = arg.slice(name.length + 3).trim();
  return value.length > 0 ? value : null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function toIntInRange(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

// ---------- random helpers -------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 2) {
  return Number.parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function generateBatchNumber(productName, receivedDate, index) {
  const prefix = String(productName || 'PROD')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  const datePart = formatDate(receivedDate).replace(/-/g, '');
  const suffix = String.fromCharCode(65 + index); // A, B, C, ...
  return `${prefix}-${datePart}-${suffix}`;
}

// ---------- DB path resolution --------------------------------------------

function getElectronUserDataDir() {
  const appName = 'INVENTRA';
  const platform = process.platform;
  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, appName);
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', appName);
  }
  // linux & others
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, appName);
}

function getDefaultPrimaryDbPath() {
  return path.join(getElectronUserDataDir(), 'runtime', 'data', 'pos_inventory.db');
}

function getDefaultMirrorDbPath() {
  return path.join(process.cwd(), 'database-electron', 'pos_inventory.db');
}

function resolvePrimaryDbPath() {
  const explicit = process.env.DB_PATH || getArgValue('db');
  if (explicit) return path.resolve(explicit);

  const runtime = getDefaultPrimaryDbPath();
  if (fs.existsSync(runtime)) return runtime;

  const mirror = getDefaultMirrorDbPath();
  if (fs.existsSync(mirror)) return mirror;

  const dataDir = path.join(process.cwd(), 'data', 'pos_inventory.db');
  if (fs.existsSync(dataDir)) return dataDir;

  return runtime;
}

function resolveMirrorDbPath(primaryDbPath) {
  if (hasFlag('no-mirror')) return null;
  const explicit = getArgValue('mirror');
  const target = explicit ? path.resolve(explicit) : getDefaultMirrorDbPath();
  if (path.resolve(target) === path.resolve(primaryDbPath)) return null;
  return target;
}

// ---------- shelf life by category -----------------------------------------

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
  // Stationery / office / school supplies — long shelf life but we still
  // want expiry dates for the demo so FEFO is visible.
  art: { min: 730, max: 1825 },
  school: { min: 730, max: 1825 },
  invitation: { min: 730, max: 1825 },
  birthday: { min: 365, max: 1095 },
  stationery: { min: 730, max: 1825 },
  office: { min: 730, max: 1825 },
  default: { min: 365, max: 730 },
};

function getShelfLife(categoryName) {
  const key = String(categoryName || '').toLowerCase().trim();
  for (const [k, v] of Object.entries(CATEGORY_SHELF_LIFE)) {
    if (k === 'default') continue;
    if (key.includes(k)) return v;
  }
  return CATEGORY_SHELF_LIFE.default;
}

// ---------- core seeder ----------------------------------------------------

function distributeQuantity(totalQty, numBatches) {
  const out = new Array(numBatches).fill(0);
  if (totalQty <= 0) return out;

  // Low stock case: not enough units for every batch to have >=1.
  // Realistic FIFO story → older batches were fully sold (qty 0), the
  // newest batch carries the remaining stock.
  if (totalQty < numBatches) {
    out[numBatches - 1] = totalQty;
    return out;
  }

  // Normal case: distribute weighted, sum exactly equals totalQty.
  const weights = [];
  for (let i = 0; i < numBatches; i++) {
    // Newer batches (higher i) get larger weight on average.
    const base = 0.4 + (i / Math.max(1, numBatches - 1)) * 0.8;
    weights.push(base + Math.random() * 0.4);
  }
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let assigned = 0;
  for (let i = 0; i < numBatches - 1; i++) {
    const share = Math.max(1, Math.round((weights[i] / totalWeight) * totalQty));
    const remaining = totalQty - assigned;
    const reserved = numBatches - 1 - i;
    const max = Math.max(1, remaining - reserved);
    out[i] = Math.min(share, max);
    assigned += out[i];
  }
  out[numBatches - 1] = Math.max(1, totalQty - assigned);
  return out;
}

function buildBatchPlan(product, { minBatches, maxBatches, now }) {
  const productQty = Math.max(0, Number.parseInt(product.quantity, 10) || 0);
  const productCost = Number(product.cost) || 0;
  const productPrice = Number(product.price) || 0;
  const shelfLife = getShelfLife(product.category_name);

  // Bias toward maxBatches for richer demos.
  const numBatches = Math.random() < 0.65
    ? maxBatches
    : randomInt(minBatches, maxBatches);

  const quantities = productQty > 0
    ? distributeQuantity(productQty, numBatches)
    : new Array(numBatches).fill(0);

  // 1 in 7 products gets an oldest-batch-near-expiry twist for demo realism.
  const dramatic = Math.random() < 1 / 7;

  const batches = [];
  for (let i = 0; i < numBatches; i++) {
    // batch 0 = oldest, batch numBatches-1 = newest
    const slotsFromNewest = numBatches - 1 - i;
    const daysAgoMin = slotsFromNewest * 14;
    const daysAgoMax = (slotsFromNewest + 1) * 28;
    const daysAgoReceived = randomInt(
      Math.max(0, daysAgoMin),
      Math.max(daysAgoMin + 1, daysAgoMax),
    );
    const receivedDate = addDays(now, -daysAgoReceived);

    let expiryDate = null;
    if (shelfLife.min !== null && shelfLife.max !== null) {
      const shelfDays = randomInt(shelfLife.min, shelfLife.max);
      expiryDate = formatDate(addDays(receivedDate, shelfDays));
      if (i === 0 && dramatic) {
        // Oldest batch lands somewhere in [-10, +30] days from today.
        expiryDate = formatDate(addDays(now, randomInt(-10, 30)));
      }
    }

    const costVariance = randomFloat(-0.05, 0.05);
    const priceVariance = randomFloat(-0.03, 0.03);
    const unitCost = Number.parseFloat(
      Math.max(0, productCost * (1 + costVariance)).toFixed(2),
    );
    const unitPrice = productPrice > 0
      ? Number.parseFloat(Math.max(0, productPrice * (1 + priceVariance)).toFixed(2))
      : null;

    const qty = quantities[i];
    batches.push({
      id: uuidv4(),
      productId: product.id,
      batchNumber: generateBatchNumber(product.name, receivedDate, i),
      quantity: qty,
      initialQuantity: qty,
      unitCost,
      unitPrice,
      expiryDate,
      receivedDate: formatDateTime(receivedDate),
      sourceType: 'seeder',
      sourceId: null, // filled in below using batch id slice
      status: qty <= 0 ? 'depleted' : 'active',
    });
  }

  for (const b of batches) {
    b.sourceId = `seed-${b.id.slice(0, 8)}`;
  }

  return batches;
}

function seedBatches(db, options) {
  const {
    minBatches,
    maxBatches,
    skipExisting,
    clearAll,
  } = options;

  const products = db.prepare(`
    SELECT id, name, category_name, quantity, cost, price
    FROM products
    WHERE deleted_at IS NULL
    ORDER BY name
  `).all();

  if (products.length === 0) {
    throw new Error('No active products found. Add products before seeding batches.');
  }

  const insertBatch = db.prepare(`
    INSERT INTO inventory_batches (
      id, product_id, batch_number, quantity, initial_quantity,
      unit_cost, unit_price, expiry_date, received_date,
      supplier_id, notes, storage_location,
      source_type, source_id, status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      NULL, NULL, NULL,
      ?, ?, ?, datetime('now'), datetime('now')
    )
  `);

  const deleteProductBatches = db.prepare(
    'DELETE FROM inventory_batches WHERE product_id = ?',
  );

  const countActiveBatches = db.prepare(`
    SELECT COUNT(*) AS c
    FROM inventory_batches
    WHERE product_id = ? AND status = 'active' AND quantity > 0
  `);

  const updateProductBatchNumber = db.prepare(`
    UPDATE products
    SET batch_number = ?
    WHERE id = ?
  `);

  let processed = 0;
  let inserted = 0;
  let skipped = 0;

  const now = new Date();

  const run = db.transaction(() => {
    if (clearAll) {
      console.log('  Clearing every row in inventory_batches...');
      db.prepare('DELETE FROM inventory_batches').run();
    }

    for (const product of products) {
      processed += 1;

      if (skipExisting) {
        const { c } = countActiveBatches.get(product.id);
        if (c >= 2) {
          skipped += 1;
          continue;
        }
      }

      // Replace existing batches for this product so totals stay consistent.
      if (!clearAll) deleteProductBatches.run(product.id);

      const plan = buildBatchPlan(product, { minBatches, maxBatches, now });
      for (const b of plan) {
        insertBatch.run(
          b.id,
          b.productId,
          b.batchNumber,
          b.quantity,
          b.initialQuantity,
          b.unitCost,
          b.unitPrice,
          b.expiryDate,
          b.receivedDate,
          b.sourceType,
          b.sourceId,
          b.status,
        );
        inserted += 1;
      }

      // Sync products.batch_number to the newest batch number (it's the
      // legacy display field used in some screens).
      const newest = plan[plan.length - 1];
      if (newest?.batchNumber) {
        updateProductBatchNumber.run(newest.batchNumber, product.id);
      }
    }
  });

  run();

  return { processed, inserted, skipped };
}

// ---------- mirror helper --------------------------------------------------

function checkpointAndClose(db) {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    console.warn('  WAL checkpoint warning:', e.message);
  }
  db.close();
}

function copyDbToMirror(srcDbPath, dstDbPath) {
  const dir = path.dirname(dstDbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.copyFileSync(srcDbPath, dstDbPath);
  for (const ext of ['-shm', '-wal']) {
    const stale = `${dstDbPath}${ext}`;
    if (fs.existsSync(stale)) {
      try { fs.unlinkSync(stale); } catch (_) { /* best effort */ }
    }
  }
}

// ---------- main -----------------------------------------------------------

function main() {
  const dbPath = resolvePrimaryDbPath();
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found: ${dbPath}`);
    console.error('  Tip: launch the app once with `npm run electron:start` so the');
    console.error('       runtime DB is created, then re-run this seeder.');
    console.error('  Or pass --db="C:\\full\\path\\to\\pos_inventory.db".');
    process.exit(1);
  }

  const minBatches = toIntInRange(getArgValue('min'), 2, 1, 10);
  const maxBatches = toIntInRange(getArgValue('max'), 3, minBatches, 10);
  const skipExisting = hasFlag('skip-existing');
  const clearAll = hasFlag('clear-all');
  const mirrorPath = resolveMirrorDbPath(dbPath);

  console.log('');
  console.log('INVENTRA - Inventory batch seeder (FIFO demo)');
  console.log(`  Primary DB         : ${dbPath}`);
  console.log(`  Mirror DB          : ${mirrorPath || '(disabled)'}`);
  console.log(`  Batches per product: ${minBatches}-${maxBatches}`);
  console.log(`  Mode               : ${clearAll ? 'clear-all + reseed' : skipExisting ? 'skip products with >=2 active batches' : 'replace per-product'}`);
  console.log('');

  let db;
  try {
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    const result = seedBatches(db, {
      minBatches,
      maxBatches,
      skipExisting,
      clearAll,
    });

    const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' AND quantity > 0 THEN 1 ELSE 0 END) AS active,
        COUNT(DISTINCT product_id) AS products
      FROM inventory_batches
    `).get();

    console.log('  Seeding complete.');
    console.log(`  Products processed       : ${result.processed}`);
    console.log(`  Products skipped         : ${result.skipped}`);
    console.log(`  Batch rows inserted      : ${result.inserted}`);
    console.log(`  Total batches in DB      : ${stats.total}`);
    console.log(`  Active batches in DB     : ${stats.active}`);
    console.log(`  Distinct products w/batch: ${stats.products}`);
    console.log('');

    checkpointAndClose(db);
    db = null;

    if (mirrorPath) {
      console.log(`  Copying seeded DB to mirror: ${mirrorPath}`);
      copyDbToMirror(dbPath, mirrorPath);
      console.log('  Mirror copy done.');
      console.log('');
    }

    console.log('Done. If your Electron app is currently running, close and restart');
    console.log('it (npm run electron:start) to pick up the new batches.');
    console.log('');
  } catch (err) {
    console.error('Seeder failed:', err.message || err);
    if (err && err.stack) console.error(err.stack);
    if (db) {
      try { db.close(); } catch (_) { /* ignore */ }
    }
    process.exit(1);
  }
}

main();
