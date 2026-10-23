// Empreinte CSP (sha256, base64) du script en ligne de frontend/index.html, à reporter dans
// `script-src` de nginx/proxy-locations.conf à chaque modification de ce script.
// Usage : node scripts/csp-inline-script-hash.js
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const root = path.resolve(__dirname, '..', 'frontend');
for (const file of ['index.html', 'dist/index.html']) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.log(`${file} : absent`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (scripts.length === 0) {
    console.log(`${file} : aucun script en ligne`);
    continue;
  }
  for (const [, body] of scripts) {
    console.log(`${file} : 'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
}
