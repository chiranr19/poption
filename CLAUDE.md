# Poption — Options-Flow Forensics

## What this is
A demo-grade **real-time options-flow anomaly detector** with **LLM-powered
forensic explanations**. Ingests synthetic options-chain data through a
streaming pipeline, detects IV spikes and unusual put/call activity, and asks
Claude to narrate what the pattern means — *grounded in the detector's
payload only*.

**Positioning:** portfolio / interview / consulting demo piece. Not a trading
system, not licensed for real OPRA data (OPRA charges $1,500/mo redistributor
fees), not financial advice. Analysis-only forever.

## Sister project
[Stocky](https://github.com/chiranr19/stocky) is the beginner-facing learning
dashboard — EOD data, deterministic engines, no-LLM digest. Poption is the
opposite on every axis (real-time, options, synthetic data, LLM narrative).
Don't blur the lines.

## The differentiator — enforced grounding
Every number the LLM cites in a forensic explanation **must trace to the
detector's input payload**. A CI test asserts this, and fails the build on
advice-like phrasing (`you should`, `guaranteed`, `will rise`, etc.). This is
inherited from Stocky's `test_digest.py` — the anti-hallucination guarantee is
enforced code, not a policy statement.

## Stack (decided — don't relitigate)
- **Backend:** Python 3.12, FastAPI, `asyncio.Queue` broker, `websockets` for
  streaming. NumPy for Greeks / IV surface / anomaly math. Anthropic Python
  SDK for forensics (`claude-haiku-4-5-20251001` for per-tick blurbs,
  `claude-sonnet-5` for deep-dive on-demand). ChromaDB deliberately NOT used
  — a 50-entry JSON corpus + in-memory numpy cosine is plenty and stays
  swappable behind a `Retriever` interface.
- **Frontend:** Vite + React + TypeScript + Tailwind. Charts:
  **lightweight-charts** for candles (learned from Stocky — Recharts is bad at
  them), Recharts for gauges and heatmaps.
- **Deploy:** Dockerfile in the repo. Cloud Run instructions in the README —
  requires the user's GCP account, so it's user-run, not committed as code.

## Design philosophy
- **Show the anomaly against context**, never in isolation — multi-timeframe
  candles (1m/5m/1h/1D) around every fired signal.
- **Confidence gauges must show their factors** (z-score magnitude, sample
  size, regime). No bare 0-100 scores anywhere.
- **Replay mode is the wow feature.** Three real historical events (COVID
  Mar-2020, GME Jan-2021, SVB Mar-2023) as curated parameter scripts driving
  the synthetic generator — the viewer watches the system detect and explain a
  real pattern.
- **Voice narration is a stretch goal** (browser SpeechSynthesis; cheap; last).

## Conventions
- Type hints + pydantic models on every endpoint.
- Pure functions in `services/` — hand-computed fixture tests, no mocks of
  business logic.
- Correctness gates: Greeks vs analytical values, detector fires on planted
  anomalies AND is silent on calm data.
- API key via `ANTHROPIC_API_KEY` in a gitignored `.env`. Never hardcode.

## Repo layout
- `/backend` — FastAPI app, streaming pipeline, detector, forensics service,
  synthetic generator, tests.
- `/frontend` — Vite React dashboard with lightweight-charts + Recharts.
- `/.github/workflows/ci.yml` — pytest + frontend build on push.
