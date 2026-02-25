// File: plugins/file-path-comment/inject-comments.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const BASE_DIR = path.resolve(__dirname, '../src');
const BASE_DIR = path.resolve(process.cwd(), 'src');

const INCLUDED_EXTENSIONS =
  /\.(ts|tsx|js|jsx|vue|svelte|scss|sass|less|styl|css|html|md|mdx)$/;
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', '.cache', 'build'];

/* -------------------------------------------------------------------------- */
/*                               utils / helpers                              */
/* -------------------------------------------------------------------------- */
function getComment(filePath) {
  const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  const ext = path.extname(filePath).toLowerCase();

  if (['.vue', '.html', '.svelte', '.md', '.mdx'].includes(ext))
    return `<!-- File: ${rel} -->`;
  if (['.css', '.scss', '.sass', '.less', '.styl'].includes(ext))
    return `/* File: ${rel} */`;
  return `// File: ${rel}`;
}

function shouldIgnore(filePath) {
  return (
    !INCLUDED_EXTENSIONS.test(filePath) ||
    EXCLUDED_DIRS.some((dir) => filePath.includes(dir)) ||
    !fs.existsSync(filePath)
  );
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.includes(entry.name)) walk(full);
    } else {
      if (!shouldIgnore(full)) processFile(full);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                              core : processFile                            */
/* -------------------------------------------------------------------------- */
function processFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lf = raw.replace(/\r\n/g, '\n');

  let lines = lf.split('\n');

  // 1. Enlève tous les blancs en tête
  while (lines.length && lines[0].trim() === '') lines.shift();

  // 2. Supprime header "File:" existant
  if (/^\s*(?:\/\/|\/\*|<!--)\s*File:/.test(lines[0])) lines.shift();

  // 3. Supprime les lignes blanches directement après le header (même s'il vient d'être supprimé)
  while (lines.length && /^\s*$/.test(lines[0])) lines.shift();

  const body = lines.join('\n');
  const header = getComment(filePath);
  const result = body ? `${header}\n\n${body}` : `${header}\n\n`;

  if (result !== lf) {
    fs.writeFileSync(filePath, result.replace(/\n/g, eol), 'utf-8');
    console.log(`[tag:files] ${filePath}`);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  run walk                                  */
/* -------------------------------------------------------------------------- */
walk(BASE_DIR);
