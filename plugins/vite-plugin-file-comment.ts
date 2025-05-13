import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';

const INCLUDED_EXTENSIONS =
    /\.(ts|tsx|js|jsx|vue|svelte|scss|sass|less|styl|css|html|md|mdx)$/;
const EXCLUDED_DIRS = ['node_modules', '.git', 'dist', '.cache', 'build'];

/* -------------------------------------------------------------------------- */
/*                               utils / helpers                              */
/* -------------------------------------------------------------------------- */
function getComment(filePath: string): string {
    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();

    if (['.vue', '.html', '.svelte', '.md', '.mdx'].includes(ext))
        return `<!-- File: ${rel} -->`;
    if (['.css', '.scss', '.sass', '.less', '.styl'].includes(ext))
        return `/* File: ${rel} */`;
    return `// File: ${rel}`;
}

function shouldIgnore(filePath: string): boolean {
    return (
        !INCLUDED_EXTENSIONS.test(filePath) ||
        EXCLUDED_DIRS.some((dir) => filePath.includes(dir)) ||
        !fs.existsSync(filePath)
    );
}

/* -------------------------------------------------------------------------- */
/*                                   plugin                                   */
/* -------------------------------------------------------------------------- */
export default function injectFileComment(): Plugin {
    return {
        name: 'vite-inject-file-comment',
        enforce: 'pre',

        async handleHotUpdate({ file }) {
            if (shouldIgnore(file)) return;

            // 1️⃣ — on garde la version brute + EOL d’origine
            const raw = fs.readFileSync(file, 'utf-8');
            const eol = raw.includes('\r\n') ? '\r\n' : '\n';
            const lf = raw.replace(/\r\n/g, '\n');

            let lines = lf.split('\n');

            // purge avant header
            while (lines.length && lines[0].trim() === '') lines.shift();

            // zappe header existant
            if (/^\s*(?:\/\/|\/\*|<!--)\s*File:/.test(lines[0])) lines.shift();

            // 2️⃣ — supprime *toute* ligne blanche/tab/espace juste après
            while (lines.length && /^\s*$/.test(lines[0])) lines.shift();

            const header = getComment(file);
            const body = lines.join('\n');
            const result = body ? `${header}\n\n${body}` : `${header}\n\n`;

            // 3️⃣ — compare à l’original avec les EOL d’origine
            if (result !== raw.replace(/\r\n/g, eol)) {
                fs.writeFileSync(file, result.replace(/\n/g, eol), 'utf-8');
                console.log(`[Comment] Synced header for: ${file}`);
            }
        }
    };
}
