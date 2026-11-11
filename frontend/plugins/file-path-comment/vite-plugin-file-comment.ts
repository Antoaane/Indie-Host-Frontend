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

// Fichiers de déclarations générés (`components.d.ts`, `auto-imports.d.ts`) : leur générateur les
// réécrit sans l'en-tête, ce plugin le remettait, et ainsi de suite. Sous Docker, une lecture
// tombant pendant une de ces écritures arrêtait le serveur de développement (ENODATA).
const GENERATED_DECLARATIONS = /\.d\.ts$/;

// Fragments des pages légales : leur texte est publié tel quel (pré-rendu), on n'y ajoute rien.
const CONTENT_FRAGMENTS = /\/views\/Legal\/content\//;

function shouldIgnore(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
        GENERATED_DECLARATIONS.test(normalized) ||
        CONTENT_FRAGMENTS.test(normalized) ||
        !INCLUDED_EXTENSIONS.test(normalized) ||
        EXCLUDED_DIRS.some((dir) => normalized.includes(dir)) ||
        !fs.existsSync(filePath)
    );
}

const STABLE_READ_DELAY_MS = 200;

/* -------------------------------------------------------------------------- */
/*                                   plugin                                   */
/* -------------------------------------------------------------------------- */
export default function injectFileComment(): Plugin {
    return {
        name: 'vite-inject-file-comment',
        enforce: 'pre',

        async handleHotUpdate({ file }) {
            if (shouldIgnore(file)) return;

            // Fichier en cours d'écriture : on n'y touche pas, la mise à jour suivante s'en chargera.
            // Le 2026-11-11, une page légale lue au moment où un script la réécrivait (donc vide) a
            // été remplacée par le seul en-tête « File: » : tout son texte avait disparu.
            const first = fs.readFileSync(file, 'utf-8');
            if (!first.trim()) return;
            await new Promise((resolve) => setTimeout(resolve, STABLE_READ_DELAY_MS));
            if (!fs.existsSync(file)) return;

            // 1️⃣ — on garde la version brute + EOL d’origine
            const raw = fs.readFileSync(file, 'utf-8');
            if (raw !== first) return;
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
