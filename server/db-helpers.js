import db from './db-sqlite.js';

/**
 * Helper functions to make SQLite queries compatible with MySQL-style code
 */

// Execute query (compatible with MySQL pool.execute pattern)
export function execute(query, params = []) {
  try {
    // Normalize query for SQLite
    let normalizedQuery = query
      .replace(/NOW\(\)/gi, "datetime('now')")
      .replace(/CURRENT_TIMESTAMP/gi, "datetime('now')")
      .replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '')
      .replace(/IF NOT EXISTS/gi, '')
      .replace(/ENGINE=InnoDB/gi, '')
      .replace(/DEFAULT CHARSET=utf8mb4/gi, '')
      .replace(/COLLATE=utf8mb4_general_ci/gi, '');

    // Handle SHOW COLUMNS queries
    if (normalizedQuery.trim().toUpperCase().startsWith('SHOW COLUMNS')) {
      const tableMatch = normalizedQuery.match(/FROM\s+(\w+)/i);
      if (tableMatch) {
        const tableName = tableMatch[1];
        const result = db.prepare(`PRAGMA table_info(${tableName})`).all();
        // Convert to MySQL-like format
        const columns = result.map(col => ({
          Field: col.name,
          Type: col.type,
          Null: col.notnull ? 'NO' : 'YES',
          Key: col.pk ? 'PRI' : '',
          Default: col.dflt_value,
          Extra: ''
        }));
        return [columns];
      }
    }

    // Handle ALTER TABLE ADD COLUMN IF NOT EXISTS
    if (normalizedQuery.includes('ADD COLUMN IF NOT EXISTS')) {
      const match = normalizedQuery.match(/ALTER TABLE\s+(\w+)\s+ADD COLUMN IF NOT EXISTS\s+(.+)/i);
      if (match) {
        const [, tableName, columnDef] = match;
        // Check if column exists
        const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all();
        const columnName = columnDef.trim().split(/\s+/)[0];
        const exists = tableInfo.some(col => col.name === columnName);
        
        if (!exists) {
          normalizedQuery = normalizedQuery.replace('IF NOT EXISTS', '');
          const stmt = db.prepare(normalizedQuery);
          stmt.run(params);
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
      }
    }

    // Handle SELECT queries
    if (normalizedQuery.trim().toUpperCase().startsWith('SELECT')) {
      const stmt = db.prepare(normalizedQuery);
      const rows = stmt.all(params);
      return [rows];
    }

    // Handle INSERT, UPDATE, DELETE queries
    const stmt = db.prepare(normalizedQuery);
    const result = stmt.run(params);
    return [{ affectedRows: result.changes, insertId: result.lastInsertRowid }];
  } catch (error) {
    console.error('SQLite query error:', error);
    console.error('Query:', query);
    console.error('Params:', params);
    throw error;
  }
}

// Get connection (for compatibility with MySQL pool pattern)
export async function getConnection() {
  return {
    execute: (query, params = []) => {
      return execute(query, params);
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
}

// Transaction helper
export async function withTransaction(callback) {
  const connection = await getConnection();
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
}

// Export db for direct access when needed
export { db };
