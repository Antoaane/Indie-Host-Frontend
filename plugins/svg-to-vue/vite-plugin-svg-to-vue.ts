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
