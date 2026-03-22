import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.VITE_MYSQL_HOST || 'localhost',
  user: process.env.VITE_MYSQL_USER || 'root',
  password: process.env.VITE_MYSQL_PASSWORD || '',
  database: process.env.VITE_MYSQL_DATABASE || 'pos_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool; 