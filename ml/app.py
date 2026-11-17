from __future__ import annotations

import asyncio
import gc
import os
from pathlib import Path

import joblib
import numpy as np

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .callback import post_callback


# ============================================================
# SETTINGS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATASET_ROOT = Path(
    os.getenv(
        "DATASET_ROOT",
        "./ml/datasets",
    )
)

MODEL_DIR = Path(
    os.getenv(
        "MODEL_DIR",
        "ml/models",
    )
)

VOICE_MODEL_PATH = (
    MODEL_DIR / "voice_model.joblib"
)

ALLOWED_VOICE_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".m4a",
    ".flac",
    ".ogg",
    ".webm",
}


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="NeuroSense ML API",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:5173",
        "https://neurosense1.vercel.app",
        "https://neurosense1-h4k7bcadr-tasmiya-a.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODEL CACHE
# ============================================================

_drawing_cache = {}

_voice_cache = None


# ============================================================
# DRAWING MODEL LOADER
# ============================================================

def _load_drawing(task: str):
    global _drawing_cache

    task = task.lower().strip()

    if task not in {
        "spiral",
        "circle",
        "meander",
    }:
        raise ValueError(
            f"Invalid drawing task: {task}"
        )

    if task in _drawing_cache:
        return _drawing_cache[task]

    _drawing_cache.clear()
    gc.collect()

    model_path = (
        MODEL_DIR
        / f"drawing_{task}.pt"
    )

    if not model_path.exists():
        raise FileNotFoundError(
            f"Drawing model not found: {model_path}"
        )

    import torch
    import torch.nn as nn
    from torchvision.models import resnet18

    print(
        f"[DRAWING] loading {task} model..."
    )

    try:
        blob = torch.load(
            model_path,
            map_location="cpu",
            weights_only=False,
        )
    except TypeError:
        blob = torch.load(
            model_path,
            map_location="cpu",
        )

    classes = blob.get(
        "classes",
        [
            "healthy",
            "parkinson",
        ],
    )

    model = resnet18(
        weights=None
    )

    model.fc = nn.Linear(
        model.fc.in_features,
        len(classes),
    )

    state_dict = blob.get(
        "state_dict"
    )

    if state_dict is None:
        raise ValueError(
            f"state_dict missing from "
            f"{model_path.name}"
        )

    model.load_state_dict(
        state_dict
    )

    model.eval()

    _drawing_cache[task] = (
        model,
        classes,
    )

    print(
        f"[DRAWING] {task} model loaded"
    )

    return (
        model,
        classes,
    )


# ============================================================
# VOICE MODEL LOADER
# ============================================================

def _load_voice():
    global _voice_cache

    if _voice_cache is not None:
        return _voice_cache

    if not VOICE_MODEL_PATH.exists():
        raise FileNotFoundError(
            "Voice model not found: "
            f"{VOICE_MODEL_PATH}"
        )

    print(
        "[VOICE] loading voice model..."
    )

    _voice_cache = joblib.load(
        VOICE_MODEL_PATH
    )

    print(
        "[VOICE] voice model loaded"
    )

    return _voice_cache


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    models = []

    if MODEL_DIR.exists():
        models = sorted(
            p.name
            for p in MODEL_DIR.iterdir()
            if p.is_file()
        )

    return {
        "ok": True,
        "dataset_root": str(
            DATASET_ROOT
        ),
        "model_dir": str(
            MODEL_DIR
        ),
        "models": models,
        "loaded_drawing_models": list(
            _drawing_cache.keys()
        ),
        "voice_model_loaded": (
            _voice_cache is not None
        ),
    }


# ============================================================
# DRAWING PREDICTION
# ============================================================

