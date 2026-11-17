# NeuroSense — Draw. Speak. Understand.

An AI-powered multimodal neurological **screening and education companion**.
Users complete short drawing and voice activities; the app shows AI-estimated
screening scores plus plain-language education.

> NeuroSense is not a diagnostic tool. Every result is an AI screening estimate,
> never a medical diagnosis.

## Stack

- **Frontend**: React 19 + TypeScript, TanStack Start (file-based routing), Vite 7, Tailwind CSS v4, shadcn/ui
- **Backend**: Supabase (auth, Postgres + RLS, private storage) and TanStack server functions / server routes
- **ML**: Python (PyTorch for drawing, scikit-learn + librosa for voice) in `ml/`

## Folder map

```text
src/
  routes/                    pages (file-based routing)
    index.tsx                landing
    auth/                    sign in / sign up / reset
    _authenticated/          onboarding, home, checkin, drawing, voice,
                             results, progress, companion, learn, simulation,
                             profile, admin/*
    api/public/              webhooks (training-callback)
  components/neuro/          canvas, recorder, gauges, disclaimers, nav
  components/ui/             shadcn primitives
  lib/                       drawing.ts, fusion, assessment.ts,
                             training.functions.ts (server functions)
  integrations/supabase/     generated client + types (do not edit)
  styles.css                 design tokens (mint / deep green / lavender / cream)
supabase/migrations/         database schema, RLS policies, grants
ml/                          Python training + inference service
  train_drawing.py           PyTorch image model per task
  train_voice.py             MFCC/pitch features + gradient boosting
  app.py                     FastAPI: /train, /predict/*, /health
  callback.py                reports job status back to the app
  datasets/                  put your data here (see datasets/README.md)
  models/                    trained model output
PROJECT_STATUS.md            what is real vs Demo Mode
.env.example                 environment template
```

## Run the web app

```sh
npm install     # or bun install
npm run dev     # http://localhost:8080
```

Copy `.env.example` to `.env` and fill in your backend values when running
outside Lovable.

## Run the ML side

See `ml/README.md`. Short version:

```sh
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python train_drawing.py --task spiral
uvicorn app:app --port 9000
```

Then set `TRAINING_WEBHOOK_URL`, `TRAINING_CALLBACK_SECRET` and `APP_ORIGIN` as
backend secrets in the app so the admin Training screen can dispatch jobs.

## Assessment flow

Start → Drawing check (spiral, circle, meander) → Voice check → Fusion analysis
→ Final result. One screening session is shared across every step; the final
score is the weighted combination of both modality scores (default 50/50,
configurable) and is only produced after both checks complete.

## Status

See [PROJECT_STATUS.md](./PROJECT_STATUS.md) — everything except the model
prediction scores is real; those stay in visible Demo Mode until you train and
activate a model.
