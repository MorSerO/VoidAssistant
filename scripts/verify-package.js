// Verify the packaged app.asar contains everything the app needs at runtime.
const asar = require('@electron/asar');
const fs = require('fs');
const path = require('path');

const asarPath = path.join(__dirname, '..', 'release', 'win-unpacked', 'resources', 'app.asar');
const files = asar.listPackage(asarPath);

const checks = [
  'dist/main/main/index.js',
  'dist/main/preload/index.js',
  'dist/renderer/index.html',
  'package.json',
  'resources/icon.ico',
];
console.log('asar total files:', files.length);
for (const c of checks) {
  const norm = '\\' + c.replace(/\//g, '\\');
  console.log(c, '=>', files.includes(norm) ? 'FOUND' : 'MISSING');
}

// Native module: better_sqlite3.node must be in asar.unpacked, not inside the asar
const nodeInAsar = files.filter(f => f.endsWith('.node'));
console.log('.node files inside asar (should be 0):');
for (const f of nodeInAsar) console.log('  ', f);
const unpackedNode = path.join(__dirname, '..', 'release', 'win-unpacked', 'resources', 'app.asar.unpacked');
const walk = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (p.endsWith('.node')) acc.push(p);
  }
  return acc;
};
const unpackedNodes = walk(unpackedNode);
console.log('.node files in app.asar.unpacked:', unpackedNodes.map(p => p.replace(/\\/g, '/').split('app.asar.unpacked/')[1]));

// better-sqlite3 loads from the unpacked path via __dirname probing;
// check the index.js resolves build/Release/better_sqlite3.node
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'package.json'), 'utf8'));
console.log('better-sqlite3 main:', pkg.main, '| binary target exists in unpacked:',
  fs.existsSync(path.join(unpackedNode, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')));

// Renderer assets referenced by index.html must exist
const html = asar.extractFile(asarPath, 'dist\\renderer\\index.html').toString('utf8');
const assetRefs = [...html.matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map(m => m[1]);
console.log('renderer asset refs:');
for (const a of assetRefs) {
  const norm = '\\dist\\renderer\\' + a.replace(/\//g, '\\');
  console.log(' ', a, '=>', files.includes(norm) ? 'FOUND' : 'MISSING');
}
