"""Leakage-safe drawing training for NeuroSense.

Key properties:
- Participant-aware train/validation/test split.
- Augmentation is applied ONLY to training images.
- ImageNet normalization matches NeuroSense inference.
- Class-weighted loss handles the mild class imbalance.
- Early stopping keeps the best validation model.
- Saves drawing_<task>.pt, compatible with ml/app.py.

Dataset:
    datasets/drawing/<task>/<healthy|parkinson>/*

Run from ml/:
    python train_drawing.py --task spiral --epochs 25
"""

from pathlib import Path
import argparse
import json
import random
import re
import copy

import numpy as np
from PIL import Image

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
)


# ============================================================
# SETTINGS
# ============================================================

SEED = 42
IMAGE_SIZE = 224

random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)

BASE_DIR = Path(__file__).resolve().parent

ORIGINAL_DIR = BASE_DIR / "datasets" / "drawing"
AUGMENTED_DIR = BASE_DIR / "datasets" / "drawing" / "circle_augmented"

MODEL_DIR = BASE_DIR / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

CLASSES = ["healthy", "parkinson"]
CLASS_TO_ID = {
    "healthy": 0,
    "parkinson": 1,
}


# ============================================================
# PARTICIPANT ID
# ============================================================

def get_participant_id(filename):
    """
    Extract participant ID from filenames.

    Examples:
        ...H1...  -> H1
        ...H12... -> H12
        ...P3...  -> P3

    For augmented files such as:
        something_P3_aug_1.jpg
        something_P3_original.jpg

    the original participant ID is still P3.
    """

    stem = Path(filename).stem

    # Look for H<number> or P<number>
    matches = re.findall(r"([HP]\d+)", stem, flags=re.IGNORECASE)

    if matches:
        return matches[-1].upper()

    # Fallback: use final number
    numbers = re.findall(r"\d+", stem)

    if numbers:
        return numbers[-1]

    # Should rarely happen
    return stem


# ============================================================
# GET ORIGINAL IMAGES
# ============================================================

def get_original_images(task):
    records = []

    for class_name in CLASSES:

        folder = ORIGINAL_DIR / task / class_name

        if not folder.exists():
            raise RuntimeError(f"Folder not found: {folder}")

        for path in folder.iterdir():

            if path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
                continue

            participant = get_participant_id(path.name)

            records.append({
                "path": path,
                "class_name": class_name,
                "label": CLASS_TO_ID[class_name],
                "participant": participant,
                "is_augmented": False,
            })

    return records


# ============================================================
# PARTICIPANT-AWARE SPLIT
# ============================================================

def split_participants(records):

    participants_by_class = {}

    for record in records:

        key = record["class_name"]

        if key not in participants_by_class:
            participants_by_class[key] = set()

        participants_by_class[key].add(record["participant"])

    train_participants = set()
    val_participants = set()
    test_participants = set()

    for class_name in CLASSES:

        participants = sorted(participants_by_class[class_name])

        random.Random(SEED).shuffle(participants)

        n = len(participants)

        n_train = round(n * 0.70)
        n_val = round(n * 0.15)

        train_participants.update(
            (class_name, p) for p in participants[:n_train]
        )

        val_participants.update(
            (class_name, p)
            for p in participants[n_train:n_train + n_val]
        )

        test_participants.update(
            (class_name, p)
            for p in participants[n_train + n_val:]
        )

    return (
        train_participants,
        val_participants,
        test_participants,
    )


# ============================================================
# BUILD DATASET
# ============================================================

def build_datasets(task):

    original_records = get_original_images(task)

    (
        train_participants,
        val_participants,
        test_participants,
    ) = split_participants(original_records)

    train_records = []
    val_records = []
    test_records = []

    # --------------------------------------------------------
    # ORIGINAL IMAGES
    # --------------------------------------------------------

    for record in original_records:

        key = (
            record["class_name"],
            record["participant"],
        )

        if key in train_participants:
            train_records.append(record)

        elif key in val_participants:
            val_records.append(record)

        elif key in test_participants:
            test_records.append(record)

    # --------------------------------------------------------
    # AUGMENTED IMAGES
    # ONLY FOR TRAINING PARTICIPANTS
    # --------------------------------------------------------

    if task == "circle" and AUGMENTED_DIR.exists():

        train_keys = train_participants

        for class_name in CLASSES:

            folder = AUGMENTED_DIR / class_name

            if not folder.exists():
                continue

            for path in folder.iterdir():

                if path.suffix.lower() not in [
                    ".jpg",
                    ".jpeg",
                    ".png",
                ]:
                    continue

                participant = get_participant_id(path.name)

                key = (
                    class_name,
                    participant,
                )

                if key in train_keys:

                    # Avoid adding the original twice.
                    # circle_augmented contains *_original files.
                    # The original image is already in train_records.

                    if "_original" in path.stem:
                        continue

                    train_records.append({
                        "path": path,
                        "class_name": class_name,
                        "label": CLASS_TO_ID[class_name],
                        "participant": participant,
                        "is_augmented": True,
                    })

    return (
        train_records,
        val_records,
        test_records,
        train_participants,
        val_participants,
        test_participants,
    )


