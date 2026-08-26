#!/usr/bin/env python
"""The crew demo: two shifts, real processes, coordination only through
Sibyl Memory tiers.

Shift 1: scout files the need → purser pays → auditor reconciles CLEAN.
Shift 2: same need → scout flags likely-duplicate → purser REFUSES via the
         ledger → auditor reconciles the refusal. Every handoff is a HOT
         state key; every step is a COLD journal line.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "runtime" / "crew_memory.db"

NEED = ["--need", "weather for lagos",
        "--vendor", "weather.x402.press",
        "--sku", "lagos-weather-current",
        "--amount-micro", "3750",
        "--url", "https://weather.x402.press/weather/current?latitude=6.45&longitude=3.39"]


def shift(n: int) -> None:
    print(f"\n════ SHIFT {n} ════", flush=True)
    cmd = [sys.executable, "-m", "purser.crew", "--db", str(DB),
           "--role", "shift", "--shift", str(n), "--pay-mode", "simulate", *NEED]
    rc = subprocess.run(cmd, cwd=str(ROOT / "src")).returncode
    if rc:
        sys.exit(rc)


def main() -> int:
    if DB.exists():
        DB.unlink()
    print("Each role runs as a SEPARATE fresh process. Their only channel is memory.", flush=True)
    shift(1)
    shift(2)

    print("\n════ HOT STATE AFTER TWO SHIFTS ════", flush=True)
    sys.path.insert(0, str(ROOT / "src"))
    from purser.memory import PurserMemory
    mem = PurserMemory(str(DB))
    for key in ("session:scout", "session:purser", "session:auditor", "audit"):
        rec = mem._client.get_state(key)
        print(f"{key}: {rec.get('body') if rec else None}")
    print("\njournal tail:")
    for ev in mem.recent_events(limit=6):
        print(f"  [{(ev.get('extra') or {}).get('role', (ev.get('extra') or {}).get('kind'))}] "
              f"{'; '.join(ev.get('acted') or [])[:90]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
