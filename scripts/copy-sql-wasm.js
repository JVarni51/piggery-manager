const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const targetDir = path.join(__dirname, '..', 'public');
const target = path.join(targetDir, 'sql-wasm.wasm');

if (!fs.existsSync(source)) {
  console.warn('sql.js wasm not found; web SQL fallback will be unavailable until dependencies install.');
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log('Copied sql-wasm.wasm to public/');
