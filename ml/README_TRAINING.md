# NeuroSense — Corrected ML Training Pack

This pack is designed for the supplied raw NeuroSense dataset.

## Why augmentation?

The drawing dataset is small, and the voice dataset has only 81 recordings.
We use **conservative augmentation on the training set only**.

We do NOT augment validation/test data.

### Drawing augmentation
- small rotation
- small translation/scale variation

We intentionally do not use aggressive horizontal flipping because it can
change meaningful drawing geometry.

### Voice augmentation
- very low-level additive noise
- small time stretch

We intentionally avoid pitch shifting because pitch is itself an important
voice feature.

## Most important rule: no leakage

For drawings, filenames contain participant identifiers. The script splits
participants first, then assigns all of a participant's images to exactly one
of train/validation/test.

For voice, the 81 original recordings are split first. Only training
recordings are augmented.

The separate 195-row `voice_data.data` dataset is NOT mixed with the 81 WAV
recordings.

## Install

From the NeuroSense `ml` folder:

    python -m pip install -r requirements.txt

## Prepare the dataset

First extract your dataset ZIP somewhere, for example:

    C:\Users\tasmi\Downloads\parkinson_dataset

The extracted folder should contain `drawings` and `voice`.

Then:

    python prepare_dataset.py --source "C:\Users\tasmi\Downloads\parkinson_dataset"

This creates:

    ml/datasets/
      drawing/
        spiral/healthy
        spiral/parkinson
        circle/healthy
        circle/parkinson
        meander/healthy
        meander/parkinson
      voice/
        healthy
        parkinson

## Train drawing models

Run one at a time:

    python train_drawing.py --task spiral --epochs 25
    python train_drawing.py --task circle --epochs 25
    python train_drawing.py --task meander --epochs 25

Outputs:

    ml/models/drawing_spiral.pt
    ml/models/drawing_circle.pt
    ml/models/drawing_meander.pt

plus JSON metric/curve files.

## Train voice model

    python train_voice.py --epochs 150

Output:

    ml/models/voice_model.joblib

## What to report

Do NOT report only accuracy.

For each model record:
- Accuracy
- Precision
- Recall
- F1-score
- ROC-AUC
- Confusion matrix
- Number of original train/validation/test participants or recordings

Because this is a small dataset, treat the metrics as experimental screening
results rather than clinical performance.

## Compatibility

The drawing `.pt` files and voice `.joblib` file are compatible with the
current NeuroSense `ml/app.py` inference endpoints.
