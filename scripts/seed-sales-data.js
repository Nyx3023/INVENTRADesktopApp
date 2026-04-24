/**
 * Sales data seeder.
 *
 * Generates transactions from existing products for a date range and inserts
 * into transactions and transaction_items.
 *
 * Transaction IDs match system style:
 * TXN-MMDDYY-HHMM-#
 *
 * Usage:
 *   node scripts/seed-sales-data.js
 *   node scripts/seed-sales-data.js --start=2021-04-24 --end=2026-04-24
 *   node scripts/seed-sales-data.js --start=2021-04-24 --end=2026-04-24 --min=70 --max=120
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_START = '2021-04-24';
const DEFAULT_END = '2026-04-24';
const DEFAULT_MIN_TRANSACTIONS_PER_DAY = 70;
const DEFAULT_MAX_TRANSACTIONS_PER_DAY = 120;

function getArgValue(name) {
  const arg = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  if (!arg) return null;
  const value = arg.slice(name.length + 3).trim();
  return value.length > 0 ? value : null;
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDateOnly(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid date format: ${value}. Expected YYYY-MM-DD`);
  }
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function transactionPrefixForDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `TXN-${month}${day}${year}-${hour}${minute}`;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function isWithinStoreSchedule(date) {
  const day = date.getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  if (day === 0) return false;

  const hour = date.getHours();
  const minute = date.getMinutes();

  if (hour < 8) return false;
  if (hour > 17) return false;
  if (hour === 17 && minute > 0) return false;
  return true;
}

function isValidTransactionId(id) {
  return /^TXN-\d{6}-\d{4}-\d+$/.test(id);
}

function getStoreOperatingTimestamp(baseDate) {
  // Store hours: 08:00 to 17:00 (inclusive end boundary).
  const openingMinutes = 8 * 60;
  const closingMinutes = 17 * 60;
  const randomMinuteOffset = randomInt(0, closingMinutes - openingMinutes);
  const totalMinutes = openingMinutes + randomMinuteOffset;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const transactionDate = new Date(baseDate);
  transactionDate.setHours(hours, minutes, randomInt(0, 59), 0);
  return transactionDate;
}

function getDatabasePath() {
  const dataDb = path.join(process.cwd(), 'data', 'pos_inventory.db');
  const rootDb = path.join(process.cwd(), 'pos_inventory.db');
  return fs.existsSync(dataDb) ? dataDb : rootDb;
}

function buildExistingPrefixCounters(db) {
  const prefixCounters = new Map();
  const idRows = db.prepare("SELECT id FROM transactions WHERE id LIKE 'TXN-%'").all();

  for (const row of idRows) {
    const id = row.id || '';
    const match = id.match(/^(TXN-\d{6}-\d{4})-(\d+)$/);
    if (!match) continue;
    const prefix = match[1];
    const seq = Number(match[2]);
    if (!Number.isFinite(seq)) continue;
    const currentMax = prefixCounters.get(prefix) || 0;
    if (seq > currentMax) {
      prefixCounters.set(prefix, seq);
    }
  }

  return prefixCounters;
}

function nextTransactionId(prefixCounters, date) {
  const prefix = transactionPrefixForDate(date);
  const nextSeq = (prefixCounters.get(prefix) || 0) + 1;
  prefixCounters.set(prefix, nextSeq);
  return `${prefix}-${nextSeq}`;
}

function seedSales({
  db,
  startDateText,
  endDateText,
  minTransactionsPerDay,
  maxTransactionsPerDay,
}) {
  const products = db.prepare(`
    SELECT id, name, category_name, price, cost
    FROM products
    WHERE deleted_at IS NULL
  `).all();

  if (products.length === 0) {
    throw new Error('No active products found. Add products first.');
  }

  const startDate = parseDateOnly(startDateText);
  const endDate = parseDateOnly(endDateText);
  if (startDate > endDate) {
    throw new Error('Start date must be on or before end date.');
  }

  const paymentMethods = ['cash', 'cash', 'cash', 'gcash', 'card'];
  const dayCount = Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1;
  const prefixCounters = buildExistingPrefixCounters(db);

  const existingInRange = db.prepare(`
    SELECT COUNT(*) AS count
    FROM transactions
    WHERE timestamp >= ? AND timestamp < datetime(?, '+1 day')
  `).get(`${startDateText} 00:00:00`, `${endDateText} 00:00:00`);
  if ((existingInRange?.count || 0) > 0) {
    console.log(`Found ${existingInRange.count} existing transaction(s) in range. New seed rows will be appended.`);
  }

  const insertTransaction = db.prepare(`
    INSERT INTO transactions (
      id, timestamp, items, subtotal, tax, total, payment_method,
      received_amount, change_amount, user_id, user_name, user_email
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransactionItem = db.prepare(`
    INSERT INTO transaction_items (
      id, transaction_id, product_id, quantity, unit_price, unit_cost, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let totalTransactions = 0;
  let totalLineItems = 0;
  let skippedSundays = 0;

  const validation = {
    invalidScheduleCount: 0,
    invalidIdFormatCount: 0,
  };

  const runInsert = db.transaction(() => {
    for (let dayIndex = 0; dayIndex < dayCount; dayIndex++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayIndex);

      // Store operates Monday-Saturday only. Skip Sundays entirely.
      if (date.getDay() === 0) {
        skippedSundays++;
        continue;
      }

      const isSaturday = date.getDay() === 6;
      const minDayTx = isSaturday ? Math.max(1, minTransactionsPerDay - 2) : minTransactionsPerDay;
      const maxDayTx = isSaturday ? Math.max(minDayTx, maxTransactionsPerDay - 2) : maxTransactionsPerDay;
      const txCount = randomInt(minDayTx, maxDayTx);

      const trendMultiplier = 1 + dayIndex / (dayCount * 3);

      for (let txIndex = 0; txIndex < txCount; txIndex++) {
        const txDate = getStoreOperatingTimestamp(date);

        const uniqueProducts = new Set();
        const items = [];
        const maxItems = Math.min(products.length, 5);
        const itemCount = randomInt(1, maxItems);

        for (let i = 0; i < itemCount; i++) {
          let chosen = null;
          let tries = 0;

          while (tries < 20) {
            const candidate = randomChoice(products);
            if (!uniqueProducts.has(candidate.id)) {
              chosen = candidate;
              break;
            }
            tries++;
          }

          if (!chosen) continue;
          uniqueProducts.add(chosen.id);

          const quantity = randomInt(1, Math.max(1, Math.ceil(5 * trendMultiplier)));
          const unitPrice = Number(chosen.price) || 0;
          const unitCost = Number(chosen.cost) || 0;
          const lineSubtotal = unitPrice * quantity;

          items.push({
            productId: chosen.id,
            name: chosen.name,
            category: chosen.category_name || 'Uncategorized',
            price: unitPrice,
            cost: unitCost,
            quantity,
            subtotal: lineSubtotal,
          });
        }

        if (items.length === 0) continue;

        const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
        const tax = 0;
        const total = subtotal + tax;
        const paymentMethod = randomChoice(paymentMethods);
        const receivedAmount = paymentMethod === 'cash' ? Math.ceil(total / 100) * 100 : total;
        const changeAmount = receivedAmount - total;
        const timestamp = formatDateTime(txDate);

        const transactionId = nextTransactionId(prefixCounters, txDate);
        if (!isWithinStoreSchedule(txDate)) {
          validation.invalidScheduleCount++;
        }
        if (!isValidTransactionId(transactionId)) {
          validation.invalidIdFormatCount++;
        }

        insertTransaction.run(
          transactionId,
          timestamp,
          JSON.stringify(items),
          subtotal,
          tax,
          total,
          paymentMethod,
          receivedAmount,
          changeAmount,
          'admin-001',
          'Administrator',
          'admin@gmail.com'
        );

        for (const item of items) {
          insertTransactionItem.run(
            uuidv4(),
            transactionId,
            item.productId,
            item.quantity,
            item.price,
            item.cost,
            timestamp
          );
        }

        totalTransactions++;
        totalLineItems += items.length;
      }
    }
  });

  runInsert();
  return {
    totalTransactions,
    totalLineItems,
    productCount: products.length,
    skippedSundays,
    validation,
  };
}

function main() {
  const dbPath = getDatabasePath();
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file not found: ${dbPath}`);
    process.exit(1);
  }

  const startDateText = getArgValue('start') || DEFAULT_START;
  const endDateText = getArgValue('end') || DEFAULT_END;
  const minTransactionsPerDay = Math.max(70, toNumber(getArgValue('min'), DEFAULT_MIN_TRANSACTIONS_PER_DAY));
  const maxTransactionsPerDay = Math.max(minTransactionsPerDay, toNumber(getArgValue('max'), DEFAULT_MAX_TRANSACTIONS_PER_DAY));

  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  console.log('Sales Data Seeder');
  console.log(`Database: ${dbPath}`);
  console.log(`Date range: ${startDateText} to ${endDateText}`);
  console.log(`Transactions/day: ${minTransactionsPerDay} to ${maxTransactionsPerDay}`);

  try {
    const result = seedSales({
      db,
      startDateText,
      endDateText,
      minTransactionsPerDay,
      maxTransactionsPerDay,
    });

    const totalTx = db.prepare('SELECT COUNT(*) AS count FROM transactions').get();

    console.log(`Products used: ${result.productCount}`);
    console.log(`Seeded transactions: ${result.totalTransactions}`);
    console.log(`Seeded line items: ${result.totalLineItems}`);
    console.log(`Sundays skipped: ${result.skippedSundays}`);
    console.log(`Total transactions in DB: ${totalTx.count}`);
    console.log('');
    console.log('Validation report');
    console.log(`  Schedule violations: ${result.validation.invalidScheduleCount}`);
    console.log(`  Transaction ID format violations: ${result.validation.invalidIdFormatCount}`);
    if (result.validation.invalidScheduleCount === 0 && result.validation.invalidIdFormatCount === 0) {
      console.log('  Status: PASS');
    } else {
      console.log('  Status: FAIL');
    }
    console.log('Done.');
  } catch (error) {
    console.error('Seeder failed:', error.message || error);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
