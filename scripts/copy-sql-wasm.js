const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
const targetDir = path.join(__dirname, '..', 'public');
const files = ['sql-wasm.wasm', 'sql-wasm-browser.wasm'];

if (!fs.existsSync(dist)) {
  console.warn('sql.js wasm not found; web SQL fallback will be unavailable until dependencies install.');
  process.exit(0);
}

fs.mkdirSync(targetDir, { recursive: true });
for (const file of files) {
  const source = path.join(dist, file);
  if (!fs.existsSync(source)) {
    console.warn(`Missing ${file}`);
    continue;
  }
  fs.copyFileSync(source, path.join(targetDir, file));
  console.log(`Copied ${file} to public/`);
}
