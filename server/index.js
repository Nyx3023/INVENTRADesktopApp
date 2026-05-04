import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, execute, getConnection, withTransaction } from './db-helpers.js';
import { initializeDatabase } from '../database/sqlite-schema.js';
import AdmZip from 'adm-zip';

dotenv.config();

// Initialize SQLite database before starting server
let dbInitialized = false;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Allow frontend connections
});

io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`Socket joined room: user_${userId}`);
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Helper to enqueue operations (outbox table is created by schema init)
async function enqueueOutbox(entityType, entityId, opType, payloadObj) {
  try {
    const outboxId = uuidv4();
    execute(
      `INSERT INTO outbox (id, entity_type, entity_id, op_type, payload, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
      [outboxId, entityType, entityId, opType, JSON.stringify(payloadObj || null)]
    );
    return outboxId;
  } catch (e) {
    console.error('Failed to enqueue outbox entry:', { entityType, entityId, opType }, e);
    // Return null instead of throwing - don't break the main operation
    return null;
  }
}
// Categories table is created by schema initialization

// Supplier columns are created by schema initialization

// Product columns are created by schema initialization

// Transaction columns are created by schema initialization

const ACTIVITY_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  CREATE_PRODUCT: 'CREATE_PRODUCT',
  UPDATE_PRODUCT: 'UPDATE_PRODUCT',
  DELETE_PRODUCT: 'DELETE_PRODUCT',
  RESTORE_PRODUCT: 'RESTORE_PRODUCT',
  PERMANENT_DELETE_PRODUCT: 'PERMANENT_DELETE_PRODUCT',
  STOCK_IN: 'STOCK_IN',
  STOCK_OUT: 'STOCK_OUT',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  CREATE_SALE: 'CREATE_SALE',
  VOID_SALE: 'VOID_SALE',
  ARCHIVE_TRANSACTION: 'ARCHIVE_TRANSACTION',
  RESTORE_TRANSACTION: 'RESTORE_TRANSACTION',
  DELETE_TRANSACTION: 'DELETE_TRANSACTION',
  CREATE_CATEGORY: 'CREATE_CATEGORY',
  DELETE_CATEGORY: 'DELETE_CATEGORY',
  CREATE_SUPPLIER: 'CREATE_SUPPLIER',
  UPDATE_SUPPLIER: 'UPDATE_SUPPLIER',
  DELETE_SUPPLIER: 'DELETE_SUPPLIER',
  CREATE_PURCHASE_ORDER: 'CREATE_PURCHASE_ORDER',
  RECEIVE_PURCHASE_ORDER: 'RECEIVE_PURCHASE_ORDER',
  CANCEL_PURCHASE_ORDER: 'CANCEL_PURCHASE_ORDER',
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  CREATE_AUDIT: 'CREATE_AUDIT',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  PRINT_RECEIPT: 'PRINT_RECEIPT',
  CREATE_INVENTORY_BATCH: 'CREATE_INVENTORY_BATCH',
  UPDATE_INVENTORY_BATCH: 'UPDATE_INVENTORY_BATCH',
  DELETE_INVENTORY_BATCH: 'DELETE_INVENTORY_BATCH',
};

// Activity logs table is created by schema initialization

// Helper function to extract user info from request
function getUserFromRequest(req) {
  const user = req.user || req.session?.user || null;
  return {
    id: user?.id || req.body?.actingUserId || req.body?.userId || req.query?.userId || null,
    name: user?.name || req.body?.actingUserName || req.body?.userName || req.query?.userName || 'System',
    email: user?.email || req.body?.actingUserEmail || req.body?.userEmail || req.query?.userEmail || null,
  };
}

function logActivity({
  userId,
  userName,
  userEmail,
  action,
  entityType,
  entityId,
  details,
  ipAddress,
}) {
  if (!action) {
    return;
  }
  try {
    let serializedDetails = null;
    if (details !== undefined && details !== null) {
      serializedDetails =
        typeof details === 'string' ? details : JSON.stringify(details);
    }

    execute(
      `INSERT INTO activity_logs (
        id, user_id, user_name, user_email, action, entity_type, entity_id, details, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        uuidv4(),
        userId || null,
        userName || null,
        userEmail || null,
        action,
        entityType || null,
        entityId || null,
        serializedDetails,
        ipAddress || null,
      ]
    );
  } catch (error) {
    console.warn('Failed to log activity', action, error);
  }
}

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeOptionalDate = (value) => {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
};

const isStockInMovement = (type) => ['in', 'stock_in', 'return'].includes(String(type || '').toLowerCase());
const isStockOutMovement = (type) => ['out', 'stock_out', 'damage', 'write_off', 'sale'].includes(String(type || '').toLowerCase());

function addInventoryBatch(connection, {
  productId,
  quantity,
  batchNumber = null,
  expiryDate = null,
  unitCost = 0,
  unitPrice = null,
  sourceType = null,
  sourceId = null,
}) {
  const qty = Math.max(0, Number.parseInt(quantity, 10) || 0);
  if (!productId || qty <= 0) return null;

  const batchId = uuidv4();
  const sell =
    unitPrice != null && unitPrice !== '' && Number.isFinite(Number(unitPrice))
      ? Number(unitPrice)
      : null;
  connection.execute(
    `INSERT INTO inventory_batches (
      id, product_id, batch_number, quantity, initial_quantity,
      unit_cost, unit_price, expiry_date, received_date, supplier_id, notes, storage_location,
      source_type, source_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), NULL, NULL, NULL, ?, ?, 'active')`,
    [
      batchId,
      productId,
      normalizeOptionalText(batchNumber),
      qty,
      qty,
      Number(unitCost) || 0,
      sell,
      normalizeOptionalDate(expiryDate),
      normalizeOptionalText(sourceType),
      normalizeOptionalText(sourceId),
    ]
  );
  return batchId;
}

/** Opening batch for a new product — allows qty 0 (depleted row) so every product has a batch row. */
function insertOpeningInventoryBatch(connection, {
  productId,
  batchNumber,
  quantity,
  expiryDate = null,
  unitCost = 0,
  unitPrice = null,
  sourceType = 'initial_stock',
  sourceId = null,
}) {
  if (!productId) return null;
  const trimmed = normalizeOptionalText(batchNumber);
  if (!trimmed) return null;
  const qty = Math.max(0, Number.parseInt(quantity, 10) || 0);
  const batchId = uuidv4();
  const status = qty > 0 ? 'active' : 'depleted';
  const sell =
    unitPrice != null && unitPrice !== '' && Number.isFinite(Number(unitPrice))
      ? Number(unitPrice)
      : null;
  connection.execute(
    `INSERT INTO inventory_batches (
      id, product_id, batch_number, quantity, initial_quantity,
      unit_cost, unit_price, expiry_date, received_date, supplier_id, notes, storage_location,
      source_type, source_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), NULL, NULL, NULL, ?, ?, ?)`,
    [
      batchId,
      productId,
      trimmed,
      qty,
      qty,
      Number(unitCost) || 0,
      sell,
      normalizeOptionalDate(expiryDate),
      normalizeOptionalText(sourceType),
      normalizeOptionalText(sourceId),
      status,
    ]
  );
  return batchId;
}

function deductInventoryBatches(connection, { productId, quantity }) {
  let remaining = Math.max(0, Number.parseInt(quantity, 10) || 0);
  if (!productId || remaining <= 0) return [];

  const [batches] = connection.execute(
    `SELECT id, batch_number, quantity, expiry_date
     FROM inventory_batches
     WHERE product_id = ? AND quantity > 0 AND status = 'active'
     ORDER BY
       CASE WHEN expiry_date IS NULL OR expiry_date = '' THEN 1 ELSE 0 END,
       expiry_date ASC,
       received_date ASC,
       id ASC`,
    [productId]
  );

  const deductions = [];
  for (const batch of batches || []) {
    if (remaining <= 0) break;
    const available = Number(batch.quantity) || 0;
    const used = Math.min(available, remaining);
    const newQty = available - used;

    connection.execute(
      `UPDATE inventory_batches
       SET quantity = ?, status = CASE WHEN ? <= 0 THEN 'depleted' ELSE 'active' END, updated_at = datetime('now')
       WHERE id = ?`,
      [newQty, newQty, batch.id]
    );

    deductions.push({
      batchId: batch.id,
      batchNumber: batch.batch_number,
      expiryDate: batch.expiry_date,
      quantity: used,
    });
    remaining -= used;
  }

  if (remaining > 0) {
    deductions.push({
      batchId: null,
      batchNumber: 'Legacy stock',
      expiryDate: null,
      quantity: remaining,
    });
  }

  return deductions;
}

// Cleanup archived transactions older than 60 days
async function cleanupOldArchivedTransactions() {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [result] = execute(
      'DELETE FROM transactions WHERE archived_at IS NOT NULL AND archived_at < ?',
      [sixtyDaysAgo.toISOString()]
    );

    if (result.affectedRows > 0) {
      console.log(`Cleaned up ${result.affectedRows} archived transactions older than 60 days`);
    }
  } catch (err) {
    console.error('Failed to cleanup old archived transactions:', err);
  }
}

// Cleanup functions will be called after database initialization

// Cleanup orphaned images (images not referenced in any product)
async function cleanupOrphanedImages() {
  try {
    const uploadPath = 'uploads/products/';

    // Check if directory exists
    if (!fs.existsSync(uploadPath)) {
      console.log('Upload directory does not exist, skipping image cleanup');
      return;
    }

    // Get all product image URLs from database
    const [products] = execute(
      "SELECT image_url FROM products WHERE image_url IS NOT NULL AND image_url != '' AND deleted_at IS NULL"
    );

    const usedImages = new Set(products.map(p => p.image_url.replace('/uploads/products/', '')));
    console.log(`Found ${usedImages.size} images in use by products`);

    // Get all files in upload directory
    const files = fs.readdirSync(uploadPath);
    let deletedCount = 0;

    for (const file of files) {
      // Skip if file is in use
      if (usedImages.has(file)) {
        continue;
      }

      // Delete orphaned file
      try {
        const filePath = path.join(uploadPath, file);
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`Deleted orphaned image: ${file}`);
      } catch (err) {
        console.error(`Failed to delete orphaned image ${file}:`, err);
      }
    }

    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} orphaned images`);
    } else {
      console.log('✓ No orphaned images to clean up');
    }
  } catch (err) {
    console.error('Failed to cleanup orphaned images:', err);
  }
}

// Image cleanup will be called after database initialization

// All tables are created by schema initialization

// withTransaction is now imported from db-helpers

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/products/';
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log('Created uploads directory:', uploadPath);
      }
      cb(null, uploadPath);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Use product name if provided, otherwise use a generic name
    let baseFilename = 'product';

    if (req.body && req.body.productName) {
      // Sanitize product name for filename
      baseFilename = req.body.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
        .substring(0, 50);              // Limit length
    }

    // Add short random hex suffix for uniqueness (matches existing naming convention)
    const suffix = Math.random().toString(16).substring(2, 6);
    const filename = `${baseFilename}-${suffix}${path.extname(file.originalname)}`;
    console.log('Generated filename:', filename, 'from product:', req.body?.productName);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeType = allowedTypes.test(file.mimetype);

    if (mimeType && extName) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Database connection is handled by db-sqlite.js
console.log('SQLite database ready');

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    // Get user from database
    const [users] = execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    const user = users[0];

    if (!user) {
      console.log('User not found:', email);
      logActivity({
        userEmail: email,
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        details: { reason: 'User not found' },
        ipAddress: req.ip,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      console.log('Invalid password for user:', email);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.LOGIN_FAILED,
        details: { reason: 'Invalid password' },
        ipAddress: req.ip,
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Remove password hash before sending user data
    const { password_hash, ...userWithoutPassword } = user;
    userWithoutPassword.permissions = user.permissions ? JSON.parse(user.permissions) : [];

    console.log('Login successful for:', email);
    logActivity({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: ACTIVITY_ACTIONS.LOGIN,
      details: { via: 'web' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
});

app.post('/api/verify-admin-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    // Get all admin users
    const [admins] = execute(
      'SELECT id, name, email, password_hash FROM users WHERE role = ?',
      ['admin']
    );

    for (let admin of admins) {
      const isValid = await bcrypt.compare(password, admin.password_hash);
      if (isValid) {
        logActivity({
          userId: admin.id,
          userName: admin.name,
          userEmail: admin.email,
          action: 'ADMIN_OVERRIDE_VERIFIED',
          details: { via: 'AdminOverrideModal' },
          ipAddress: req.ip,
        });
        return res.json({ success: true, user: { id: admin.id, name: admin.name, email: admin.email } });
      }
    }

    return res.status(401).json({ success: false, message: 'Invalid admin password' });
  } catch (error) {
    console.error('Verify admin password error:', error);
    res.status(500).json({ success: false, message: 'An error occurred during verification' });
  }
});

// Image upload endpoint
app.post('/api/upload-image', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large. Maximum size is 5MB.',
          code: 'FILE_TOO_LARGE'
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected field name. Use "image" as the field name.',
          code: 'UNEXPECTED_FIELD'
        });
      }
      return res.status(400).json({
        error: `Upload error: ${err.message}`,
        code: err.code
      });
    } else if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        error: err.message,
        code: 'INVALID_FILE_TYPE'
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No image file uploaded',
          code: 'NO_FILE'
        });
      }

      const imageUrl = `/uploads/products/${req.file.filename}`;
      console.log('Image uploaded successfully:', imageUrl);

      res.json({
        success: true,
        imageUrl: imageUrl,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('Error processing uploaded image:', error);
      res.status(500).json({
        error: 'Failed to process uploaded image',
        code: 'PROCESSING_ERROR'
      });
    }
  });
});

// Delete image endpoint
app.delete('/api/delete-image', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        error: 'Image URL is required',
        code: 'NO_IMAGE_URL'
      });
    }

    // Only delete local uploaded images (not external URLs)
    if (imageUrl.startsWith('/uploads/')) {
      const imagePath = imageUrl.replace('/uploads/', 'uploads/');

      try {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
          console.log('Deleted image file:', imagePath);
          res.json({
            success: true,
            message: 'Image deleted successfully',
            deletedPath: imagePath
          });
        } else {
          console.log('Image file not found:', imagePath);
          res.json({
            success: true,
            message: 'Image file not found (may have been already deleted)',
            deletedPath: imagePath
          });
        }
      } catch (fileError) {
        console.error('Failed to delete image file:', imagePath, fileError);
        res.status(500).json({
          error: 'Failed to delete image file',
          code: 'FILE_DELETE_ERROR',
          details: fileError.message
        });
      }
    } else {
      // External URL - just return success (nothing to delete server-side)
      console.log('External image URL, nothing to delete:', imageUrl);
      res.json({
        success: true,
        message: 'External image URL, no server-side deletion needed',
        imageUrl: imageUrl
      });
    }
  } catch (error) {
    console.error('Error in delete image endpoint:', error);
    res.status(500).json({
      error: 'Failed to delete image',
      code: 'DELETE_ERROR',
      details: error.message
    });
  }
});

// Store Info and Setup API
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RUNTIME_DATA_DIR = path.join(process.cwd(), 'data');
const STORE_INFO_FILE = path.join(RUNTIME_DATA_DIR, 'store-info.json');
const SETUP_STATE_FILE = path.join(RUNTIME_DATA_DIR, 'setup-state.json');
const DEV_SETUP_TOOLS_ENABLED = process.env.NODE_ENV !== 'production';

const readJsonFileSafe = (filePath, fallback = {}) => {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed reading JSON file ${filePath}:`, error);
    return fallback;
  }
};

const writeJsonFileSafe = (filePath, data) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

app.get('/api/store-info', (req, res) => {
  try {
    res.json(readJsonFileSafe(STORE_INFO_FILE, {}));
  } catch (error) {
    console.error('Error reading store info:', error);
    res.status(500).json({ error: 'Failed to read store info' });
  }
});

