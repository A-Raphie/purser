#!/usr/bin/env python
"""THE demo: fresh-session recall refusing a duplicate purchase.

Session 1 (fresh process) buys Lagos weather. Session 2 (ANOTHER fresh
process) gets the same request and must refuse it, citing the ledger.

  --wipe-between   runs the amnesiac twin: memory wiped between sessions,
                   session 2 pays again. This is the litmus contrast —
                   delete the memory layer and the product is broken.

Payments default to simulate (free). --real uses actual x402 on Base
($0.00375; the flow proven in Spike B).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / "runtime"
DB = RUNTIME / "memory.db"

REQUEST = {
    "vendor": "weather.x402.press",
    "sku": "lagos-weather-current",
    "description": "current weather for Lagos (6.45, 3.39)",
    "amount_micro": 3_750,
    "url": "https://weather.x402.press/weather/current?latitude=6.45&longitude=3.39",
    "requested_by": "scout",
}


def run_session_proc(session_n: int, pay_mode: str) -> int:
    req_file = RUNTIME / f"demo_session{session_n}.json"
    req_file.write_text(json.dumps([REQUEST]))
    cmd = [sys.executable, "-m", "purser.cli",
           "--db", str(DB), "--session", str(session_n),
           "--pay-mode", pay_mode, "--requests", str(req_file)]
    proc = subprocess.run(cmd, cwd=str(ROOT / "src"), capture_output=False)
    return proc.returncode


def main() -> int:
    wipe = "--wipe-between" in sys.argv
    real = "--real" in sys.argv
    mode = "real" if real else "simulate"
    RUNTIME.mkdir(exist_ok=True)

    if DB.exists():
        DB.unlink()
    print(f"== fresh DB at {DB} (wipe-between={wipe}, pay-mode={mode}) ==\n", flush=True)

    print(">>> SESSION 1 — buys the data", flush=True)
    run_session_proc(1, mode)

    if wipe:
        print("\n*** wiping memory between sessions (the amnesia twin) ***\n", flush=True)
        DB.unlink()

    print(">>> SESSION 2 — fresh process, same request", flush=True)
    rc = run_session_proc(2, mode)
    return rc


if __name__ == "__main__":
    sys.exit(main())