@app.post("/predict/drawing")
async def predict_drawing(
    task: str,
    file: UploadFile = File(...),
):
    task = task.lower().strip()

    if task not in {
        "spiral",
        "circle",
        "meander",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid drawing task.",
        )

    try:
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Empty drawing file.",
            )

        import io

        from PIL import Image
        import torch
        from torchvision import transforms

        image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")

        transform = transforms.Compose(
            [
                transforms.Resize(
                    (224, 224)
                ),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[
                        0.485,
                        0.456,
                        0.406,
                    ],
                    std=[
                        0.229,
                        0.224,
                        0.225,
                    ],
                ),
            ]
        )

        tensor = transform(
            image
        ).unsqueeze(0)

        model, classes = _load_drawing(
            task
        )

        with torch.inference_mode():

            output = model(
                tensor
            )

            if isinstance(
                output,
                tuple,
            ):
                output = output[0]

            probability = torch.softmax(
                output,
                dim=1,
            )[0]

            prediction_index = int(
                torch.argmax(
                    probability
                ).item()
            )

            prediction = classes[
                prediction_index
            ]

            parkinson_probability = float(
                probability[1].item()
            )

        print(
            f"[DRAWING] task={task} "
            f"prediction={prediction} "
            f"probability="
            f"{parkinson_probability:.4f}"
        )

        return {
            "ok": True,
            "task": task,
            "prediction": prediction,
            "probability": (
                parkinson_probability
            ),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"[DRAWING] error: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )


# ============================================================
# OPTIMIZED VOICE PREDICTION
# ============================================================

@app.post("/predict/voice")
async def predict_voice(
    file: UploadFile = File(...),
):
    """
    Optimized voice inference.

    Flow:

        Browser
           ↓
        uploaded bytes
           ↓
        FFmpeg / librosa
           ↓
        78 features
           ↓
        existing SVM
           ↓
        result

    No temporary audio file is created.

    IMPORTANT:
    The existing 78-feature representation
    and existing SVM model are preserved.
    """

    filename = (
        file.filename
        or "voice.webm"
    )

    suffix = (
        Path(filename)
        .suffix
        .lower()
    )

    if suffix not in ALLOWED_VOICE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported voice format. "
                f"Allowed: "
                f"{sorted(ALLOWED_VOICE_EXTENSIONS)}"
            ),
        )

    try:
        # ----------------------------------------------------
        # Read uploaded audio directly into memory.
        # ----------------------------------------------------

        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Voice recording is empty."
                ),
            )

        print(
            f"[VOICE] received "
            f"{filename} "
            f"({len(audio_bytes)} bytes)"
        )

        # ----------------------------------------------------
        # Use the same exact 78-feature extractor.
        # ----------------------------------------------------

        from .voice_features import (
            extract_features_from_bytes,
        )

        # ----------------------------------------------------
        # Feature extraction is CPU-heavy.
        # Run it in a worker thread so the FastAPI
        # event loop is not blocked.
        # ----------------------------------------------------
        print("[VOICE DEBUG] Starting feature extraction...", flush=True)

        feats = await asyncio.to_thread(
            extract_features_from_bytes,
            audio_bytes,
            suffix,
        )
        print("[VOICE DEBUG] Feature extraction completed.", flush=True)

        if feats is None:
            raise ValueError(
                "Feature extraction returned None."
            )

        feats = np.asarray(
            feats,
            dtype=np.float32,
        )

        if feats.ndim != 1:
            feats = feats.reshape(-1)

        # ----------------------------------------------------
        # HARD compatibility check.
        #
        # Existing model expects exactly 78 features.
        # ----------------------------------------------------

        if feats.shape[0] != 78:
            raise ValueError(
                "Voice feature mismatch: "
                "expected 78 features, "
                f"got {feats.shape[0]}"
            )

        print(
            "[VOICE] extracted "
            f"{feats.shape[0]} features"
        )
        print("[VOICE DEBUG] Feature count verified.",flush=True)
        print(
            "[VOICE DEBUG] feature_stats=",
            {
                "min": float(np.min(feats)),
                "max": float(np.max(feats)),
                "mean": float(np.mean(feats)),
                "std": float(np.std(feats)),
            },
        )

        # ----------------------------------------------------
        # Load existing SVM lazily.
        # ----------------------------------------------------
        print(
        "[VOICE DEBUG] Loading voice model...",
        flush=True
        )
        blob = _load_voice()
        print(
        "[VOICE DEBUG] Voice model loaded.",
        flush=True
        )
        pipeline = blob.get(
            "pipeline"
        )

        if pipeline is None:
            raise ValueError(
                "Voice model pipeline is missing."
            )

        classes = blob.get(
            "classes",
            [
                "healthy",
                "parkinson",
            ],
        )

        # ----------------------------------------------------
        # Prepare input
        # ----------------------------------------------------

        X = feats.reshape(
            1,
            -1,
        )

        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------
        print(
        "[VOICE DEBUG] Starting SVM prediction...",
        flush=True
        )
        prediction_index = int(
            pipeline.predict(
                X
            )[0]
        )
        print(
        "[VOICE DEBUG] SVM prediction completed.",
        flush=True
        )
        prediction = classes[
            prediction_index
        ]

        # ----------------------------------------------------
        # Probability
        # ----------------------------------------------------

        probability = None
        print(
        "[VOICE DEBUG] Checking probability...",
        flush=True
        )
        if hasattr(
            pipeline,
            "predict_proba",
        ):
            probabilities = (
                pipeline.predict_proba(
                    X
                )[0]
            )

            parkinson_index = None

            for (
                index,
                class_name,
            ) in enumerate(classes):

                if (
                    str(
                        class_name
                    ).lower()
                    == "parkinson"
                ):
                    parkinson_index = (
                        index
                    )
                    break

            if (
                parkinson_index
                is not None
            ):
                probability = float(
                    probabilities[
                        parkinson_index
                    ]
                )

            print(
                "[VOICE DEBUG] probabilities=",
                probabilities.tolist(),
            )

        # ----------------------------------------------------
        # Fallback
        # ----------------------------------------------------

        if probability is None:

            if (
                str(
                    prediction
                ).lower()
                == "parkinson"
            ):
                probability = 1.0

            else:
                probability = 0.0

        print(
            "[VOICE] prediction="
            f"{prediction} "
            f"probability="
            f"{probability:.4f}"
        )

        # ----------------------------------------------------
        # Screening band
        # ----------------------------------------------------

        if probability < 0.70:
            screening_band = {
                "key": "lower",
                "label": "Lower screening score",
            }

        elif probability < 0.90:
            screening_band = {
                "key": "intermediate",
                "label": "Intermediate screening score",
            }

        else:
            screening_band = {
                "key": "higher",
                "label": "Higher screening score",
            }

        # ----------------------------------------------------
        # FINAL RESPONSE
        # ----------------------------------------------------

        return {
            "ok": True,
            "modality": "voice",
            "prediction": prediction,
            "label": prediction,
            "probability": probability,
            "screening_score": probability,
            "screening_band": screening_band,
            "feature_count": int(
                feats.shape[0]
            ),
            "is_demo": False,
            "disclaimer": (
                "AI screening estimate only — "
                "not a medical diagnosis."
            ),
        }

    except HTTPException:
        raise

    except Exception as exc:
        print(
            f"[VOICE] error: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Unable to analyze the "
                f"voice recording: {exc}"
            ),
        )


# ============================================================
# TRAIN
# ============================================================

@app.post("/train")
async def train():
    """
    Training endpoint.

    Normal screening does NOT call /train.
    """

    try:
        from .train_voice import (
            train,
        )

        result = await asyncio.to_thread(
            train,
            DATASET_ROOT,
            MODEL_DIR,
        )

        return {
            "ok": True,
            "result": result,
        }

    except Exception as exc:
        print(
            f"[TRAIN] error: {exc}"
        )

        raise HTTPException(
            status_code=500,
            detail=str(exc),
        )