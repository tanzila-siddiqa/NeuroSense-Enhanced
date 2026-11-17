from pathlib import Path
from PIL import Image, ImageEnhance
import random

# --------------------------------------------------
# PATHS
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

SOURCE_DIR = BASE_DIR / "datasets" / "drawing" / "circle"
OUTPUT_DIR = BASE_DIR / "datasets" / "drawing" / "circle_augmented"

random.seed(42)

# Number of augmented images per original
AUGMENTATIONS_PER_IMAGE = 5


# --------------------------------------------------
# AUGMENTATION FUNCTIONS
# --------------------------------------------------

def rotate_image(img, angle):
    return img.rotate(angle, resample=Image.Resampling.BICUBIC, fillcolor="white")


def scale_image(img, scale):
    width, height = img.size

    new_width = int(width * scale)
    new_height = int(height * scale)

    resized = img.resize(
        (new_width, new_height),
        Image.Resampling.BICUBIC
    )

    canvas = Image.new("RGB", (width, height), "white")

    x = (width - new_width) // 2
    y = (height - new_height) // 2

    canvas.paste(resized, (x, y))

    return canvas


def shift_image(img, dx, dy):
    width, height = img.size

    shifted = Image.new("RGB", (width, height), "white")
    shifted.paste(img, (dx, dy))

    return shifted


# --------------------------------------------------
# PROCESS DATASET
# --------------------------------------------------

total_original = 0
total_augmented = 0

classes = ["healthy", "parkinson"]

for class_name in classes:

    source_class = SOURCE_DIR / class_name
    output_class = OUTPUT_DIR / class_name

    output_class.mkdir(parents=True, exist_ok=True)

    images = list(source_class.glob("*.jpg"))

    print(f"\n{class_name}: {len(images)} original images")

    for image_path in images:

        try:
            img = Image.open(image_path).convert("RGB")
        except Exception as e:
            print(f"Skipping {image_path.name}: {e}")
            continue

        total_original += 1

        # --------------------------------------------------
        # SAVE ORIGINAL
        # --------------------------------------------------

        original_name = image_path.stem

        img.save(
            output_class / f"{original_name}_original.jpg",
            quality=95
        )

        # --------------------------------------------------
        # CREATE AUGMENTATIONS
        # --------------------------------------------------

        for i in range(AUGMENTATIONS_PER_IMAGE):

            aug = img.copy()

            # 1. Small rotation
            angle = random.uniform(-8, 8)
            aug = rotate_image(aug, angle)

            # 2. Small scaling
            scale = random.uniform(0.94, 1.06)
            aug = scale_image(aug, scale)

            # 3. Small translation
            dx = random.randint(-8, 8)
            dy = random.randint(-8, 8)
            aug = shift_image(aug, dx, dy)

            # Save
            output_name = (
                f"{original_name}_aug_{i + 1}.jpg"
            )

            aug.save(
                output_class / output_name,
                quality=95
            )

            total_augmented += 1


# --------------------------------------------------
# SUMMARY
# --------------------------------------------------

print("\n" + "=" * 50)
print("CIRCLE DATA AUGMENTATION COMPLETE")
print("=" * 50)

print(f"Original images processed : {total_original}")
print(f"Augmented images created  : {total_augmented}")
print(f"Total images              : {total_original + total_augmented}")

print(f"\nSaved to:")
print(OUTPUT_DIR)