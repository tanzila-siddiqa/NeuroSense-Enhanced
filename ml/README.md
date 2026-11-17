# NeuroSense ML service (Python)

Real training and inference for the drawing and voice models. The web app never
trains anything itself — it dispatches jobs here and stores what this service
reports back.

## Setup

```bash
cd ml
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env      # set NEUROSENSE_CALLBACK_URL + TRAINING_CALLBACK_SECRET
```

Put your data in `ml/datasets/` (see `datasets/README.md`).

## Train from the command line

```bash
python train_drawing.py --task spiral --epochs 15 --architecture resnet18
python train_voice.py --epochs 100 --architecture gradient_boosting
```

Outputs: `models/drawing_<task>.pt`, `models/voice_model.joblib`, plus
`*_metrics.json` next to them.

## Run the service (admin panel integration)

```bash
uvicorn app:app --reload --port 9000
```

Endpoints
- `POST /train` — called by the app's admin Training screen
- `POST /predict/drawing?task=spiral` — multipart `file` (PNG/JPG)
- `POST /predict/voice` — multipart `file` (WAV)
- `GET /health`

Every request must carry `x-neurosense-secret: <TRAINING_CALLBACK_SECRET>`.

## Connect it to the app

In the app's backend secrets set:
- `TRAINING_WEBHOOK_URL` = `https://<your-service>/train`
- `TRAINING_CALLBACK_SECRET` = the same value as in `ml/.env`
- `APP_ORIGIN` = your app URL (used to build the callback URL)

For local development expose the service with a tunnel (`ngrok http 9000`) so
the hosted app can reach it.

## Wiring real predictions into the app

Training, the model registry and activation are already wired. To replace the
Demo Mode scores, call `/predict/drawing` and `/predict/voice` from a server
function in the app (upload the stored drawing image / audio clip), store the
returned probability and confidence with `is_demo: false`, and keep the
"AI screening estimate — not a medical diagnosis" disclaimer on screen.
