import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = fs.existsSync('data/pos_inventory.db') ? 'data/pos_inventory.db' : 'pos_inventory.db';
const db = new Database(dbPath);

console.log('Creating inventory_batches table...');

db.exec(`
CREATE TABLE IF NOT EXISTS inventory_batches (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  batch_number VARCHAR(64) DEFAULT NULL,
  quantity INT NOT NULL DEFAULT 0,
  initial_quantity INT NOT NULL DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  received_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME DEFAULT NULL,
  po_id VARCHAR(36) DEFAULT NULL,
  source_type VARCHAR(64) DEFAULT NULL,
  source_id VARCHAR(36) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_received ON inventory_batches (product_id, received_date);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_status ON inventory_batches (status);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches (expiry_date);
`);

console.log('Table created.');
db.close();
