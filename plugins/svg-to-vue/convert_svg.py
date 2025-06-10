#!/usr/bin/env python3
"""convert_svg.py
------------------------------------------------------------
Parcourt récursivement MEDIA_ROOT, extrait les images base64
embarquées dans les SVG, génère un composant Vue pour chacun,
optimise le SVG avec SVGO (si dispo) et formate le résultat
avec Prettier.
Chaque étape affiche désormais un message explicite afin de
faciliter le débogage et le suivi du pipeline.
"""

from __future__ import annotations

import base64
import io
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from PIL import Image
import imagehash

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MEDIA_ROOT = Path('public/assets/media')
IMAGE_OUTPUT = MEDIA_ROOT / 'images'
VUE_OUTPUT_ROOT = Path('src/components/svgs')
MAX_NODE_MEMORY_MB = 4096
PRETTIER_ARGS = ['--plugin-search-dir', '.', '--write']

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    """Affiche un log simple et uniforme."""
    print(msg)

# ---------------------------------------------------------------------------
# File-system helpers
# ---------------------------------------------------------------------------


def ensure_image_output() -> None:
    if not IMAGE_OUTPUT.exists():
        log(f'📂 Création du dossier images → {IMAGE_OUTPUT}')
    IMAGE_OUTPUT.mkdir(parents=True, exist_ok=True)


def to_pascal_case(name: str) -> str:
    pascal = ''.join(word.capitalize()
                     for word in re.split(r'[\s\-_]+', name) if word)
    log(f'🔤 Conversion "{name}" → "{pascal}"')
    return pascal

# ---------------------------------------------------------------------------
# Image deduplication helpers
# ---------------------------------------------------------------------------


def find_existing_image(b64_data: str) -> Optional[str]:
    new_hash = imagehash.phash(Image.open(
        io.BytesIO(base64.b64decode(b64_data))))
    for existing_file in IMAGE_OUTPUT.iterdir():
        if existing_file.suffix.lower() in {'.png', '.jpg', '.jpeg'}:
            try:
                if abs(new_hash - imagehash.phash(Image.open(existing_file))) <= 5:
                    log(
                        f'🔁 Duplication détectée → réutilisation {existing_file.name}')
                    return f'/public/assets/media/images/{existing_file.name}'
            except Exception:
                continue
    return None


def has_transparency(img: Image.Image) -> bool:
    if img.mode in {'RGBA', 'LA'}:
        transparency = any(p < 255 for p in img.getchannel('A').getdata())
    elif img.mode == 'P':
        transparency = 'transparency' in img.info
    else:
        transparency = False
    log(f'🖼️  Image {"avec" if transparency else "sans"} transparence')
    return transparency

# ---------------------------------------------------------------------------
# External binaries location
# ---------------------------------------------------------------------------


def _locate_cmd(candidates: list[str]) -> Optional[str]:
    for cmd in candidates:
        path = shutil.which(cmd)
        if path:
            log(f'⚙️  Binaire trouvé dans PATH → {path}')
            return path
    local_bin = Path.cwd() / 'node_modules' / '.bin'
    for cmd in candidates:
        candidate = local_bin / cmd
        if candidate.exists():
            log(f'⚙️  Binaire trouvé dans node_modules → {candidate}')
            return str(candidate)
    log('🔍 Aucun binaire trouvé pour ' + ', '.join(candidates))
    return None


def _locate_svgo_cmd() -> Optional[str]:
    return _locate_cmd(['svgo.cmd', 'svgo'] if os.name == 'nt' else ['svgo'])


def _locate_prettier_cmd() -> Optional[str]:
    return _locate_cmd(['prettier.cmd', 'prettier', 'npx.cmd', 'npx'] if os.name == 'nt' else ['prettier', 'npx'])

# ---------------------------------------------------------------------------
# SVGO optimisation
# ---------------------------------------------------------------------------


def optimize_svg(svg_raw: str) -> str:
    svgo_cmd = _locate_svgo_cmd()
    if not svgo_cmd:
        log('⚠️  SVGO absent — optimisation ignorée')
        return svg_raw

    with tempfile.NamedTemporaryFile('w+', suffix='.svg', delete=False, encoding='utf-8') as tmp:
        tmp.write(svg_raw)
        tmp_path = Path(tmp.name)
    log(f'🛠️  Optimisation SVGO → {tmp_path.name}')

    env = os.environ.copy()
    env['NODE_OPTIONS'] = env.get(
        'NODE_OPTIONS', '') + f' --max-old-space-size={MAX_NODE_MEMORY_MB}'

    try:
        subprocess.run([
            svgo_cmd, str(
                tmp_path), '--config', 'plugins/svg-to-vue/svgo.config.js', '-o', str(tmp_path)
        ], check=True, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        log('✅ SVGO terminé')
        return tmp_path.read_text('utf-8')
    except subprocess.CalledProcessError as e:
        log('❌ SVGO erreur : ' + e.stderr.decode(errors='ignore').strip())
        return svg_raw
    finally:
        tmp_path.unlink(missing_ok=True)

# ---------------------------------------------------------------------------
# Prettier formatting
# ---------------------------------------------------------------------------


def format_with_prettier(filepath: Path) -> None:
    prettier_cmd = _locate_prettier_cmd()
    if not prettier_cmd:
        log('⚠️  Prettier absent — skip format')
        return
    cmd = [prettier_cmd, *PRETTIER_ARGS, str(filepath)]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE,
                       stderr=subprocess.PIPE)
        log(f'✨ Prettier ok → {filepath}')
    except subprocess.CalledProcessError as e:
        log('❌ Prettier erreur : ' + e.stderr.decode(errors='ignore').strip())

