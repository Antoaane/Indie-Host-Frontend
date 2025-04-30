// File: plugins/inject-comments.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '../src');
const INCLUDED_EXTENSIONS = /\.(ts|js|vue|scss|css|html)$/;
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', '.cache', 'build'];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (EXCLUDED_DIRS.includes(entry.name)) continue;
            walk(fullPath);
        } else if (INCLUDED_EXTENSIONS.test(fullPath)) {
            processFile(fullPath);
        }
    }
}

function getComment(filePath) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return filePath.endsWith('.vue') || filePath.endsWith('.html')
        ? `<!-- File: ${relativePath} -->`
        : `// File: ${relativePath}`;
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const expectedComment = getComment(filePath);
    const firstLine = lines[0];

    if (firstLine === expectedComment && lines[1] === '') return;

    let newContent = '';

    if (
        firstLine.startsWith('// File: ') ||
        firstLine.startsWith('<!-- File: ')
    ) {
        lines[0] = expectedComment;
        if (lines[1] !== '') lines.splice(1, 0, '');
        newContent = lines.join('\n');
    } else {
        newContent = expectedComment + '\n\n' + content;
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`[tag:files] ${filePath}`);
}

walk(BASE_DIR);