app.post('/api/store-info', (req, res) => {
  try {
    writeJsonFileSafe(STORE_INFO_FILE, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving store info:', error);
    res.status(500).json({ error: 'Failed to save store info' });
  }
});

app.get('/api/setup/status', async (req, res) => {
  try {
    const setupState = readJsonFileSafe(SETUP_STATE_FILE, {});
    const storeInfo = readJsonFileSafe(STORE_INFO_FILE, {});
    const [admins] = execute(
      'SELECT id, name, email, password_hash, role FROM users WHERE role = ? ORDER BY created_at ASC',
      ['admin']
    );
    const adminUser = admins?.[0] || null;

    let isDefaultAdminPassword = false;
    if (adminUser?.password_hash) {
      try {
        isDefaultAdminPassword = await bcrypt.compare('admin123', adminUser.password_hash);
      } catch {
        isDefaultAdminPassword = false;
      }
    }

    const hasStoreName = typeof storeInfo.storeName === 'string' && storeInfo.storeName.trim().length > 0;
    const completedFlag = setupState.completed === true;
    const required = !completedFlag || !adminUser || isDefaultAdminPassword || !hasStoreName;

    res.json({
      required,
      completed: !required,
      admin: adminUser ? {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
      } : null,
      storeInfo,
      reasons: {
        setupFlagMissing: !completedFlag,
        adminMissing: !adminUser,
        defaultAdminPassword: isDefaultAdminPassword,
        missingStoreInfo: !hasStoreName,
      },
    });
  } catch (error) {
    console.error('Error checking setup status:', error);
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

app.post('/api/setup/complete', async (req, res) => {
  try {
    const {
      storeInfo = {},
      admin = {},
      printerConfigured = false,
    } = req.body || {};

    if (!storeInfo.storeName || String(storeInfo.storeName).trim().length < 2) {
      return res.status(400).json({ error: 'Store name is required.' });
    }

    if (!admin.password || String(admin.password).length < 8) {
      return res.status(400).json({ error: 'Admin password must be at least 8 characters.' });
    }

    const [admins] = execute(
      'SELECT id, name, email, password_hash, permissions FROM users WHERE role = ? ORDER BY created_at ASC',
      ['admin']
    );
    const targetAdmin = admins?.[0];
    if (!targetAdmin) {
      return res.status(400).json({ error: 'No admin account found to update.' });
    }

    const safeName = String(admin.name || targetAdmin.name || 'Administrator').trim();
    const safeEmail = String(admin.email || targetAdmin.email || '').trim().toLowerCase();
    if (!safeEmail) {
      return res.status(400).json({ error: 'Admin email is required.' });
    }

    const [emailConflict] = execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [safeEmail, targetAdmin.id]
    );
    if (emailConflict && emailConflict.length > 0) {
      return res.status(400).json({ error: 'Admin email is already in use by another account.' });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(String(admin.password), saltRounds);
    execute(
      'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?',
      [safeName, safeEmail, passwordHash, targetAdmin.id]
    );

    writeJsonFileSafe(STORE_INFO_FILE, {
      ...storeInfo,
      storeName: String(storeInfo.storeName).trim(),
      updatedAt: new Date().toISOString(),
    });

    writeJsonFileSafe(SETUP_STATE_FILE, {
      completed: true,
      completedAt: new Date().toISOString(),
      adminUserId: targetAdmin.id,
      printerConfigured: !!printerConfigured,
      version: '1.0',
    });

    logActivity({
      userId: targetAdmin.id,
      userName: safeName,
      userEmail: safeEmail,
      action: ACTIVITY_ACTIONS.UPDATE_SETTINGS,
      details: {
        setupCompleted: true,
        printerConfigured: !!printerConfigured,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Initial setup completed successfully.',
    });
  } catch (error) {
    console.error('Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup.' });
  }
});

app.post('/api/setup/dev-skip', (req, res) => {
  try {
    if (!DEV_SETUP_TOOLS_ENABLED) {
      return res.status(404).json({ error: 'Not found' });
    }

    writeJsonFileSafe(SETUP_STATE_FILE, {
      completed: true,
      completedAt: new Date().toISOString(),
      devSkipped: true,
      version: '1.0',
    });

    res.json({
      success: true,
      message: 'Setup skipped in development mode.',
    });
  } catch (error) {
    console.error('Error skipping setup in development:', error);
    res.status(500).json({ error: 'Failed to skip setup.' });
  }
});

app.post('/api/setup/reset', async (req, res) => {
  try {
    if (!DEV_SETUP_TOOLS_ENABLED) {
      return res.status(404).json({ error: 'Not found' });
    }

    const clearStoreInfo = req.body?.clearStoreInfo !== false;
    const resetAdmin = req.body?.resetAdmin !== false;

    if (fs.existsSync(SETUP_STATE_FILE)) {
      fs.unlinkSync(SETUP_STATE_FILE);
    }

    if (clearStoreInfo && fs.existsSync(STORE_INFO_FILE)) {
      fs.unlinkSync(STORE_INFO_FILE);
    }

    if (resetAdmin) {
      const [admins] = execute(
        'SELECT id FROM users WHERE role = ? ORDER BY created_at ASC',
        ['admin']
      );
      const targetAdmin = admins?.[0];
      if (targetAdmin?.id) {
        const defaultPasswordHash = await bcrypt.hash('admin123', 10);
        execute(
          'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?',
          ['Administrator', 'admin@gmail.com', defaultPasswordHash, targetAdmin.id]
        );
      }
    }

    res.json({
      success: true,
      message: 'Setup reset for development mode.',
    });
  } catch (error) {
    console.error('Error resetting setup in development:', error);
    res.status(500).json({ error: 'Failed to reset setup.' });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = execute(
      'SELECT id, name, description, category_name, price, cost, ' +
      'quantity, batch_number as batchNumber, expiry_date as expiryDate, barcode, image_url as imageUrl, status ' +
      'FROM products WHERE deleted_at IS NULL'
    );
    console.log('Products fetched:', rows);
    res.json(enrichProductsWithFifoBatches(rows));
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get archived (soft-deleted) products
app.get('/api/products/archived', async (req, res) => {
  try {
    const [rows] = execute(
      'SELECT id, name, description, category_name, price, cost, ' +
      'quantity, batch_number as batchNumber, expiry_date as expiryDate, barcode, image_url as imageUrl, status, deleted_at ' +
      'FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    console.log('Archived products fetched:', rows.length);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching archived products:', error);
    res.status(500).json({ error: 'Failed to fetch archived products' });
  }
});

// Get inventory valuation
app.get('/api/products/inventory-valuation', async (req, res) => {
  try {
    const [products] = execute(
      'SELECT id, name, category_name, quantity, cost, price ' +
      'FROM products WHERE deleted_at IS NULL AND quantity > 0'
    );

    const valuation = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category_name,
      quantity: p.quantity,
      cost: parseFloat(p.cost) || 0,
      price: parseFloat(p.price) || 0,
      costValue: p.quantity * (parseFloat(p.cost) || 0),
      retailValue: p.quantity * (parseFloat(p.price) || 0),
      potentialProfit: p.quantity * ((parseFloat(p.price) || 0) - (parseFloat(p.cost) || 0)),
    }));

    const totals = valuation.reduce((acc, item) => ({
      totalCostValue: acc.totalCostValue + item.costValue,
      totalRetailValue: acc.totalRetailValue + item.retailValue,
      totalPotentialProfit: acc.totalPotentialProfit + item.potentialProfit,
      totalItems: acc.totalItems + 1,
      totalUnits: acc.totalUnits + item.quantity,
    }), { totalCostValue: 0, totalRetailValue: 0, totalPotentialProfit: 0, totalItems: 0, totalUnits: 0 });

    res.json({
      items: valuation,
      summary: totals,
    });
  } catch (error) {
    console.error('Error calculating inventory valuation:', error);
    res.status(500).json({ error: 'Failed to calculate inventory valuation' });
  }
});

// ────────────────────────────────────────────────────────────
// Inventory batch helpers (display status / row mapper)
// ────────────────────────────────────────────────────────────

// Compute display status & days-until-expiry for a batch row
function computeBatchDisplayStatus({ status, quantity, expiryDate }) {
  const qty = Number(quantity) || 0;
  if (status === 'depleted' || qty <= 0) {
    return { displayStatus: 'depleted', daysUntilExpiry: null };
  }
  if (!expiryDate) {
    return { displayStatus: 'active', daysUntilExpiry: null };
  }
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) {
    return { displayStatus: 'active', daysUntilExpiry: null };
  }
  // Compare in days at local midnight precision
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  const days = Math.round((startOfExp - startOfToday) / (1000 * 60 * 60 * 24));
  let displayStatus = 'active';
  if (days < 0) displayStatus = 'expired';
  else if (days <= 3) displayStatus = 'critical';
  else if (days <= 7) displayStatus = 'near_expiry';
  return { displayStatus, daysUntilExpiry: days };
}

function mapBatchRow(row) {
  const { displayStatus, daysUntilExpiry } = computeBatchDisplayStatus({
    status: row.status,
    quantity: row.quantity,
    expiryDate: row.expiry_date,
  });
  const fallbackSell = Number(row.product_price ?? 0);
  const rawSell = row.unit_price;
  const unitPrice =
    rawSell != null && rawSell !== '' && Number.isFinite(Number(rawSell))
      ? Number(rawSell)
      : fallbackSell;

  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    categoryName: row.category_name,
    batchNumber: row.batch_number,
    quantity: row.quantity,
    initialQuantity: row.initial_quantity,
    unitCost: row.unit_cost,
    unitPrice,
    expiryDate: row.expiry_date,
    receivedDate: row.received_date,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    notes: row.notes,
    storageLocation: row.storage_location,
    status: row.status,
    displayStatus,
    daysUntilExpiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** FIFO sellable batches + first-batch POS price for product list / POS. */
function enrichProductsWithFifoBatches(productRows) {
  const list = Array.isArray(productRows) ? productRows : [];
  if (list.length === 0) return list;
  const ids = list.map((p) => p.id).filter(Boolean);
  if (ids.length === 0) return list;

  const placeholders = ids.map(() => '?').join(',');
  const [batchRows] = execute(
    `SELECT ib.id, ib.product_id, ib.batch_number, ib.quantity, ib.unit_cost,
            ib.unit_price, ib.expiry_date, ib.received_date, ib.status,
            CAST(p.price AS REAL) AS product_price
     FROM inventory_batches ib
     JOIN products p ON p.id = ib.product_id
     WHERE p.deleted_at IS NULL
       AND ib.status = 'active'
       AND ib.quantity > 0
       AND ib.product_id IN (${placeholders})`,
    ids
  );

  const fifoSort = (a, b) => {
    const aNo = !a.expiry_date || a.expiry_date === '';
    const bNo = !b.expiry_date || b.expiry_date === '';
    const tA = aNo ? 1 : 0;
    const tB = bNo ? 1 : 0;
    if (tA !== tB) return tA - tB;
    if (!aNo && !bNo) {
      const c = String(a.expiry_date).localeCompare(String(b.expiry_date));
      if (c !== 0) return c;
    }
    const r = String(a.received_date || '').localeCompare(String(b.received_date || ''));
    if (r !== 0) return r;
    return String(a.id).localeCompare(String(b.id));
  };

  const byProduct = new Map();
  for (const row of batchRows || []) {
    const pid = row.product_id;
    if (!byProduct.has(pid)) byProduct.set(pid, []);
    byProduct.get(pid).push(row);
  }

  return list.map((p) => {
    const raw = (byProduct.get(p.id) || []).slice().sort(fifoSort);
    const productPrice = Number(p.price) || 0;
    const fifoBatches = raw.map((b) => ({
      id: b.id,
      batchNumber: b.batch_number,
      quantity: Number(b.quantity) || 0,
      unitCost: Number(b.unit_cost) || 0,
      unitPrice:
        b.unit_price != null && b.unit_price !== '' && Number.isFinite(Number(b.unit_price))
          ? Number(b.unit_price)
          : productPrice,
      expiryDate: b.expiry_date,
      receivedDate: b.received_date,
    }));
    const posDisplayPrice = fifoBatches.length > 0 ? fifoBatches[0].unitPrice : productPrice;
    return { ...p, fifoBatches, posDisplayPrice };
  });
}

// Get all inventory batches (with filters, search, sort)
app.get('/api/inventory-batches', async (req, res) => {
  try {
    const {
      productId,
      status,           // 'active' | 'depleted'
      displayStatus,    // 'active' | 'near_expiry' | 'critical' | 'expired'
      expiryFrom,
      expiryTo,
      search,
      sort = 'received_desc', // 'expiry_asc' | 'expiry_desc' | 'received_asc' | 'received_desc'
      limit,
    } = req.query;

    let query = `
      SELECT
        ib.id, ib.product_id, ib.batch_number, ib.quantity, ib.initial_quantity,
        ib.unit_cost, ib.unit_price, CAST(p.price AS REAL) AS product_price,
        ib.expiry_date, ib.received_date, ib.supplier_id,
        ib.notes, ib.storage_location, ib.status, ib.created_at, ib.updated_at,
        p.name AS product_name, p.category_name,
        s.name AS supplier_name
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      LEFT JOIN suppliers s ON s.id = ib.supplier_id
      WHERE p.deleted_at IS NULL
    `;
    const params = [];

    if (productId) {
      query += ` AND ib.product_id = ?`;
      params.push(productId);
    }

    if (status) {
      query += ` AND ib.status = ?`;
      params.push(status);
    }

    if (expiryFrom) {
      query += ` AND ib.expiry_date IS NOT NULL AND date(ib.expiry_date) >= date(?)`;
      params.push(expiryFrom);
    }

    if (expiryTo) {
      query += ` AND ib.expiry_date IS NOT NULL AND date(ib.expiry_date) <= date(?)`;
      params.push(expiryTo);
    }

    if (search) {
      query += ` AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(COALESCE(ib.batch_number, '')) LIKE LOWER(?) OR LOWER(ib.id) LIKE LOWER(?))`;
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    // Sorting
    switch (sort) {
      case 'expiry_asc':
        // Put NULL expiry dates last (active-with-no-expiry shouldn't trigger near-expiry sort)
        query += ` ORDER BY CASE WHEN ib.expiry_date IS NULL OR ib.expiry_date = '' THEN 1 ELSE 0 END, ib.expiry_date ASC, ib.created_at DESC`;
        break;
      case 'expiry_desc':
        query += ` ORDER BY CASE WHEN ib.expiry_date IS NULL OR ib.expiry_date = '' THEN 1 ELSE 0 END, ib.expiry_date DESC, ib.created_at DESC`;
        break;
      case 'received_asc':
        query += ` ORDER BY ib.received_date ASC, ib.created_at ASC`;
        break;
      case 'received_desc':
      default:
        query += ` ORDER BY ib.received_date DESC, ib.created_at DESC`;
    }

    const [rows] = execute(query, params);

    // Map + filter by computed displayStatus (post-query, since it's derived)
    let mapped = rows.map(mapBatchRow);
    if (displayStatus) {
      mapped = mapped.filter((b) => b.displayStatus === displayStatus);
    }

    // Apply limit (after filter)
    const lim = Number.parseInt(limit, 10);
    if (Number.isFinite(lim) && lim > 0) {
      mapped = mapped.slice(0, lim);
    }

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching inventory batches:', error);
    res.status(500).json({ error: 'Failed to fetch inventory batches' });
  }
});

// Aggregate batch status counts (all products, not affected by list filters) — for dashboard-style summary modals
app.get('/api/inventory-batches/stats', async (req, res) => {
  try {
    const [rows] = execute(
      `SELECT ib.id, ib.product_id, ib.quantity, ib.status, ib.expiry_date
       FROM inventory_batches ib
       JOIN products p ON p.id = ib.product_id
       WHERE p.deleted_at IS NULL`
    );
    const counts = { active: 0, near_expiry: 0, critical: 0, expired: 0, depleted: 0 };
    const productIds = new Set();
    for (const row of rows || []) {
      productIds.add(row.product_id);
      const { displayStatus } = computeBatchDisplayStatus({
        status: row.status,
        quantity: row.quantity,
        expiryDate: row.expiry_date,
      });
      counts[displayStatus] = (counts[displayStatus] || 0) + 1;
    }
    res.json({
      totalBatches: rows?.length || 0,
      productsWithBatches: productIds.size,
      byStatus: counts,
    });
  } catch (error) {
    console.error('Error fetching batch stats:', error);
    res.status(500).json({ error: 'Failed to fetch batch stats' });
  }
});

// Get a single inventory batch by id
app.get('/api/inventory-batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = execute(
      `SELECT
        ib.id, ib.product_id, ib.batch_number, ib.quantity, ib.initial_quantity,
        ib.unit_cost, ib.expiry_date, ib.received_date, ib.supplier_id,
        ib.notes, ib.storage_location, ib.status, ib.created_at, ib.updated_at,
        p.name AS product_name, p.category_name,
        s.name AS supplier_name
      FROM inventory_batches ib
      JOIN products p ON ib.product_id = p.id
      LEFT JOIN suppliers s ON s.id = ib.supplier_id
      WHERE ib.id = ?`,
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(mapBatchRow(rows[0]));
  } catch (error) {
    console.error('Error fetching inventory batch:', error);
    res.status(500).json({ error: 'Failed to fetch inventory batch' });
  }
});

// Validate shared batch payload (expiry > received, etc.)
function validateBatchSharedFields({ receivedDate, expiryDate }) {
  if (!receivedDate) {
    return 'Received date is required';
  }
  if (expiryDate) {
    const recv = new Date(receivedDate);
    const exp = new Date(expiryDate);
    if (Number.isNaN(recv.getTime()) || Number.isNaN(exp.getTime())) {
      return 'Invalid date format';
    }
    if (exp <= recv) {
      return 'Expiry date must be later than received date';
    }
  }
  return null;
}

// Create one or more inventory batches (one row per product, sharing batch metadata)
app.post('/api/inventory-batches', async (req, res) => {
  try {
    const {
      products: productItems,
      batchNumber,
      receivedDate,
      expiryDate,
      supplierId,
      notes,
      storageLocation,
    } = req.body || {};

    if (!Array.isArray(productItems) || productItems.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    // Per-row validation
    for (const item of productItems) {
      if (!item?.productId) {
        return res.status(400).json({ error: 'Each row must have a product' });
      }
      const qty = Number.parseInt(item.quantity, 10);
      if (!Number.isFinite(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Quantity must be a positive number' });
      }
    }

    const sharedError = validateBatchSharedFields({ receivedDate, expiryDate });
    if (sharedError) {
      return res.status(400).json({ error: sharedError });
    }

    const trimmedBatchNumber = normalizeOptionalText(batchNumber);
    const normalizedReceived = normalizeOptionalDate(receivedDate);
    const normalizedExpiry = normalizeOptionalDate(expiryDate);
    const normalizedSupplier = normalizeOptionalText(supplierId);
    const normalizedNotes = normalizeOptionalText(notes);
    const normalizedStorage = normalizeOptionalText(storageLocation);

    const created = await withTransaction(async (connection) => {
      const insertedIds = [];
      for (const item of productItems) {
        const qty = Number.parseInt(item.quantity, 10);
        const unitCost = Number(item.unitCost) || 0;
        // Verify product exists
        const [productRows] = connection.execute(
          'SELECT id, name, quantity, price FROM products WHERE id = ? AND deleted_at IS NULL',
          [item.productId]
        );
        if (!productRows || productRows.length === 0) {
          throw new Error(`Product not found: ${item.productId}`);
        }
        const productRow = productRows[0];
        const listPrice = Number(productRow.price) || 0;
        const unitSellRaw = item.unitPrice ?? item.unit_price;
        const unitSell =
          unitSellRaw != null && unitSellRaw !== '' && Number.isFinite(Number(unitSellRaw))
            ? Number(unitSellRaw)
            : listPrice;
        const batchId = uuidv4();
        connection.execute(
          `INSERT INTO inventory_batches (
            id, product_id, batch_number, quantity, initial_quantity,
            unit_cost, unit_price, expiry_date, received_date, supplier_id, notes, storage_location,
            source_type, source_id, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', NULL, 'active')`,
          [
            batchId,
            item.productId,
            trimmedBatchNumber,
            qty,
            qty,
            unitCost,
            unitSell,
            normalizedExpiry,
            normalizedReceived,
            normalizedSupplier,
            normalizedNotes,
            normalizedStorage,
          ]
        );
        // Bump product's on-hand quantity
        connection.execute(
          'UPDATE products SET quantity = quantity + ? WHERE id = ?',
          [qty, item.productId]
        );
        insertedIds.push({ id: batchId, productId: item.productId, productName: productRow.name });
      }
      return insertedIds;
    });

    const userInfo = getUserFromRequest(req);
    logActivity({
      userId: userInfo.id,
      userName: userInfo.name,
      userEmail: userInfo.email,
      action: 'CREATE_INVENTORY_BATCH',
      entityType: 'inventory_batch',
      entityId: created.map((c) => c.id).join(','),
      details: {
        batchNumber: trimmedBatchNumber,
        products: created,
        receivedDate: normalizedReceived,
        expiryDate: normalizedExpiry,
      },
    });

    res.status(201).json({ success: true, created });
  } catch (error) {
    console.error('Error creating inventory batch:', error);
    res.status(500).json({ error: error.message || 'Failed to create inventory batch' });
  }
});

// Update an existing inventory batch
app.put('/api/inventory-batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      batchNumber,
      quantity,
      unitCost,
      unitPrice,
      receivedDate,
      expiryDate,
      supplierId,
      notes,
      storageLocation,
    } = req.body || {};

    const newQty = Number.parseInt(quantity, 10);
    if (!Number.isFinite(newQty) || newQty < 0) {
      return res.status(400).json({ error: 'Quantity must be a non-negative number' });
    }

    const sharedError = validateBatchSharedFields({ receivedDate, expiryDate });
    if (sharedError) {
      return res.status(400).json({ error: sharedError });
    }

    const result = await withTransaction(async (connection) => {
      const [rows] = connection.execute(
        'SELECT id, product_id, quantity, unit_price FROM inventory_batches WHERE id = ?',
        [id]
      );
      if (!rows || rows.length === 0) {
        const err = new Error('Batch not found');
        err.statusCode = 404;
        throw err;
      }
      const existing = rows[0];
      const oldQty = Number(existing.quantity) || 0;
      const delta = newQty - oldQty;
      const newStatus = newQty <= 0 ? 'depleted' : 'active';

      const [priceRows] = connection.execute(
        'SELECT CAST(price AS REAL) AS price FROM products WHERE id = ?',
        [existing.product_id]
      );
      const listPrice = Number(priceRows?.[0]?.price) || 0;
      const sellRaw = unitPrice !== undefined ? unitPrice : req.body?.unit_price;
      const existingSell =
        existing.unit_price != null &&
        existing.unit_price !== '' &&
        Number.isFinite(Number(existing.unit_price))
          ? Number(existing.unit_price)
          : null;
      const resolvedSell =
        sellRaw != null && sellRaw !== '' && Number.isFinite(Number(sellRaw))
          ? Number(sellRaw)
          : (existingSell ?? listPrice);

      connection.execute(
        `UPDATE inventory_batches SET
          batch_number = ?, quantity = ?, unit_cost = ?, unit_price = ?,
          received_date = ?, expiry_date = ?, supplier_id = ?,
          notes = ?, storage_location = ?, status = ?,
          updated_at = datetime('now')
        WHERE id = ?`,
        [
          normalizeOptionalText(batchNumber),
          newQty,
          Number(unitCost) || 0,
          resolvedSell,
          normalizeOptionalDate(receivedDate),
          normalizeOptionalDate(expiryDate),
          normalizeOptionalText(supplierId),
          normalizeOptionalText(notes),
          normalizeOptionalText(storageLocation),
          newStatus,
          id,
        ]
      );

      if (delta !== 0) {
        connection.execute(
          'UPDATE products SET quantity = quantity + ? WHERE id = ?',
          [delta, existing.product_id]
        );
      }

      // If expiry has changed, drop stale notifications so the daily job can re-evaluate
      connection.execute('DELETE FROM notifications WHERE batch_id = ?', [id]);

      return { id, productId: existing.product_id, oldQty, newQty };
    });

    const userInfo = getUserFromRequest(req);
    const [nameRows] = execute('SELECT name FROM products WHERE id = ?', [result.productId]);
    const productName = nameRows?.[0]?.name;
    logActivity({
      userId: userInfo.id,
      userName: userInfo.name,
      userEmail: userInfo.email,
      action: 'UPDATE_INVENTORY_BATCH',
      entityType: 'inventory_batch',
      entityId: id,
      details: { ...result, productName },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error updating inventory batch:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to update inventory batch' });
  }
});

// Delete an inventory batch (soft: set quantity=0, status=depleted, deduct from product)
app.delete('/api/inventory-batches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await withTransaction(async (connection) => {
      const [rows] = connection.execute(
        `SELECT ib.id, ib.product_id, ib.quantity, p.name AS product_name
         FROM inventory_batches ib
         JOIN products p ON p.id = ib.product_id
         WHERE ib.id = ?`,
        [id]
      );
      if (!rows || rows.length === 0) {
        const err = new Error('Batch not found');
        err.statusCode = 404;
        throw err;
      }
      const existing = rows[0];
      const oldQty = Number(existing.quantity) || 0;

      connection.execute(
        `UPDATE inventory_batches SET quantity = 0, status = 'depleted', updated_at = datetime('now') WHERE id = ?`,
        [id]
      );
      if (oldQty > 0) {
        connection.execute(
          'UPDATE products SET quantity = MAX(0, quantity - ?) WHERE id = ?',
          [oldQty, existing.product_id]
        );
      }
      connection.execute('DELETE FROM notifications WHERE batch_id = ?', [id]);
      return {
        id,
        productId: existing.product_id,
        productName: existing.product_name,
        deductedQty: oldQty,
      };
    });

    const userInfo = getUserFromRequest(req);
    logActivity({
      userId: userInfo.id,
      userName: userInfo.name,
      userEmail: userInfo.email,
      action: 'DELETE_INVENTORY_BATCH',
      entityType: 'inventory_batch',
      entityId: id,
      details: { ...result, reason: 'Batch deleted' },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error deleting inventory batch:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ error: error.message || 'Failed to delete inventory batch' });
  }
});

