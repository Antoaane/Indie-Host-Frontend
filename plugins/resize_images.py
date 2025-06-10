import os
import shutil
import subprocess
from PIL import Image
import platform

IMAGE_FOLDER = 'public/assets/media/images/'
OLD_FOLDER = os.path.join(IMAGE_FOLDER, 'old')

# Détection du bon binaire pngquant selon l'OS
def get_pngquant_path():
    system = platform.system().lower()
    if system == "windows":
        return os.path.join("plugins", "bin", "windows", "pngquant.exe")
    elif system == "darwin":
        return os.path.join("plugins", "bin", "darwin", "pngquant")
    elif system == "linux":
        return os.path.join("plugins", "bin", "linux", "pngquant")
    else:
        raise RuntimeError("Système non supporté pour pngquant.")

def has_pngquant():
    try:
        pngquant_path = get_pngquant_path()
        return os.path.exists(pngquant_path)
    except:
        return False

def compress_png_with_pngquant(image_path):
    pngquant = get_pngquant_path()
    output_path = image_path.replace(".png", "-fs8.png")
    result = subprocess.run([
        pngquant,
        "--force",
        "--output", output_path,
        "--quality=55-85",
        "--speed", "1",
        image_path
    ])
    if result.returncode == 0 and os.path.exists(output_path):
        os.replace(output_path, image_path)
        print(f"✅ PNG compressé avec pngquant: {image_path}")
    else:
        print(f"❌ Échec compression pngquant: {image_path}")

def ensure_folders():
    os.makedirs(IMAGE_FOLDER, exist_ok=True)
    os.makedirs(OLD_FOLDER, exist_ok=True)

def resize_image(path):
    ext = os.path.splitext(path)[1].lower()
    img = Image.open(path)
    width, height = img.size
    max_side = max(width, height)

    # Barèmes de poids max selon format
    size_thresholds = {
        '.jpg': {1920: 600_000, 1280: 400_000, 800: 250_000, 600: 180_000},
        '.png': {1920: 800_000, 1280: 600_000, 800: 400_000, 600: 300_000},
    }

    breakpoints = [1920, 1280, 800, 600]

    if max_side in breakpoints:
        new_side = max_side
    elif max_side > 1920:
        new_side = 1920
    elif max_side > 1280:
        new_side = 1280
    elif max_side > 800:
        new_side = 800
    elif max_side > 600:
        new_side = 600
    else:
        print(f"✅ Image trop petite, pas de resize pour {path}")
        img.close()
        return

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
        img.save(path)
        img.close()
        print(f"🔻 Redimensionnée : {path} ({width}x{height} ➞ {new_width}x{new_height})")
    else:
        new_width, new_height = width, height
        img.close()

    # Compression selon seuils de poids
    final_size = os.path.getsize(path)
    threshold = size_thresholds.get(ext, {}).get(new_side)

    if threshold and final_size > threshold:
        print(f"⚠️ Compression nécessaire ({final_size // 1024} ko > {threshold // 1024} ko)")

        if ext in ['.jpg', '.jpeg']:
            img = Image.open(path)
            img = img.convert('RGB')
            img.save(path, format='JPEG', quality=80, optimize=True)
            img.close()
            print("💨 JPEG recompressé.")

        elif ext == '.png' and has_pngquant():
            compress_png_with_pngquant(path)

        elif ext == '.png':
            print("⚠️ pngquant non dispo, compression PNG ignorée.")
    else:
        print(f"✅ Compression inutile pour {path} ({final_size // 1024} ko).")

def batch_resize(folder):
    for file in os.listdir(folder):
        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
            resize_image(os.path.join(folder, file))

if __name__ == '__main__':
    ensure_folders()
    print(f"🚀 Redimensionnement des images dans {IMAGE_FOLDER}...")
    batch_resize(IMAGE_FOLDER)
    print("🌟 Traitement terminé.")
