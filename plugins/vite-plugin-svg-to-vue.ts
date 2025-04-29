import { Plugin } from 'vite';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

async function runPythonExtraction() {
    try {
        const pythonScriptPath = path.resolve(__dirname, 'convert_svg.py');

        console.log('🚀 [vite-plugin-svg-to-vue] Démarrage de l\'exécution du script Python...');

        if (!fs.existsSync(pythonScriptPath)) {
            console.error('❌ [vite-plugin-svg-to-vue] Script Python introuvable :', pythonScriptPath);
            return;
        }

        execSync(`python "${pythonScriptPath}"`, { stdio: 'inherit' });

        console.log('✅ [vite-plugin-svg-to-vue] Extraction et génération .vue terminée.');
    } catch (error) {
        console.error('❌ [vite-plugin-svg-to-vue] Erreur pendant l\'exécution du script Python :', error);
    }
}

export default function svgToVuePlugin(): Plugin {
    return {
        name: 'vite-plugin-svg-to-vue',
        apply: 'serve',
        async configResolved() {
            console.log('🚀 [vite-plugin-svg-to-vue] Scan et génération des composants SVG avec indentation...');
            await runPythonExtraction();
        }
    };
}

// import { Plugin } from 'vite';
// import fs from 'fs/promises';
// import path from 'path';
// import prettier from 'prettier';

// const vueTemplate = (svgContent: string) => `
// <template>
// ${svgContent}
// </template>
// `;

// const pascalCase = (str: string) => {
//     return str.replace(/(^\w|-\w)/g, (match) => match.replace('-', '').toUpperCase());
// };

// async function formatSvg(svgContent: string): Promise<string> {
//     try {
//         const formatted = await prettier.format(svgContent, {
//             parser: 'html', // oui oui, svg = xml = html pour Prettier
//             htmlWhitespaceSensitivity: 'ignore',
//         });
//         return formatted.trim(); // enlever les espaces inutiles autour
//     } catch (error) {
//         console.error('❌ Erreur Prettier sur le SVG:', error);
//         return svgContent; // fallback brut si erreur
//     }
// }

// async function generateVueComponent(svgPath: string) {
//     const svgContent = await fs.readFile(svgPath, 'utf-8');
//     const formattedSvg = await formatSvg(svgContent);

//     const { dir, name } = path.parse(svgPath);
//     const componentName = pascalCase(name);
//     const vueFilePath = path.join(dir, `${componentName}.vue`);

//     try {
//         await fs.access(vueFilePath);
//         console.log(`⏭️ ${componentName}.vue existe déjà, on skip.`);
//         return;
//     } catch {
//         // Le fichier .vue n'existe pas
//     }

//     const vueContent = vueTemplate(formattedSvg);
//     await fs.writeFile(vueFilePath, vueContent, 'utf-8');
//     console.log(`✅ Créé avec indentation : ${vueFilePath}`);
// }

// async function scanAndGenerateAll() {
//     const svgDirectory = path.resolve('src/assets/media');

//     async function scanDirectory(dir: string) {
//         const entries = await fs.readdir(dir, { withFileTypes: true });

//         for (const entry of entries) {
//             const fullPath = path.join(dir, entry.name);

//             if (entry.isDirectory()) {
//                 await scanDirectory(fullPath);
//             } else if (entry.isFile() && fullPath.endsWith('.svg')) {
//                 await generateVueComponent(fullPath);
//             }
//         }
//     }

//     await scanDirectory(svgDirectory);
// }

// export default function svgToVuePlugin(): Plugin {
//     return {
//         name: 'vite-plugin-svg-to-vue',
//         apply: 'serve',
//         async configResolved() {
//             console.log('🚀 Scan et génération des composants SVG avec indentation...');
//             await scanAndGenerateAll();
//         }
//     };
// }