// ────────────────────────────────────────────────────────────
// Notifications API (batch expiry alerts and future types)
// ────────────────────────────────────────────────────────────

function mapNotificationRow(row) {
  return {
    id: row.id,
    type: row.type,
    severity: row.severity,
    batchId: row.batch_id,
    productId: row.product_id,
    productName: row.product_name,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    title: row.title,
    message: row.message,
    isRead: !!row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

app.get('/api/notifications', async (req, res) => {
  try {
    const { unreadOnly, severity, limit, type, category } = req.query;
    let query = `
      SELECT n.*, p.name AS product_name, ib.batch_number, ib.expiry_date
      FROM notifications n
      LEFT JOIN inventory_batches ib ON ib.id = n.batch_id
      LEFT JOIN products p ON p.id = n.product_id
      WHERE 1=1
    `;
    const params = [];
    if (unreadOnly === '1' || unreadOnly === 'true') {
      query += ` AND n.is_read = 0`;
    }
    if (type) {
      query += ` AND n.type = ?`;
      params.push(type);
    } else if (category === 'expiry') {
      query += ` AND n.type = 'expiry'`;
    } else if (category === 'other') {
      query += ` AND n.type IS NOT NULL AND n.type != 'expiry'`;
    }
    if (severity) {
      query += ` AND n.severity = ?`;
      params.push(severity);
    }
    query += ` ORDER BY n.created_at DESC`;
    const lim = Number.parseInt(limit, 10);
    if (Number.isFinite(lim) && lim > 0) {
      query += ` LIMIT ${lim}`;
    }
    const [rows] = execute(query, params);
    res.json(rows.map(mapNotificationRow));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const [rows] = execute('SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0');
    const total = rows?.[0]?.count ?? 0;
    const [bySeverity] = execute(
      `SELECT severity, COUNT(*) AS count FROM notifications WHERE is_read = 0 GROUP BY severity`
    );
    const counts = { near_expiry: 0, critical: 0, expired: 0 };
    for (const row of bySeverity || []) {
      counts[row.severity] = row.count;
    }
    const [byTypeRows] = execute(
      `SELECT type, COUNT(*) AS count FROM notifications WHERE is_read = 0 GROUP BY type`
    );
    const byType = {};
    for (const row of byTypeRows || []) {
      if (row.type) byType[row.type] = row.count;
    }
    res.json({ total, ...counts, byType });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    execute(
      `UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE id = ?`,
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

app.patch('/api/notifications/read-all', async (req, res) => {
  try {
    execute(
      `UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE is_read = 0`
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    execute('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Daily background job: scan inventory_batches and create expiry notifications
function checkExpiringBatches() {
  try {
    const [rows] = execute(`
      SELECT ib.id, ib.product_id, ib.batch_number, ib.expiry_date,
             p.name AS productName,
             CAST(julianday(date(ib.expiry_date)) - julianday(date('now','localtime')) AS INTEGER) AS days
      FROM inventory_batches ib
      JOIN products p ON p.id = ib.product_id
      WHERE ib.status = 'active'
        AND ib.quantity > 0
        AND ib.expiry_date IS NOT NULL
        AND p.deleted_at IS NULL
    `);

    let inserted = 0;
    for (const r of rows || []) {
      let severity = null;
      if (r.days < 0) severity = 'expired';
      else if (r.days <= 3) severity = 'critical'; // covers 1-day and 3-day buckets
      else if (r.days <= 7) severity = 'near_expiry';
      if (!severity) continue;

      const batchLabel = r.batch_number || r.id.slice(0, 8);
      const message = severity === 'expired'
        ? `Batch #${batchLabel} of '${r.productName}' has expired.`
        : `Batch #${batchLabel} of '${r.productName}' will expire in ${r.days} day${r.days === 1 ? '' : 's'}.`;
      const title = severity === 'expired' ? 'Batch expired' : 'Batch expiring soon';

      try {
        const [result] = execute(
          `INSERT OR IGNORE INTO notifications (id, type, severity, batch_id, product_id, title, message)
           VALUES (?, 'expiry', ?, ?, ?, ?, ?)`,
          [uuidv4(), severity, r.id, r.product_id, title, message]
        );
        if (result?.affectedRows > 0) {
          inserted += 1;
          // Best-effort socket push (front-end can listen and refresh)
          try {
            io.emit('notification:new', {
              id: r.id,
              severity,
              title,
              message,
              batchId: r.id,
              productId: r.product_id,
            });
          } catch (_) { /* ignore broadcast errors */ }
        }
      } catch (innerErr) {
        // UNIQUE constraint will already be respected by INSERT OR IGNORE; log anything else
        console.warn('checkExpiringBatches: insert skipped', innerErr?.message);
      }
    }
    if (inserted > 0) {
      console.log(`checkExpiringBatches: created ${inserted} new expiry notification(s)`);
    }
  } catch (error) {
    console.error('checkExpiringBatches failed:', error);
  }
}

// Create a product
app.post('/api/products', async (req, res) => {
  try {
    const id = uuidv4();
    const product = req.body;
    console.log('Creating product:', product);

    // Validate barcode uniqueness only if barcode is provided
    if (product.barcode && product.barcode.trim() !== '') {
      const [existingProducts] = execute(
        'SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL',
        [product.barcode.trim()]
      );

      if (existingProducts.length > 0) {
        return res.status(400).json({
          error: 'Barcode already exists',
          details: 'A product with this barcode already exists in the system.'
        });
      }
    }

    // Convert empty barcode to null
    const barcodeValue = product.barcode && product.barcode.trim() !== '' ? product.barcode.trim() : null;

    // Validate and handle category - create if it doesn't exist
    const categoryName = ensureCategoryExists(product.category);

    const initialQuantity = Math.max(0, Number.parseInt(product.quantity, 10) || 0);
    const batchNumber = normalizeOptionalText(product.batchNumber ?? product.batch_number);
    const expiryDate = normalizeOptionalDate(product.expiryDate ?? product.expiry_date);

    if (!batchNumber) {
      return res.status(400).json({
        error: 'Batch number is required',
        details: 'Every product must have an initial batch / lot number.',
      });
    }

    await withTransaction(async (connection) => {
      connection.execute(
        `INSERT INTO products (
          id, name, description, category_name, 
          price, cost, quantity, batch_number, expiry_date,
          barcode, image_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          product.name,
          product.description,
          categoryName, // Use validated/created category
          product.price,
          product.cost || 0,
          initialQuantity,
          batchNumber,
          expiryDate,
          barcodeValue,
          product.imageUrl,
          product.status || 'available'
        ]
      );

      insertOpeningInventoryBatch(connection, {
        productId: id,
        batchNumber,
        quantity: initialQuantity,
        expiryDate,
        unitCost: product.cost || 0,
        unitPrice: product.price,
        sourceType: 'initial_stock',
        sourceId: id,
      });
    });

    console.log('Product created with ID:', id);
    // Enqueue outbox for sync
    enqueueOutbox('product', id, 'create', { id, ...product });

    // Log activity - non-blocking
    try {
      const user = getUserFromRequest(req);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.CREATE_PRODUCT,
        entityType: 'product',
        entityId: id,
        details: {
          message: `Created product: ${product.name}`,
          productName: product.name,
          category: product.category || null,
          price: product.price,
          quantity: product.quantity || 0
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
    } catch (logError) {
      console.warn('Failed to log activity for product creation:', logError);
    }

    res.status(201).json({ id, ...product, quantity: initialQuantity, batchNumber, expiryDate });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
});

// Update a product
// Helper function to ensure category exists
function ensureCategoryExists(categoryName) {
  if (!categoryName || categoryName.trim() === '') {
    return null;
  }

  const trimmedCategory = categoryName.trim();

  // Check if category exists
  const [existingCategories] = execute(
    'SELECT name FROM categories WHERE name = ?',
    [trimmedCategory]
  );

  if (existingCategories.length === 0) {
    // Category doesn't exist, create it
    try {
      execute(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [trimmedCategory, null]
      );
      console.log(`Created new category: ${trimmedCategory}`);
      return trimmedCategory;
    } catch (err) {
      console.warn(`Failed to create category "${trimmedCategory}":`, err.message);
      return null; // Return null if creation fails
    }
  }

  return trimmedCategory;
}

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = req.body;
    console.log('Updating product:', id, product);

    // Validate barcode uniqueness only if barcode is provided and changed
    const barcodeToCheck = product.barcode && typeof product.barcode === 'string' && product.barcode.trim() !== ''
      ? product.barcode.trim()
      : null;

    if (barcodeToCheck) {
      const [existingProducts] = execute(
        'SELECT id FROM products WHERE barcode = ? AND id != ? AND deleted_at IS NULL',
        [barcodeToCheck, id]
      );

      if (existingProducts.length > 0) {
        return res.status(400).json({
          error: 'Barcode already exists',
          details: 'Another product with this barcode already exists in the system.'
        });
      }
    }

    // Validate and handle category - create if it doesn't exist
    const categoryName = ensureCategoryExists(product.category_name || product.category);

    // Map frontend field names to database field names and handle undefined values
    const updateData = {
      name: product.name || null,
      description: product.description || null,
      category_name: categoryName, // Use validated/created category
      price: product.price || 0,
      cost: product.cost || 0,
      quantity: product.quantity || 0,
      batch_number: normalizeOptionalText(product.batchNumber ?? product.batch_number),
      expiry_date: normalizeOptionalDate(product.expiryDate ?? product.expiry_date),
      barcode: barcodeToCheck,
      image_url: product.imageUrl || product.image_url || null,
      status: product.status || 'available'
    };

    console.log('Mapped update data:', updateData);

    const [result] = execute(
      `UPDATE products SET 
        name = ?,
        description = ?,
        category_name = ?,
        price = ?,
        cost = ?,
        quantity = ?,
        batch_number = ?,
        expiry_date = ?,
        barcode = ?,
        image_url = ?,
        status = ?
      WHERE id = ?`,
      [
        updateData.name,
        updateData.description,
        updateData.category_name,
        updateData.price,
        updateData.cost,
        updateData.quantity,
        updateData.batch_number,
        updateData.expiry_date,
        updateData.barcode,
        updateData.image_url,
        updateData.status,
        id
      ]
    );

    if (result.affectedRows === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      console.log('Product updated successfully:', id);
      // Enqueue outbox for sync
      enqueueOutbox('product', id, 'update', { id, ...updateData });

      // Log activity - non-blocking
      try {
        const user = getUserFromRequest(req);
        logActivity({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: ACTIVITY_ACTIONS.UPDATE_PRODUCT,
          entityType: 'product',
          entityId: id,
          details: {
            message: `Updated product: ${updateData.name}`,
            productName: updateData.name,
            category: updateData.category_name,
            price: updateData.price,
            quantity: updateData.quantity
          },
          ipAddress: req.ip || req.connection?.remoteAddress || null
        });
      } catch (logError) {
        console.warn('Failed to log activity for product update:', logError);
      }

      res.json({ id, ...updateData });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// Get a single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching product:', id);

    const [rows] = execute(
      'SELECT id, name, description, category_name, price, cost, ' +
      'quantity, batch_number as batchNumber, expiry_date as expiryDate, ' +
      'barcode, image_url as imageUrl ' +
      'FROM products WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      const [enriched] = enrichProductsWithFifoBatches(rows);
      console.log('Product fetched:', enriched);
      res.json(enriched);
    }
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product', details: error.message });
  }
});

// Delete a product
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  console.log('Soft deleting product:', id);

  try {
    // Check if product exists and is not already deleted
    const [productRows] = execute(
      'SELECT id, name, deleted_at FROM products WHERE id = ?',
      [id]
    );

    if (productRows.length === 0) {
      console.log('Product not found:', id);
      return res.status(404).json({ error: 'Product not found' });
    }

    if (productRows[0].deleted_at) {
      console.log('Product already deleted:', id);
      return res.status(400).json({ error: 'Product is already deleted' });
    }

    // Soft delete the product by setting deleted_at timestamp
    const [result] = execute(
      "UPDATE products SET deleted_at = datetime('now') WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      console.log('Product deletion failed - not found:', id);
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Product soft deleted successfully:', id);

    // Enqueue outbox for sync (soft delete) - non-blocking
    try {
      const outboxResult = await enqueueOutbox('product', id, 'delete', { id });
      if (outboxResult) {
        console.log('Outbox entry created for product delete:', outboxResult);
      }
    } catch (outboxError) {
      console.warn('Failed to enqueue outbox for product delete:', outboxError);
      // Don't fail the delete if outbox fails
    }

    // Log activity - non-blocking
    try {
      const user = getUserFromRequest(req);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.DELETE_PRODUCT,
        entityType: 'product',
        entityId: id,
        details: {
          message: `Deleted product: ${productRows[0].name}`,
          productName: productRows[0].name,
          productId: id
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
      console.log('Activity logged for product delete');
    } catch (logError) {
      console.warn('Failed to log activity for product delete:', logError);
      // Don't fail the delete if logging fails
    }

    // Always return success if the UPDATE succeeded
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);

    // Handle foreign key constraint errors
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        error: 'Cannot delete product as it is referenced in sales transactions or other records.',
        code: 'PRODUCT_IN_USE'
      });
    }

    res.status(500).json({
      error: 'Failed to delete product',
      details: error.message,
      code: error.code
    });
  }
});

// Restore an archived (soft-deleted) product
app.post('/api/products/:id/restore', async (req, res) => {
  const { id } = req.params;
  console.log('Restoring product:', id);

  try {
    const [productRows] = execute(
      'SELECT id, name, barcode, deleted_at FROM products WHERE id = ?',
      [id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!productRows[0].deleted_at) {
      return res.status(400).json({ error: 'Product is not archived' });
    }

    // If another active product has the same barcode, block the restore
    if (productRows[0].barcode) {
      const [barcodeConflict] = execute(
        'SELECT id FROM products WHERE barcode = ? AND id != ? AND deleted_at IS NULL',
        [productRows[0].barcode, id]
      );
      if (barcodeConflict.length > 0) {
        return res.status(400).json({
          error: 'Cannot restore: another active product already uses this barcode.',
          code: 'BARCODE_CONFLICT'
        });
      }
    }

    const [result] = execute(
      'UPDATE products SET deleted_at = NULL WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    try {
      await enqueueOutbox('product', id, 'restore', { id });
    } catch (outboxError) {
      console.warn('Failed to enqueue outbox for product restore:', outboxError);
    }

    try {
      const user = getUserFromRequest(req);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.RESTORE_PRODUCT,
        entityType: 'product',
        entityId: id,
        details: {
          message: `Restored product: ${productRows[0].name}`,
          productName: productRows[0].name,
          productId: id
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
    } catch (logError) {
      console.warn('Failed to log activity for product restore:', logError);
    }

    res.json({
      success: true,
      message: 'Product restored successfully',
      restoredId: id
    });
  } catch (error) {
    console.error('Error restoring product:', error);
    res.status(500).json({
      error: 'Failed to restore product',
      details: error.message,
    });
  }
});

// Permanently delete an archived product (hard delete)
app.delete('/api/products/:id/permanent', async (req, res) => {
  const { id } = req.params;
  console.log('Permanently deleting product:', id);

  try {
    const [productRows] = execute(
      'SELECT id, name, deleted_at FROM products WHERE id = ?',
      [id]
    );

    if (productRows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (!productRows[0].deleted_at) {
      return res.status(400).json({ error: 'Can only permanently delete archived products' });
    }

    const [result] = execute('DELETE FROM products WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    try {
      await enqueueOutbox('product', id, 'delete', { id });
    } catch (outboxError) {
      console.warn('Failed to enqueue outbox for product permanent delete:', outboxError);
    }

    try {
      const user = getUserFromRequest(req);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.PERMANENT_DELETE_PRODUCT,
        entityType: 'product',
        entityId: id,
        details: {
          message: `Permanently deleted product: ${productRows[0].name}`,
          productName: productRows[0].name,
          productId: id
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
    } catch (logError) {
      console.warn('Failed to log activity for product permanent delete:', logError);
    }

    res.json({
      success: true,
      message: 'Product permanently deleted',
      deletedId: id
    });
  } catch (error) {
    console.error('Error permanently deleting product:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        error: 'Cannot permanently delete product as it is referenced in sales transactions or other records.',
        code: 'PRODUCT_IN_USE'
      });
    }
    res.status(500).json({
      error: 'Failed to permanently delete product',
      details: error.message,
      code: error.code,
    });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = execute('SELECT name, description FROM categories');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (admin client should control access)
app.post('/api/categories', async (req, res) => {
  try {
    const { name, description } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Category name is required' });
    }
    execute(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );
    console.log('Category created:', name);
    const user = getUserFromRequest(req);
    logActivity({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: ACTIVITY_ACTIONS.CREATE_CATEGORY,
      entityType: 'category',
      entityId: name.trim(),
      details: { name: name.trim(), description: description || null },
      ipAddress: req.ip,
    });
    res.status(201).json({ name: name.trim(), description: description || null });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category', details: error.message });
  }
});

// Delete category by name (admin only)
app.delete('/api/categories/:name', async (req, res) => {
  try {
    const { name } = req.params;
    if (!name) return res.status(400).json({ error: 'Category name is required' });
    const [result] = execute('DELETE FROM categories WHERE name = ?', [name]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    console.log('Category deleted:', name);
    const user = getUserFromRequest(req);
    logActivity({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      action: ACTIVITY_ACTIONS.DELETE_CATEGORY,
      entityType: 'category',
      entityId: name,
      details: { name },
      ipAddress: req.ip,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category', details: error.message });
  }
});

// Suppliers CRUD
app.get('/api/suppliers', async (req, res) => {
  try {
    // Exclude the N/A supplier from the list
    const [rows] = execute('SELECT * FROM suppliers WHERE id != ? ORDER BY name ASC', ['na-supplier-default']);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

app.post('/api/suppliers', async (req, res) => {
  try {
    const id = uuidv4();
    const { name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Supplier name is required' });
    execute(
      `INSERT INTO suppliers (id, name, contact_person, phone, email, address, notes, facebook_url, messenger_url, website_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), contactPerson || null, phone || null, email || null, address || null, notes || null, facebook_url || null, messenger_url || null, website_url || null]
    );
    enqueueOutbox('supplier', id, 'create', { id, name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url });
    res.status(201).json({ id, name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url } = req.body || {};
    const [result] = execute(
      `UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?, notes = ?, facebook_url = ?, messenger_url = ?, website_url = ? WHERE id = ?`,
      [name, contactPerson || null, phone || null, email || null, address || null, notes || null, facebook_url || null, messenger_url || null, website_url || null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Supplier not found' });
    enqueueOutbox('supplier', id, 'update', { id, name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url });
    res.json({ id, name, contactPerson, phone, email, address, notes, facebook_url, messenger_url, website_url });
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Reassign any purchase orders using this supplier to the default N/A supplier,
    // then delete the supplier. This avoids foreign key issues while keeping PO history.
    const DEFAULT_SUPPLIER_ID = 'na-supplier-default';
    execute('UPDATE purchase_orders SET supplier_id = ? WHERE supplier_id = ?', [DEFAULT_SUPPLIER_ID, id]);
    const [result] = execute('DELETE FROM suppliers WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Supplier not found' });
    enqueueOutbox('supplier', id, 'delete', { id });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});



// User Management Routes

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = execute(
      'SELECT id, email, name, role, permissions, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    const parsedRows = rows.map(r => ({
      ...r,
      permissions: r.permissions ? JSON.parse(r.permissions) : []
    }));
    console.log('Users fetched:', parsedRows.length);
    res.json(parsedRows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get a single user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = execute(
      'SELECT id, email, name, role, permissions, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = rows[0];
    user.permissions = user.permissions ? JSON.parse(user.permissions) : [];
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create a new user
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    console.log('Creating user:', { name, email, role, permissions });

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    const [existingUsers] = execute(
      'SELECT email FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate UUID for ID since table uses VARCHAR(36)
    const userId = uuidv4();

    // Hash the password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const [result] = execute(
      'INSERT INTO users (id, name, email, password_hash, role, permissions) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, name, email, password_hash, role, JSON.stringify(permissions || [])]
    );

    console.log('User created with ID:', userId);

    // Log activity
    const actingUser = getUserFromRequest(req);
    logActivity({
      userId: actingUser.id,
      userName: actingUser.name,
      userEmail: actingUser.email,
      action: ACTIVITY_ACTIONS.CREATE_USER,
      entityType: 'user',
      entityId: userId,
      details: { username: name, email, role },
      ipAddress: req.ip,
    });

    // Return user without password
    res.status(201).json({
      id: userId,
      name,
      email,
      role,
      permissions: permissions || [],
      created_at: new Date()
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user', details: error.message });
  }
});

// Update a user
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, permissions } = req.body;
    console.log('Updating user:', id, { name, email, role, permissions });

    // Check if user exists
    const [existingUsers] = execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is already taken by another user
    const [emailCheck] = execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'Email is already taken by another user' });
    }

    const updates = ['name = ?', 'email = ?', 'permissions = ?'];
    const updateParams = [name, email, JSON.stringify(permissions || [])];

    if (role !== undefined) {
      updates.push('role = ?');
      updateParams.push(role);
    }

    // If password is provided, update it too
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      updates.push('password_hash = ?');
      updateParams.push(await bcrypt.hash(password, saltRounds));
    }

    updateParams.push(id);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    const [result] = execute(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      console.log('User not found:', id);
      res.status(404).json({ error: 'User not found' });
    } else {
      console.log('User updated:', id);
      // Log activity
      const actingUser = getUserFromRequest(req);
      logActivity({
        userId: actingUser.id,
        userName: actingUser.name,
        userEmail: actingUser.email,
        action: ACTIVITY_ACTIONS.UPDATE_USER,
        entityType: 'user',
        entityId: id,
        details: { username: name, email, role },
        ipAddress: req.ip,
      });
      // Emit websocket event to notify this specific user to refresh their permissions
      io.to(`user_${id}`).emit('permissions_updated');
      res.json({
        id: id,
        name,
        email,
        role,
        permissions: permissions || [],
        updated_at: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user', details: error.message });
  }
});

// Delete a user
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user || req.session?.user || null;
    console.log('Deleting user:', id);

    // Prevent self-deletion
    if (currentUser && currentUser.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Check if user exists
    const [existingUsers] = execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the last admin user
    if (existingUsers[0].role === 'admin') {
      const [adminCount] = execute(
        'SELECT COUNT(*) as count FROM users WHERE role = "admin"'
      );

      if (adminCount[0].count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin user' });
      }
    }

    const [result] = execute('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      console.log('User not found:', id);
      res.status(404).json({ error: 'User not found' });
    } else {
      console.log('User deleted:', id);
      // Log activity
      const actingUser = getUserFromRequest(req);
      logActivity({
        userId: actingUser.id,
        userName: actingUser.name,
        userEmail: actingUser.email,
        action: ACTIVITY_ACTIONS.DELETE_USER,
        entityType: 'user',
        entityId: id,
        details: { username: existingUsers[0].name, email: existingUsers[0].email },
        ipAddress: req.ip,
      });
      res.json({ success: true });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user', details: error.message });
  }
});

// Stock Movement Routes

// Create a stock movement
app.post('/api/stock-movements', async (req, res) => {
  try {
    const { productId, movementType, quantity, batchNumber, expiryDate, fromLocation, toLocation, referenceNumber, notes, performedBy, performedById } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product ID and positive quantity are required' });
    }

    const normalizedMovementType = movementType || 'transfer';
    const movementQty = Math.max(1, Number.parseInt(quantity, 10) || 1);
    const normalizedBatchNumber = normalizeOptionalText(batchNumber);
    const normalizedExpiryDate = normalizeOptionalDate(expiryDate);

    const result = await withTransaction(async (connection) => {
      // Get product name (exclude deleted products)
      const [[product]] = connection.execute('SELECT id, name, quantity, cost FROM products WHERE id = ? AND deleted_at IS NULL', [productId]);
      if (!product) {
        const error = new Error('PRODUCT_NOT_FOUND');
        error.statusCode = 404;
        throw error;
      }

      if (isStockInMovement(normalizedMovementType)) {
        addInventoryBatch(connection, {
          productId,
          quantity: movementQty,
          batchNumber: normalizedBatchNumber,
          expiryDate: normalizedExpiryDate,
          unitCost: product.cost || 0,
          sourceType: normalizedMovementType,
          sourceId: referenceNumber || null,
        });
        connection.execute(
          'UPDATE products SET quantity = quantity + ?, batch_number = COALESCE(?, batch_number), expiry_date = COALESCE(?, expiry_date) WHERE id = ?',
          [movementQty, normalizedBatchNumber, normalizedExpiryDate, productId]
        );
      } else if (isStockOutMovement(normalizedMovementType)) {
        const currentQty = Number(product.quantity) || 0;
        if (currentQty < movementQty) {
          throw new Error('INSUFFICIENT_STOCK');
        }
        deductInventoryBatches(connection, { productId, quantity: movementQty });
        connection.execute(
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [movementQty, productId]
        );
      }

      const movementId = uuidv4();
      connection.execute(
        `INSERT INTO stock_movements (
          id, product_id, product_name, movement_type, quantity,
          batch_number, expiry_date, from_location, to_location,
          reference_number, notes, performed_by, performed_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          movementId,
          productId,
          product.name,
          normalizedMovementType,
          movementQty,
          normalizedBatchNumber,
          normalizedExpiryDate,
          fromLocation || null,
          toLocation || null,
          referenceNumber || null,
          notes || null,
          performedBy || null,
          performedById || null,
        ]
      );

      return { movementId, product };
    });

    // Log activity - determine action based on movement type
    const stockAction = isStockInMovement(normalizedMovementType) ? 'STOCK_IN' : 'STOCK_OUT';
    logActivity({
      userId: performedById,
      userName: performedBy,
      action: stockAction,
      entityType: 'product',
      entityId: productId,
      details: {
        productName: result.product.name,
        movementType: normalizedMovementType,
        quantity: movementQty,
        batchNumber: normalizedBatchNumber,
        expiryDate: normalizedExpiryDate,
        fromLocation,
        toLocation,
        referenceNumber,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({ id: result.movementId, message: 'Stock movement recorded successfully' });
  } catch (error) {
    console.error('Error creating stock movement:', error);
    if (error.statusCode === 404 || error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({ error: 'Product not found or deleted' });
    }
    if (error.message === 'INSUFFICIENT_STOCK' || error.message === 'INSUFFICIENT_BATCH_STOCK') {
      return res.status(400).json({ error: 'Insufficient stock for this movement' });
    }
    res.status(500).json({ error: 'Failed to create stock movement', details: error.message });
  }
});

// Get stock movements
app.get('/api/stock-movements', async (req, res) => {
  try {
    const { productId, movementType, startDate, endDate, limit } = req.query;
    let query = 'SELECT * FROM stock_movements WHERE 1=1';
    const params = [];

    if (productId) {
      query += ' AND product_id = ?';
      params.push(productId);
    }
    if (movementType) {
      query += ' AND movement_type = ?';
      params.push(movementType);
    }
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [rows] = execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

// Reorder Point & Smart Suggestions API

// Get products that need reordering
app.get('/api/products/reorder-suggestions', async (req, res) => {
  try {
    // Get products below their reorder point (low stock threshold)
    const [products] = execute(`
      SELECT 
        p.id, p.name, p.category_name, p.quantity, p.low_stock_threshold,
        p.price, p.barcode
      FROM products p
      WHERE p.deleted_at IS NULL 
        AND p.quantity <= p.low_stock_threshold
      ORDER BY 
        CASE 
          WHEN p.quantity <= 0 THEN 0
          WHEN p.quantity <= p.low_stock_threshold / 2 THEN 1
          ELSE 2
        END,
        p.quantity ASC
    `);

    // Calculate suggested reorder quantities based on sales velocity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const suggestions = await Promise.all(products.map(async (product) => {
      // Get sales velocity for last 30 days
      const [transactions] = execute(`
        SELECT ti.quantity
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE ti.product_id = ? 
          AND t.timestamp >= ?
          AND t.archived_at IS NULL
      `, [product.id, thirtyDaysAgo.toISOString()]);

      const totalSold = transactions.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
      const avgDailySales = totalSold / 30;

      // Suggest enough stock for 30-60 days based on velocity
      const suggestedReorder = avgDailySales > 0
        ? Math.max(10, Math.ceil(avgDailySales * 45)) // 45 days worth
        : Math.max(10, (product.low_stock_threshold || 10) * 2); // Or 2x threshold

      const stockoutRisk = product.quantity <= 0 ? 'critical'
        : product.quantity <= product.low_stock_threshold / 2 ? 'high'
          : 'medium';

      return {
        ...product,
        totalSoldLast30Days: totalSold,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        suggestedReorderQty: suggestedReorder,
        stockoutRisk,
        daysUntilStockout: avgDailySales > 0 ? Math.floor(product.quantity / avgDailySales) : null,
      };
    }));

    res.json(suggestions);
  } catch (error) {
    console.error('Error generating reorder suggestions:', error);
    res.status(500).json({ error: 'Failed to generate reorder suggestions' });
  }
});

// Stock Adjustment Routes

// Create a stock adjustment
app.post('/api/stock-adjustments', async (req, res) => {
  try {
    const { productId, adjustmentType, newQuantity, reason, notes, adjustedBy, adjustedById, batchNumber, expiryDate } = req.body;

    if (!productId || newQuantity === undefined || newQuantity === null) {
      return res.status(400).json({ error: 'Product ID and new quantity are required' });
    }

    const connection = await getConnection();
    try {
      connection.beginTransaction();

      // Get current product (exclude deleted products)
      const [[product]] = connection.execute(
        'SELECT id, name, quantity, cost FROM products WHERE id = ? AND deleted_at IS NULL',
        [productId]
      );

      if (!product) {
        connection.rollback();
        return res.status(404).json({ error: 'Product not found or deleted' });
      }

      const quantityBefore = Number(product.quantity) || 0;
      const quantityAfter = Number(newQuantity);
      const quantityChange = quantityAfter - quantityBefore;
      const normalizedBatchNumber = normalizeOptionalText(batchNumber);
      const normalizedExpiryDate = normalizeOptionalDate(expiryDate);

      // Create adjustment record
      const adjustmentId = uuidv4();
      connection.execute(
        `INSERT INTO stock_adjustments (
          id, product_id, product_name, adjustment_type,
          quantity_before, quantity_after, quantity_change,
          reason, notes, adjusted_by, adjusted_by_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adjustmentId,
          productId,
          product.name,
          adjustmentType || 'correction',
          quantityBefore,
          quantityAfter,
          quantityChange,
          reason || null,
          notes || null,
          adjustedBy || null,
          adjustedById || null,
        ]
      );

      // Update product quantity
      if (quantityChange > 0) {
        addInventoryBatch(connection, {
          productId,
          quantity: quantityChange,
          batchNumber: normalizedBatchNumber,
          expiryDate: normalizedExpiryDate,
          unitCost: product.cost || 0,
          sourceType: adjustmentType || 'correction',
          sourceId: adjustmentId,
        });
      } else if (quantityChange < 0) {
        deductInventoryBatches(connection, { productId, quantity: Math.abs(quantityChange) });
      }

      connection.execute(
        'UPDATE products SET quantity = ?, batch_number = COALESCE(?, batch_number), expiry_date = COALESCE(?, expiry_date) WHERE id = ?',
        [quantityAfter, normalizedBatchNumber, normalizedExpiryDate, productId]
      );

      // Log activity - use STOCK_IN/STOCK_OUT based on direction, or STOCK_ADJUSTMENT for corrections
      let stockAction = 'STOCK_ADJUSTMENT';
      if (quantityChange > 0) stockAction = 'STOCK_IN';
      else if (quantityChange < 0) stockAction = 'STOCK_OUT';
      logActivity({
        userId: adjustedById,
        userName: adjustedBy,
        action: stockAction,
        entityType: 'product',
        entityId: productId,
        details: {
          productName: product.name,
          adjustmentType,
          quantityBefore,
          quantityAfter,
          quantityChange,
          reason,
        },
        ipAddress: req.ip,
      });

      connection.commit();

      res.status(201).json({
        id: adjustmentId,
        productId,
        productName: product.name,
        quantityBefore,
        quantityAfter,
        quantityChange,
      });
    } catch (error) {
      connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    res.status(500).json({ error: 'Failed to create stock adjustment', details: error.message });
  }
});

// Get stock adjustments
app.get('/api/stock-adjustments', async (req, res) => {
  try {
    const { productId, startDate, endDate, adjustmentType, limit } = req.query;
    let query = 'SELECT * FROM stock_adjustments WHERE 1=1';
    const params = [];

    if (productId) {
      query += ' AND product_id = ?';
      params.push(productId);
    }
    if (adjustmentType) {
      query += ' AND adjustment_type = ?';
      params.push(adjustmentType);
    }
    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [rows] = execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    res.status(500).json({ error: 'Failed to fetch stock adjustments' });
  }
});

// Get stock adjustment by ID
app.get('/api/stock-adjustments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[adjustment]] = execute('SELECT * FROM stock_adjustments WHERE id = ?', [id]);

    if (!adjustment) {
      return res.status(404).json({ error: 'Stock adjustment not found' });
    }

    res.json(adjustment);
  } catch (error) {
    console.error('Error fetching stock adjustment:', error);
    res.status(500).json({ error: 'Failed to fetch stock adjustment' });
  }
});

// Transaction Management Routes

const TRANSACTION_DEFAULT_LIMIT = 50;
const TRANSACTION_MAX_LIMIT = 500;

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeDateStart(value) {
  if (!value) return null;
  return String(value).length <= 10 ? `${value} 00:00:00` : value;
}

function normalizeDateEnd(value) {
  if (!value) return null;
  return String(value).length <= 10 ? `${value} 00:00:00` : value;
}

function buildTransactionsWhere({
  archivedOnly = false,
  startDate,
  endDate,
  search,
  cashier,
  paymentMethod,
}) {
  const clauses = [];
  const params = [];

  clauses.push(archivedOnly ? 'archived_at IS NOT NULL' : 'archived_at IS NULL');

  const normalizedStart = normalizeDateStart(startDate);
  const normalizedEnd = normalizeDateEnd(endDate);
  if (normalizedStart && normalizedEnd) {
    clauses.push('timestamp >= ? AND timestamp < datetime(?, \'+1 day\')');
    params.push(normalizedStart, normalizedEnd);
  } else if (normalizedStart) {
    clauses.push('timestamp >= ?');
    params.push(normalizedStart);
  } else if (normalizedEnd) {
    clauses.push('timestamp < datetime(?, \'+1 day\')');
    params.push(normalizedEnd);
  }

  if (search) {
    clauses.push('(lower(id) LIKE ? OR lower(COALESCE(reference_number, \'\')) LIKE ? OR lower(COALESCE(user_name, \'\')) LIKE ?)');
    const pattern = `%${String(search).toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  if (cashier) {
    clauses.push('lower(COALESCE(user_name, \'system\')) = ?');
    params.push(String(cashier).toLowerCase());
  }

  if (paymentMethod) {
    clauses.push('lower(COALESCE(payment_method, \'cash\')) = ?');
    params.push(String(paymentMethod).toLowerCase());
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function parseTransactionItems(rows, includeItems) {
  if (!includeItems) return rows;
  return rows.map((transaction) => ({
    ...transaction,
    items: transaction.items ? JSON.parse(transaction.items) : [],
  }));
}

function fetchTransactionsList(req, archivedOnly = false) {
  const {
    startDate,
    endDate,
    search,
    cashier,
    paymentMethod,
    page,
    limit,
    paginated,
    includeItems,
  } = req.query;

  const shouldPaginate = toBool(paginated, false) || page !== undefined || limit !== undefined;
  const limitCap = toBool(req.query.bulk, false) ? 200000 : TRANSACTION_MAX_LIMIT;
  const parsedPage = Math.max(1, toInt(page, 1));
  const parsedLimit = Math.min(limitCap, Math.max(1, toInt(limit, TRANSACTION_DEFAULT_LIMIT)));
  const offset = (parsedPage - 1) * parsedLimit;
  const shouldIncludeItems = toBool(includeItems, true);

  const { whereSql, params } = buildTransactionsWhere({
    archivedOnly,
    startDate,
    endDate,
    search,
    cashier,
    paymentMethod,
  });

  const sortField = archivedOnly ? 'archived_at' : 'timestamp';
  const columns = shouldIncludeItems
    ? 'id, timestamp, items, subtotal, tax, total, payment_method, received_amount, change_amount, reference_number, user_id, user_name, user_email, archived_at'
    : 'id, timestamp, subtotal, tax, total, payment_method, received_amount, change_amount, reference_number, user_id, user_name, user_email, archived_at';

  let listSql = `SELECT ${columns} FROM transactions ${whereSql} ORDER BY ${sortField} DESC`;
  const listParams = [...params];

  if (shouldPaginate) {
    listSql += ' LIMIT ? OFFSET ?';
    listParams.push(parsedLimit, offset);
  }

  const [rows] = execute(listSql, listParams);
  const items = parseTransactionItems(rows, shouldIncludeItems);

  if (!shouldPaginate) {
    return items;
  }

  const [countRows] = execute(`SELECT COUNT(*) AS total FROM transactions ${whereSql}`, params);
  const total = Number(countRows?.[0]?.total || 0);
  const hasNextPage = offset + items.length < total;

  return {
    items,
    total,
    page: parsedPage,
    limit: parsedLimit,
    hasNextPage,
  };
}

// Get transactions (supports pagination/filtering)
app.get('/api/transactions', async (req, res) => {
  try {
    const response = fetchTransactionsList(req, false);
    if (Array.isArray(response)) {
      console.log('Transactions fetched (legacy):', response.length);
    } else {
      console.log('Transactions fetched (paged):', response.items.length, 'total:', response.total);
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get archived transactions (supports pagination/filtering)
app.get('/api/transactions/archived', async (req, res) => {
  try {
    const response = fetchTransactionsList(req, true);
    if (Array.isArray(response)) {
      console.log('Archived transactions fetched (legacy):', response.length);
    } else {
      console.log('Archived transactions fetched (paged):', response.items.length, 'total:', response.total);
    }
    res.json(response);
  } catch (error) {
    console.error('Error fetching archived transactions:', error);
    res.status(500).json({ error: 'Failed to fetch archived transactions' });
  }
});

app.get('/api/transactions/summary', async (req, res) => {
  try {
    const { startDate, endDate, cashier, paymentMethod } = req.query;
    const { whereSql, params } = buildTransactionsWhere({
      archivedOnly: false,
      startDate,
      endDate,
      cashier,
      paymentMethod,
    });

    const [summaryRows] = execute(
      `SELECT
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(total), 0) AS totalSales,
        COALESCE(AVG(total), 0) AS averageTransaction
      FROM transactions
      ${whereSql}`,
      params
    );

    const [todayRows] = execute(
      `SELECT COALESCE(SUM(total), 0) AS todaySales
      FROM transactions
      ${whereSql ? `${whereSql} AND` : 'WHERE'} date(timestamp) = date('now', 'localtime')`,
      params
    );

    const [cashierRows] = execute(
      `SELECT DISTINCT COALESCE(user_name, 'System') AS name
      FROM transactions
      ${whereSql}
      ORDER BY name ASC`,
      params
    );

    const [methodRows] = execute(
      `SELECT DISTINCT lower(COALESCE(payment_method, 'cash')) AS method
      FROM transactions
      ${whereSql}
      ORDER BY method ASC`,
      params
    );

    res.json({
      totalSales: Number(summaryRows?.[0]?.totalSales || 0),
      totalTransactions: Number(summaryRows?.[0]?.totalTransactions || 0),
      averageTransaction: Number(summaryRows?.[0]?.averageTransaction || 0),
      todaySales: Number(todayRows?.[0]?.todaySales || 0),
      cashiers: cashierRows.map((row) => row.name).filter(Boolean),
      paymentMethods: methodRows.map((row) => row.method).filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
});

// Endpoint to generate transaction number (MUST be before /api/transactions/:id)
app.get('/api/transactions/generate-id', async (req, res) => {
  try {
    const transactionId = await generateTransactionNumber();
    res.json({ id: transactionId });
  } catch (error) {
    console.error('Error generating transaction ID:', error);
    res.status(500).json({ error: 'Failed to generate transaction ID' });
  }
});

// Get a single transaction by ID
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching transaction:', id);

    const [rows] = await execute('SELECT * FROM transactions WHERE id = ?', [id]);

    if (rows.length === 0) {
      console.log('Transaction not found:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      const transaction = {
        ...rows[0],
        items: rows[0].items ? JSON.parse(rows[0].items) : []
      };
      console.log('Transaction fetched:', transaction);
      res.json(transaction);
    }
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction', details: error.message });
  }
});

// Create a transaction

app.post('/api/transactions', async (req, res) => {
  let connection;
  try {
    const transaction = req.body;
    console.log('Creating transaction:', transaction);
    if (!Array.isArray(transaction.items) || transaction.items.length === 0) {
      return res.status(400).json({ error: 'Transaction items are required' });
    }

    // Check for duplicate reference number (only for non-cash payments)
    const refNum = transaction.referenceNumber?.trim() || null;
    if (refNum) {
      const [existingRef] = execute(
        'SELECT id FROM transactions WHERE reference_number = ?',
        [refNum]
      );
      if (existingRef && existingRef.length > 0) {
        return res.status(400).json({ error: 'Reference number already used. Each reference number must be unique.' });
      }
    }

    connection = await getConnection();
    connection.beginTransaction();

    const transactionId = transaction.id || await generateTransactionNumber();

    await connection.execute(
      `INSERT INTO transactions (
        id, timestamp, items, subtotal, tax, total,
        payment_method, received_amount, change_amount, reference_number,
        user_id, user_name, user_email,
        discount_type, discount_percentage, discount_amount
      ) VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        JSON.stringify(transaction.items),
        transaction.subtotal ?? 0,
        transaction.tax ?? 0,
        transaction.total ?? 0,
        transaction.paymentMethod || 'cash',
        transaction.receivedAmount ?? null,
        transaction.change ?? 0,
        refNum,
        transaction.userId || null,
        transaction.userName || null,
        transaction.userEmail || null,
        transaction.discountType || null,
        transaction.discountPercentage ?? null,
        transaction.discountAmount ?? null,
      ]
    );

    // Deduct stock from products using FIFO batches while keeping product totals in sync.
    for (const item of transaction.items) {
      const productId = item.productId || item.product_id;
      let fifoDeductions = [];

      await connection.execute(
        `INSERT INTO transaction_items (
          id, transaction_id, product_id, quantity, unit_price, unit_cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          uuidv4(),
          transactionId,
          productId,
          Number(item.quantity) || 0,
          Number(item.price ?? item.unit_price ?? 0),
          Number(item.cost || 0),
        ]
      );

      if (productId) {
        const [productRows] = await connection.execute(
          'SELECT quantity FROM products WHERE id = ? AND deleted_at IS NULL',
          [productId]
        );

        if (!productRows || productRows.length === 0) {
          throw new Error(`Product ${item.productId} not found or deleted`);
        }

        const product = productRows[0];
        const currentQty = Number(product.quantity) || 0;
        const quantityToSell = Number(item.quantity) || 0;

        if (currentQty < quantityToSell) {
          throw new Error('INSUFFICIENT_STOCK');
        }

        fifoDeductions = deductInventoryBatches(connection, { productId, quantity: quantityToSell });

        await connection.execute(
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [quantityToSell, productId]
        );

        await connection.execute(
          `INSERT INTO stock_movements (
            id, product_id, product_name, movement_type, quantity,
            batch_number, expiry_date, reference_number, notes, performed_by, performed_by_id
          ) VALUES (?, ?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            productId,
            item.name || 'Sold product',
            quantityToSell,
            fifoDeductions.map(d => d.batchNumber).filter(Boolean).join(', ') || null,
            fifoDeductions.map(d => d.expiryDate).filter(Boolean).join(', ') || null,
            transactionId,
            'FIFO sale deduction',
            transaction.userName || null,
            transaction.userId || null,
          ]
        );
      }
    }

    connection.commit();
    connection.release();
    connection = null;

    console.log('Transaction created with ID:', transactionId);
    enqueueOutbox('transaction', transactionId, 'create', { ...transaction, id: transactionId });

    logActivity({
      userId: transaction.userId,
      userName: transaction.userName,
      userEmail: transaction.userEmail,
      action: ACTIVITY_ACTIONS.CREATE_SALE,
      entityType: 'transaction',
      entityId: transactionId,
      details: {
        total: transaction.total,
        itemCount: transaction.items.length,
        paymentMethod: transaction.paymentMethod || 'cash',
      },
    });

    res.status(201).json({ ...transaction, id: transactionId });
  } catch (error) {
    if (connection) {
      try {
        connection.rollback();
        connection.release();
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError);
      }
    }
    if (error.message === 'INSUFFICIENT_STOCK') {
      return res.status(400).json({ error: 'Insufficient stock to complete sale' });
    }
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction', details: error.message });
  }
});

// Archive a transaction (admin only) - soft delete
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userRole } = req.body; // We'll send user role from frontend
    const user = getUserFromRequest(req);

    console.log('Archive transaction request:', id, 'by role:', userRole);

    // Check if user is admin
    if (userRole !== 'admin') {
      console.log('Unauthorized transaction archive attempt by role:', userRole);
      return res.status(403).json({
        error: 'Access denied. Only administrators can archive transactions.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Check if transaction exists and is not already archived
    const [transactionRows] = execute(
      'SELECT id, archived_at FROM transactions WHERE id = ?',
      [id]
    );

    if (transactionRows.length === 0) {
      console.log('Transaction not found:', id);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transactionRows[0].archived_at) {
      console.log('Transaction already archived:', id);
      return res.status(400).json({ error: 'Transaction is already archived' });
    }

    // Archive the transaction by setting archived_at timestamp
    const [result] = execute(
      "UPDATE transactions SET archived_at = datetime('now') WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      console.log('Transaction archiving failed:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      // Enqueue outbox for sync (archive)
      enqueueOutbox('transaction', id, 'archive', { id });
      console.log('Transaction archived successfully:', id);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.ARCHIVE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction archived' },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: 'Transaction archived successfully. It will be permanently deleted after 60 days.',
        archivedId: id
      });
    }
  } catch (error) {
    console.error('Error archiving transaction:', error);
    res.status(500).json({ error: 'Failed to archive transaction', details: error.message });
  }
});

