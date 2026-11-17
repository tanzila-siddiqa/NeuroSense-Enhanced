from pathlib import Path
import random

import numpy as np
import librosa
import soundfile as sf


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

SOURCE_DIR = BASE_DIR / "datasets" / "voice"
OUTPUT_DIR = BASE_DIR / "datasets" / "voice_augmented"

random.seed(42)
np.random.seed(42)

# Number of augmented versions per original
AUGMENTATIONS_PER_FILE = 4

TARGET_SR = 16000


# ============================================================
# AUGMENTATION FUNCTIONS
# ============================================================

def add_noise(audio):
    """
    Add very small background noise.
    """
    noise_level = random.uniform(0.002, 0.008)

    noise = np.random.normal(
        0,
        noise_level,
        size=len(audio)
    )

    return audio + noise


def time_stretch(audio):
    """
    Slightly speed up or slow down the recording.
    """
    rate = random.choice([
        0.97,
        1.03
    ])

    return librosa.effects.time_stretch(
        audio,
        rate=rate
    )


def change_volume(audio):
    """
    Small volume variation.
    """
    factor = random.uniform(
        0.90,
        1.10
    )

    return audio * factor


def time_shift(audio):
    """
    Shift audio slightly left or right.
    """
    shift = random.randint(
        -800,
        800
    )

    return np.roll(
        audio,
        shift
    )


# ============================================================
# PROCESS DATASET
# ============================================================

total_original = 0
total_augmented = 0

classes = [
    "healthy",
    "parkinson"
]


for class_name in classes:

    source_class = SOURCE_DIR / class_name
    output_class = OUTPUT_DIR / class_name

    output_class.mkdir(
        parents=True,
        exist_ok=True
    )

    files = list(
        source_class.glob("*.wav")
    )

    print(
        f"\n{class_name}: "
        f"{len(files)} original recordings"
    )

    for audio_path in files:

        try:

            audio, sr = librosa.load(
                audio_path,
                sr=TARGET_SR,
                mono=True
            )

        except Exception as e:

            print(
                f"Skipping "
                f"{audio_path.name}: {e}"
            )

            continue

        total_original += 1

        original_name = audio_path.stem

        # ----------------------------------------------------
        # SAVE ORIGINAL
        # ----------------------------------------------------

        sf.write(
            output_class /
            f"{original_name}_original.wav",
            audio,
            TARGET_SR
        )

        # ----------------------------------------------------
        # CREATE AUGMENTATIONS
        # ----------------------------------------------------

        for i in range(
            AUGMENTATIONS_PER_FILE
        ):

            aug = audio.copy()

            # Randomly choose one or more
            # realistic transformations

            operations = random.sample(
                [
                    "noise",
                    "stretch",
                    "volume",
                    "shift"
                ],
                k=random.randint(1, 2)
            )

            for operation in operations:

                if operation == "noise":

                    aug = add_noise(aug)

                elif operation == "stretch":

                    aug = time_stretch(aug)

                elif operation == "volume":

                    aug = change_volume(aug)

                elif operation == "shift":

                    aug = time_shift(aug)

            # Prevent clipping
            max_value = np.max(
                np.abs(aug)
            )

            if max_value > 0.99:

                aug = (
                    aug / max_value
                ) * 0.99

            output_name = (
                f"{original_name}"
                f"_aug_{i + 1}.wav"
            )

            sf.write(
                output_class /
                output_name,
                aug,
                TARGET_SR
            )

            total_augmented += 1


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("VOICE DATA AUGMENTATION COMPLETE")
print("=" * 60)

print(
    f"Original recordings processed : "
    f"{total_original}"
)

print(
    f"Augmented recordings created  : "
    f"{total_augmented}"
)

print(
    f"Total recordings              : "
    f"{total_original + total_augmented}"
)

print("\nSaved to:")
print(OUTPUT_DIR)