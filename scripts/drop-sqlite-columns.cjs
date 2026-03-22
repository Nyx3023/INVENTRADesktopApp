const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'pos_inventory.db');

try {
    const db = new Database(dbPath);
    console.log(`Connected to database at ${dbPath}`);

    // SQLite supports ALTER TABLE DROP COLUMN starting from version 3.35.0 (2021)
    // better-sqlite3 uses the bundled SQLite engine, so it should support it

    // Check if columns exist first
    const columnsInfo = db.prepare('PRAGMA table_info(products)').all();
    const columnNames = columnsInfo.map(c => c.name);

    let dropped = false;

    if (columnNames.includes('low_stock_threshold')) {
        console.log('Dropping low_stock_threshold...');
        db.prepare('ALTER TABLE products DROP COLUMN low_stock_threshold').run();
        dropped = true;
    }

    if (columnNames.includes('reorder_point')) {
        console.log('Dropping reorder_point...');
        db.prepare('ALTER TABLE products DROP COLUMN reorder_point').run();
        dropped = true;
    }

    if (dropped) {
        console.log('Successfully dropped columns from the SQLite database!');
    } else {
        console.log('Columns do not exist. No actions taken.');
    }

    db.close();
} catch (error) {
    console.error('Error modifying SQLite database:', error.message);
    if (error.message.includes('NOT SUPPORTED') || error.message.includes('syntax error')) {
        console.warn('Your SQLite version may not support dropping columns. Try updating Node or Better-SQLite3, or use table recreation.');
    }
}