// Restore transaction from archive (admin only)
app.post('/api/transactions/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { userRole } = req.body;
    const user = getUserFromRequest(req);

    console.log('Restore transaction request:', id, 'by role:', userRole);

    // Check if user is admin
    if (userRole !== 'admin') {
      console.log('Unauthorized transaction restore attempt by role:', userRole);
      return res.status(403).json({
        error: 'Access denied. Only administrators can restore transactions.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Check if transaction exists and is archived
    const [transactionRows] = execute(
      'SELECT id, archived_at FROM transactions WHERE id = ?',
      [id]
    );

    if (transactionRows.length === 0) {
      console.log('Transaction not found:', id);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!transactionRows[0].archived_at) {
      console.log('Transaction is not archived:', id);
      return res.status(400).json({ error: 'Transaction is not archived' });
    }

    // Restore the transaction by removing archived_at timestamp
    const [result] = execute(
      'UPDATE transactions SET archived_at = NULL WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      console.log('Transaction restore failed:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      // Enqueue outbox for sync (restore)
      enqueueOutbox('transaction', id, 'restore', { id });
      console.log('Transaction restored successfully:', id);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.RESTORE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction restored' },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: 'Transaction restored successfully',
        restoredId: id
      });
    }
  } catch (error) {
    console.error('Error restoring transaction:', error);
    res.status(500).json({ error: 'Failed to restore transaction', details: error.message });
  }
});

