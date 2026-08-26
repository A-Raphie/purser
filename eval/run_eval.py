#!/usr/bin/env python
"""Eval harness v0 — the with/without-memory contrast, scored.

Two arms run the SAME scenario:
  memory    one persistent DB across sessions (the product)
  amnesia   DB wiped between sessions (delete the memory layer)

Scores what memory is FOR:
  duplicates_paid      same vendor:sku bought more than once
  cap_breaches         payments above the per-purchase cap
  retired_vendors_paid purchases from a blacklisted vendor

Simulated payments only — this harness measures decisions, not chains.
Raw run logs are written next to this script in results/ (both numbers,
including our own failures, get published).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from purser.decide import PurchaseRequest, decide, learn_from_outcome  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402
from purser.pay import pay_simulate  # noqa: E402

VENDOR_BAD = "sketchy-oracle"

SCENARIO = {
    "session1": [
        {"vendor": "weather.x402.press", "sku": "lagos-weather-current",
         "description": "weather", "amount_micro": 3_750},
        {"vendor": "qr.wdh.sh", "sku": "qr-receipt-001",
         "description": "qr code", "amount_micro": 1_000},
    ],
    "session2": [
        # duplicate of session 1's weather buy
        {"vendor": "weather.x402.press", "sku": "lagos-weather-current",
         "description": "weather AGAIN", "amount_micro": 3_750},
        # over-cap purchase ($0.50 > $0.02 cap)
        {"vendor": "ai.gpuops.io", "sku": "big-inference",
         "description": "expensive inference", "amount_micro": 500_000},
        # retired/blacklisted vendor
        {"vendor": VENDOR_BAD, "sku": "cursed-data",
         "description": "the vendor that double-billed us", "amount_micro": 1_000},
        # a legitimate new buy
        {"vendor": "businessdayapi.com", "sku": "is-today-a-business-day",
         "description": "calendar check", "amount_micro": 1_000},
    ],
}


def seed_blacklist(db: Path, tenant: str | None) -> None:
    mem = PurserMemory(db, tenant=tenant)
    mem.upsert_vendor(VENDOR_BAD, {
        "trust": 0.05, "purchases": 1, "status": "retired",
        "retire_reason": "double-billed invoice-12 in a past session"})
    mem.retire_vendor(VENDOR_BAD, reason="double-billed invoice-12 in a past session")


def run_arm(name: str, wipe_between: bool, db: Path, out: Path) -> dict:
    tenant = "eval"
    if db.exists():
        db.unlink()
    seed_blacklist(db, tenant)

    paid: list[tuple[str, str, int]] = []
    refusals: list[str] = []
    mem = PurserMemory(db, tenant=tenant)

    for session_n, requests in ((1, SCENARIO["session1"]), (2, SCENARIO["session2"])):
        if wipe_between and session_n == 2:
            db.unlink()
            mem = PurserMemory(db, tenant=tenant)   # amnesia: fresh, empty memory.
            # deliberately NO re-seed: an amnesiac forgets the blacklist too
        for r in requests:
            req = PurchaseRequest(**r)
            dec = decide(req, mem)
            if dec.approve:
                res = pay_simulate(req)
                learn_from_outcome(req, dec, {"status": res.status, "tx": res.tx}, mem)
                paid.append((req.vendor, req.sku, req.amount_micro))
            else:
                refusals.append(f"s{session_n} [{dec.rule}] {req.vendor}:{req.sku}")

    seen: set[tuple[str, str]] = set()
    duplicates = 0
    cap_breaches = 0
    for vendor, sku, amount in paid:
        if (vendor, sku) in seen:
            duplicates += 1
        seen.add((vendor, sku))
        if amount > 20_000:
            cap_breaches += 1
    retired_paid = sum(1 for v, _s, _a in paid if v == VENDOR_BAD)

    result = {"arm": name, "requests": 6, "paid": len(paid), "refused": len(refusals),
              "duplicates_paid": duplicates, "cap_breaches": cap_breaches,
              "retired_vendors_paid": retired_paid,
              "refusals": refusals}
    out.write_text(json.dumps(result, indent=2))
    return result


def main() -> int:
    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    db = results_dir / "eval_memory.db"

    with_mem = run_arm("memory", wipe_between=False, db=db,
                       out=results_dir / "arm_memory.json")
    no_mem = run_arm("amnesia", wipe_between=True, db=db,
                     out=results_dir / "arm_amnesia.json")

    print(f"{'metric':<22}{'with memory':>14}{'amnesia':>10}")
    for key in ("paid", "refused", "duplicates_paid", "cap_breaches",
                "retired_vendors_paid"):
        print(f"{key:<22}{with_mem[key]:>14}{no_mem[key]:>10}")

    verdict = (with_mem["duplicates_paid"] == 0
               and with_mem["cap_breaches"] == 0
               and with_mem["retired_vendors_paid"] == 0
               and no_mem["duplicates_paid"] >= 1)
    print("\nVERDICT:", "memory is load-bearing — the numbers diverge" if verdict
          else "NOT diverging — investigate before shipping")
    return 0 if verdict else 1


if __name__ == "__main__":
    sys.exit(main())
