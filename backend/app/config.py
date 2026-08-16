"""Application settings + tuning constants (documented so the UI can explain them)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Frontend origin for CORS + WebSocket.
    cors_origin: str = "http://localhost:5173"

    # Anthropic API for forensic explanations. Empty = stub responses so the app still runs.
    anthropic_api_key: str = ""

    # Fast/cheap model for per-tick blurbs; deep-reasoning model for on-demand forensics.
    claude_fast_model: str = "claude-haiku-4-5-20251001"
    claude_deep_model: str = "claude-sonnet-5"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


# --------------------------------------------------------------------------- #
# Simulation defaults — the demo uses one liquid name so the chain stays legible.
# --------------------------------------------------------------------------- #
DEFAULT_SYMBOL = "DEMO"
DEFAULT_SPOT = 200.0            # opening spot price
DEFAULT_R = 0.05                # risk-free rate (annualized)
DEFAULT_Q = 0.0                 # dividend yield
BASE_IV = 0.22                  # baseline at-the-money implied vol

# Strike ladder: percent offsets from spot at generation time.
STRIKE_OFFSETS_PCT = [-15, -10, -7.5, -5, -2.5, 0, 2.5, 5, 7.5, 10, 15]
# Expirations in days-to-expiry.
DEFAULT_DTES = [7, 14, 30, 60, 90]


# --------------------------------------------------------------------------- #
# Anomaly detector — the numbers the UI teaches users to read.
# --------------------------------------------------------------------------- #
# Rolling z-score windows (in ticks).
IV_ZSCORE_WINDOW = 60
PC_RATIO_WINDOW = 60
VOL_OI_WINDOW = 60

# Absolute z-score above which a signal fires. Calibrated (see
# tests/test_detector.py::test_detector_is_silent_on_calm_data) so 200 calm
# ticks produce zero false positives — per-tick P/C sampling variance is
# ~10% coefficient of variation, so a 2.5σ threshold naturally fires ~1% of
# the time; 4.0 stays well past the noise floor while still catching planted
# biases (which push the signal well past 20σ).
IV_SPIKE_Z = 4.0
PC_SHIFT_Z = 4.0
VOL_OI_Z = 4.0

# Minimum samples in a rolling window before we even score — keeps a cold start
# from firing noise.
MIN_SAMPLES = 20

# Confidence weighting: raw scores get combined into 0-100. Each factor is
# surfaced in the UI so no gauge is ever a bare number.
CONFIDENCE_WEIGHTS = {
    "magnitude": 0.50,   # how far past the trigger threshold
    "sample": 0.25,      # how mature the rolling window is
    "regime": 0.25,      # calm/normal/stressed at fire time
}
