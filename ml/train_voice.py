from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np

from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import (
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    RandomForestClassifier,
)
from sklearn.feature_selection import SelectKBest, f_classif
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import (
    GridSearchCV,
    StratifiedKFold,
    train_test_split,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from .voice_features import (
    AUDIO_EXTENSIONS,
    FEATURE_COUNT,
    SAMPLE_RATE,
    extract_features,
)


CLASS_ORDER = ["healthy", "parkinson"]


# ============================================================
# DATASET HELPERS
# ============================================================

def find_voice_dataset(dataset_root: Path):
    """
    Find healthy and parkinson voice recordings.

    Expected structure:

        datasets/
            voice/
                healthy/
                    ...
                parkinson/
                    ...
    """

    possible_roots = [
        dataset_root / "voice",
        dataset_root,
    ]

    for root in possible_roots:
        healthy_dir = root / "healthy"
        parkinson_dir = root / "parkinson"

        if healthy_dir.exists() and parkinson_dir.exists():
            return healthy_dir, parkinson_dir

    raise FileNotFoundError(
        "Voice dataset not found.\n"
        "Expected:\n"
        f"  {dataset_root / 'voice' / 'healthy'}\n"
        f"  {dataset_root / 'voice' / 'parkinson'}"
    )


def collect_audio_files(directory: Path):
    """Collect supported audio files recursively."""

    files = []

    for path in directory.rglob("*"):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            files.append(path)

    return sorted(files)


def load_dataset(dataset_root: Path):
    """
    Load voice dataset paths and labels.

    Label:
        healthy   -> 0
        parkinson -> 1
    """

    healthy_dir, parkinson_dir = find_voice_dataset(dataset_root)

    healthy_files = collect_audio_files(healthy_dir)
    parkinson_files = collect_audio_files(parkinson_dir)

    if not healthy_files:
        raise RuntimeError(
            f"No healthy audio files found in {healthy_dir}"
        )

    if not parkinson_files:
        raise RuntimeError(
            f"No parkinson audio files found in {parkinson_dir}"
        )

    paths = healthy_files + parkinson_files
    labels = (
        [0] * len(healthy_files)
        + [1] * len(parkinson_files)
    )

    print(f"Healthy recordings: {len(healthy_files)}")
    print(f"Parkinson recordings: {len(parkinson_files)}")
    print(f"Total recordings: {len(paths)}")

    return paths, np.asarray(labels, dtype=np.int64)


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def build_feature_matrix(paths):
    """
    Extract the same voice features used by the deployed model.

    Feature extraction itself is implemented in voice_features.py.
    """

    features = []
    valid_paths = []

    total = len(paths)

    for index, path in enumerate(paths, start=1):

        print(
            f"[FEATURES] {index}/{total}: {path.name}",
            flush=True,
        )

        try:
            vector = extract_features(path)

            vector = np.asarray(vector, dtype=np.float32)

            if vector.shape[0] != FEATURE_COUNT:
                raise ValueError(
                    f"Expected {FEATURE_COUNT} features, "
                    f"got {vector.shape[0]}"
                )

            features.append(vector)
            valid_paths.append(path)

        except Exception as exc:
            print(
                f"[WARNING] Failed to extract features from "
                f"{path}: {exc}",
                flush=True,
            )

    if not features:
        raise RuntimeError(
            "No valid audio samples were available after "
            "feature extraction."
        )

    X = np.vstack(features)

    print(
        f"[FEATURES] Final feature matrix shape: {X.shape}",
        flush=True,
    )

    return X, valid_paths


# ============================================================
# MODEL CANDIDATES
# ============================================================

def build_model_candidates(random_state: int = 42):
    """
    Create candidate ML pipelines and parameter grids.
    """

    models = {}

    # --------------------------------------------------------
    # Logistic Regression
    # --------------------------------------------------------

    models["logistic_regression"] = (
        Pipeline(
            [
                (
                    "scaler",
                    StandardScaler(),
                ),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=3000,
                        random_state=random_state,
                    ),
                ),
            ]
        ),
        {
            "classifier__C": [
                0.01,
                0.1,
                1.0,
                10.0,
                100.0,
            ],
        },
    )

    # --------------------------------------------------------
    # RBF SVM
    # --------------------------------------------------------

    models["rbf_svm"] = (
        Pipeline(
            [
                (
                    "scaler",
                    StandardScaler(),
                ),
                (
                    "classifier",
                    SVC(
                        kernel="rbf",
                        probability=True,
                        random_state=random_state,
                    ),
                ),
            ]
        ),
        {
            "classifier__C": [
                0.1,
                1.0,
                10.0,
                100.0,
            ],
            "classifier__gamma": [
                "scale",
                "auto",
                0.001,
                0.01,
                0.1,
            ],
        },
    )

    # --------------------------------------------------------
    # Linear SVM
    # --------------------------------------------------------

    models["linear_svm"] = (
        Pipeline(
            [
                (
                    "scaler",
                    StandardScaler(),
                ),
                (
                    "classifier",
                    SVC(
                        kernel="linear",
                        probability=True,
                        random_state=random_state,
                    ),
                ),
            ]
        ),
        {
            "classifier__C": [
                0.01,
                0.1,
                1.0,
                10.0,
                100.0,
            ],
        },
    )

    # --------------------------------------------------------
    # Random Forest
    # --------------------------------------------------------

    models["random_forest"] = (
        Pipeline(
            [
                (
                    "classifier",
                    RandomForestClassifier(
                        random_state=random_state,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        {
            "classifier__n_estimators": [
                100,
                200,
                300,
            ],
            "classifier__max_depth": [
                None,
                5,
                10,
                20,
            ],
            "classifier__min_samples_split": [
                2,
                5,
                10,
            ],
        },
    )

    # --------------------------------------------------------
    # Extra Trees
    # --------------------------------------------------------

    models["extra_trees"] = (
        Pipeline(
            [
                (
                    "classifier",
                    ExtraTreesClassifier(
                        random_state=random_state,
                        n_jobs=-1,
                    ),
                ),
            ]
        ),
        {
            "classifier__n_estimators": [
                100,
                200,
                300,
            ],
            "classifier__max_depth": [
                None,
                5,
                10,
                20,
            ],
            "classifier__min_samples_split": [
                2,
                5,
                10,
            ],
        },
    )

    # --------------------------------------------------------
    # Gradient Boosting
    # --------------------------------------------------------

    models["gradient_boosting"] = (
        Pipeline(
            [
                (
                    "classifier",
                    GradientBoostingClassifier(
                        random_state=random_state,
                    ),
                ),
            ]
        ),
        {
            "classifier__n_estimators": [
                50,
                100,
                200,
            ],
            "classifier__learning_rate": [
                0.01,
                0.05,
                0.1,
            ],
            "classifier__max_depth": [
                1,
                2,
                3,
            ],
        },
    )

    return models


# ============================================================
# MODEL EVALUATION
# ============================================================

def evaluate_model(model, X_test, y_test, model_name):
    """Evaluate a trained classifier."""

    predictions = model.predict(X_test)

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    precision = precision_score(
        y_test,
        predictions,
        zero_division=0,
    )

    recall = recall_score(
        y_test,
        predictions,
        zero_division=0,
    )

    f1 = f1_score(
        y_test,
        predictions,
        zero_division=0,
    )

    try:
        probabilities = model.predict_proba(X_test)[:, 1]

        roc_auc = roc_auc_score(
            y_test,
            probabilities,
        )

    except Exception:
        probabilities = None
        roc_auc = float("nan")

    cm = confusion_matrix(
        y_test,
        predictions,
    )

    print()
    print("=" * 70)
    print(f"MODEL: {model_name}")
    print("=" * 70)

    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f}")
    print(f"Recall   : {recall:.4f}")
    print(f"F1 Score : {f1:.4f}")

    if np.isfinite(roc_auc):
        print(f"ROC-AUC  : {roc_auc:.4f}")

    print()
    print("Confusion Matrix:")
    print(cm)

    print()
    print("Classification Report:")
    print(
        classification_report(
            y_test,
            predictions,
            target_names=CLASS_ORDER,
            zero_division=0,
        )
    )

    return {
        "model": model_name,
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "roc_auc": (
            float(roc_auc)
            if np.isfinite(roc_auc)
            else None
        ),
        "confusion_matrix": cm.tolist(),
    }


# ============================================================
# TRAINING
# ============================================================

def train(
    dataset_root: Path,
    output_dir: Path,
    test_size: float = 0.20,
    validation_size: float = 0.20,
    random_state: int = 42,
):
    """
    Complete voice-model training pipeline.
    """

    print("=" * 70)
    print("NEUROSENSE VOICE MODEL TRAINING")
    print("=" * 70)

    print()
    print(f"Dataset root : {dataset_root}")
    print(f"Output dir   : {output_dir}")
    print(f"Feature count: {FEATURE_COUNT}")
    print(f"Sample rate  : {SAMPLE_RATE}")

    # --------------------------------------------------------
    # 1. Load dataset
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 1: LOADING DATASET")
    print("=" * 70)

    paths, labels = load_dataset(
        dataset_root
    )

    # --------------------------------------------------------
    # 2. Extract features
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 2: EXTRACTING FEATURES")
    print("=" * 70)

    X, valid_paths = build_feature_matrix(
        paths
    )

    # Keep labels aligned with successfully processed files.
    valid_path_set = {
        str(path): index
        for index, path in enumerate(paths)
    }

    valid_indices = [
        valid_path_set[str(path)]
        for path in valid_paths
    ]

    y = labels[valid_indices]

    print()
    print(f"X shape: {X.shape}")
    print(f"y shape: {y.shape}")

    if X.shape[1] != FEATURE_COUNT:
        raise ValueError(
            f"Feature dimension mismatch. "
            f"Expected {FEATURE_COUNT}, got {X.shape[1]}"
        )

    # --------------------------------------------------------
    # 3. Train/test split
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 3: TRAIN / TEST SPLIT")
    print("=" * 70)

    X_train_full, X_test, y_train_full, y_test = train_test_split(
        X,
        y,
        test_size=test_size,
        stratify=y,
        random_state=random_state,
    )

    print(
        f"Training samples: {len(X_train_full)}"
    )

    print(
        f"Test samples    : {len(X_test)}"
    )

    # --------------------------------------------------------
    # 4. Train/validation split
    # --------------------------------------------------------

    # validation_size is relative to the original training
    # portion so that the final split remains stratified.

    X_train, X_val, y_train, y_val = train_test_split(
        X_train_full,
        y_train_full,
        test_size=validation_size,
        stratify=y_train_full,
        random_state=random_state,
    )

    print(
        f"Training samples  : {len(X_train)}"
    )

    print(
        f"Validation samples: {len(X_val)}"
    )

    print(
        f"Test samples      : {len(X_test)}"
    )

    # --------------------------------------------------------
    # 5. Candidate models
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 4: MODEL BENCHMARKING")
    print("=" * 70)

    candidates = build_model_candidates(
        random_state=random_state
    )

    cv = StratifiedKFold(
        n_splits=5,
        shuffle=True,
        random_state=random_state,
    )

    benchmark_results = []

    best_model = None
    best_model_name = None
    best_score = -np.inf
    best_params = None

    for model_name, (pipeline, param_grid) in candidates.items():

        print()
        print("-" * 70)
        print(f"Training candidate: {model_name}")
        print("-" * 70)

        search = GridSearchCV(
            estimator=pipeline,
            param_grid=param_grid,
            scoring="f1",
            cv=cv,
            n_jobs=-1,
            refit=True,
            verbose=1,
        )

        search.fit(
            X_train,
            y_train,
        )

        print()
        print(
            f"Best CV F1: {search.best_score_:.4f}"
        )

        print(
            f"Best parameters: {search.best_params_}"
        )

        validation_predictions = search.predict(
            X_val
        )

        validation_accuracy = accuracy_score(
            y_val,
            validation_predictions,
        )

        validation_precision = precision_score(
            y_val,
            validation_predictions,
            zero_division=0,
        )

        validation_recall = recall_score(
            y_val,
            validation_predictions,
            zero_division=0,
        )

        validation_f1 = f1_score(
            y_val,
            validation_predictions,
            zero_division=0,
        )

        try:
            validation_probabilities = (
                search.predict_proba(X_val)[:, 1]
            )

            validation_auc = roc_auc_score(
                y_val,
                validation_probabilities,
            )

        except Exception:
            validation_auc = float("nan")

        result = {
            "model": model_name,
            "cv_f1": float(search.best_score_),
            "validation_accuracy": float(
                validation_accuracy
            ),
            "validation_precision": float(
                validation_precision
            ),
            "validation_recall": float(
                validation_recall
            ),
            "validation_f1": float(
                validation_f1
            ),
            "validation_roc_auc": (
                float(validation_auc)
                if np.isfinite(validation_auc)
                else None
            ),
            "best_params": search.best_params_,
        }

        benchmark_results.append(result)

        print(
            f"Validation Accuracy : "
            f"{validation_accuracy:.4f}"
        )

        print(
            f"Validation Precision: "
            f"{validation_precision:.4f}"
        )

        print(
            f"Validation Recall   : "
            f"{validation_recall:.4f}"
        )

        print(
            f"Validation F1       : "
            f"{validation_f1:.4f}"
        )

        if np.isfinite(validation_auc):
            print(
                f"Validation ROC-AUC  : "
                f"{validation_auc:.4f}"
            )

        # Select based on cross-validation F1.
        if search.best_score_ > best_score:
            best_score = search.best_score_
            best_model = search.best_estimator_
            best_model_name = model_name
            best_params = search.best_params_

    if best_model is None:
        raise RuntimeError(
            "No model was successfully trained."
        )

    # --------------------------------------------------------
    # 6. Refit best model on train + validation data
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 5: REFITTING BEST MODEL")
    print("=" * 70)

    print(
        f"Selected model: {best_model_name}"
    )

    print(
        f"Best CV F1: {best_score:.4f}"
    )

    print(
        f"Best parameters: {best_params}"
    )

    X_train_final = np.vstack(
        [
            X_train,
            X_val,
        ]
    )

    y_train_final = np.concatenate(
        [
            y_train,
            y_val,
        ]
    )

    best_model.fit(
        X_train_final,
        y_train_final,
    )

    # --------------------------------------------------------
    # 7. Calibration
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 6: CALIBRATING PROBABILITIES")
    print("=" * 70)

    try:
        calibrated_model = CalibratedClassifierCV(
            estimator=best_model,
            method="sigmoid",
            cv=5,
        )

        calibrated_model.fit(
            X_train_final,
            y_train_final,
        )

        final_model = calibrated_model

        print(
            "Probability calibration completed."
        )

    except Exception as exc:

        print(
            f"Calibration failed: {exc}"
        )

        print(
            "Using the best uncalibrated model."
        )

        final_model = best_model

    # --------------------------------------------------------
    # 8. Final test evaluation
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 7: FINAL TEST EVALUATION")
    print("=" * 70)

    final_results = evaluate_model(
        final_model,
        X_test,
        y_test,
        best_model_name,
    )

    # --------------------------------------------------------
    # 9. Save model
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("STEP 8: SAVING MODEL")
    print("=" * 70)

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    model_path = (
        output_dir /
        "voice_model.joblib"
    )

    joblib.dump(
        final_model,
        model_path,
    )

    print(
        f"Model saved to: {model_path}"
    )

    # --------------------------------------------------------
    # 10. Save metadata
    # --------------------------------------------------------

    metadata = {
        "feature_count": FEATURE_COUNT,
        "sample_rate": SAMPLE_RATE,
        "class_order": CLASS_ORDER,
        "model_name": best_model_name,
        "best_cv_f1": float(best_score),
        "best_params": best_params,
        "benchmark_results": benchmark_results,
        "final_test_results": final_results,
        "train_samples": int(len(X_train)),
        "validation_samples": int(len(X_val)),
        "test_samples": int(len(X_test)),
        "total_samples": int(len(X)),
    }

    metadata_path = (
        output_dir /
        "voice_model_metadata.json"
    )

    with open(
        metadata_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metadata,
            file,
            indent=2,
            default=str,
        )

    print(
        f"Metadata saved to: {metadata_path}"
    )

    print()
    print("=" * 70)
    print("VOICE MODEL TRAINING COMPLETE")
    print("=" * 70)

    print()
    print("Final Test Results:")

    for key, value in final_results.items():

        if key not in {
            "model",
            "confusion_matrix",
        }:
            print(
                f"{key}: {value}"
            )

    print()
    print(
        f"Model: {model_path}"
    )

    return final_model, final_results


# ============================================================
# COMMAND-LINE ENTRY POINT
# ============================================================

def main():
    parser = argparse.ArgumentParser(
        description="Train NeuroSense voice Parkinson's model."
    )

    parser.add_argument(
        "--dataset",
        type=str,
        default="ml/datasets",
        help="Path to dataset root.",
    )

    parser.add_argument(
        "--output",
        type=str,
        default="ml/models",
        help="Directory where the trained model is saved.",
    )

    parser.add_argument(
        "--test-size",
        type=float,
        default=0.20,
        help="Fraction of data used for the final test set.",
    )

    parser.add_argument(
        "--validation-size",
        type=float,
        default=0.20,
        help="Fraction of the remaining training data used for validation.",
    )

    parser.add_argument(
        "--random-state",
        type=int,
        default=42,
        help="Random seed.",
    )

    args = parser.parse_args()

    train(
        dataset_root=Path(args.dataset),
        output_dir=Path(args.output),
        test_size=args.test_size,
        validation_size=args.validation_size,
        random_state=args.random_state,
    )


if __name__ == "__main__":
    main()