// Permanently delete transaction from archive (admin only)
app.delete('/api/transactions/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const { userRole } = req.body;
    const user = getUserFromRequest(req);

    console.log('Permanent delete transaction request:', id, 'by role:', userRole);

    // Check if user is admin
    if (userRole !== 'admin') {
      console.log('Unauthorized permanent deletion attempt by role:', userRole);
      return res.status(403).json({
        error: 'Access denied. Only administrators can permanently delete transactions.',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Check if transaction exists and is archived
    const [transactionRows] = execute(
      'SELECT id, archived_at FROM transactions WHERE id = ?',
      [id]
    );

    if (transactionRows.length === 0) {
      console.log('Transaction not found:', id);
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (!transactionRows[0].archived_at) {
      console.log('Cannot permanently delete non-archived transaction:', id);
      return res.status(400).json({ error: 'Can only permanently delete archived transactions' });
    }

    // Permanently delete the transaction
    const [result] = execute('DELETE FROM transactions WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      console.log('Transaction permanent deletion failed:', id);
      res.status(404).json({ error: 'Transaction not found' });
    } else {
      // Enqueue outbox for sync (permanent delete)
      enqueueOutbox('transaction', id, 'delete', { id });
      console.log('Transaction permanently deleted:', id);
      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.DELETE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction permanently deleted' },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: 'Transaction permanently deleted',
        deletedId: id
      });
    }
  } catch (error) {
    console.error('Error permanently deleting transaction:', error);
    res.status(500).json({ error: 'Failed to permanently delete transaction', details: error.message });
  }
});

