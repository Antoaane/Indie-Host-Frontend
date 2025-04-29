import os
import re
import base64
import sys
from PIL import Image
import imagehash
import io

MEDIA_ROOT = 'src/assets/media/'
IMAGE_OUTPUT = os.path.join(MEDIA_ROOT, 'images')

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

    base_name = os.path.splitext(os.path.basename(svg_path))[0]
    vue_name = to_pascal_case(base_name)
    svg_folder = os.path.dirname(svg_path)
    vue_file_path = os.path.join(svg_folder, vue_name + '.vue')

    if os.path.exists(vue_file_path):
        print(f"🚫 Fichier Vue déjà existant, on skip : {vue_name}.vue")
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

        # Décode l'image pour analyser son contenu
        image = Image.open(io.BytesIO(base64.b64decode(b64_data)))
        transparent = has_transparency(image)

        # Détermine l'extension finale
        ext = 'png' if transparent else 'jpg'
        filename = f"{img_id}.{ext}"
        filepath = os.path.join(IMAGE_OUTPUT, filename)

        existing_path = find_existing_image(b64_data)

        # On récupère la taille de l'image décodée
        image = Image.open(io.BytesIO(base64.b64decode(b64_data)))
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


    # Regex qui chope les <image id="..." xlink:href="data:image/...">
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