# ============================================================
# DATASET CLASS
# ============================================================

class DrawingDataset(Dataset):

    def __init__(self, records, transform=None):

        self.records = records
        self.transform = transform

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):

        record = self.records[index]

        image = Image.open(record["path"]).convert("RGB")

        if self.transform:
            image = self.transform(image)

        label = record["label"]

        return image, label


# ============================================================
# TRANSFORMS
# ============================================================

train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    # Small additional augmentation.
    # The physical dataset already contains augmentation,
    # so we keep this conservative.
    transforms.RandomRotation(5),

    transforms.RandomAffine(
        degrees=0,
        translate=(0.03, 0.03),
        scale=(0.97, 1.03),
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


eval_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# MODEL
# ============================================================

def create_model():

    try:
        weights = models.ResNet18_Weights.DEFAULT
        model = models.resnet18(weights=weights)

    except Exception:
        print("Could not download pretrained weights.")
        print("Using ResNet18 without pretrained weights.")

        model = models.resnet18(weights=None)

    # Replace final layer
    model.fc = nn.Linear(
        model.fc.in_features,
        2
    )

    return model


# ============================================================
# EVALUATION
# ============================================================

def evaluate(model, loader, device):

    model.eval()

    y_true = []
    y_pred = []
    y_prob = []

    total_loss = 0
    criterion = nn.CrossEntropyLoss()

    with torch.no_grad():

        for images, labels in loader:

            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)

            loss = criterion(outputs, labels)

            total_loss += loss.item() * images.size(0)

            probabilities = torch.softmax(
                outputs,
                dim=1
            )[:, 1]

            predictions = torch.argmax(
                outputs,
                dim=1
            )

            y_true.extend(
                labels.cpu().numpy()
            )

            y_pred.extend(
                predictions.cpu().numpy()
            )

            y_prob.extend(
                probabilities.cpu().numpy()
            )

    accuracy = accuracy_score(y_true, y_pred)

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0
    )

    recall = recall_score(
        y_true,
        y_pred,
        zero_division=0
    )

    f1 = f1_score(
        y_true,
        y_pred,
        zero_division=0
    )

    cm = confusion_matrix(
        y_true,
        y_pred,
        labels=[0, 1]
    )

    try:
        roc_auc = roc_auc_score(
            y_true,
            y_prob
        )
    except ValueError:
        roc_auc = None

    avg_loss = total_loss / len(y_true)

    return {
        "loss": avg_loss,
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "confusion_matrix": cm.tolist(),
        "roc_auc": (
            float(roc_auc)
            if roc_auc is not None
            else None
        ),
        "n_test": len(y_true),
    }


# ============================================================
# TRAIN
# ============================================================

