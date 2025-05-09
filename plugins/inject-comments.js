// File: plugins/inject-comments.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '../src');
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

    // 1. On bosse en LF interne pour simplifier
    const lf = raw.replace(/\r\n/g, '\n');
    let lines = lf.split('\n');

    // 2. Dégage TOUS les blancs en tête
    while (lines.length && lines[0].trim() === '') lines.shift();

    // 3. Si un header « File: » existe déjà, on le vire
    if (/^\s*(?:\/\/|\/\*|<!--)\s*File:/.test(lines[0])) lines.shift();

    // 4. Et on re-purge tout blanc juste après
    while (lines.length && lines[0].trim() === '') lines.shift();

    const body = lines.join('\n');
    const header = getComment(filePath);

    // 5. Reconstruction : header + EOL + code (aucune ligne blanche intermédiaire)
    const result = body ? `${header}\n${body}` : `${header}\n`;

    // 6. Écriture si changement, en restaurant le style EOL d’origine
    if (result !== lf) {
        const eol = raw.includes('\r\n') ? '\r\n' : '\n';
        fs.writeFileSync(filePath, result.replace(/\n/g, eol), 'utf-8');
        console.log(`[tag:files] ${filePath}`);
    }
}

/* -------------------------------------------------------------------------- */
/*                                  run walk                                  */
/* -------------------------------------------------------------------------- */
walk(BASE_DIR);
