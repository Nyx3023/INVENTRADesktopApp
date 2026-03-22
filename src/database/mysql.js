import pool from '../config/mysql';
import { v4 as uuidv4 } from 'uuid';

export const productOperations = {
  // Create a new product
  create: async (productData) => {
    const connection = await pool.getConnection();
    try {
      const id = uuidv4();
      const [result] = await connection.execute(
        `INSERT INTO products (
          id, name, description, category, 
          price, quantity, low_stock_threshold, 
          barcode, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          productData.name,
          productData.description,
          productData.category,
          productData.price,
          productData.quantity,
          productData.lowStockThreshold,
          productData.barcode,
          productData.imageUrl
        ]
      );
      return { id, ...productData };
    } finally {
      connection.release();
    }
  },

  // Update an existing product
  update: async (productId, productData) => {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE products SET 
          name = ?,
          description = ?,
          category = ?,
          price = ?,
          quantity = ?,
          low_stock_threshold = ?,
          barcode = ?,
          image_url = ?
        WHERE id = ?`,
        [
          productData.name,
          productData.description,
          productData.category,
          productData.price,
          productData.quantity,
          productData.lowStockThreshold,
          productData.barcode,
          productData.imageUrl,
          productId
        ]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  },

  // Delete a product
  delete: async (productId) => {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        'DELETE FROM products WHERE id = ?',
        [productId]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  },

  // Get all products
  getAll: async () => {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT id, name, description, category, price, ' +
        'quantity, low_stock_threshold as lowStockThreshold, barcode, image_url as imageUrl ' +
        'FROM products'
      );
      return rows;
    } finally {
      connection.release();
    }
  }
}; 