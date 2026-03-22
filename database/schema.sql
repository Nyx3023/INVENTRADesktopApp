-- ============================================================================
-- Inventory Management System - Complete Database Schema
-- ============================================================================
-- This schema supports the following features:
-- - User Management & Authentication
-- - Product & Category Management
-- - Inventory Tracking & Audits
-- - Purchase Orders & Supplier Management
-- - Sales Transactions & POS
-- - Stock Movements & Adjustments
-- - Reports & Analytics
-- ============================================================================

-- Drop existing tables (in correct order to handle foreign key constraints)
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS audits;
DROP TABLE IF EXISTS transaction_items;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'staff') DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. CATEGORIES TABLE
-- ============================================================================
CREATE TABLE categories (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. PRODUCTS TABLE
-- ============================================================================
CREATE TABLE products (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  barcode VARCHAR(100),
  category_id VARCHAR(36),
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  quantity INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  image_url VARCHAR(500),
  sku VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_barcode (barcode),
  INDEX idx_sku (sku),
  INDEX idx_category (category_id),
  INDEX idx_name (name),
  INDEX idx_quantity (quantity),
  INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. SUPPLIERS TABLE
-- ============================================================================
CREATE TABLE suppliers (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(50),
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. PURCHASE ORDERS TABLE
-- ============================================================================
CREATE TABLE purchase_orders (
  id VARCHAR(36) PRIMARY KEY,
  supplier_id VARCHAR(36),
  order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'ordered', 'received', 'cancelled') DEFAULT 'ordered',
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  received_date TIMESTAMP NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (status),
  INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. PURCHASE ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE purchase_order_items (
  id VARCHAR(36) PRIMARY KEY,
  purchase_order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_purchase_order (purchase_order_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. STOCK MOVEMENTS TABLE
-- ============================================================================
CREATE TABLE stock_movements (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  type ENUM('in', 'out', 'adjustment', 'purchase', 'sale', 'return') NOT NULL,
  quantity INT NOT NULL,
  reference_type ENUM('purchase_order', 'transaction', 'manual', 'audit') DEFAULT 'manual',
  reference_id VARCHAR(36),
  notes TEXT,
  previous_quantity INT NOT NULL,
  new_quantity INT NOT NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_type (type),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. TRANSACTIONS TABLE (Sales/POS)
-- ============================================================================
CREATE TABLE transactions (
  id VARCHAR(36) PRIMARY KEY,
  total DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash', 'card', 'ewallet') DEFAULT 'cash',
  amount_paid DECIMAL(10,2) NOT NULL,
  change_amount DECIMAL(10,2) DEFAULT 0.00,
  customer_name VARCHAR(100),
  notes TEXT,
  cashier_id VARCHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_timestamp (timestamp),
  INDEX idx_payment_method (payment_method),
  INDEX idx_cashier (cashier_id),
  INDEX idx_archived_at (archived_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. TRANSACTION ITEMS TABLE
-- ============================================================================
CREATE TABLE transaction_items (
  id VARCHAR(36) PRIMARY KEY,
  transaction_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_transaction (transaction_id),
  INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. AUDITS TABLE
-- ============================================================================
CREATE TABLE audits (
  id VARCHAR(36) PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  product_name VARCHAR(255) NOT NULL,
  expected_quantity INT NOT NULL,
  actual_quantity INT NOT NULL,
  difference INT NOT NULL,
  notes TEXT,
  audited_by VARCHAR(36),
  audit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (audited_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product (product_id),
  INDEX idx_audit_date (audit_date),
  INDEX idx_audited_by (audited_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Insert default admin user (password: admin123)
INSERT INTO users (id, name, email, password_hash, role) 
VALUES (
  UUID(),
  'Administrator',
  'admin@inventory.com',
  '$2a$10$XQrfZ4QZQJZGZJZGZJZGZe7KvYvXvYvXvYvXvYvXvYvXvYvXvYvXv',
  'admin'
);

-- Insert default categories
INSERT INTO categories (id, name, description) VALUES
  (UUID(), 'Art Supplies', 'Painting and drawing materials'),
  (UUID(), 'Brushes', 'Various types of brushes'),
  (UUID(), 'Canvas', 'Canvas and painting surfaces'),
  (UUID(), 'Colors', 'Paints and pigments'),
  (UUID(), 'Drawing', 'Drawing materials and tools'),
  (UUID(), 'Frames', 'Picture frames and framing materials'),
  (UUID(), 'Sketch Pads', 'Sketchbooks and pads'),
  (UUID(), 'Miscellaneous', 'Other art supplies');

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- View: Product with Category Name
CREATE OR REPLACE VIEW vw_products_with_category AS
SELECT 
  p.*,
  c.name AS category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;

-- View: Low Stock Products
CREATE OR REPLACE VIEW vw_low_stock_products AS
SELECT 
  p.*,
  c.name AS category_name
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.quantity <= p.low_stock_threshold;

-- View: Purchase Orders with Details
CREATE OR REPLACE VIEW vw_purchase_orders_detailed AS
SELECT 
  po.*,
  s.name AS supplier_name,
  u.name AS created_by_name,
  COUNT(poi.id) AS item_count
FROM purchase_orders po
LEFT JOIN suppliers s ON po.supplier_id = s.id
LEFT JOIN users u ON po.created_by = u.id
LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
GROUP BY po.id;

-- View: Sales Summary by Date
CREATE OR REPLACE VIEW vw_sales_summary AS
SELECT 
  DATE(timestamp) AS sale_date,
  COUNT(*) AS transaction_count,
  SUM(total) AS total_sales,
  AVG(total) AS average_sale,
  payment_method
FROM transactions
GROUP BY DATE(timestamp), payment_method;

-- ============================================================================
-- STORED PROCEDURES
-- ============================================================================

DELIMITER //

-- Procedure: Add Stock Movement
CREATE PROCEDURE sp_add_stock_movement(
  IN p_product_id VARCHAR(36),
  IN p_type VARCHAR(20),
  IN p_quantity INT,
  IN p_reference_type VARCHAR(50),
  IN p_reference_id VARCHAR(36),
  IN p_notes TEXT,
  IN p_created_by VARCHAR(36)
)
BEGIN
  DECLARE v_current_qty INT;
  DECLARE v_new_qty INT;
  
  -- Get current quantity
  SELECT quantity INTO v_current_qty FROM products WHERE id = p_product_id;
  
  -- Calculate new quantity
  IF p_type IN ('in', 'purchase', 'return') THEN
    SET v_new_qty = v_current_qty + p_quantity;
  ELSE
    SET v_new_qty = v_current_qty - p_quantity;
  END IF;
  
  -- Insert stock movement record
  INSERT INTO stock_movements (
    id, product_id, type, quantity, reference_type, reference_id, 
    notes, previous_quantity, new_quantity, created_by
  ) VALUES (
    UUID(), p_product_id, p_type, p_quantity, p_reference_type, p_reference_id,
    p_notes, v_current_qty, v_new_qty, p_created_by
  );
  
  -- Update product quantity
  UPDATE products SET quantity = v_new_qty WHERE id = p_product_id;
END//

-- Procedure: Complete Purchase Order
CREATE PROCEDURE sp_complete_purchase_order(
  IN p_order_id VARCHAR(36)
)
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_product_id VARCHAR(36);
  DECLARE v_quantity INT;
  DECLARE cur CURSOR FOR 
    SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = p_order_id;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
  
  START TRANSACTION;
  
  -- Update order status
  UPDATE purchase_orders 
  SET status = 'received', received_date = CURRENT_TIMESTAMP 
  WHERE id = p_order_id;
  
  -- Update product quantities
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_product_id, v_quantity;
    IF done THEN
      LEAVE read_loop;
    END IF;
    
    UPDATE products 
    SET quantity = quantity + v_quantity 
    WHERE id = v_product_id;
    
    -- Add stock movement record
    INSERT INTO stock_movements (
      id, product_id, type, quantity, reference_type, reference_id,
      previous_quantity, new_quantity
    ) 
    SELECT 
      UUID(), v_product_id, 'purchase', v_quantity, 'purchase_order', p_order_id,
      quantity - v_quantity, quantity
    FROM products WHERE id = v_product_id;
  END LOOP;
  CLOSE cur;
  
  COMMIT;
END//

DELIMITER ;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX idx_products_category_quantity ON products(category_id, quantity);
CREATE INDEX idx_transactions_date_total ON transactions(timestamp, total);
CREATE INDEX idx_stock_movements_product_date ON stock_movements(product_id, created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DELIMITER //

-- Trigger: Update product updated_at on quantity change
CREATE TRIGGER tr_products_before_update
BEFORE UPDATE ON products
FOR EACH ROW
BEGIN
  IF NEW.quantity != OLD.quantity THEN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
  END IF;
END//

-- Trigger: Validate stock movement quantity
CREATE TRIGGER tr_stock_movements_before_insert
BEFORE INSERT ON stock_movements
FOR EACH ROW
BEGIN
  IF NEW.quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' 
    SET MESSAGE_TEXT = 'Stock movement quantity must be greater than 0';
  END IF;
END//

DELIMITER ;

-- ============================================================================
-- GRANTS (Optional - for production use)
-- ============================================================================

-- Create application user (update password as needed)
-- CREATE USER IF NOT EXISTS 'inventory_app'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_db.* TO 'inventory_app'@'localhost';
-- FLUSH PRIVILEGES;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

