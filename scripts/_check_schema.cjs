const Database = require('better-sqlite3');
const fs = require('fs');
const dbPath = fs.existsSync('data/pos_inventory.db') ? 'data/pos_inventory.db' : 'pos_inventory.db';
const db = new Database(dbPath);
const info = db.prepare('PRAGMA table_info(inventory_batches)').all();
console.log(info.map(c => c.name).join(', '));
db.close();
