# ✦ @chiranr19 · © 2026 All Rights Reserved · proprietary · sigil:UOAELIPGBDVWPU6C
"""Pytest bootstrap — put backend/ on sys.path so `from app...` resolves."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
