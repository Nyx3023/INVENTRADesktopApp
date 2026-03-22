import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'pos_inventory.db');

if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

console.log('--- Generating Missing Unit Costs ---');

try {
    // Begin transaction
    db.prepare('BEGIN').run();

    // Find products where cost is 0, null, or missing
    const products = db.prepare(`
    SELECT id, name, price, cost 
    FROM products 
    WHERE cost IS NULL OR cost = 0 OR cost = ''
  `).all();

    console.log(`Found ${products.length} products needing unit cost generation.`);

    if (products.length === 0) {
        console.log('No products require updates. Exiting.');
        db.prepare('COMMIT').run();
        process.exit(0);
    }

    const updateStmt = db.prepare('UPDATE products SET cost = ?, updated_at = datetime(\'now\') WHERE id = ?');
    let updateCount = 0;

    for (const product of products) {
        const price = parseFloat(product.price) || 0;

        // Calculate a random cost between 80% and 95% of the selling price
        // e.g. Price is 10. Cost is between 8 and 9.5
        if (price > 0) {
            const minPercentage = 0.80;
            const maxPercentage = 0.95;
            const randomMultiplier = Math.random() * (maxPercentage - minPercentage) + minPercentage;

            const generatedCost = (price * randomMultiplier).toFixed(2);

            updateStmt.run(generatedCost, product.id);
            console.log(`Updated [${product.name}] - Price: ₱${price.toFixed(2)} -> Generated Cost: ₱${generatedCost} (${(randomMultiplier * 100).toFixed(1)}%)`);
            updateCount++;
        } else {
            console.log(`Skipped [${product.name}] - Price is 0 or invalid.`);
        }
    }

    db.prepare('COMMIT').run();
    console.log('-----------------------------------');
    console.log(`Successfully updated ${updateCount} products with new generated unit costs.`);

} catch (error) {
    // Rollback on error
    db.prepare('ROLLBACK').run();
    console.error('An error occurred during script execution. Changes rolled back.', error);
} finally {
    db.close();
}
