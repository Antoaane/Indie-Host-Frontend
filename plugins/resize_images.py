import os
import shutil
from PIL import Image

IMAGE_FOLDER = 'src/assets/media/images/'
OLD_FOLDER = os.path.join(IMAGE_FOLDER, 'old')

def ensure_folders():
    if not os.path.exists(IMAGE_FOLDER):
        os.makedirs(IMAGE_FOLDER)
    if not os.path.exists(OLD_FOLDER):
        os.makedirs(OLD_FOLDER)

def resize_image(path):
    img = Image.open(path)
    width, height = img.size
    max_side = max(width, height)

    # Liste des tailles parfaites
    breakpoints = [1920, 1280, 800, 600]

    # Check si on est pile sur un breakpoint
    if max_side in breakpoints:
        print(f"✅ Taille parfaite pour {path} ({width}x{height}), aucune action.")
        img.close()
        return

    # Définir le nouveau side cible
    if max_side > 1920:
        new_side = 1920
    elif max_side > 1280:
        new_side = 1280
    elif max_side > 800:
        new_side = 800
    elif max_side > 600:
        new_side = 600
    else:
        print(f"✅ Image trop petite, pas de resize nécessaire pour {path} ({width}x{height})")
        img.close()
        return

    # Downscale si nécessaire
    if max_side > new_side:
        if width >= height:
            new_width = new_side
            new_height = int(height * (new_width / width))
        else:
            new_height = new_side
            new_width = int(width * (new_height / height))

        img.close()

        old_path = os.path.join(OLD_FOLDER, os.path.basename(path))
        shutil.move(path, old_path)
        print(f"📦 Ancienne image déplacée : {old_path}")

        img = Image.open(old_path)
        img = img.resize((new_width, new_height), Image.LANCZOS)

        ext = os.path.splitext(path)[1].lower()
        if ext in ['.jpg', '.jpeg']:
            img.save(path, format='JPEG', quality=85, optimize=True)
        elif ext == '.png':
            img.save(path, format='PNG', optimize=True)
        else:
            img.save(path)  # fallback brut

        img.close()
        print(f"🔻 Image redimensionnée et compressée : {path} ({width}x{height} ➔ {new_width}x{new_height})")
    else:
        print(f"✅ Taille correcte pour {path} ({width}x{height}), pas de changement.")
        img.close()

def batch_resize(folder):
    for file in os.listdir(folder):
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            path = os.path.join(folder, file)
            resize_image(path)

if __name__ == '__main__':
    ensure_folders()
    print(f"🚀 Redimensionnement des images dans {IMAGE_FOLDER}...")
    batch_resize(IMAGE_FOLDER)
    print("🏁 Redimensionnement terminé.")
