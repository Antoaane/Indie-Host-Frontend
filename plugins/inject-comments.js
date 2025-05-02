// File: plugins/inject-comments.js


import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '../src');
const INCLUDED_EXTENSIONS = /\.(ts|js|vue|scss|css|html)$/;
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', '.cache', 'build'];

/* -------------------------------------------------------------------------- */
/*                               utils / helpers                              */
/* -------------------------------------------------------------------------- */
function getComment(filePath) {
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return filePath.endsWith('.vue') || filePath.endsWith('.html')
        ? `<!-- File: ${rel} -->`
        : `// File: ${rel}`;
}

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!EXCLUDED_DIRS.includes(entry.name)) walk(full);
        } else if (INCLUDED_EXTENSIONS.test(full)) {
            processFile(full);
        }
    }
}

/* -------------------------------------------------------------------------- */
/*                              core : processFile                            */
/* -------------------------------------------------------------------------- */
function processFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const lines = raw.split('\n');

    // 1. jette le premier commentaire File: éventuel
    let idx = 0;
    if (lines[idx]?.startsWith('// File: ') || lines[idx]?.startsWith('<!-- File: ')) {
        idx++; // saute la ligne commentaire existante
    }

    // 2. jette toutes les lignes vides directement après
    while (idx < lines.length && lines[idx].trim() === '') idx++;

    // 3. ce qu’il reste est le contenu "utile"
    const body = lines.slice(idx).join('\n');

    // 4. reconstruit ultra-simple : commentaire + une ligne vide + contenu
    const result = `${getComment(filePath)}\n\n${body}`;

    // 5. écrit si ça a changé
    if (result !== raw) {
        fs.writeFileSync(filePath, result, 'utf-8');
        console.log(`[tag:files] ${filePath}`);
    }
}

/* -------------------------------------------------------------------------- */
/*                                  run walk                                  */
/* -------------------------------------------------------------------------- */
walk(BASE_DIR);
