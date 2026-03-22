import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dbPath = path.join(__dirname, '..', 'data', 'pos_inventory.db');
const uploadsDir = path.join(__dirname, '..', 'uploads', 'products');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

// Helper to make a string URL/Filename safe
function sanitizeFilename(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphen
        .replace(/^-+|-+$/g, '');    // Remove leading/trailing hyphens
}

console.log('--- Renaming Product Images ---');

try {
    // Begin transaction
    db.prepare('BEGIN').run();

    // Find products that have an image_url
    const products = db.prepare(`
    SELECT id, name, image_url 
    FROM products 
    WHERE image_url IS NOT NULL AND image_url != ''
  `).all();

    console.log(`Found ${products.length} products with images.`);

    if (products.length === 0) {
        console.log('No products require updates. Exiting.');
        db.prepare('COMMIT').run();
        process.exit(0);
    }

    const updateStmt = db.prepare('UPDATE products SET image_url = ?, updated_at = datetime(\'now\') WHERE id = ?');
    let updateCount = 0;
    let missingFilesCount = 0;

    for (const product of products) {
        if (!product.image_url.startsWith('/uploads/products/')) {
            console.log(`Skipped [${product.name}] - Image URL does not match expected format: ${product.image_url}`);
            continue;
        }

        const oldFilename = path.basename(product.image_url);
        const oldFilePath = path.join(uploadsDir, oldFilename);
        const extension = path.extname(oldFilename);

        // If file doesn't exist on disk, skip
        if (!fs.existsSync(oldFilePath)) {
            console.log(`Skipped [${product.name}] - File not found on disk: ${oldFilePath}`);
            missingFilesCount++;
            continue;
        }

        // Generate new filename
        const cleanProductName = sanitizeFilename(product.name);

        // Add a short hash or ID to prevent collisions if two products have the same name
        const shortId = product.id.toString().substring(0, 4);
        const newFilename = `${cleanProductName}-${shortId}${extension}`;

        const newFilePath = path.join(uploadsDir, newFilename);
        const newImageUrl = `/uploads/products/${newFilename}`;

        // If already correctly named, skip
        if (oldFilename === newFilename) {
            console.log(`Skipped [${product.name}] - Already correctly named.`);
            continue;
        }

        // Rename file on disk
        fs.renameSync(oldFilePath, newFilePath);

        // Update database
        updateStmt.run(newImageUrl, product.id);

        console.log(`Renamed [${product.name}] -> ${newFilename}`);
        updateCount++;
    }

    db.prepare('COMMIT').run();
    console.log('-----------------------------------');
    console.log(`Successfully renamed ${updateCount} product images.`);
    if (missingFilesCount > 0) {
        console.log(`Note: ${missingFilesCount} image files were referenced in DB but missing from the disk.`);
    }

} catch (error) {
    // Rollback on error
    db.prepare('ROLLBACK').run();
    console.error('An error occurred during script execution. Changes rolled back.', error);
} finally {
    db.close();
}
