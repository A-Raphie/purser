"""The crew: scout → purser → auditor, coordinating ONLY through Sibyl
Memory. No messages, no queues — HOT handoff keys carry the work, WARM holds
the shared world, COLD journals every step. Each role runs as a FRESH process
(every shift starts cold and recalls).

Run one shift:
  python -m purser.crew --db runtime/crew.db --shift 1 \
      --need weather-lagos --vendor weather.x402.press \
      --sku lagos-weather-current --amount-micro 3750 \
      --url "https://weather.x402.press/weather/current?latitude=6.45&longitude=3.39" \
      --pay-mode simulate
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

from .decide import PurchaseRequest, decide, learn_from_outcome
from .memory import PurserMemory
from .pay import pay

SCOUT_TO_PURSER = ("scout", "purser")
PURSER_TO_AUDITOR = ("purser", "auditor")


def _today() -> str:
    return _dt.date.today().isoformat()


# ---------------------------------------------------------------- roles


def run_scout(db: str, shift: int, need: str, vendor: str, sku: str,
              amount_micro: int, url: str, pay_mode: str) -> dict[str, Any]:
    """Fresh process. Recalls whether the need is already served, then writes
    the HOT handoff for the purser (or marks it a duplicate up front)."""
    mem = PurserMemory(db)
    mem._client.set_state(f"session:scout", {"shift": shift, "started": _today(), "need": need})

    prior = mem.get_purchase(vendor, sku)
    handoff: dict[str, Any] = {
        "shift": shift, "need": need, "vendor": vendor, "sku": sku,
        "amount_micro": amount_micro, "url": url, "pay_mode": pay_mode,
        "scout_note": "fresh need", "requested_by": "scout",
    }
    if prior is not None:
        handoff["scout_note"] = (f"likely duplicate: purchased {prior.get('date')} "
                                 f"(tx {str(prior.get('tx', ''))[:14]}…) — purser to verify")
    mem.set_handoff(*SCOUT_TO_PURSER, handoff)
    mem.journal(acted=[f"scout filed need '{need}' ({vendor}:{sku}) for shift {shift}"],
                extra={"kind": "crew", "role": "scout", "shift": shift, "date": _today()})
    return handoff


def run_purser(db: str, shift: int) -> dict[str, Any]:
    """Fresh process. Reads the scout's handoff from HOT, decides from memory,
    pays, learns, and hands the reconciliation work to the auditor."""
    mem = PurserMemory(db)
    mem._client.set_state(f"session:purser", {"shift": shift, "started": _today()})
    handoff = mem.get_handoff(*SCOUT_TO_PURSER)
    if not handoff:
        return {"error": "no scout handoff waiting"}

    req = PurchaseRequest(
        vendor=handoff["vendor"], sku=handoff["sku"],
        amount_micro=int(handoff["amount_micro"]), url=handoff.get("url", ""),
        description=handoff.get("need", ""), requested_by="scout")
    dec = decide(req, mem)
    if dec.approve:
        result = pay(req, mode=handoff.get("pay_mode", "simulate"))
        outcome = {"status": result.status, "tx": result.tx, "detail": result.detail}
    else:
        outcome = {"status": "refused", "tx": "", "detail": dec.reason}
    ledger_id = learn_from_outcome(req, dec, outcome, mem)

    # consume the handoff so a second purser run finds nothing stale
    mem.set_handoff(*SCOUT_TO_PURSER, {**handoff, "status": "consumed",
                                       "consumed_shift": shift})
    mem.set_handoff(*PURSER_TO_AUDITOR, {
        "shift": shift, "vendor": req.vendor, "sku": req.sku,
        "approved": dec.approve, "rule": dec.rule, "ledger_id": ledger_id,
        "note": "reconcile this decision against WARM entities"})
    mem.journal(acted=[f"purser decided '{req.sku}': {'PAID' if dec.approve else f'REFUSED [{dec.rule}]'}"],
                extra={"kind": "crew", "role": "purser", "shift": shift, "date": _today()})
    return {"approve": dec.approve, "rule": dec.rule, "ledger_id": ledger_id,
            "payment": outcome}


def run_auditor(db: str, shift: int) -> dict[str, Any]:
    """Fresh process. Reconciles the COLD journal against WARM entities and
    writes the audit verdict into HOT state. Drift is flagged, never hidden."""
    mem = PurserMemory(db)
    mem._client.set_state("session:auditor", {"shift": shift, "started": _today()})
    handoff = mem.get_handoff(*PURSER_TO_AUDITOR)

    payments: list[dict[str, Any]] = []
    for ev in mem.recent_events(limit=200):
        extra = ev.get("extra") or {}
        if extra.get("kind") == "payment" and extra.get("status") in ("settled", "simulated"):
            payments.append(extra)

    drift: list[str] = []
    checked = 0
    for p in payments:
        checked += 1
        vendor, sku = p.get("vendor", "?"), p.get("sku", "")
        if mem.get_purchase(vendor, sku) is None:
            drift.append(f"journal payment {vendor}:{sku} has no WARM purchase entity")

    if handoff and handoff.get("ledger_id") and not handoff.get("consumed_shift"):
        ids = {e.get("id") for e in mem.recent_events(limit=200)}
        if handoff["ledger_id"] not in ids:
            drift.append("purser handed off a ledger id that is not in the journal")

    verdict = {"shift": shift, "checked": checked, "drift": drift,
               "clean": not drift,
               "note": "reconciled COLD journal against WARM purchases"}
    mem._client.set_state("audit", verdict)
    if handoff:
        mem.set_handoff(*PURSER_TO_AUDITOR, {**handoff, "status": "consumed",
                                             "consumed_shift": shift})
    mem.journal(acted=[f"auditor shift {shift}: {'CLEAN' if not drift else f'DRIFT x{len(drift)}'} "
                       f"({checked} payments checked)"],
                extra={"kind": "crew", "role": "auditor", "shift": shift,
                       "date": _today(), "drift": drift})
    return verdict


# ---------------------------------------------------------------- orchestrator


def run_shift(args: argparse.Namespace) -> int:
    root = Path(__file__).resolve().parent.parent
    base = [sys.executable, "-m", "purser.crew", "--db", args.db,
            "--shift", str(args.shift), "--pay-mode", args.pay_mode]

    def proc(role: str, extra: list[str] | None = None) -> int:
        cmd = [*base, "--role", role, *(extra or [])]
        return subprocess.run(cmd, cwd=str(root)).returncode

    rc = proc("scout", ["--need", args.need, "--vendor", args.vendor,
                        "--sku", args.sku, "--amount-micro", str(args.amount_micro),
                        "--url", args.url])
    if rc:
        return rc
    rc = proc("purser")
    if rc:
        return rc
    rc = proc("auditor")
    return rc


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--role", choices=["scout", "purser", "auditor", "shift"])
    ap.add_argument("--shift", type=int, default=1)
    ap.add_argument("--pay-mode", choices=["simulate", "real"], default="simulate")
    ap.add_argument("--need", default="need")
    ap.add_argument("--vendor", default="weather.x402.press")
    ap.add_argument("--sku", default="lagos-weather-current")
    ap.add_argument("--amount-micro", type=int, default=3_750)
    ap.add_argument("--url", default="")
    args = ap.parse_args()

    if args.role == "scout":
        out = run_scout(args.db, args.shift, args.need, args.vendor, args.sku,
                        args.amount_micro, args.url, args.pay_mode)
    elif args.role == "purser":
        out = run_purser(args.db, args.shift)
    elif args.role == "auditor":
        out = run_auditor(args.db, args.shift)
    else:
        return run_shift(args)
    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