# ---------------------------------------------------------------------------
# Core : SVG ➔ Vue
# ---------------------------------------------------------------------------


def extract_and_convert(svg_path: Path) -> None:
    log(f'📑 Lecture {svg_path}')
    ensure_image_output()

    vue_name = to_pascal_case(svg_path.stem)
    vue_output_dir = VUE_OUTPUT_ROOT / svg_path.relative_to(MEDIA_ROOT).parent
    vue_output_dir.mkdir(parents=True, exist_ok=True)
    vue_file_path = vue_output_dir / f'{vue_name}.vue'

    if vue_file_path.exists():
        log(f'🚫 Composant déjà présent : {vue_file_path.name} — skip')
        return

    # ------------------------------------------------------------------ #
    # 1. Lecture + nettoyage a11y
    # ------------------------------------------------------------------ #
    svg_text = svg_path.read_text('utf-8')
    log('🧹 Suppression <title>/<desc> et attrs a11y existants')
    svg_text = re.sub(r'<title[^>]*>.*?</title>', '', svg_text, flags=re.S)
    svg_text = re.sub(r'<desc[^>]*>.*?</desc>', '', svg_text, flags=re.S)
    svg_text = re.sub(r'role="[^"]*"', '', svg_text)
    svg_text = re.sub(r'aria-[a-z-]+="[^"]*"', '', svg_text)

    # ------------------------------------------------------------------ #
    # 2. Gestion des <image ... base64>
    # ------------------------------------------------------------------ #
    pattern = re.compile(
        r'id="([^"]+)"\s+[^>]*xlink:href="data:image/(.*?);base64,([^"]+)"')

    def _repl(m: re.Match) -> str:
        img_id, _mime, b64 = m.groups()
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        ext = 'png' if has_transparency(img) else 'jpg'
        fname = f'{img_id}.{ext}'
        width, height = img.size

        if existing := find_existing_image(b64):
            return (f'id="{img_id}" xlink:href="{existing}" '
                    f'width="{width}" height="{height}"')

        img_path = IMAGE_OUTPUT / fname
        if ext == 'png':
            img.save(img_path, 'PNG', optimize=True)
        else:
            img.convert('RGB').save(img_path, 'JPEG', quality=85, optimize=True)

        log(f'📤 Export image {fname} ({width}×{height})')
        return (f'id="{img_id}" '
                f'xlink:href="/public/assets/media/images/{fname}" '
                f'width="{width}" height="{height}"')

    svg_text = pattern.sub(_repl, svg_text)
    svg_text = optimize_svg(svg_text)

    # ------------------------------------------------------------------ #
    # 3. Injection des bindings a11y typés
    # ------------------------------------------------------------------ #
    log('➕ Injection bindings attrRole / ariaHidden / ariaLabelledBy')
    svg_text = re.sub(
        r'<svg',
        '<svg '
        ':role="attrRole" '
        ':aria-hidden="ariaHidden" '
        ':aria-labelledby="ariaLabelledBy"',
        svg_text,
        count=1
    )
    svg_text = re.sub(
        r'</svg>',
        ('  <title v-if="!ariaHidden" :id="\'titleId\'">{{ title }}</title>\n'
         '  <desc  v-if="!ariaHidden" :id="\'descId\'">{{ desc }}</desc>\n'
         '</svg>'),
        svg_text,
        count=1
    )

    # ------------------------------------------------------------------ #
    # 4. Construction du composant Vue SFC
    # ------------------------------------------------------------------ #
    vue_content = (
        '<template>\n' + svg_text + '\n</template>\n\n'
        '<script setup lang="ts">\n'
        'import { computed, onMounted, withDefaults } from "vue";\n\n'
        'const props = withDefaults(\n'
        '  defineProps<{\n'
        '    title?: string;\n'
        '    desc?: string;\n'
        '    role?: boolean | string;\n'
        '  }>(),\n'
        '  { role: true }\n'
        ');\n\n'
        '// computed 100 % typés pour éviter les erreurs TS\n'
        'const attrRole       = computed(() => props.role === true ? undefined : String(props.role));\n'
        'const ariaHidden     = computed(() => props.role === true);\n'
        'const ariaLabelledBy = computed(() => props.role === true ? undefined : "titleId descId");\n\n'
        'onMounted(() => {\n'
        '  if (props.role !== true && (!props.title || !props.desc)) {\n'
        '    console.warn("[' + vue_name + '.vue] title et desc sont requis quand role ≠ true");\n'
        '  }\n'
        '});\n'
        '// généré automatiquement par convert_svg.py\n'
        '</script>\n'
    )

    # ------------------------------------------------------------------ #
    # 5. Écriture + formatage
    # ------------------------------------------------------------------ #
    vue_file_path.write_text(vue_content, 'utf-8', newline='\n')
    log(f'📝 Composant écrit → {vue_file_path}')
    format_with_prettier(vue_file_path)
    log(f'✅ Composant généré : {vue_file_path}')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    log(f'🚀 Scan des SVG dans {MEDIA_ROOT}')
    for svg in MEDIA_ROOT.rglob('*.svg'):
        try:
            extract_and_convert(svg)
        except Exception as exc:
            log(f'❌ Erreur sur {svg}: {exc}')
    log('🏁 Pipeline terminé')


if __name__ == '__main__':
    main()
