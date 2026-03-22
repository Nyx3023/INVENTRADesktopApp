/**
 * Sample Sales Data Seeder
 * 
 * Populates the database with sample transactions spanning the last 90 days
 * using the EXISTING products from your database to test Statistical Reports.
 * 
 * Usage: node scripts/seed-sales-data.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// ─── Database connection ────────────────────────────────────────────
const dataDir = path.join(process.cwd(), 'data');
const dbPath = fs.existsSync(dataDir)
  ? path.join(dataDir, 'pos_inventory.db')
  : path.join(process.cwd(), 'pos_inventory.db');

console.log(`Using database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found! Start the server at least once first to create the database.');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ─── Helpers ────────────────────────────────────────────────────────
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDateSqlite(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// ─── Get existing products from the database ────────────────────────
function getProducts() {
  const products = db.prepare(`
    SELECT id, name, category_name, price, cost
    FROM products
    WHERE deleted_at IS NULL
  `).all();

  if (products.length === 0) {
    console.error('❌ No products found in the database!');
    console.error('   Add some products through the app first, then run this script.');
    process.exit(1);
  }

  return products;
}

// ─── Generate transactions using existing products ──────────────────
function generateTransactions(daysBack = 90, transactionsPerDayRange = [3, 10]) {
  const products = getProducts();
  console.log(`✓ Found ${products.length} existing products in database`);

  // List the products we'll use
  console.log('  Products:');
  products.forEach((p, i) => {
    console.log(`    ${i + 1}. ${p.name} (${p.category_name || 'No Category'}) — ₱${p.price}`);
  });
  console.log('');

  const paymentMethods = ['cash', 'cash', 'cash', 'gcash', 'card']; // weighted towards cash
  const now = new Date();

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (id, timestamp, items, subtotal, tax, total, payment_method, received_amount, change_amount, user_id, user_name, user_email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransactionItem = db.prepare(`
    INSERT INTO transaction_items (id, transaction_id, product_id, quantity, unit_price, unit_cost, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let totalTransactions = 0;
  let totalItems = 0;

  // Get current transaction count for sequential numbering
  const existingCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  let txCounter = (existingCount?.count || 0) + 1;

  const insertBatch = db.transaction((transactionsData) => {
    for (const tx of transactionsData) {
      insertTransaction.run(
        tx.id, tx.timestamp, tx.items, tx.subtotal, tx.tax, tx.total,
        tx.paymentMethod, tx.receivedAmount, tx.changeAmount,
        tx.userId, tx.userName, tx.userEmail
      );
      for (const item of tx.txItems) {
        insertTransactionItem.run(
          item.id, item.transactionId, item.productId,
          item.quantity, item.unitPrice, item.unitCost, item.createdAt
        );
      }
    }
  });

  const batch = [];

  for (let dayOffset = daysBack; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);

    // More transactions on weekdays, fewer on weekends
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const numTransactions = randomInt(
      isWeekend ? 1 : transactionsPerDayRange[0],
      isWeekend ? transactionsPerDayRange[0] : transactionsPerDayRange[1]
    );

    // Slight upward sales trend over time (simulating growth)
    const trendMultiplier = 1 + (daysBack - dayOffset) / (daysBack * 3);

    for (let t = 0; t < numTransactions; t++) {
      // Random time of day (8 AM to 8 PM)
      const txDate = new Date(date);
      txDate.setHours(randomInt(8, 20), randomInt(0, 59), randomInt(0, 59));

      // 1 to 5 items per transaction (or fewer if not enough products)
      const maxItems = Math.min(5, products.length);
      const numItems = randomInt(1, maxItems);
      const selectedProducts = [];
      const usedProductIds = new Set();

      for (let i = 0; i < numItems; i++) {
        let product;
        let attempts = 0;
        do {
          product = randomChoice(products);
          attempts++;
        } while (usedProductIds.has(product.id) && attempts < 20);

        if (usedProductIds.has(product.id)) continue;
        usedProductIds.add(product.id);

        const qty = randomInt(1, Math.ceil(5 * trendMultiplier));
        const price = Number(product.price) || 0;
        const subtotal = price * qty;

        selectedProducts.push({
          productId: product.id,
          name: product.name,
          category: product.category_name || 'Uncategorized',
          price: price,
          cost: Number(product.cost) || 0,
          quantity: qty,
          subtotal: subtotal,
        });
      }

      if (selectedProducts.length === 0) continue;

      const subtotal = selectedProducts.reduce((sum, item) => sum + item.subtotal, 0);
      const tax = 0;
      const total = subtotal + tax;
      const paymentMethod = randomChoice(paymentMethods);
      const receivedAmount = paymentMethod === 'cash'
        ? Math.ceil(total / 100) * 100
        : total;
      const changeAmount = receivedAmount - total;

      const txId = `TX-SEED-${String(txCounter++).padStart(6, '0')}`;
      const timestamp = formatDateSqlite(txDate);

      const txItems = selectedProducts.map(item => ({
        id: uuidv4(),
        transactionId: txId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.price,
        unitCost: item.cost,
        createdAt: timestamp,
      }));

      batch.push({
        id: txId,
        timestamp,
        items: JSON.stringify(selectedProducts),
        subtotal,
        tax,
        total,
        paymentMethod,
        receivedAmount,
        changeAmount,
        userId: 'admin-001',
        userName: 'Administrator',
        userEmail: 'admin@gmail.com',
        txItems,
      });

      totalTransactions++;
      totalItems += selectedProducts.length;
    }
  }

  // Execute the batch insert
  insertBatch(batch);

  console.log(`✓ Generated ${totalTransactions} transactions with ${totalItems} line items`);
  console.log(`  Spanning ${daysBack} days (${new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000).toLocaleDateString()} to ${now.toLocaleDateString()})`);
}

// ─── Main ───────────────────────────────────────────────────────────
function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Sample Sales Data Seeder                   ║');
  console.log('║   Uses YOUR existing products from the DB    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  try {
    generateTransactions(90, [3, 10]); // 90 days, 3-10 transactions per day

    // Show summary
    const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
    const productCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE deleted_at IS NULL').get();

    console.log('');
    console.log('── Database Summary ──────────────────────');
    console.log(`  Products:     ${productCount.count}`);
    console.log(`  Transactions: ${txCount.count}`);
    console.log('');
    console.log('Done! Restart the server and check the Statistical Reports screen.');
    console.log('');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
