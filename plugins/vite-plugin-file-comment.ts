import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const INCLUDED_EXTENSIONS = /\.(ts|js|vue|scss|css|html)$/;
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', '.cache', 'build'];

function getComment(filePath: string): string {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    return filePath.endsWith('.vue') || filePath.endsWith('.html')
        ? `<!-- File: ${relativePath} -->`
        : `// File: ${relativePath}`;
}

function shouldIgnore(filePath: string): boolean {
    return (
        !INCLUDED_EXTENSIONS.test(filePath) ||
        EXCLUDED_DIRS.some((dir) => filePath.includes(dir)) ||
        !fs.existsSync(filePath)
    );
}

export default function injectFileComment(): Plugin {
    return {
        name: 'vite-inject-file-comment',
        enforce: 'pre',
        async handleHotUpdate({ file }) {
            if (shouldIgnore(file)) return;

            const content = fs.readFileSync(file, 'utf-8');
            const expectedComment = getComment(file);

            const lines = content.split('\n');
            const firstLine = lines[0];

            if (firstLine === expectedComment) {
                if (lines[1] === '') return; // tout est déjà bon → on sort
                lines.splice(1, 0, '');       // commentaire présent mais ligne vide manquante
                const newContent = lines.join('\n');
                fs.writeFileSync(file, newContent, 'utf-8');
                console.log(`[Comment] Added missing newline after: ${file}`);
                return;
            }

            let newContent: string;

            if (
                firstLine.startsWith('// File: ') ||
                firstLine.startsWith('<!-- File: ')
            ) {
                // remplacer le commentaire existant et forcer une ligne vide après
                lines[0] = expectedComment;
                if (lines[1] !== '') lines.splice(1, 0, '');
                newContent = lines.join('\n');
            } else {
                // injecter le commentaire + saut de ligne vide
                newContent = expectedComment + '\n\n' + content;
            }

            fs.writeFileSync(file, newContent, 'utf-8');
            console.log(`[Comment] Injected into: ${file}`);
        }
    };
}
