import mysql from 'mysql2/promise';

const createPool = () => {
  try {
    console.log('Creating MySQL pool...');
    const pool = mysql.createPool({
      host: import.meta.env.VITE_MYSQL_HOST || 'localhost',
      user: import.meta.env.VITE_MYSQL_USER,
      password: import.meta.env.VITE_MYSQL_PASSWORD,
      database: import.meta.env.VITE_MYSQL_DATABASE || 'pos_inventory',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    pool.getConnection()
      .then(connection => {
        console.log('MySQL connection successful');
        connection.release();
      })
      .catch(err => {
        console.error('Error connecting to MySQL:', err);
        throw err;
      });

    return pool;
  } catch (error) {
    console.error('Error creating MySQL pool:', error);
    throw error;
  }
};

const pool = createPool();

export default pool; 