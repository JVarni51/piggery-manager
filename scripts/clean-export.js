/**
 * Expo's web export copies some package assets under dist/assets/node_modules/.
 * Cloudflare Pages refuses to upload any path that contains "node_modules".
 * Move those files to dist/assets/vendor/ and rewrite the references the bundle
 * already wrote, so `npm run export:web` is safe as a Git build command.
 */
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const TEXT_EXT = new Set(['.html', '.js', '.css', '.json', '.map', '.txt', '.svg']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function posix(file) {
  return path.relative(dist, file).split(path.sep).join('/');
}

if (!fs.existsSync(dist)) {
  console.error('dist/ is missing. Run `npx expo export -p web` first.');
  process.exit(1);
}

const moves = walk(dist).filter((file) => posix(file).split('/').includes('node_modules'));
const replacements = [
  ['/assets/node_modules/', '/assets/vendor/'],
  ['assets/node_modules/', 'assets/vendor/'],
  ['assets\\/node_modules\\/', 'assets\\/vendor\\/'],
  ['assets%2Fnode_modules%2F', 'assets%2Fvendor%2F'],
  ['assets%2fnode_modules%2f', 'assets%2fvendor%2f'],
];

let rewritten = 0;
for (const file of walk(dist)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  const original = fs.readFileSync(file, 'utf8');
  let next = original;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  if (next !== original) {
    fs.writeFileSync(file, next);
    rewritten += 1;
  }
}

for (const file of moves) {
  const nextRel = posix(file).replace(/(^|\/)node_modules(?=\/)/g, '$1vendor');
  const dest = path.join(dist, ...nextRel.split('/'));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(file, dest);
}

function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) prune(path.join(dir, entry.name));
  }
  if (dir !== dist && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
prune(dist);

const leftover = walk(dist).filter((file) => posix(file).split('/').includes('node_modules'));
if (leftover.length) {
  console.error('Export still contains node_modules paths:');
  for (const file of leftover) console.error(`  ${posix(file)}`);
  process.exit(1);
}

const textHits = [];
for (const file of walk(dist)) {
  if (!TEXT_EXT.has(path.extname(file))) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('/node_modules/') || text.includes('\\/node_modules\\/') || text.includes('%2Fnode_modules%2F') || text.includes('%2fnode_modules%2f')) {
    textHits.push(posix(file));
  }
}
if (textHits.length) {
  console.error('Export text still points at node_modules paths:');
  for (const file of textHits) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`Moved ${moves.length} asset(s) out of node_modules paths and rewrote ${rewritten} file(s).`);
