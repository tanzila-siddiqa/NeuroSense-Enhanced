# NeuroSense — what is real and what is Demo Mode

NeuroSense is a screening-support and education companion. It never diagnoses.
Every AI result in the product carries an "AI screening estimate — not a medical
diagnosis" note.

## Real and functional today

| Area | Status |
| --- | --- |
| Auth (sign up, sign in, reset, persisted session, roles user/admin) | Real |
| Database + row-level security, profiles, all session tables | Real |
| Onboarding, home dashboard, bottom nav, profile, account deletion | Real |
| Drawing canvas (spiral / circle / meander), stroke capture, duration, point count, average speed | Real |
| Drawing image upload to private storage + `drawing_sessions` rows | Real |
| Voice recorder, waveform, level meter, audio upload + `voice_sessions` rows | Real |
| Guided assessment flow: Start → Drawing → Voice → Fusion → Result | Real |
| Fusion maths (weighted combination, configurable weights, risk banding) | Real |
| Progress charts, session history, filters (7d/30d/3mo/6mo/1yr) | Real |
| Companion chatbot (server-side LLM, safety prompt blocking diagnosis/prescription) | Real |
| Learn articles | Real |
| Admin: dataset ZIP upload, inventory, versioning, rollback, current version | Real |
| Admin: training job records, dispatch webhook, secured callback, metrics, curves, overfitting warning | Real (needs the Python service running) |
| Admin: model registry, explicit per-modality activation, audit log | Real |
| Python training scripts and service (`ml/`) | Real |

## Demo Mode / simulated

| Area | Status |
| --- | --- |
| Drawing probability + confidence scores | Simulated (`is_demo: true`, Demo Mode badge) |
| Voice probability + confidence scores | Simulated (`is_demo: true`, Demo Mode badge) |
| Fused overall score | Real maths over simulated inputs — badged Demo Mode |
| Simulation page animations | Procedurally generated illustrations, labelled "educational simulation only" |

Demo Mode disappears for a modality once you train a model in `ml/`, register it
and activate it in the admin Models screen, and wire the prediction call
(see `ml/README.md` → "Wiring real predictions into the app").

## Datasets

None are included. Place yours in `ml/datasets/` — exact layout in
`ml/datasets/README.md`.
