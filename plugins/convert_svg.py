import os
import re
import base64
import sys
from PIL import Image
import imagehash
import io

MEDIA_ROOT = 'src/assets/media/'
IMAGE_OUTPUT = os.path.join(MEDIA_ROOT, 'images')
VUE_OUTPUT_ROOT = 'src/components/svgs/'

def ensure_media_folder():
    if not os.path.exists(IMAGE_OUTPUT):
        os.makedirs(IMAGE_OUTPUT)

def find_existing_image(b64_data):
    new_image = Image.open(io.BytesIO(base64.b64decode(b64_data)))
    new_hash = imagehash.phash(new_image)

    for existing_file in os.listdir(IMAGE_OUTPUT):
        if existing_file.lower().endswith(('.png', '.jpg', '.jpeg')):
            existing_path = os.path.join(IMAGE_OUTPUT, existing_file)
            try:
                existing_image = Image.open(existing_path)
                existing_hash = imagehash.phash(existing_image)

                if abs(new_hash - existing_hash) <= 5:
                    print(f"✅ Image similaire trouvée : {existing_file}")
                    return f"@/assets/media/images/{existing_file}"
            except:
                continue

    return None

def to_pascal_case(name):
    words = re.split(r'[\s\-_]+', name)
    return ''.join(word.capitalize() for word in words if word)

def extract_and_convert(svg_path):
    ensure_media_folder()

    # Chemin relatif depuis MEDIA_ROOT
    relative_path = os.path.relpath(svg_path, MEDIA_ROOT)
    svg_subdir = os.path.dirname(relative_path)
    base_name = os.path.splitext(os.path.basename(svg_path))[0]
    vue_name = to_pascal_case(base_name)

    # Nouveau dossier de sortie des .vue
    vue_output_dir = os.path.join(VUE_OUTPUT_ROOT, svg_subdir)
    os.makedirs(vue_output_dir, exist_ok=True)
    vue_file_path = os.path.join(vue_output_dir, vue_name + '.vue')

    if os.path.exists(vue_file_path):
        print(f"🚫 Fichier Vue déjà existant, on skip : {vue_file_path}")
        return

    with open(svg_path, 'r', encoding='utf-8') as f:
        svg_text = f.read()

    def replace_match(match):
        full = match.group(0)
        img_id = match.group(1)
        mime = match.group(2)
        b64_data = match.group(3)

        def has_transparency(img):
            if img.mode in ('RGBA', 'LA'):
                alpha = img.getchannel('A')
                return any(pixel < 255 for pixel in alpha.getdata())
            elif img.mode == 'P':
                return 'transparency' in img.info
            return False

        image = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        transparent = has_transparency(image)

        ext = 'png' if transparent else 'jpg'
        filename = f"{img_id}.{ext}"
        filepath = os.path.join(IMAGE_OUTPUT, filename)

        existing_path = find_existing_image(b64_data)

        width, height = image.size

        if existing_path:
            print(f"↪️ Image réutilisée : {filename} avec forçage des dimensions")
            return f'id="{img_id}" xlink:href="{existing_path}" width="{width}" height="{height}"'
        else:
            if transparent:
                image.save(filepath, format='PNG', optimize=True)
            else:
                image.convert('RGB').save(filepath, format='JPEG', quality=85, optimize=True)

            print(f"📦 Image {img_id} extraite → {filepath}")
            return f'id="{img_id}" xlink:href="@/assets/media/images/{filename}" width="{width}" height="{height}"'

    # Traitement du SVG brut
    pattern = r'id="([^"]+)"\s+[^>]*xlink:href="data:image/(.*?);base64,([^"]+)"'
    svg_text = re.sub(pattern, replace_match, svg_text)

    vue_content = f'''<template>
{svg_text}
</template>

<script setup lang="ts">
// Ce composant a été généré automatiquement
</script>
'''

    with open(vue_file_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(vue_content)

    print(f"✅ Fichier Vue généré : {vue_file_path}")

if __name__ == '__main__':
    print("🚀 Recherche récursive des fichiers SVG dans src/assets/media...")
    for root, dirs, files in os.walk(MEDIA_ROOT):
        for file in files:
            if file.endswith('.svg'):
                full_path = os.path.join(root, file)
                print(f"🔍 Traitement de {full_path}")
                extract_and_convert(full_path)
    print("🏁 Conversion terminée.")
