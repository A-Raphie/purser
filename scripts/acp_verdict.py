"""Compute a spend-check verdict for an ACP job — the bridge between the
Virtuals CLI flow and Purser's Sibyl-backed judgment.

Prints the deliverable JSON to stdout. Read-only: decide() writes nothing,
so a spend-check never pollutes dedup. (The earning row is journaled by
scripts/acp_run.sh at delivery time.)

Usage:
    .venv/bin/python scripts/acp_verdict.py --db runtime/panel_memory.db \
        --vendor weather.x402.press --sku lagos-weather-current --amount-micro 3750
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from purser.acp_service import verdict_deliverable  # noqa: E402
from purser.decide import PurchaseRequest, decide  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--vendor", required=True)
    ap.add_argument("--sku", required=True)
    ap.add_argument("--amount-micro", type=int, required=True)
    ap.add_argument("--description", default="ACP spend-check job")
    ap.add_argument("--requested-by", default="acp-client")
    ap.add_argument("--job-id", default="")
    args = ap.parse_args()

    req = PurchaseRequest(
        vendor=args.vendor,
        sku=args.sku,
        amount_micro=args.amount_micro,
        description=args.description,
        requested_by=args.requested_by,
    )
    dec = decide(req, PurserMemory(args.db))
    print(json.dumps(verdict_deliverable(dec, f"job-{args.job_id}", args.job_id)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
