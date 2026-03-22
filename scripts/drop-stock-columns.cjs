const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_system'
};

async function dropColumns() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database. Checking columns...');

        const [rows] = await connection.execute('SHOW COLUMNS FROM products');
        const columns = rows.map(r => r.Field);

        if (columns.includes('low_stock_threshold') || columns.includes('reorder_point')) {
            console.log('Dropping columns...');
            await connection.execute('ALTER TABLE products DROP COLUMN low_stock_threshold, DROP COLUMN reorder_point');
            console.log('Columns dropped successfully.');
        } else {
            console.log('Columns already dropped or do not exist.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        if (connection) await connection.end();
    }
}

dropColumns();
