"""Reports training status back to the NeuroSense app."""

import os
import requests


def post_callback(payload: dict) -> None:
    url = os.environ.get("NEUROSENSE_CALLBACK_URL")
    secret = os.environ.get("TRAINING_CALLBACK_SECRET")
    if not url or not secret:
        print("[callback] NEUROSENSE_CALLBACK_URL / TRAINING_CALLBACK_SECRET not set; skipping")
        return
    try:
        res = requests.post(
            url,
            json=payload,
            headers={"x-neurosense-secret": secret},
            timeout=30,
        )
        print(f"[callback] {payload.get('status')} -> {res.status_code} {res.text[:200]}")
    except Exception as exc:  # noqa: BLE001
        print(f"[callback] failed: {exc}")
