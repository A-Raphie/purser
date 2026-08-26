"""CLI entry for one session (fresh process per call).

Usage:
  python -m purser.cli --db runtime/memory.db --session 2 --pay-mode simulate \
      --requests runtime/session2.json
Request JSON: [{"vendor": "...", "sku": "...", "description": "...",
                "amount_micro": 3750, "url": "..."}]
"""
from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--tenant", default=None)
    ap.add_argument("--session", type=int, required=True)
    ap.add_argument("--pay-mode", choices=["simulate", "real"], default="simulate")
    ap.add_argument("--requests", required=True, help="path to request JSON list")
    args = ap.parse_args()

    from .decide import PurchaseRequest
    from .session import print_report, run_session

    with open(args.requests) as fh:
        raw = json.load(fh)
    requests = [PurchaseRequest(**r) for r in raw]

    rep = run_session(args.session, requests, db=args.db, tenant=args.tenant,
                      pay_mode=args.pay_mode)
    print_report(rep)
    return 0


if __name__ == "__main__":
    sys.exit(main())
