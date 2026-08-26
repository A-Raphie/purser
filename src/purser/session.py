"""Session runner — one fresh process per session, by design.

The session starts COLD: no in-process state, everything recalled from Sibyl
Memory. Flow per request: recall -> decide -> pay -> journal -> learn -> handoff.
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass
from typing import Any

from .decide import Decision, PurchaseRequest, decide, learn_from_outcome
from .memory import PurserMemory
from .pay import PayResult, pay


@dataclass
class SessionReport:
    session: int
    n_requests: int
    approved: int
    refused: int
    log: list[str]


def run_session(session_n: int, requests: list[PurchaseRequest], *,
                db: str, tenant: str | None = None,
                pay_mode: str = "simulate",
                role: str = "purser") -> SessionReport:
    """Run one session against the given memory DB. Fresh process each time
    (the demo script spawns us via subprocess to make that literally true)."""
    mem = PurserMemory(db, tenant=tenant)
    started = _dt.datetime.now(_dt.timezone.utc).isoformat()
    mem.set_session({"n": session_n, "started": started, "agent": role,
                     "open_items": [r.sku for r in requests]})

    log: list[str] = []
    approved = refused = 0

    for req in requests:
        dec: Decision = decide(req, mem)
        if dec.approve:
            outcome: PayResult = pay(req, mode=pay_mode)
            status = outcome.status
            learn_from_outcome(req, dec, {"status": status, "tx": outcome.tx,
                                          "detail": outcome.detail}, mem)
            approved += 1
            log.append(f"SESSION {session_n} | APPROVE+{status} | {req.vendor}:{req.sku} "
                       f"| ${req.amount_micro/1e6:.6f} | tx {outcome.tx[:20]} | {outcome.detail}")
        else:
            learn_from_outcome(req, dec, {"status": "refused"}, mem)
            refused += 1
            log.append(f"SESSION {session_n} | REFUSE [{dec.rule}] | {req.vendor}:{req.sku} "
                       f"| {dec.reason}")
            for line in dec.recalled:
                log.append(f"    recalled: {line}")

    mem.set_handoff("purser", "auditor", {
        "session": session_n, "approved": approved, "refused": refused,
        "note": "reconcile today's journal against WARM entities"})
    mem.journal(acted=[f"session {session_n} complete: {approved} approved, {refused} refused"],
                extra={"kind": "session_end", "session": session_n})

    return SessionReport(session_n, len(requests), approved, refused, log)


def print_report(rep: SessionReport) -> None:
    for line in rep.log:
        print(line)
    print(f"-- session {rep.session}: {rep.n_requests} requests, "
          f"{rep.approved} approved, {rep.refused} refused\n")