// Outbox Sync Endpoints
app.get('/api/outbox', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const [rows] = execute(
      'SELECT * FROM outbox WHERE status = ? ORDER BY created_at ASC LIMIT ?',
      [status, limit]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching outbox entries:', error);
    res.status(500).json({ error: 'Failed to fetch outbox entries' });
  }
});

app.put('/api/outbox/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error: lastError } = req.body || {};
    if (!status || !['pending', 'synced', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const [result] = execute(
      `UPDATE outbox SET status = ?, attempt_count = attempt_count + 1, last_error = ? WHERE id = ?`,
      [status, lastError || null, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Outbox entry not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating outbox entry:', error);
    res.status(500).json({ error: 'Failed to update outbox entry' });
  }
});

// Activity Logs
app.get('/api/activity-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const { action, userId, entityType, startDate, endDate } = req.query;

    const filters = [];
    const params = [];

    if (action) {
      filters.push('action = ?');
      params.push(action);
    }
    if (userId) {
      filters.push('user_id = ?');
      params.push(userId);
    }
    if (entityType) {
      filters.push('entity_type = ?');
      params.push(entityType);
    }
    if (startDate) {
      filters.push('created_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      filters.push('created_at <= ?');
      params.push(endDate);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [logs] = execute(
      `SELECT * FROM activity_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [[{ total }]] = execute(
      `SELECT COUNT(*) AS total FROM activity_logs ${whereClause}`,
      params
    );

    const parsedLogs = logs.map((log) => {
      let details = log.details;
      if (details) {
        try {
          details = JSON.parse(details);
        } catch {
          // keep as raw string
        }
      }
      return { ...log, details };
    });

    res.json({ logs: parsedLogs, total: total || 0 });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

app.post('/api/activity-logs', async (req, res) => {
  try {
    logActivity(req.body || {});
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error creating activity log:', error);
    res.status(500).json({ error: 'Failed to create activity log' });
  }
});

app.get('/api/activity-logs/action-types', (req, res) => {
  res.json(Object.values(ACTIVITY_ACTIONS));
});

// Audit Management Routes

// Get all audits
app.get('/api/audits', async (req, res) => {
  try {
    const [rows] = execute(
      'SELECT * FROM audits ORDER BY audit_date DESC'
    );

    // Parse results JSON for each audit
    const audits = rows.map(audit => ({
      ...audit,
      results: audit.results ? JSON.parse(audit.results) : []
    }));

    console.log('Audits fetched:', audits.length);
    res.json(audits);
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

// Create an audit
app.post('/api/audits', async (req, res) => {
  try {
    const payload = req.body || {};
    console.log('Creating audit:', payload);

    const auditId = payload.auditId || payload.id || uuidv4();
    const auditDate =
      payload.audit_date ||
      payload.auditDate ||
      payload.date ||
      new Date().toISOString();
    const auditType = payload.audit_type || payload.auditType || payload.mode || 'full';
    const productsAudited =
      payload.products_audited ?? payload.productsAudited ?? (payload.results?.length ?? 0);
    const discrepanciesFound =
      payload.discrepancies_found ?? payload.discrepancies ?? 0;
    const totalAdjustments =
      payload.total_adjustments ?? payload.totalAdjustments ?? 0;
    const notes = payload.notes || null;
    const resultsJson = JSON.stringify(payload.results || []);

    execute(
      `INSERT INTO audits (
        id, audit_date, audit_type, products_audited, 
        discrepancies_found, total_adjustments, notes, results
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        auditId,
        auditDate,
        auditType,
        productsAudited,
        discrepanciesFound,
        totalAdjustments,
        notes,
        resultsJson
      ]
    );

    logActivity({
      userId: payload.userId,
      userName: payload.userName,
      userEmail: payload.userEmail,
      action: ACTIVITY_ACTIONS.CREATE_AUDIT,
      entityType: 'audit',
      entityId: auditId,
      details: {
        type: auditType,
        productsAudited,
        discrepanciesFound,
        totalAdjustments,
      },
    });

    console.log('Audit created with ID:', auditId);
    res.status(201).json({
      ...payload,
      id: auditId,
      audit_date: auditDate,
      audit_type: auditType,
      products_audited: productsAudited,
      discrepancies_found: discrepanciesFound,
      total_adjustments: totalAdjustments,
      results: JSON.parse(resultsJson),
    });
  } catch (error) {
    console.error('Error creating audit:', error);
    res.status(500).json({ error: 'Failed to create audit', details: error.message });
  }
});

// Analytics Routes

// Analytics Routes

app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const validPeriods = ['daily', 'weekly', 'monthly', 'all'];
    const period = validPeriods.includes(req.query.period) ? req.query.period : 'weekly';
    // trendPeriod controls the Sales Overview chart independently
    const trendPeriod = ['weekly', 'monthly'].includes(req.query.trendPeriod) ? req.query.trendPeriod : period;
    const lowStockThreshold = Math.max(1, toInt(req.query.lowStockThreshold, 10));
    const periodDays = period === 'all' ? null : period === 'monthly' ? 30 : period === 'daily' ? 1 : 7;
    const trendDays = trendPeriod === 'monthly' ? 30 : 7;

    const [productRows] = execute(
      `SELECT
        COUNT(*) AS totalProducts,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS outOfStock,
        SUM(CASE WHEN quantity > 0 AND quantity <= ? THEN 1 ELSE 0 END) AS lowStock,
        COALESCE(SUM(quantity), 0) AS totalStock
      FROM products
      WHERE deleted_at IS NULL`,
      [lowStockThreshold]
    );

    const [metricsRows] = execute(
      `SELECT
        COALESCE(SUM(total), 0) AS totalSales,
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', 'start of day') THEN total ELSE 0 END), 0) AS dailySales,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-7 days') THEN total ELSE 0 END), 0) AS weeklySales,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-30 days') THEN total ELSE 0 END), 0) AS monthlySales,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-14 days') AND timestamp < datetime('now', '-7 days') THEN total ELSE 0 END), 0) AS previousWeekSales,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-60 days') AND timestamp < datetime('now', '-30 days') THEN total ELSE 0 END), 0) AS previousMonthSales,
        COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-1 days', 'start of day') AND timestamp < datetime('now', 'start of day') THEN total ELSE 0 END), 0) AS previousDaySales
      FROM transactions
      WHERE archived_at IS NULL`
    );

    const periodCostQuery = period === 'all'
      ? `SELECT COALESCE(SUM(ti.quantity * COALESCE(ti.unit_cost, 0)), 0) AS periodCost
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.archived_at IS NULL`
      : `SELECT COALESCE(SUM(ti.quantity * COALESCE(ti.unit_cost, 0)), 0) AS periodCost
         FROM transaction_items ti
         JOIN transactions t ON t.id = ti.transaction_id
         WHERE t.archived_at IS NULL
           AND t.timestamp >= datetime('now', '-${periodDays} days')`;
    const [periodCostRows] = execute(periodCostQuery);

    const [recentRows] = execute(
      `SELECT
        t.id,
        t.timestamp,
        t.total,
        COALESCE(t.user_name, 'System') AS user_name,
        COUNT(ti.id) AS item_count
      FROM transactions t
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE t.archived_at IS NULL
      GROUP BY t.id, t.timestamp, t.total, t.user_name
      ORDER BY t.timestamp DESC
      LIMIT 4`
    );

    const topRowsQuery = period === 'all'
      ? `SELECT
          ti.product_id AS id,
          COALESCE(p.name, 'Unknown Product') AS name,
          COALESCE(p.category_name, 'Uncategorized') AS category,
          COALESCE(SUM(ti.quantity), 0) AS sales,
          COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN products p ON p.id = ti.product_id
        WHERE t.archived_at IS NULL
        GROUP BY ti.product_id
        ORDER BY sales DESC
        LIMIT 5`
      : `SELECT
          ti.product_id AS id,
          COALESCE(p.name, 'Unknown Product') AS name,
          COALESCE(p.category_name, 'Uncategorized') AS category,
          COALESCE(SUM(ti.quantity), 0) AS sales,
          COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN products p ON p.id = ti.product_id
        WHERE t.archived_at IS NULL
          AND t.timestamp >= datetime('now', '-${periodDays} days')
        GROUP BY ti.product_id
        ORDER BY sales DESC
        LIMIT 5`;
    const [topRows] = execute(topRowsQuery);

    const [trendRows] = execute(
      `SELECT
        date(timestamp) AS sale_date,
        COALESCE(SUM(total), 0) AS total
      FROM transactions
      WHERE archived_at IS NULL
        AND timestamp >= datetime('now', ?)
      GROUP BY date(timestamp)
      ORDER BY sale_date ASC`,
      [`-${trendDays - 1} days`]
    );

    const trendMap = new Map((trendRows || []).map((row) => [row.sale_date, Number(row.total || 0)]));
    const salesTrend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      salesTrend.push({
        date: key,
        total: trendMap.get(key) || 0,
      });
    }

    const metrics = metricsRows?.[0] || {};
    const totalSales = Number(metrics.totalSales || 0);
    const totalTransactions = Number(metrics.totalTransactions || 0);
    const dailySales = Number(metrics.dailySales || 0);
    const weeklySales = Number(metrics.weeklySales || 0);
    const monthlySales = Number(metrics.monthlySales || 0);
    const previousDaySales = Number(metrics.previousDaySales || 0);
    const previousWeekSales = Number(metrics.previousWeekSales || 0);
    const previousMonthSales = Number(metrics.previousMonthSales || 0);
    const dailyGrowth = previousDaySales > 0 ? ((dailySales - previousDaySales) / previousDaySales) * 100 : (dailySales > 0 ? 100 : 0);
    const weeklyGrowth = previousWeekSales > 0 ? ((weeklySales - previousWeekSales) / previousWeekSales) * 100 : (weeklySales > 0 ? 100 : 0);
    const monthlyGrowth = previousMonthSales > 0 ? ((monthlySales - previousMonthSales) / previousMonthSales) * 100 : (monthlySales > 0 ? 100 : 0);
    const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    const periodCost = Number(periodCostRows?.[0]?.periodCost || 0);

    // Determine the revenue for the selected period
    const periodRevenue = period === 'all' ? totalSales : period === 'monthly' ? monthlySales : period === 'daily' ? dailySales : weeklySales;
    const periodGrowth = period === 'all' ? 0 : period === 'monthly' ? monthlyGrowth : period === 'daily' ? dailyGrowth : weeklyGrowth;

    // Count transactions for the selected period
    const periodTransactionsQuery = period === 'all'
      ? `SELECT COUNT(*) AS cnt FROM transactions WHERE archived_at IS NULL`
      : period === 'daily'
        ? `SELECT COUNT(*) AS cnt FROM transactions WHERE archived_at IS NULL AND timestamp >= datetime('now', 'start of day')`
        : `SELECT COUNT(*) AS cnt FROM transactions WHERE archived_at IS NULL AND timestamp >= datetime('now', '-${periodDays} days')`;
    const [periodTransactionRows] = execute(periodTransactionsQuery);
    const periodTransactions = Number(periodTransactionRows?.[0]?.cnt || 0);

    const response = {
      summary: {
        totalProducts: Number(productRows?.[0]?.totalProducts || 0),
        outOfStock: Number(productRows?.[0]?.outOfStock || 0),
        lowStock: Number(productRows?.[0]?.lowStock || 0),
        totalStock: Number(productRows?.[0]?.totalStock || 0),
      },
      salesMetrics: {
        totalSales,
        dailySales,
        weeklySales,
        monthlySales,
        dailyGrowth: Number(dailyGrowth || 0),
        weeklyGrowth: Number(weeklyGrowth || 0),
        monthlyGrowth: Number(monthlyGrowth || 0),
        averageOrderValue,
        totalTransactions,
        periodTransactions,
        // Keep dashboard cost/profit scoped to the selected period for faster queries.
        totalCost: periodCost,
        currentPeriodCost: periodCost,
        grossProfit: periodRevenue - periodCost,
        currentPeriodProfit: periodRevenue - periodCost,
        periodRevenue,
        periodGrowth,
      },
      recentTransactions: (recentRows || []).map((row) => ({
        id: row.id,
        productName: 'Multiple Items',
        date: new Date(row.timestamp).toLocaleDateString(),
        time: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        amount: Number(row.total || 0),
        items: Number(row.item_count || 0),
      })),
      topProducts: (topRows || []).map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        sales: Number(row.sales || 0),
        revenue: Number(row.revenue || 0),
      })),
      salesTrend,
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      transactionPage,
      transactionLimit,
      movementPage,
      movementLimit,
      category,
      paymentMethod,
      minAmount,
      maxAmount,
    } = req.query;

    const txPage = Math.max(1, toInt(transactionPage, 1));
    const txLimit = Math.min(TRANSACTION_MAX_LIMIT, Math.max(1, toInt(transactionLimit, 50)));
    const txOffset = (txPage - 1) * txLimit;
    const mvPage = Math.max(1, toInt(movementPage, 1));
    const mvLimit = Math.min(TRANSACTION_MAX_LIMIT, Math.max(1, toInt(movementLimit, 100)));
    const mvOffset = (mvPage - 1) * mvLimit;
    const normalizedPaymentMethod = typeof paymentMethod === 'string' ? paymentMethod.trim().toLowerCase() : '';
    const normalizedCategory = typeof category === 'string' ? category.trim() : '';
    const minAmountValue = Number(minAmount);
    const maxAmountValue = Number(maxAmount);

    const whereParts = ['t.archived_at IS NULL'];
    const whereParams = [];
    const normalizedStart = normalizeDateStart(startDate);
    const normalizedEnd = normalizeDateEnd(endDate);
    if (normalizedStart && normalizedEnd) {
      whereParts.push('t.timestamp >= ? AND t.timestamp < datetime(?, \'+1 day\')');
      whereParams.push(normalizedStart, normalizedEnd);
    } else if (normalizedStart) {
      whereParts.push('t.timestamp >= ?');
      whereParams.push(normalizedStart);
    } else if (normalizedEnd) {
      whereParts.push('t.timestamp < datetime(?, \'+1 day\')');
      whereParams.push(normalizedEnd);
    }
    if (normalizedPaymentMethod) {
      whereParts.push('LOWER(COALESCE(t.payment_method, \'cash\')) = ?');
      whereParams.push(normalizedPaymentMethod);
    }
    if (Number.isFinite(minAmountValue)) {
      whereParts.push('COALESCE(t.total, 0) >= ?');
      whereParams.push(minAmountValue);
    }
    if (Number.isFinite(maxAmountValue)) {
      whereParts.push('COALESCE(t.total, 0) <= ?');
      whereParams.push(maxAmountValue);
    }
    if (normalizedCategory) {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM transaction_items tfi
        LEFT JOIN products pf ON pf.id = tfi.product_id
        WHERE tfi.transaction_id = t.id
          AND COALESCE(pf.category_name, 'Uncategorized') = ?
      )`);
      whereParams.push(normalizedCategory);
    }
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;
    const itemCategoryClause = normalizedCategory
      ? `AND COALESCE(p.category_name, 'Uncategorized') = ?`
      : '';
    const itemCategoryParams = normalizedCategory ? [normalizedCategory] : [];

    const [dailyRows] = execute(
      `SELECT
        date(t.timestamp) AS date,
        COUNT(DISTINCT t.id) AS transactions,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue,
        COALESCE(SUM(ti.quantity), 0) AS itemsSold
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      LEFT JOIN products p ON p.id = ti.product_id
      ${whereSql}
      ${itemCategoryClause}
      GROUP BY date(t.timestamp)
      ORDER BY date(t.timestamp) ASC`,
      [...whereParams, ...itemCategoryParams]
    );

    const [productRows] = execute(
      `SELECT
        ti.product_id AS productId,
        COALESCE(p.name, 'Unknown Product') AS name,
        COALESCE(p.category_name, 'Uncategorized') AS category,
        COALESCE(SUM(ti.quantity), 0) AS unitsSold,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${whereSql}
      ${itemCategoryClause}
      GROUP BY ti.product_id
      ORDER BY revenue DESC`,
      [...whereParams, ...itemCategoryParams]
    );

    const [categoryRows] = execute(
      `SELECT
        COALESCE(p.category_name, 'Uncategorized') AS category,
        COALESCE(SUM(ti.quantity), 0) AS unitsSold,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${whereSql}
      ${itemCategoryClause}
      GROUP BY COALESCE(p.category_name, 'Uncategorized')
      ORDER BY revenue DESC`,
      [...whereParams, ...itemCategoryParams]
    );

    const [itemTotalRows] = execute(
      `SELECT COALESCE(SUM(ti.quantity), 0) AS totalItemsSold
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${whereSql}
      ${itemCategoryClause}`,
      [...whereParams, ...itemCategoryParams]
    );

    const [txRows] = execute(
      `SELECT id, timestamp, items, total, payment_method, user_name
      FROM transactions t
      ${whereSql}
      ORDER BY t.timestamp DESC
      LIMIT ? OFFSET ?`,
      [...whereParams, txLimit, txOffset]
    );
    const [txCountRows] = execute(`SELECT COUNT(*) AS total FROM transactions t ${whereSql}`, whereParams);

    const movementWhereParts = ['1=1'];
    const movementWhereParams = [];
    if (normalizedStart && normalizedEnd) {
      movementWhereParts.push('sm.created_at >= ? AND sm.created_at < datetime(?, \'+1 day\')');
      movementWhereParams.push(normalizedStart, normalizedEnd);
    } else if (normalizedStart) {
      movementWhereParts.push('sm.created_at >= ?');
      movementWhereParams.push(normalizedStart);
    } else if (normalizedEnd) {
      movementWhereParts.push('sm.created_at < datetime(?, \'+1 day\')');
      movementWhereParams.push(normalizedEnd);
    }
    if (normalizedCategory) {
      movementWhereParts.push(`COALESCE(p.category_name, 'Uncategorized') = ?`);
      movementWhereParams.push(normalizedCategory);
    }
    const movementWhereSql = `WHERE ${movementWhereParts.join(' AND ')}`;

    const [movementRows] = execute(
      `SELECT
        id, timestamp, product_id, product_name, category, movement_type, quantity,
        unit_price, total_value, reference, batch_number, expiry_date, description
      FROM (
        SELECT
          t.id || '-' || ti.product_id AS id,
          t.timestamp AS timestamp,
          ti.product_id AS product_id,
          COALESCE(p.name, 'Unknown Product') AS product_name,
          COALESCE(p.category_name, 'Uncategorized') AS category,
          'SALE' AS movement_type,
          -ti.quantity AS quantity,
          COALESCE(ti.unit_price, 0) AS unit_price,
          COALESCE(ti.quantity * COALESCE(ti.unit_price, 0), 0) AS total_value,
          t.id AS reference,
          NULL AS batch_number,
          NULL AS expiry_date,
          'Sale - Transaction ' || t.id AS description
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN products p ON p.id = ti.product_id
        ${whereSql}
        ${itemCategoryClause}
        UNION ALL
        SELECT
          sm.id AS id,
          sm.created_at AS timestamp,
          sm.product_id AS product_id,
          sm.product_name AS product_name,
          COALESCE(p.category_name, 'Uncategorized') AS category,
          UPPER(sm.movement_type) AS movement_type,
          CASE
            WHEN LOWER(sm.movement_type) IN ('out', 'stock_out', 'damage', 'write_off') THEN -sm.quantity
            ELSE sm.quantity
          END AS quantity,
          COALESCE(p.cost, 0) AS unit_price,
          COALESCE(sm.quantity * COALESCE(p.cost, 0), 0) AS total_value,
          COALESCE(sm.reference_number, sm.id) AS reference,
          sm.batch_number AS batch_number,
          sm.expiry_date AS expiry_date,
          COALESCE(sm.notes, UPPER(sm.movement_type) || ' movement') AS description
        FROM stock_movements sm
        LEFT JOIN products p ON p.id = sm.product_id
        ${movementWhereSql}
          AND LOWER(sm.movement_type) != 'sale'
      )
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?`,
      [...whereParams, ...itemCategoryParams, ...movementWhereParams, mvLimit, mvOffset]
    );
    const [movementCountRows] = execute(
      `SELECT SUM(total) AS total FROM (
        SELECT COUNT(*) AS total
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN products p ON p.id = ti.product_id
        ${whereSql}
        ${itemCategoryClause}
        UNION ALL
        SELECT COUNT(*) AS total
        FROM stock_movements sm
        LEFT JOIN products p ON p.id = sm.product_id
        ${movementWhereSql}
          AND LOWER(sm.movement_type) != 'sale'
      )`,
      [...whereParams, ...itemCategoryParams, ...movementWhereParams]
    );

    const [restockingRows] = execute(
      `SELECT
        id AS productId,
        name AS productName,
        COALESCE(category_name, 'Uncategorized') AS category,
        quantity AS currentStock,
        CASE WHEN quantity <= ? THEN 'LOW_STOCK' ELSE 'ADEQUATE' END AS status
      FROM products
      WHERE deleted_at IS NULL
      ORDER BY quantity ASC`,
      [10]
    );
    const [categoryOptionRows] = execute(
      `SELECT DISTINCT COALESCE(category_name, 'Uncategorized') AS category
      FROM products
      WHERE deleted_at IS NULL
      ORDER BY category ASC`
    );

    const totalTransactions = Number(txCountRows?.[0]?.total || 0);
    const totalRevenue = (dailyRows || []).reduce((sum, row) => sum + Number(row.revenue || 0), 0);

    res.json({
      sales: {
        dailySales: (dailyRows || []).map((row) => ({
          date: row.date,
          transactions: Number(row.transactions || 0),
          revenue: Number(row.revenue || 0),
          itemsSold: Number(row.itemsSold || 0),
        })),
        productSales: (productRows || []).map((row) => ({
          productId: row.productId,
          name: row.name,
          category: row.category,
          unitsSold: Number(row.unitsSold || 0),
          revenue: Number(row.revenue || 0),
        })),
        categorySales: (categoryRows || []).map((row) => ({
          category: row.category,
          unitsSold: Number(row.unitsSold || 0),
          revenue: Number(row.revenue || 0),
        })),
        summary: {
          totalTransactions,
          totalRevenue,
          totalItemsSold: Number(itemTotalRows?.[0]?.totalItemsSold || 0),
          avgTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        },
      },
      transactions: {
        items: (txRows || []).map((row) => ({
          ...row,
          items: row.items ? JSON.parse(row.items) : [],
          paymentMethod: row.payment_method || 'cash',
        })),
        total: Number(txCountRows?.[0]?.total || 0),
        page: txPage,
        limit: txLimit,
        hasNextPage: txOffset + (txRows?.length || 0) < Number(txCountRows?.[0]?.total || 0),
      },
      stockMovement: {
        items: (movementRows || []).map((row) => ({
          id: row.id,
          timestamp: row.timestamp,
          productId: row.product_id,
          productName: row.product_name,
          category: row.category,
          type: row.movement_type,
          quantity: Number(row.quantity || 0),
          unitPrice: Number(row.unit_price || 0),
          totalValue: Number(row.total_value || 0),
          reference: row.reference,
          batchNumber: row.batch_number || '',
          expiryDate: row.expiry_date || '',
          description: row.description,
        })),
        total: Number(movementCountRows?.[0]?.total || 0),
        page: mvPage,
        limit: mvLimit,
        hasNextPage: mvOffset + (movementRows?.length || 0) < Number(movementCountRows?.[0]?.total || 0),
      },
      restocking: restockingRows || [],
      availableCategories: (categoryOptionRows || []).map((row) => row.category).filter(Boolean),
    });
  } catch (error) {
    console.error('Error fetching reports summary:', error);
    res.status(500).json({ error: 'Failed to fetch reports summary' });
  }
});

app.get('/api/statistical-reports/summary', async (req, res) => {
  try {
    const period = ['weekly', 'monthly', 'quarterly', 'yearly'].includes(req.query.period)
      ? req.query.period
      : 'monthly';
    const deadStockDays = Math.max(1, toInt(req.query.deadStockDays, 60));
    const periodDays = period === 'weekly' ? 7 : period === 'monthly' ? 30 : period === 'quarterly' ? 90 : 365;

    // Year selection is only meaningful for the yearly view. Default to the current year.
    let selectedYear = null;
    let comparisonYear = null;
    let yearlyRangeStart = null;
    let yearlyRangeEnd = null;
    let yearlyPreviousStart = null;
    let yearlyPreviousEnd = null;
    if (period === 'yearly') {
      const parsedYear = toInt(req.query.year, 0);
      const nowYear = new Date().getFullYear();
      selectedYear = parsedYear >= 2000 && parsedYear <= nowYear + 1 ? parsedYear : nowYear;
      comparisonYear = selectedYear - 1;
      yearlyRangeStart = `${selectedYear}-01-01 00:00:00`;
      yearlyRangeEnd = `${selectedYear + 1}-01-01 00:00:00`;
      yearlyPreviousStart = `${comparisonYear}-01-01 00:00:00`;
      yearlyPreviousEnd = `${selectedYear}-01-01 00:00:00`;
    }

    let salesDataResult = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, yearly: 0 };
    if (period === 'yearly') {
      const [salesRows] = execute(
        `SELECT COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN total ELSE 0 END), 0) AS yearly
         FROM transactions
         WHERE archived_at IS NULL`,
        [yearlyRangeStart, yearlyRangeEnd]
      );
      const yearlyTotal = Number(salesRows?.[0]?.yearly || 0);
      salesDataResult = {
        yearly: yearlyTotal,
        quarterly: yearlyTotal / 4,
        monthly: yearlyTotal / 12,
        weekly: yearlyTotal / 52,
        daily: yearlyTotal / 365,
      };
    } else {
      const [salesRows] = execute(
        `SELECT
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', 'start of day') THEN total ELSE 0 END), 0) AS daily,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-7 days') THEN total ELSE 0 END), 0) AS weekly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-30 days') THEN total ELSE 0 END), 0) AS monthly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-90 days') THEN total ELSE 0 END), 0) AS quarterly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-365 days') THEN total ELSE 0 END), 0) AS yearly
        FROM transactions
        WHERE archived_at IS NULL`
      );
      salesDataResult = {
        daily: Number(salesRows?.[0]?.daily || 0),
        weekly: Number(salesRows?.[0]?.weekly || 0),
        monthly: Number(salesRows?.[0]?.monthly || 0),
        quarterly: Number(salesRows?.[0]?.quarterly || 0),
        yearly: Number(salesRows?.[0]?.yearly || 0),
      };
    }

    const rangeStart = period === 'yearly' ? yearlyRangeStart : null;
    const rangeEnd = period === 'yearly' ? yearlyRangeEnd : null;
    const itemsWhereClause = period === 'yearly'
      ? 'WHERE t.archived_at IS NULL AND t.timestamp >= ? AND t.timestamp < ?'
      : 'WHERE t.archived_at IS NULL AND t.timestamp >= datetime(\'now\', ?)';
    const itemsWhereParams = period === 'yearly'
      ? [rangeStart, rangeEnd]
      : [`-${periodDays} days`];

    const [revenueRows] = execute(
      `SELECT
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_cost, 0)), 0) AS cost,
        COALESCE(SUM(ti.quantity), 0) AS itemsSold
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      ${itemsWhereClause}`,
      itemsWhereParams
    );

    const [topRows] = execute(
      `SELECT
        ti.product_id AS id,
        COALESCE(p.name, 'Unknown Product') AS name,
        COALESCE(SUM(ti.quantity), 0) AS quantity,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${itemsWhereClause}
      GROUP BY ti.product_id
      ORDER BY quantity DESC
      LIMIT 10`,
      itemsWhereParams
    );

    const [categoryRows] = execute(
      `SELECT
        COALESCE(p.category_name, 'Uncategorized') AS category,
        COALESCE(SUM(ti.quantity), 0) AS sales,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${itemsWhereClause}
      GROUP BY COALESCE(p.category_name, 'Uncategorized')
      ORDER BY revenue DESC`,
      itemsWhereParams
    );

    let salesTrend = [];
    if (period === 'yearly') {
      // Monthly roll-up: 12 rows instead of 365 for the whole year.
      const [monthlyTrendRows] = execute(
        `SELECT
          strftime('%Y-%m', timestamp) AS month_key,
          COALESCE(SUM(total), 0) AS total
        FROM transactions
        WHERE archived_at IS NULL
          AND timestamp >= ?
          AND timestamp < ?
        GROUP BY strftime('%Y-%m', timestamp)
        ORDER BY month_key ASC`,
        [yearlyRangeStart, yearlyRangeEnd]
      );
      const monthlyMap = new Map((monthlyTrendRows || []).map((row) => [row.month_key, Number(row.total || 0)]));
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let m = 0; m < 12; m++) {
        const key = `${selectedYear}-${String(m + 1).padStart(2, '0')}`;
        salesTrend.push({
          date: key,
          label: `${monthLabels[m]} ${selectedYear}`,
          sales: monthlyMap.get(key) || 0,
        });
      }
    } else {
      const [trendRows] = execute(
        `SELECT
          date(timestamp) AS sale_date,
          COALESCE(SUM(total), 0) AS total
        FROM transactions
        WHERE archived_at IS NULL
          AND timestamp >= datetime('now', ?)
        GROUP BY date(timestamp)
        ORDER BY sale_date ASC`,
        [`-${periodDays - 1} days`]
      );

      const trendMap = new Map((trendRows || []).map((row) => [row.sale_date, Number(row.total || 0)]));
      for (let i = periodDays - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        salesTrend.push({
          date: key,
          label: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          sales: trendMap.get(key) || 0,
        });
      }
    }

    let growthPayload;
    let hasPreviousData;
    if (period === 'yearly') {
      const [yearlyGrowthRows] = execute(
        `SELECT
          COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN total ELSE 0 END), 0) AS currentYearly,
          COALESCE(SUM(CASE WHEN timestamp >= ? AND timestamp < ? THEN total ELSE 0 END), 0) AS previousYearly
        FROM transactions
        WHERE archived_at IS NULL`,
        [yearlyRangeStart, yearlyRangeEnd, yearlyPreviousStart, yearlyPreviousEnd]
      );
      const yg = yearlyGrowthRows?.[0] || {};
      const currentYearly = Number(yg.currentYearly || 0);
      const previousYearly = Number(yg.previousYearly || 0);
      const yearlyGrowth = previousYearly > 0
        ? ((currentYearly - previousYearly) / previousYearly) * 100
        : (currentYearly > 0 ? 100 : 0);
      growthPayload = {
        weekly: null,
        monthly: null,
        quarterly: null,
        yearly: Number(yearlyGrowth),
      };
      hasPreviousData = {
        weekly: false,
        monthly: false,
        quarterly: false,
        yearly: previousYearly > 0,
      };
    } else {
      const [growthRows] = execute(
        `SELECT
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', 'start of day') THEN total ELSE 0 END), 0) AS currentDaily,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-1 days', 'start of day') AND timestamp < datetime('now', 'start of day') THEN total ELSE 0 END), 0) AS previousDaily,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-7 days') THEN total ELSE 0 END), 0) AS currentWeekly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-14 days') AND timestamp < datetime('now', '-7 days') THEN total ELSE 0 END), 0) AS previousWeekly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-30 days') THEN total ELSE 0 END), 0) AS currentMonthly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-60 days') AND timestamp < datetime('now', '-30 days') THEN total ELSE 0 END), 0) AS previousMonthly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-90 days') THEN total ELSE 0 END), 0) AS currentQuarterly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-180 days') AND timestamp < datetime('now', '-90 days') THEN total ELSE 0 END), 0) AS previousQuarterly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-365 days') THEN total ELSE 0 END), 0) AS currentYearly,
          COALESCE(SUM(CASE WHEN timestamp >= datetime('now', '-730 days') AND timestamp < datetime('now', '-365 days') THEN total ELSE 0 END), 0) AS previousYearly
        FROM transactions
        WHERE archived_at IS NULL`
      );

      const growthSource = growthRows?.[0] || {};
      const growthFor = (current, previous) => previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0);
      growthPayload = {
        daily: Number(growthFor(Number(growthSource.currentDaily || 0), Number(growthSource.previousDaily || 0))),
        weekly: Number(growthFor(Number(growthSource.currentWeekly || 0), Number(growthSource.previousWeekly || 0))),
        monthly: Number(growthFor(Number(growthSource.currentMonthly || 0), Number(growthSource.previousMonthly || 0))),
        quarterly: Number(growthFor(Number(growthSource.currentQuarterly || 0), Number(growthSource.previousQuarterly || 0))),
        yearly: Number(growthFor(Number(growthSource.currentYearly || 0), Number(growthSource.previousYearly || 0))),
      };
      hasPreviousData = {
        daily: Number(growthSource.previousDaily || 0) > 0,
        weekly: Number(growthSource.previousWeekly || 0) > 0,
        monthly: Number(growthSource.previousMonthly || 0) > 0,
        quarterly: Number(growthSource.previousQuarterly || 0) > 0,
        yearly: Number(growthSource.previousYearly || 0) > 0,
      };
    }

    // Dead stock: use a pre-aggregated subquery so we only group transaction_items once.
    const [deadStockRows] = execute(
      `SELECT
        p.id,
        p.name,
        p.category_name,
        p.quantity,
        p.cost,
        p.price,
        agg.lastSold,
        COALESCE(agg.totalSold, 0) AS totalSold
      FROM products p
      LEFT JOIN (
        SELECT
          ti.product_id,
          MAX(t.timestamp) AS lastSold,
          SUM(ti.quantity) AS totalSold
        FROM transaction_items ti
        JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.archived_at IS NULL
        GROUP BY ti.product_id
      ) agg ON agg.product_id = p.id
      WHERE p.deleted_at IS NULL
        AND p.quantity > 0`
    );

    const cutoffMs = Date.now() - deadStockDays * 24 * 60 * 60 * 1000;
    const deadStock = (deadStockRows || [])
      .map((row) => {
        const quantity = Number(row.quantity || 0);
        const cost = Number(row.cost || 0);
        const price = Number(row.price || 0);
        const lastSoldDate = row.lastSold ? new Date(row.lastSold) : null;
        const daysSinceLastSale = lastSoldDate ? Math.floor((Date.now() - lastSoldDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          id: row.id,
          name: row.name,
          category_name: row.category_name,
          quantity,
          cost,
          price,
          totalSold: Number(row.totalSold || 0),
          lastSold: row.lastSold,
          daysSinceLastSale,
          tiedUpCost: cost * quantity,
          tiedUpRetail: price * quantity,
        };
      })
      .filter((row) => !row.lastSold || new Date(row.lastSold).getTime() < cutoffMs)
      .sort((a, b) => Number(b.tiedUpRetail || 0) - Number(a.tiedUpRetail || 0));

    const [abcRows] = execute(
      `SELECT
        ti.product_id AS id,
        COALESCE(p.name, 'Unknown Product') AS name,
        COALESCE(SUM(ti.quantity), 0) AS quantity,
        COALESCE(SUM(ti.quantity * COALESCE(ti.unit_price, 0)), 0) AS revenue
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti.transaction_id
      LEFT JOIN products p ON p.id = ti.product_id
      ${itemsWhereClause}
      GROUP BY ti.product_id
      ORDER BY revenue DESC`,
      itemsWhereParams
    );

    // Available years are needed so the client can populate the year selector.
    let availableYears = [];
    if (period === 'yearly') {
      const [yearBoundsRows] = execute(
        `SELECT
          CAST(strftime('%Y', MIN(timestamp)) AS INTEGER) AS minYear,
          CAST(strftime('%Y', MAX(timestamp)) AS INTEGER) AS maxYear
        FROM transactions
        WHERE archived_at IS NULL`
      );
      const bounds = yearBoundsRows?.[0] || {};
      const minY = Number.isFinite(Number(bounds.minYear)) ? Number(bounds.minYear) : null;
      const maxY = Number.isFinite(Number(bounds.maxYear)) ? Number(bounds.maxYear) : null;
      const currentYear = new Date().getFullYear();
      const start = minY || currentYear;
      const end = Math.max(maxY || currentYear, currentYear);
      for (let y = end; y >= start; y--) {
        availableYears.push(y);
      }
    }

    const totalAbcRevenue = (abcRows || []).reduce((sum, row) => sum + Number(row.revenue || 0), 0);
    let cumulative = 0;
    const abcAnalysis = (abcRows || []).map((row, index) => {
      const revenue = Number(row.revenue || 0);
      cumulative += revenue;
      const sharePct = totalAbcRevenue > 0 ? (revenue / totalAbcRevenue) * 100 : 0;
      const cumulativePct = totalAbcRevenue > 0 ? (cumulative / totalAbcRevenue) * 100 : 0;
      let bucket = 'C';
      if (cumulativePct <= 80) bucket = 'A';
      else if (cumulativePct <= 95) bucket = 'B';
      return {
        id: row.id,
        name: row.name,
        quantity: Number(row.quantity || 0),
        revenue,
        rank: index + 1,
        sharePct,
        cumulativePct,
        bucket,
      };
    });

    const revenueSource = revenueRows?.[0] || {};
    const revenue = Number(revenueSource.revenue || 0);
    const cost = Number(revenueSource.cost || 0);

    res.json({
      salesData: salesDataResult,
      revenueData: {
        revenue,
        cost,
        profit: revenue - cost,
        margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
        itemsSold: Number(revenueSource.itemsSold || 0),
      },
      topProducts: (topRows || []).map((row) => ({
        id: row.id,
        name: row.name,
        quantity: Number(row.quantity || 0),
        revenue: Number(row.revenue || 0),
      })),
      salesTrend,
      categoryDistribution: (categoryRows || []).map((row) => ({
        category: row.category,
        sales: Number(row.sales || 0),
        revenue: Number(row.revenue || 0),
      })),
      salesGrowth: growthPayload,
      hasPreviousData,
      deadStock,
      abcAnalysis,
      selectedYear,
      comparisonYear,
      availableYears,
    });
  } catch (error) {
    console.error('Error fetching statistical reports summary:', error);
    res.status(500).json({ error: 'Failed to fetch statistical reports summary' });
  }
});

// Legacy sales analytics endpoint (kept for compatibility)
app.get('/api/analytics/sales', async (req, res) => {
  try {
    const { period = 'monthly' } = req.query;

    // Calculate date range based on period
    const now = new Date();
    let startDate;

    switch (period) {
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarterly':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // monthly
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const [transactions] = execute(
      'SELECT * FROM transactions WHERE archived_at IS NULL AND timestamp >= ? ORDER BY timestamp DESC',
      [startDate.toISOString()]
    );

    // Parse items for each transaction
    const parsedTransactions = transactions.map(transaction => ({
      ...transaction,
      items: transaction.items ? JSON.parse(transaction.items) : []
    }));

    console.log('Sales analytics fetched for period:', period, 'transactions:', parsedTransactions.length);
    res.json(parsedTransactions);
  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sales analytics' });
  }
});

// Serve built frontend files (must be AFTER all API routes)
const distPath = process.env.DIST_DIR
  ? path.resolve(process.env.DIST_DIR)
  : path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  // Serve static assets (JS, CSS, images, etc.)
  // Only serve if not an API or uploads route
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    // Try to serve static file first
    const filePath = path.join(distPath, req.path === '/' ? 'index.html' : req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    // If file doesn't exist and it's a GET request, serve index.html (for React Router)
    if (req.method === 'GET') {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
  console.log('✓ Frontend files will be served from dist/');
} else {
  console.warn('⚠️  Frontend not built. Run "npm run build" to build the frontend.');
  console.warn('   For development, run "npm run dev" in a separate terminal.');
}

const PORT = process.env.PORT || 3001;

// Initialize database and start server
async function startServer() {
  try {
    console.log('Initializing database...');
    await initializeDatabase();
    dbInitialized = true;
    console.log('✓ Database initialization complete');

    // Run cleanup tasks after database is ready
    cleanupOldArchivedTransactions();
    setInterval(cleanupOldArchivedTransactions, 24 * 60 * 60 * 1000);

    cleanupOrphanedImages();
    setInterval(cleanupOrphanedImages, 6 * 60 * 60 * 1000);

    // Daily batch-expiry alert scan
    checkExpiringBatches();
    setInterval(checkExpiringBatches, 24 * 60 * 60 * 1000);

    server.listen(PORT, () => {
      console.log(`Server & WebSocket are running on port ${PORT}`);
      console.log(`Open your browser: http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  }
}


