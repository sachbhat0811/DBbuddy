const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../backend/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
    const filePath = path.join(routesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove the pool import
    content = content.replace(/const pool = require\(['"]\.\.\/config\/db['"]\);\r?\n?/g, '');

    // Replace pool.query with req.dbPool.query
    content = content.replace(/\bpool\.query\b/g, 'req.dbPool.query');
    content = content.replace(/\bpool\.execute\b/g, 'req.dbPool.execute');
    content = content.replace(/\bpool\.replicaPool\.query\b/g, 'req.dbPool.query');

    fs.writeFileSync(filePath, content);
    console.log(`Refactored ${file}`);
});
