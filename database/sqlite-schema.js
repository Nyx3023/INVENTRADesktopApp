import db from '../server/db-sqlite.js';

/**
 * Initialize SQLite database schema
 * This script creates all necessary tables for the POS Inventory system
 */
export async function initializeDatabase() {
  try {
    console.log('Initializing SQLite database schema...');

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('admin', 'staff', 'employee')),
        permissions TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create categories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        name TEXT PRIMARY KEY,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category_name TEXT,
        price REAL NOT NULL DEFAULT 0.00,
        cost REAL NOT NULL DEFAULT 0.00,
        quantity INTEGER NOT NULL DEFAULT 0,
        low_stock_threshold INTEGER NOT NULL DEFAULT 10,
        reorder_point INTEGER NOT NULL DEFAULT 15,
        barcode TEXT,
        image_url TEXT,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_name) REFERENCES categories(name) ON DELETE SET NULL
      )
    `);

    // Create suppliers table
    db.exec(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        website_url TEXT,
        facebook_url TEXT,
        messenger_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create purchase_orders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id TEXT PRIMARY KEY,
        supplier_id TEXT NOT NULL,
        order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('draft', 'ordered', 'received', 'cancelled')),
        total REAL NOT NULL DEFAULT 0.00,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
      )
    `);

    // Create purchase_order_items table
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id TEXT PRIMARY KEY,
        po_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.00,
        subtotal REAL NOT NULL DEFAULT 0.00,
        FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
      )
    `);

    // Create transactions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        timestamp DATETIME NOT NULL,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        tax REAL NOT NULL DEFAULT 0.00,
        total REAL NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        received_amount REAL,
        change_amount REAL DEFAULT 0.00,
        reference_number TEXT,
        user_id TEXT,
        user_name TEXT,
        user_email TEXT,
        archived_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create transaction_items table
    db.exec(`
      CREATE TABLE IF NOT EXISTS transaction_items (
        id TEXT PRIMARY KEY,
        transaction_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Ensure unit_cost column exists in existing databases
    try {
      db.exec(`ALTER TABLE transaction_items ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0.00;`);
      console.log('Added unit_cost column to transaction_items table');
    } catch (e) {
      // Ignore if column already exists
      if (!e.message.includes('duplicate column name')) {
        console.error('Error adding unit_cost column:', e);
      }
    }

    // Ensure permissions column exists in existing databases
    try {
      db.exec(`ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT '[]';`);
      console.log('Added permissions column to users table');
    } catch (e) {
      // Ignore if column already exists
      if (!e.message.includes('duplicate column name')) {
        console.error('Error adding permissions column:', e);
      }
    }

    // Ensure discount columns exist in transactions table
    const discountColumns = [
      { name: 'discount_type', sql: `ALTER TABLE transactions ADD COLUMN discount_type TEXT;` },
      { name: 'discount_percentage', sql: `ALTER TABLE transactions ADD COLUMN discount_percentage REAL;` },
      { name: 'discount_amount', sql: `ALTER TABLE transactions ADD COLUMN discount_amount REAL;` },
    ];
    for (const col of discountColumns) {
      try {
        db.exec(col.sql);
        console.log(`Added ${col.name} column to transactions table`);
      } catch (e) {
        if (!e.message.includes('duplicate column name')) {
          console.error(`Error adding ${col.name} column:`, e);
        }
      }
    }

    // Create audits table
    db.exec(`
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        audit_date DATETIME NOT NULL,
        audit_type TEXT NOT NULL DEFAULT 'full',
        products_audited INTEGER NOT NULL DEFAULT 0,
        discrepancies_found INTEGER NOT NULL DEFAULT 0,
        total_adjustments INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        results TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create stock_adjustments table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        adjustment_type TEXT NOT NULL CHECK(adjustment_type IN ('physical_count', 'damage', 'loss', 'found', 'correction', 'other')),
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        quantity_change INTEGER NOT NULL,
        reason TEXT,
        notes TEXT,
        adjusted_by TEXT,
        adjusted_by_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Create stock_movements table
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        movement_type TEXT NOT NULL CHECK(movement_type IN ('transfer', 'return', 'damage', 'write_off', 'other')),
        quantity INTEGER NOT NULL,
        from_location TEXT,
        to_location TEXT,
        reference_number TEXT,
        notes TEXT,
        performed_by TEXT,
        performed_by_id TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    // Create outbox table
    db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        op_type TEXT NOT NULL,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'synced', 'failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create activity_logs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_name TEXT,
        user_email TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Create indexes
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_deleted ON products(deleted_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(po_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product ON purchase_order_items(product_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_archived ON transactions(archived_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(audit_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audits_type ON audits(audit_type)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product ON stock_adjustments(product_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_adjustments_date ON stock_adjustments(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox(status, created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at)`);

    // Insert default admin user if not exists (INSERT OR IGNORE handles any existing id/email)
    const adminExists = db.prepare('SELECT id FROM users WHERE id = ? OR email = ?').get('admin-001', 'admin@gmail.com');
    if (!adminExists) {
      const bcrypt = (await import('bcrypt')).default;
      const passwordHash = await bcrypt.hash('admin123', 10);
      db.prepare(`
        INSERT OR IGNORE INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('admin-001', 'Administrator', 'admin@gmail.com', passwordHash, 'admin');
      console.log('Default admin user created (admin@gmail.com / admin123)');
    }

    // Insert default N/A supplier if not exists
    const supplierExists = db.prepare('SELECT id FROM suppliers WHERE id = ?').get('na-supplier-default');
    if (!supplierExists) {
      db.prepare(`
        INSERT INTO suppliers (id, name, contact_person)
        VALUES (?, ?, ?)
      `).run('na-supplier-default', 'N/A', 'No supplier specified');
      console.log('Default N/A supplier created');
    }

    // Insert default categories if not exists
    const defaultCategories = [
      { name: 'Art Materials', description: 'Painting and drawing materials' },
      { name: 'Birthday Materials', description: null },
      { name: 'Invitation Letter Materials', description: null },
      { name: 'School Supplies', description: null }
    ];

    for (const category of defaultCategories) {
      const exists = db.prepare('SELECT name FROM categories WHERE name = ?').get(category.name);
      if (!exists) {
        db.prepare(`
          INSERT INTO categories (name, description)
          VALUES (?, ?)
        `).run(category.name, category.description);
      }
    }

    // Create triggers to update updated_at timestamp
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
      AFTER UPDATE ON products
      BEGIN
        UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_suppliers_timestamp 
      AFTER UPDATE ON suppliers
      BEGIN
        UPDATE suppliers SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_purchase_orders_timestamp 
      AFTER UPDATE ON purchase_orders
      BEGIN
        UPDATE purchase_orders SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_categories_timestamp 
      AFTER UPDATE ON categories
      BEGIN
        UPDATE categories SET updated_at = datetime('now') WHERE name = NEW.name;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_audits_timestamp 
      AFTER UPDATE ON audits
      BEGIN
        UPDATE audits SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_outbox_timestamp 
      AFTER UPDATE ON outbox
      BEGIN
        UPDATE outbox SET updated_at = datetime('now') WHERE id = NEW.id;
      END
    `);

    console.log('✓ Database schema initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}