// ════════════════════════════════════════════════════════════
// BACKUP & RESTORE ROUTES (Admin-only)
// ════════════════════════════════════════════════════════════

// Helper to verify admin role by ID
const verifyAdminAccess = (adminId) => {
  if (!adminId) return false;
  try {
    const [rows] = execute('SELECT role FROM users WHERE id = ?', [adminId]);
    return rows && rows.length > 0 && rows[0].role === 'admin';
  } catch (e) {
    console.error('Error verifying admin access:', e);
    return false;
  }
};

// Helper to get DB and uploads paths
const getBackupPaths = () => {
  const dbPath = path.join(process.cwd(), 'data', 'pos_inventory.db');
  const uploadsPath = path.join(process.cwd(), 'uploads');
  return { dbPath, uploadsPath };
};

// Helper to create an automatic backup file on the server
const createAutoBackup = async () => {
  const { dbPath, uploadsPath } = getBackupPaths();
  const zip = new AdmZip();

  // Create temporary directory for stripping users
  const tempDir = path.join(process.cwd(), 'data', `temp_backup_auto_${Date.now()}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempDbPath = path.join(tempDir, 'pos_inventory.db');

  try {
    if (fs.existsSync(dbPath)) {
      await db.backup(tempDbPath);
      const { default: Database } = await import('better-sqlite3');
      const tempDb = new Database(tempDbPath);
      tempDb.exec('DELETE FROM users');
      tempDb.close();
      zip.addLocalFile(tempDbPath, 'database');
    }

    if (fs.existsSync(uploadsPath)) {
      zip.addLocalFolder(uploadsPath, 'uploads');
    }
  } catch (err) {
    console.error('Failed to create stripped DB backup:', err);
    // fallback or fail
  } finally {
    // Cleanup temp files
    try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch { }
    try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir); } catch { }
  }

  const meta = JSON.stringify({
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    appName: 'INVENTRA',
    type: 'auto_backup_before_delete'
  }, null, 2);
  zip.addFile('metadata.json', Buffer.from(meta));

  const backupsDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const date = new Date().toISOString().replace(/:/g, '-');
  const backupPath = path.join(backupsDir, `INVENTRA-auto-backup-${date}.zip`);

  // writeZip is synchronous
  zip.writeZip(backupPath);
  return backupPath;
};

// GET /api/backup/create — streams zip as download
app.get('/api/backup/create', async (req, res) => {
  const { adminId } = req.query;

  if (!verifyAdminAccess(adminId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { dbPath, uploadsPath } = getBackupPaths();
    const zip = new AdmZip();

    // Create temporary directory for stripping users
    const tempDir = path.join(process.cwd(), 'data', `temp_backup_manual_${Date.now()}`);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const tempDbPath = path.join(tempDir, 'pos_inventory.db');

    try {
      if (fs.existsSync(dbPath)) {
        await db.backup(tempDbPath);
        const { default: Database } = await import('better-sqlite3');
        const tempDb = new Database(tempDbPath);
        tempDb.exec('DELETE FROM users');
        tempDb.close();
        zip.addLocalFile(tempDbPath, 'database');
      }

      if (fs.existsSync(uploadsPath)) {
        zip.addLocalFolder(uploadsPath, 'uploads');
      }
    } finally {
      // Cleanup temp files
      try { if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath); } catch { }
      try { if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir); } catch { }
    }

    // Add metadata
    const meta = JSON.stringify({
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      appName: 'INVENTRA'
    }, null, 2);
    zip.addFile('metadata.json', Buffer.from(meta));

    const zipBuffer = zip.toBuffer();
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="INVENTRA-backup-${date}.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Multer storage for restore uploads (temp folder)
const restoreUpload = multer({ dest: path.join(process.cwd(), 'tmp_restore') });

// POST /api/backup/restore — accepts zip, replaces DB + uploads
app.post('/api/backup/restore', restoreUpload.single('backup'), async (req, res) => {
  const { adminId } = req.body;

  if (!verifyAdminAccess(adminId)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ error: 'Admin access required' });
  }

  if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });

  try {
    const zip = new AdmZip(req.file.path);
    const entries = zip.getEntries().map(e => e.entryName);

    // Validate it's a real INVENTRA backup
    if (!entries.includes('metadata.json')) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid backup file: missing metadata.json' });
    }

    const metaEntry = zip.readAsText('metadata.json');
    const meta = JSON.parse(metaEntry);
    if (meta.appName !== 'INVENTRA') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'This is not an INVENTRA backup file' });
    }

    const { dbPath, uploadsPath } = getBackupPaths();

    // Create temporary restore file
    const tempDbPath = path.join(process.cwd(), 'tmp_restore', `pos_inventory_restore_${Date.now()}.db`);
    fs.mkdirSync(path.dirname(tempDbPath), { recursive: true });
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

    // Extract database
    const dbEntry = zip.getEntry('database/pos_inventory.db');
    if (dbEntry) {
      fs.writeFileSync(tempDbPath, dbEntry.getData());

      // Attach database trigger
      db.exec(`ATTACH DATABASE '${tempDbPath.replace(/'/g, "''")}' AS backup_db`);
      db.exec('PRAGMA foreign_keys = OFF');

      try {
        db.transaction(() => {
          // Get all tables in backup and current database
          const backupTablesStmt = db.prepare("SELECT name FROM backup_db.sqlite_master WHERE type='table'");
          const mainTablesStmt = db.prepare("SELECT name FROM main.sqlite_master WHERE type='table'");
          const backupTables = backupTablesStmt.all();
          const mainTables = mainTablesStmt.all();
          const tableNames = backupTables.map(t => t.name);
          const mainTableSet = new Set(mainTables.map(t => t.name));

          console.log('[Restore] Tables found in backup:', tableNames);

          for (const tableName of tableNames) {
            // Skip users, sqlite internal tables
            if (tableName === 'users' || tableName === 'sqlite_sequence') {
              console.log(`[Restore] Skipping table [${tableName}] for preservation.`);
              continue;
            }

            // Prevent malformed names from being used in dynamic SQL
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
              console.log(`[Restore] Skipping table [${tableName}] due to invalid name.`);
              continue;
            }

            // Skip tables that do not exist in current schema
            if (!mainTableSet.has(tableName)) {
              console.log(`[Restore] Skipping table [${tableName}] because it does not exist in current database.`);
              continue;
            }

            console.log(`[Restore] Restoring table [${tableName}]...`);

            const mainColumns = db.prepare(`PRAGMA main.table_info(${tableName})`).all().map(col => col.name);
            const backupColumns = db.prepare(`PRAGMA backup_db.table_info(${tableName})`).all().map(col => col.name);
            const backupColumnSet = new Set(backupColumns);

            const insertColumns = [];
            const selectExpressions = [];

            for (const col of mainColumns) {
              if (backupColumnSet.has(col)) {
                insertColumns.push(col);
                selectExpressions.push(col);
                continue;
              }

              // Backward/forward compatibility for product availability naming
              if (col === 'status' && backupColumnSet.has('availability')) {
                insertColumns.push('status');
                selectExpressions.push(`CASE
                  WHEN lower(trim(availability)) IN ('unavailable', 'not available') THEN 'unavailable'
                  ELSE 'available'
                END AS status`);
                continue;
              }

              if (col === 'availability' && backupColumnSet.has('status')) {
                insertColumns.push('availability');
                selectExpressions.push(`CASE
                  WHEN lower(trim(status)) IN ('unavailable', 'not available') THEN 'unavailable'
                  ELSE 'available'
                END AS availability`);
                continue;
              }
            }

            if (insertColumns.length === 0) {
              console.log(`[Restore] Skipping table [${tableName}] because no compatible columns were found.`);
              continue;
            }

            // Clear current table
            db.prepare(`DELETE FROM main.${tableName}`).run();
            // Insert from backup using compatible columns only
            const insertSql = `INSERT INTO main.${tableName} (${insertColumns.join(', ')})
              SELECT ${selectExpressions.join(', ')}
              FROM backup_db.${tableName}`;
            db.prepare(insertSql).run();
          }
        })();
        console.log('[Restore] ✓ Selective restore complete');
      } finally {
        // Detach and cleanup even on errors
        db.exec('PRAGMA foreign_keys = ON');
        db.exec('DETACH DATABASE backup_db');
        try { fs.unlinkSync(tempDbPath); } catch (e) { }
      }
    }

    // Extract uploads folder
    const uploadEntries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/') && !e.isDirectory);
    for (const entry of uploadEntries) {
      const destPath = path.join(process.cwd(), entry.entryName);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }

    // Cleanup temp uploaded zip file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: 'Backup restored successfully' });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/delete-selective — deletes chosen data categories
