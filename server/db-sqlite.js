import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine database path - use portable location if in portable mode
const getDbPath = () => {
  // Check if we're in a portable installation
  const portableDbPath = path.join(process.cwd(), 'data', 'pos_inventory.db');
  const defaultDbPath = path.join(process.cwd(), 'pos_inventory.db');
  
  // Create data directory if it doesn't exist (for portable mode)
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      console.warn('Could not create data directory, using default location');
    }
  }
  
  // Use portable path if data directory exists, otherwise use default
  return fs.existsSync(dataDir) ? portableDbPath : defaultDbPath;
};

const dbPath = getDbPath();

// Create database connection
const db = new Database(dbPath, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Helper function to execute queries (similar to MySQL's execute)
db.execute = function(query, params = []) {
  try {
    if (query.trim().toUpperCase().startsWith('SELECT')) {
      const stmt = this.prepare(query);
      const rows = stmt.all(params);
      return [rows];
    } else {
      const stmt = this.prepare(query);
      const result = stmt.run(params);
      return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }];
    }
  } catch (error) {
    console.error('SQLite query error:', error);
    throw error;
  }
};

// Helper function to get connection (for compatibility with MySQL pool pattern)
db.getConnection = async function() {
  // In SQLite, we return the same db instance but wrapped for compatibility
  const connection = {
    execute: (query, params = []) => {
      try {
        if (query.trim().toUpperCase().startsWith('SELECT')) {
          const stmt = db.prepare(query);
          const rows = stmt.all(params);
          return [rows];
        } else {
          const stmt = db.prepare(query);
          const result = stmt.run(params);
          return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }];
        }
      } catch (error) {
        console.error('SQLite query error:', error);
        throw error;
      }
    },
    beginTransaction: () => {
      db.exec('BEGIN TRANSACTION');
    },
    commit: () => {
      db.exec('COMMIT');
    },
    rollback: () => {
      db.exec('ROLLBACK');
    },
    release: () => {
      // No-op for SQLite
    }
  };
  return connection;
};

// Transaction helper
db.withTransaction = async function(callback) {
  const connection = await this.getConnection();
  try {
    connection.beginTransaction();
    const result = await callback(connection);
    connection.commit();
    return result;
  } catch (error) {
    connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

console.log(`SQLite database connected: ${dbPath}`);

export default db;
