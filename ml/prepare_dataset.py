"""Prepare the supplied NeuroSense raw dataset for training.

Usage (from the ml folder):
    python prepare_dataset.py --source "C:\path\to\EXTRACTED_DATASET"

The source folder should contain:
    drawings/healthy/Spiral, Circle, Meander
    drawings/parkinson/Spiral, Circle, Meander
    voice/Healthy
    voice/Parkinson

The 81-row voice_features.csv is intentionally NOT used because the raw WAV
files are the source of truth for the voice model. The separate 195-row
voice_data.data file is also not mixed into this project.
"""

from __future__ import annotations
import argparse
import shutil
from pathlib import Path

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"}

def copy_files(src: Path, dst: Path, extensions: set[str]) -> int:
    count = 0
    if not src.exists():
        return 0
    dst.mkdir(parents=True, exist_ok=True)
    for f in src.rglob("*"):
        if f.is_file() and f.suffix.lower() in extensions:
            target = dst / f.name
            # Avoid accidental overwrite when duplicate names exist.
            if target.exists():
                target = dst / f"{f.stem}_{count}{f.suffix}"
            shutil.copy2(f, target)
            count += 1
    return count

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="Extracted dataset folder")
    ap.add_argument("--dest", default="./datasets", help="NeuroSense datasets folder")
    args = ap.parse_args()

    source = Path(args.source).expanduser().resolve()
    dest = Path(args.dest).expanduser().resolve()

    drawing_src = source / "drawings"
    voice_src = source / "voice"

    if not drawing_src.exists():
        raise FileNotFoundError(f"Missing drawings folder: {drawing_src}")
    if not voice_src.exists():
        raise FileNotFoundError(f"Missing voice folder: {voice_src}")

    total = 0
    task_map = {"Spiral": "spiral", "Circle": "circle", "Meander": "meander"}
    for source_class, target_class in [("healthy", "healthy"), ("parkinson", "parkinson")]:
        for source_task, target_task in task_map.items():
            n = copy_files(
                drawing_src / source_class / source_task,
                dest / "drawing" / target_task / target_class,
                IMAGE_EXT,
            )
            print(f"drawing/{target_task}/{target_class}: {n}")
            total += n

    voice_map = {"Healthy": "healthy", "Parkinson": "parkinson"}
    for source_class, target_class in voice_map.items():
        n = copy_files(
            voice_src / source_class,
            dest / "voice" / target_class,
            AUDIO_EXT,
        )
        print(f"voice/{target_class}: {n}")
        total += n

    print(f"\nPrepared {total} files under: {dest}")
    print("Note: voice_features.csv and voice_data.data were not copied.")

if __name__ == "__main__":
    main()