app.post('/api/backup/delete-selective', async (req, res) => {
  const { categories = [], adminPassword, confirmText, adminId } = req.body;

  if (!verifyAdminAccess(adminId)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Validate confirmation phrase
  if (confirmText !== 'I CONFIRM THE DELETION') {
    return res.status(400).json({ error: 'Confirmation phrase does not match' });
  }

  // Validate admin password
  try {
    const [userRows] = execute('SELECT password_hash FROM users WHERE id = ?', [adminId]);
    if (!userRows || userRows.length === 0) return res.status(403).json({ error: 'Admin user not found' });
    const valid = await bcrypt.compare(adminPassword, userRows[0].password_hash);
    if (!valid) return res.status(403).json({ error: 'Incorrect admin password' });
  } catch (err) {
    return res.status(500).json({ error: 'Password verification failed' });
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: 'No categories specified' });
  }

  // CREATE AUTO BACKUP BEFORE DELETION FOR SAFETY
  let backupFile = null;
  try {
    backupFile = await createAutoBackup();
    console.log('Auto backup created before deletion:', backupFile);
  } catch (backupErr) {
    console.error('Auto backup failed, aborting deletion:', backupErr);
    return res.status(500).json({ error: 'Failed to create backup before deletion. Deletion aborted for safety.' });
  }

  const deleted = [];

  try {
    const tableMap = {
      transactions: ['DELETE FROM transaction_items', 'DELETE FROM transactions'],
      products: ['DELETE FROM products'],
      categories: ['DELETE FROM categories'],
      suppliers: ['DELETE FROM suppliers'],
      purchase_orders: ['DELETE FROM purchase_order_items', 'DELETE FROM purchase_orders'],
      stock_adjustments: ['DELETE FROM stock_adjustments'],
      activity_logs: ['DELETE FROM activity_logs'],
      audit_logs: ['DELETE FROM audits'],
    };

    db.exec('PRAGMA foreign_keys = OFF');
    try {
      db.transaction(() => {
        for (const cat of categories) {
          if (cat === 'product_images') continue; // handled separately
          if (tableMap[cat]) {
            for (const sql of tableMap[cat]) {
              console.log('Executing:', sql);
              db.prepare(sql).run();
            }
            deleted.push(cat);
          }
        }
      })();
    } finally {
      db.exec('PRAGMA foreign_keys = ON');
    }

    // Delete product images separately (filesystem)
    if (categories.includes('product_images')) {
      const uploadsPath = path.join(process.cwd(), 'uploads', 'products');
      if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        for (const file of files) {
          try { fs.unlinkSync(path.join(uploadsPath, file)); } catch { }
        }
      }
      deleted.push('product_images');
    }

    res.json({ success: true, deleted, autoBackup: backupFile ? path.basename(backupFile) : null });
  } catch (err) {
    console.error('Selective delete error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ════════════════════════════════════════════════════════════

startServer();


export default app; 