def train(task, epochs):

    print("=" * 60)
    print(f"TRAINING DRAWING MODEL: {task.upper()}")
    print("=" * 60)

    (
        train_records,
        val_records,
        test_records,
        train_participants,
        val_participants,
        test_participants,
    ) = build_datasets(task)

    print("\nPARTICIPANT SPLIT")
    print(
        f"Train participants: {len(train_participants)}"
    )
    print(
        f"Validation participants: {len(val_participants)}"
    )
    print(
        f"Test participants: {len(test_participants)}"
    )

    print("\nIMAGE COUNTS")

    print(
        f"Train images: {len(train_records)}"
    )
    print(
        f"Validation images: {len(val_records)}"
    )
    print(
        f"Test images: {len(test_records)}"
    )

    augmented_count = sum(
        1
        for r in train_records
        if r["is_augmented"]
    )

    print(
        f"Augmented training images: {augmented_count}"
    )

    # --------------------------------------------------------
    # DATASETS
    # --------------------------------------------------------

    train_dataset = DrawingDataset(
        train_records,
        train_transform
    )

    val_dataset = DrawingDataset(
        val_records,
        eval_transform
    )

    test_dataset = DrawingDataset(
        test_records,
        eval_transform
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=16,
        shuffle=True,
        num_workers=0,
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=16,
        shuffle=False,
        num_workers=0,
    )

    test_loader = DataLoader(
        test_dataset,
        batch_size=16,
        shuffle=False,
        num_workers=0,
    )

    # --------------------------------------------------------
    # DEVICE
    # --------------------------------------------------------

    device = torch.device(
        "cuda"
        if torch.cuda.is_available()
        else "cpu"
    )

    print(f"\nDevice: {device}")

    # --------------------------------------------------------
    # MODEL
    # --------------------------------------------------------

    model = create_model()

    model = model.to(device)

    # --------------------------------------------------------
    # CLASS WEIGHTS
    # --------------------------------------------------------

    class_counts = np.bincount(
        [
            record["label"]
            for record in train_records
        ],
        minlength=2
    )

    weights = len(train_records) / (
        2 * class_counts
    )

    class_weights = torch.tensor(
        weights,
        dtype=torch.float32
    ).to(device)

    criterion = nn.CrossEntropyLoss(
        weight=class_weights
    )

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-4,
        weight_decay=1e-4
    )

    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode="min",
        factor=0.5,
        patience=2
    )

    # --------------------------------------------------------
    # EARLY STOPPING
    # --------------------------------------------------------

    best_val_loss = float("inf")
    best_state = None
    patience = 6
    patience_counter = 0

    history = []

    # --------------------------------------------------------
    # TRAINING LOOP
    # --------------------------------------------------------

    for epoch in range(1, epochs + 1):

        model.train()

        running_loss = 0
        correct = 0
        total = 0

        for images, labels in train_loader:

            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad()

            outputs = model(images)

            loss = criterion(
                outputs,
                labels
            )

            loss.backward()

            optimizer.step()

            running_loss += (
                loss.item() * images.size(0)
            )

            predictions = torch.argmax(
                outputs,
                dim=1
            )

            correct += (
                predictions == labels
            ).sum().item()

            total += labels.size(0)

        train_loss = running_loss / total
        train_accuracy = correct / total

        # Validation
        val_metrics = evaluate(
            model,
            val_loader,
            device
        )

        val_loss = val_metrics["loss"]
        val_accuracy = val_metrics["accuracy"]

        scheduler.step(val_loss)

        print(
            f"Epoch {epoch:02d} | "
            f"train_loss {train_loss:.4f} | "
            f"val_loss {val_loss:.4f} | "
            f"train_acc {train_accuracy:.4f} | "
            f"val_acc {val_accuracy:.4f}"
        )

        history.append({
            "epoch": epoch,
            "train_loss": train_loss,
            "train_accuracy": train_accuracy,
            "val_loss": val_loss,
            "val_accuracy": val_accuracy,
        })

        # Save best model
        if val_loss < best_val_loss:

            best_val_loss = val_loss

            best_state = copy.deepcopy(
                model.state_dict()
            )

            patience_counter = 0

        else:

            patience_counter += 1

        if patience_counter >= patience:

            print(
                f"\nEarly stopping at epoch {epoch}."
            )

            break

    # --------------------------------------------------------
    # RESTORE BEST MODEL
    # --------------------------------------------------------

    if best_state is not None:
        model.load_state_dict(best_state)

    # --------------------------------------------------------
    # FINAL TEST
    # --------------------------------------------------------

    test_metrics = evaluate(
        model,
        test_loader,
        device
    )

    print("\n")
    print("=" * 60)
    print("FINAL TEST METRICS")
    print("=" * 60)

    print(
        json.dumps(
            test_metrics,
            indent=2
        )
    )

    # --------------------------------------------------------
    # SAVE MODEL
    # --------------------------------------------------------

    model_path = (
        MODEL_DIR /
        f"drawing_{task}.pt"
    )

    checkpoint = {
        "state_dict": model.state_dict(),
        "architecture": "resnet18",
        "classes": CLASSES,
        "task": task,
        "image_size": IMAGE_SIZE,
        "normalization": {
            "mean": [
                0.485,
                0.456,
                0.406
            ],
            "std": [
                0.229,
                0.224,
                0.225
            ],
        },
    }

    torch.save(
        checkpoint,
        model_path
    )

    # --------------------------------------------------------
    # SAVE METRICS
    # --------------------------------------------------------

    metrics = {
        **test_metrics,
        "task": task,
        "train_images": len(train_records),
        "val_images": len(val_records),
        "test_images": len(test_records),
        "train_participants": len(
            train_participants
        ),
        "val_participants": len(
            val_participants
        ),
        "test_participants": len(
            test_participants
        ),
        "augmented_train_images": augmented_count,
    }

    metrics_path = (
        MODEL_DIR /
        f"drawing_{task}_metrics.json"
    )

    with open(
        metrics_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            metrics,
            f,
            indent=2
        )

    curves_path = (
        MODEL_DIR /
        f"drawing_{task}_curves.json"
    )

    with open(
        curves_path,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            history,
            f,
            indent=2
        )

    print(f"\nSaved: {model_path}")
    print(f"Saved: {metrics_path}")
    print(f"Saved: {curves_path}")


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--task",
        choices=[
            "spiral",
            "circle",
            "meander"
        ],
        required=True
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=30
    )

    args = parser.parse_args()

    train(
        args.task,
        args.epochs
    )