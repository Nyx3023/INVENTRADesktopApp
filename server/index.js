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
  CREATE_PURCHASE_ORDER: 'CREATE_PURCHASE_ORDER',
  RECEIVE_PURCHASE_ORDER: 'RECEIVE_PURCHASE_ORDER',
  CANCEL_PURCHASE_ORDER: 'CANCEL_PURCHASE_ORDER',
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  CREATE_AUDIT: 'CREATE_AUDIT',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  PRINT_RECEIPT: 'PRINT_RECEIPT',
};

// Activity logs table is created by schema initialization

// Helper function to extract user info from request
function getUserFromRequest(req) {
  const user = req.user || req.session?.user || null;
  return {
    id: user?.id || req.body?.userId || req.query?.userId || null,
    name: user?.name || req.body?.userName || req.query?.userName || 'System',
    email: user?.email || req.body?.userEmail || req.query?.userEmail || null,
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
    // Use product name if provided, otherwise use timestamp
    let baseFilename = 'product';

    if (req.body && req.body.productName) {
      // Sanitize product name for filename
      baseFilename = req.body.productName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/^-+|-+$/g, '')       // Remove leading/trailing hyphens
        .substring(0, 50);              // Limit length
    }

    // Add timestamp to ensure uniqueness
    const timestamp = Date.now();
    const filename = `${baseFilename}-${timestamp}${path.extname(file.originalname)}`;
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
      'quantity, barcode, image_url as imageUrl, status ' +
      'FROM products WHERE deleted_at IS NULL'
    );
    console.log('Products fetched:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
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

    execute(
      `INSERT INTO products (
        id, name, description, category_name, 
        price, cost, quantity,
        barcode, image_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        product.name,
        product.description,
        categoryName, // Use validated/created category
        product.price,
        product.cost || 0,
        product.quantity,
        barcodeValue,
        product.imageUrl,
        product.status || 'available'
      ]
    );

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

    res.status(201).json({ id, ...product });
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
      'quantity, ' +
      'barcode, image_url as imageUrl ' +
      'FROM products WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (rows.length === 0) {
      console.log('Product not found:', id);
      res.status(404).json({ error: 'Product not found' });
    } else {
      console.log('Product fetched:', rows[0]);
      res.json(rows[0]);
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

// Purchase Orders
// Generate PO number in format: MMDDYY-HHMM-#
async function generatePONumber() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const dateTimePrefix = `${month}${day}${year}-${hours}${minutes}`;

  // Get count of POs created with this date-time prefix
  const [[result]] = execute(
    `SELECT COUNT(*) as count FROM purchase_orders WHERE id LIKE ?`,
    [`${dateTimePrefix}-%`]
  );

  const increment = (result.count || 0) + 1;
  return `${dateTimePrefix}-${increment}`;
}

// Generate Transaction number in format: TXN-MMDDYY-HHMM-#
async function generateTransactionNumber() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const dateTimePrefix = `TXN-${month}${day}${year}-${hours}${minutes}`;

  // Get count of transactions created with this date-time prefix
  const [rows] = await execute(
    `SELECT COUNT(*) as count FROM transactions WHERE id LIKE ?`,
    [`${dateTimePrefix}-%`]
  );

  const result = rows[0];
  const increment = (result?.count || 0) + 1;
  return `${dateTimePrefix}-${increment}`;
}

app.post('/api/purchase-orders', async (req, res) => {
  const user = getUserFromRequest(req);
  try {
    const { supplierId, items = [], notes } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const poId = await generatePONumber();
    const total = items.reduce((sum, it) => sum + (Number(it.unitCost) * Number(it.quantity)), 0);

    // Use N/A supplier if none selected
    const finalSupplierId = supplierId || 'na-supplier-default';

    execute(
      `INSERT INTO purchase_orders (id, supplier_id, status, total, notes) VALUES (?, ?, 'ordered', ?, ?)`,
      [poId, finalSupplierId, total, notes || null]
    );

    for (const it of items) {
      const itemId = uuidv4();
      execute(
        `INSERT INTO purchase_order_items (id, po_id, product_id, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [itemId, poId, it.productId, it.quantity, it.unitCost, it.quantity * it.unitCost]
      );
    }

    enqueueOutbox('purchase_order', poId, 'create', { id: poId, supplierId, items, notes, total });

    // Log activity - non-blocking
    try {
      const [supplierRows] = execute('SELECT name FROM suppliers WHERE id = ?', [finalSupplierId]);
      const supplierName = supplierRows[0]?.name || 'N/A';

      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.CREATE_PURCHASE_ORDER,
        entityType: 'purchase_order',
        entityId: poId,
        details: {
          message: `Created purchase order ${poId}`,
          supplierId: finalSupplierId,
          supplierName: supplierName,
          itemCount: items.length,
          total: total,
          notes: notes || null
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
    } catch (logError) {
      console.warn('Failed to log activity for purchase order creation:', logError);
    }

    res.status(201).json({ id: poId, supplierId, items, total, status: 'ordered', notes: notes || null });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

app.get('/api/purchase-orders', async (req, res) => {
  try {
    const [rows] = execute(
      `SELECT po.*, s.name AS supplierName FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id ORDER BY po.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

app.get('/api/purchase-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [[po]] = execute(`SELECT * FROM purchase_orders WHERE id = ?`, [id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const [items] = execute(
      `SELECT i.*, p.name AS productName FROM purchase_order_items i JOIN products p ON p.id = i.product_id WHERE po_id = ?`,
      [id]
    );
    // Normalize to camelCase for frontend
    const normalizedItems = items.map(item => ({
      ...item,
      unitCost: item.unit_cost,
      productId: item.product_id,
      poId: item.po_id
    }));
    res.json({ ...po, items: normalizedItems });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order' });
  }
});

// Receive a purchase order: increases product quantities and updates weighted average cost
app.post('/api/purchase-orders/:id/receive', async (req, res) => {
  const user = getUserFromRequest(req);
  try {
    const { id } = req.params;
    const connection = await getConnection();
    try {
      connection.beginTransaction();

      const [[po]] = connection.execute(`SELECT * FROM purchase_orders WHERE id = ?`, [id]);
      if (!po) {
        connection.rollback();
        return res.status(404).json({ error: 'Purchase order not found' });
      }
      if (po.status === 'received') {
        connection.rollback();
        return res.status(400).json({ error: 'Purchase order already received' });
      }

      const [items] = connection.execute(`SELECT * FROM purchase_order_items WHERE po_id = ?`, [id]);

      for (const it of items) {
        // Update product quantity (exclude deleted products)
        const [[product]] = connection.execute(`SELECT quantity FROM products WHERE id = ? AND deleted_at IS NULL FOR UPDATE`, [it.product_id]);
        if (!product) {
          throw new Error(`Product ${it.product_id} not found or deleted`);
        }
        const newQuantity = product.quantity + it.quantity;
        connection.execute(`UPDATE products SET quantity = ? WHERE id = ?`, [newQuantity, it.product_id]);
      }

      connection.execute(`UPDATE purchase_orders SET status = 'received' WHERE id = ?`, [id]);

      connection.commit();
      enqueueOutbox('purchase_order', id, 'receive', { id });

      // Log activity - non-blocking
      try {
        const [[poInfo]] = execute(
          'SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?',
          [id]
        );

        logActivity({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: ACTIVITY_ACTIONS.RECEIVE_PURCHASE_ORDER,
          entityType: 'purchase_order',
          entityId: id,
          details: {
            message: `Received purchase order ${id}`,
            supplierId: poInfo?.supplier_id,
            supplierName: poInfo?.supplier_name || 'N/A',
            total: poInfo?.total || 0,
            itemCount: items.length
          },
          ipAddress: req.ip || req.connection?.remoteAddress || null
        });
      } catch (logError) {
        console.warn('Failed to log activity for purchase order receive:', logError);
      }

      res.json({ success: true });
    } catch (err) {
      connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error receiving purchase order:', error);
    res.status(500).json({ error: 'Failed to receive purchase order' });
  }
});

// Cancel a purchase order
app.post('/api/purchase-orders/:id/cancel', async (req, res) => {
  const user = getUserFromRequest(req);
  try {
    const { id } = req.params;
    const [result] = execute(`UPDATE purchase_orders SET status = 'cancelled' WHERE id = ? AND status != 'received'`, [id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Unable to cancel (not found or already received)' });

    enqueueOutbox('purchase_order', id, 'cancel', { id });

    // Log activity - non-blocking
    try {
      const [[poInfo]] = await pool.execute(
        'SELECT po.*, s.name AS supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id WHERE po.id = ?',
        [id]
      );

      logActivity({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        action: ACTIVITY_ACTIONS.CANCEL_PURCHASE_ORDER,
        entityType: 'purchase_order',
        entityId: id,
        details: {
          message: `Cancelled purchase order ${id}`,
          supplierId: poInfo?.supplier_id,
          supplierName: poInfo?.supplier_name || 'N/A',
          total: poInfo?.total || 0
        },
        ipAddress: req.ip || req.connection?.remoteAddress || null
      });
    } catch (logError) {
      console.warn('Failed to log activity for purchase order cancel:', logError);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling purchase order:', error);
    res.status(500).json({ error: 'Failed to cancel purchase order' });
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

    let updateQuery = 'UPDATE users SET name = ?, email = ?, role = ?, permissions = ? WHERE id = ?';
    let updateParams = [name, email, role, JSON.stringify(permissions || []), id];

    // If password is provided, update it too
    if (password && password.trim() !== '') {
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      updateQuery = 'UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, permissions = ? WHERE id = ?';
      updateParams = [name, email, password_hash, role, JSON.stringify(permissions || []), id];
    }

    const [result] = execute(updateQuery, updateParams);

    if (result.affectedRows === 0) {
      console.log('User not found:', id);
      res.status(404).json({ error: 'User not found' });
    } else {
      console.log('User updated:', id);
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
    const { productId, movementType, quantity, fromLocation, toLocation, referenceNumber, notes, performedBy, performedById } = req.body;

    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Product ID and positive quantity are required' });
    }

    // Get product name (exclude deleted products)
    const [[product]] = await pool.execute('SELECT name FROM products WHERE id = ? AND deleted_at IS NULL', [productId]);
    if (!product) {
      return res.status(404).json({ error: 'Product not found or deleted' });
    }

    const movementId = uuidv4();
    execute(
      `INSERT INTO stock_movements (
        id, product_id, product_name, movement_type, quantity,
        from_location, to_location, reference_number, notes,
        performed_by, performed_by_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        productId,
        product.name,
        movementType || 'transfer',
        quantity,
        fromLocation || null,
        toLocation || null,
        referenceNumber || null,
        notes || null,
        performedBy || null,
        performedById || null,
      ]
    );

    // Log activity
    logActivity({
      userId: performedById,
      userName: performedBy,
      action: 'STOCK_OUT',
      entityType: 'product',
      entityId: productId,
      details: {
        productName: product.name,
        movementType,
        quantity,
        fromLocation,
        toLocation,
        referenceNumber,
      },
      ipAddress: req.ip,
    });

    res.status(201).json({ id: movementId, message: 'Stock movement recorded successfully' });
  } catch (error) {
    console.error('Error creating stock movement:', error);
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
    const { productId, adjustmentType, newQuantity, reason, notes, adjustedBy, adjustedById } = req.body;

    if (!productId || newQuantity === undefined || newQuantity === null) {
      return res.status(400).json({ error: 'Product ID and new quantity are required' });
    }

    const connection = await getConnection();
    try {
      connection.beginTransaction();

      // Get current product (exclude deleted products)
      const [[product]] = connection.execute(
        'SELECT id, name, quantity FROM products WHERE id = ? AND deleted_at IS NULL',
        [productId]
      );

      if (!product) {
        connection.rollback();
        return res.status(404).json({ error: 'Product not found or deleted' });
      }

      const quantityBefore = Number(product.quantity) || 0;
      const quantityAfter = Number(newQuantity);
      const quantityChange = quantityAfter - quantityBefore;

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
      connection.execute(
        'UPDATE products SET quantity = ? WHERE id = ?',
        [quantityAfter, productId]
      );

      // Log activity
      logActivity({
        userId: adjustedById,
        userName: adjustedBy,
        action: 'STOCK_ADJUSTMENT',
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

// Get all transactions (excluding archived)
app.get('/api/transactions', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = 'SELECT * FROM transactions WHERE archived_at IS NULL ORDER BY timestamp DESC';
    let params = [];

    if (startDate && endDate) {
      query = 'SELECT * FROM transactions WHERE archived_at IS NULL AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC';
      params = [startDate, endDate];
    }

    const [rows] = execute(query, params);

    // Parse items JSON for each transaction
    const transactions = rows.map(transaction => ({
      ...transaction,
      items: transaction.items ? JSON.parse(transaction.items) : []
    }));

    console.log('Transactions fetched:', transactions.length);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get all archived transactions (admin only)
app.get('/api/transactions/archived', async (req, res) => {
  try {
    const [rows] = await execute(
      'SELECT * FROM transactions WHERE archived_at IS NOT NULL ORDER BY archived_at DESC'
    );

    // Parse items JSON for each transaction
    const transactions = rows.map(transaction => ({
      ...transaction,
      items: transaction.items ? JSON.parse(transaction.items) : []
    }));

    console.log('Archived transactions fetched:', transactions.length);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching archived transactions:', error);
    res.status(500).json({ error: 'Failed to fetch archived transactions' });
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

    // Deduct stock from products (direct quantity deduction)
    for (const item of transaction.items) {
      await connection.execute(
        `INSERT INTO transaction_items (
          id, transaction_id, product_id, quantity, unit_price, unit_cost, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          uuidv4(),
          transactionId,
          item.productId || item.product_id,
          Number(item.quantity) || 0,
          Number(item.price ?? item.unit_price ?? 0),
          Number(item.cost || 0),
        ]
      );

      // Direct quantity deduction (no FIFO) - exclude deleted products
      if (item.productId) {
        const [productRows] = await connection.execute(
          'SELECT quantity FROM products WHERE id = ? AND deleted_at IS NULL',
          [item.productId]
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

        await connection.execute(
          'UPDATE products SET quantity = quantity - ? WHERE id = ?',
          [quantityToSell, item.productId]
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
        action: ACTIVITY_ACTIONS.ARCHIVE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction archived' },
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
        action: ACTIVITY_ACTIONS.RESTORE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction restored' },
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
        action: ACTIVITY_ACTIONS.DELETE_TRANSACTION,
        entityType: 'transaction',
        entityId: id,
        details: { message: 'Transaction permanently deleted' },
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

// Get sales analytics
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

    const [transactions] = await pool.execute(
      'SELECT * FROM transactions WHERE timestamp >= ? ORDER BY timestamp DESC',
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

  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath, 'database');
  }

  if (fs.existsSync(uploadsPath)) {
    zip.addLocalFolder(uploadsPath, 'uploads');
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

    // Add database file
    if (fs.existsSync(dbPath)) {
      zip.addLocalFile(dbPath, 'database');
    }

    // Add uploads folder recursively
    if (fs.existsSync(uploadsPath)) {
      zip.addLocalFolder(uploadsPath, 'uploads');
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

    // Close DB, extract, reopen
    db.close();

    // Extract DB
    const dbEntry = zip.getEntry('database/pos_inventory.db');
    if (dbEntry) {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, dbEntry.getData());
    }

    // Extract uploads folder
    const uploadEntries = zip.getEntries().filter(e => e.entryName.startsWith('uploads/') && !e.isDirectory);
    for (const entry of uploadEntries) {
      const destPath = path.join(process.cwd(), entry.entryName);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    // Reopen DB
    const { default: Database } = await import('better-sqlite3');
    const newDb = new Database(dbPath);
    newDb.pragma('foreign_keys = ON');
    newDb.pragma('journal_mode = WAL');
    // Re-assign db methods so queries work again
    // Re-assign db methods so queries work again without triggering getter errors
    const dbMethods = ['prepare', 'transaction', 'exec', 'pragma', 'close', 'backup'];
    for (const m of dbMethods) {
      if (typeof newDb[m] === 'function') {
        db[m] = newDb[m].bind(newDb);
      }
    }

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
      transactions:      ['DELETE FROM transaction_items', 'DELETE FROM transactions'],
      products:          ['DELETE FROM products'],
      categories:        ['DELETE FROM categories'],
      suppliers:         ['DELETE FROM suppliers'],
      purchase_orders:   ['DELETE FROM purchase_order_items', 'DELETE FROM purchase_orders'],
      stock_adjustments: ['DELETE FROM stock_adjustments'],
      activity_logs:     ['DELETE FROM activity_logs'],
      audit_logs:        ['DELETE FROM audits'],
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
          try { fs.unlinkSync(path.join(uploadsPath, file)); } catch {}
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