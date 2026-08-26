"""The decision engine — deterministic, testable, no LLM in the money path.

decide() answers ONE question per purchase request: approve or refuse, with
the recalled evidence that drove the call. Every check reads memory first;
if memory is empty the checks degrade permissively (which is exactly what
the eval harness punishes in the no-memory arm).
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from typing import Any

from .memory import PurserMemory, SpendPolicy

# Import lazily to keep decide() importable without the payment stack.
# Micro-USDC integers everywhere.


@dataclass
class PurchaseRequest:
    vendor: str
    sku: str
    amount_micro: int            # price in micro-USDC (1_000_000 == $1)
    description: str = ""
    url: str = ""
    requested_by: str = "scout"


@dataclass
class Decision:
    approve: bool
    reason: str
    rule: str                    # which check decided (dedup|cap|daily|trust|archived|ok)
    recalled: list[str] = field(default_factory=list)   # evidence lines, memory-sourced
    request: PurchaseRequest | None = None


def decide(req: PurchaseRequest, mem: PurserMemory) -> Decision:
    policy: SpendPolicy = mem.load_policy()

    # 1. Vendor blacklisted? (ARCHIVE tier — with a reason, by contract)
    vendor = mem.get_vendor(req.vendor)
    if vendor is not None and vendor.get("status") == "retired":
        return Decision(
            False, f"vendor {req.vendor} is retired: {vendor.get('retire_reason', '?')}",
            "archived", recalled=[f"vendor entity: {vendor}"], request=req)

    # 2. Duplicate? (WARM purchase ledger)
    if policy.require_duplicate_check:
        prior = mem.get_purchase(req.vendor, req.sku)
        if prior is not None:
            return Decision(
                False,
                (f"already purchased {req.sku} from {req.vendor} on "
                 f"{prior.get('date', '?')} (tx {str(prior.get('tx', 'none'))[:18]}…). "
                 "Refusing duplicate."),
                "dedup", recalled=[f"purchase entity: {prior}"], request=req)

    # 0. Non-positive money is not a purchase (negative amounts otherwise
    #    sail under every cap — caught by the Aug 26 ship rehearsal).
    if req.amount_micro <= 0:
        return Decision(
            False, f"amount must be positive, got {req.amount_micro} micro",
            "invalid-amount", recalled=[], request=req)

    # 3. Per-purchase cap? (REFERENCE policy)
    if req.amount_micro > policy.max_per_purchase_micro:
        return Decision(
            False,
            (f"${req.amount_micro/1e6:.6f} exceeds per-purchase cap "
             f"${policy.max_per_purchase_micro/1e6:.2f}"),
            "cap", recalled=["policy reference: max_per_purchase"], request=req)

    # 4. Daily cap? (COLD journal, summed for today)
    spent_today = mem.spent_today_micro()
    if spent_today + req.amount_micro > policy.daily_cap_micro:
        return Decision(
            False,
            (f"daily cap: spent ${spent_today/1e6:.6f} today + "
             f"${req.amount_micro/1e6:.6f} > ${policy.daily_cap_micro/1e6:.2f}"),
            "daily", recalled=[f"journal sum for today: {spent_today} micro"], request=req)

    # 5. Trust floor? (WARM vendor trust)
    if vendor is not None and float(vendor.get("trust", policy.new_vendor_trust)) \
            < policy.min_vendor_trust:
        return Decision(
            False,
            (f"vendor trust {vendor.get('trust')} below floor "
             f"{policy.min_vendor_trust}"),
            "trust", recalled=[f"vendor entity: {vendor}"], request=req)

    return Decision(
        True, "no duplicate, within caps, vendor acceptable", "ok",
        recalled=[f"vendor: {vendor or 'new (default trust)'}",
                  f"spent today: {spent_today} micro"], request=req)


def learn_from_outcome(req: PurchaseRequest, dec: Decision, outcome: dict[str, Any],
                       mem: PurserMemory) -> str | None:
    """Update memory after a decision+payment attempt. Returns the ledger
    (journal) id of the entry, so callers can link a public proof."""
    today = _dt.date.today().isoformat()
    vendor = mem.get_vendor(req.vendor) or {
        "trust": mem.load_policy().new_vendor_trust, "purchases": 0}

    if not dec.approve:
        # Every refusal is ledger-worthy: the proof pages render these
        # verbatim (rule + reason) next to settled payments.
        return mem.journal(
            acted=[f"refused {req.vendor}:{req.sku} ({dec.rule}): {dec.reason}"],
            extra={"kind": "refusal", "rule": dec.rule, "reason": dec.reason,
                   "date": today, "vendor": req.vendor, "sku": req.sku,
                   "amount_micro": req.amount_micro,
                   "recalled": dec.recalled[:2]})

    status = outcome.get("status", "failed")
    # A simulated payment counts in the ledger (it carries a sim- tx id and
    # keeps its raw status in the journal — never relabeled as "settled").
    paid_ok = status in ("settled", "simulated")
    purchases = int(vendor.get("purchases", 0))
    ledger_id: str | None = None
    if paid_ok:
        purchases += 1
        mem.record_purchase(req.vendor, req.sku, {
            "date": today, "tx": outcome.get("tx", ""), "amount_micro": req.amount_micro,
            "description": req.description, "requested_by": req.requested_by})
        ledger_id = mem.journal(
            acted=[f"paid {req.vendor} ${req.amount_micro/1e6:.6f} for {req.sku}"],
            forward=[f"watch vendor {req.vendor} for reliability"],
            extra={"kind": "payment", "status": status, "date": today,
                   "amount_micro": req.amount_micro, "vendor": req.vendor,
                   "tx": outcome.get("tx", "")})
    else:
        ledger_id = mem.journal(
            acted=[f"payment to {req.vendor} failed: {outcome.get('detail', '?')}"],
            forward=[f"review vendor {req.vendor} before retrying"],
            extra={"kind": "payment", "status": status, "date": today,
                   "amount_micro": req.amount_micro, "vendor": req.vendor})

    vendor["purchases"] = purchases
    vendor["last_price_micro"] = req.amount_micro
    vendor["last_outcome"] = status
    mem.upsert_vendor(req.vendor, vendor)
    return ledger_id
