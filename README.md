> **© 2026 Chiranjeev (@chiranr19) — All Rights Reserved.** This project is **source-available for viewing only**; it is *not* open source. No copying, reuse, modification, deployment, or redistribution of any part of it (or its underlying ideas) without prior written permission — see [LICENSE](./LICENSE) and [SIGNATURE](./SIGNATURE). Prospective employers and collaborators are welcome to read the code.  ·  authorship sigil `UOAE·LIPG·BDVW·PU6C`

# Poption

**Real-time options-flow forensics with grounded LLM explanations.**

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React%2018-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Sonnet%205-C96F34)
![Tests](https://img.shields.io/badge/tests-65%20passing-7c9070)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

**Streaming synthetic options chain · rolling-z anomaly engine · factor-scored
confidence · Claude-narrated forensics · CI-enforced grounding**

Poption watches a live options chain, fires when implied vol, put/call flow,
or volume-to-open-interest steps outside its rolling window, and asks Claude
to explain *why* — grounded in the detector's own numbers. Three real market
events (COVID crash, GameStop squeeze, SVB collapse) ship as one-click
replays.

The differentiator: **the LLM may only cite numbers we handed it.** A CI test
walks the generated text, matches every numeric token against the anomaly's
payload plus retrieved analogues, and fails the build on invented values or
advice-like phrasing. Grounded LLM narrative — enforced, not aspirational.

> Analysis-only demo. Synthetic data (no real OPRA feed — OPRA charges
> $1,500/mo for delayed-data redistribution alone). **Not financial advice.**

## Under the hood

| | |
|---|---|
| **Pricing** | Black-Scholes-Merton with analytical Greeks — tested to 1e-9 on put-call parity, 1e-4 vs finite-difference deltas/gammas, IV round-trip to 1e-4. |
| **IV surface** | Parametric skew + smile + term-slope in log-moneyness — reproduces the equity-vol shape without needing real data licensing. |
| **Simulator** | Regime-switching GBM (calm / normal / stressed) with per-tick spot, one-shot put-bias planting, and volume/OI shaped like real chains — deterministic under a seed for reproducible tests. |
| **Streaming** | `asyncio.Queue` broker with drop-oldest bounded queues (visualization cares about "latest," not "every"), FastAPI WebSocket fan-out, ~50ms tick-to-paint locally. |
| **Detector** | Three rolling-z detectors (IV spike, P/C shift, vol/OI divergence) with a **factor-scored** confidence — magnitude, sample maturity, and regime discount, each surfaced separately so no gauge is ever a bare number. Silence-on-calm is a test. |
| **Retrieval** | 20-entry curated event corpus (Black Monday, LTCM, Flash Crash, Volmageddon, COVID, GME, SVB, Yen carry unwind, …) ranked by kind-aware tag overlap with a regime bonus. Deterministic ⇒ reproducible LLM output. |
| **Grounded forensics** | Claude Haiku 4.5 for per-tick blurbs, Claude Sonnet 5 for on-demand deep-dives, both behind a provider interface. Runs without an API key against a deterministic stub, so tests and demos work offline. |
| **Enforcement** | `grounding_report()` walks the generated text, matches numeric tokens against a strict allow-list built from the anomaly payload + analogue metadata, and returns `ok=False` on any invented number or advice phrase. Wired to a CI test. |

## Run it

```bash
# backend (http://localhost:8000)
cd backend
python -m venv .venv && .venv\Scripts\Activate.ps1   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # optional: set ANTHROPIC_API_KEY for real forensics
uvicorn app.main:app --reload --port 8000
```

```bash
# frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`, click a scenario (COVID / GME / SVB), watch the
anomaly feed populate, click a fired anomaly to see the streaming forensic
narrative with its evidence table and historical analogues.

## Tests

```bash
cd backend && pytest
```

**65 passing.** Key correctness gates:

- `test_blackscholes.py` — pricing + Greeks against hand-computed references
- `test_simulator.py` — IV surface has equity skew; regime effects on IV/flow
- `test_detector.py` — silent on 200 calm ticks, fires on planted anomalies
- `test_forensics.py` — grounding rejects invented numbers and advice phrases

## Docker

```bash
docker build -t poption .
docker run --rm -p 8000:8000 -e ANTHROPIC_API_KEY=sk-... poption
```

Single container hosts the built frontend at `/_ui/` and the API at `/`. Deploy
target is Cloud Run or any Docker host; no external state, one process, no
scheduled jobs.

## Honest notes

- **Data is synthetic.** Poption reproduces the *shape* of the flow around
  real events (COVID / GME / SVB), not the actual OPRA prints. Licensing a
  live delayed feed costs $1,500/mo before you display a single quote.
- The **retriever is deliberately simple** (kind-weighted tag overlap over
  20 curated events, in-memory numpy) — the `Retriever` interface is one
  method, so swapping to embeddings + a vector store is a 40-line change.
- **Claude API is optional.** With `ANTHROPIC_API_KEY` unset, the forensics
  endpoint returns a deterministic stub built from the same inputs — grounded
  by construction. This is why the CI grounding test works with no key.
- **Confidence factors are deliberately transparent.** Every 0-100 score is
  a weighted blend of `magnitude`, `sample`, `regime` — all surfaced next to
  the total so a viewer can see when the model is guessing.
- Sister project: **[Stocky](https://github.com/chiranr19/stocky)** — the
  beginner-facing learning dashboard (EOD, deterministic engines, no-LLM
  digest). Deliberately different on every axis.
