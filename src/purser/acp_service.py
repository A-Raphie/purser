"""ACP seller service — Purser sells its verdict on Virtuals' Agent Commerce Protocol.

A client agent pays per job; Purser checks the proposed purchase against its
Sibyl memory (dedup, caps, trust, tombstones) and delivers the verdict.
Refusals are deliverables too: the guardrail firing is the product, so every
verdict earns. Verdicts are read-only — decide() writes nothing — so a
spend-check never pollutes the ledger's dedup. The only write is the income
row: journal kind "earning", which the auditor ignores (it reconciles
kind "payment" only).

The SDK needs Python <3.13 and lives in its own venv:
    python3.11 -m venv .venv-acp && .venv-acp/bin/pip install -r requirements-acp.txt

Run (from src/):  ../.venv-acp/bin/python -m purser.acp_service --db ../runtime/panel_memory.db
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import threading
from datetime import date

from .decide import Decision, PurchaseRequest, decide
from .memory import PurserMemory
from .pay import _load_env_file

# $0.01 per verdict — keep in sync with the offering price set in the ACP UI.
PRICE_MICRO = 10_000

# Mirrors virtuals_acp.models.ACPJobPhase (ints, so the pure logic below
# imports without the SDK installed).
PHASE_REQUEST = 0
PHASE_NEGOTIATION = 1
PHASE_TRANSACTION = 2
PHASE_EVALUATION = 3


def parse_job_requirement(requirement) -> PurchaseRequest:
    """Job requirement (dict or JSON string) -> PurchaseRequest."""
    if isinstance(requirement, str):
        requirement = json.loads(requirement)
    return PurchaseRequest(
        vendor=str(requirement["vendor"]),
        sku=str(requirement["sku"]),
        amount_micro=int(requirement["amount_micro"]),
        description=str(requirement.get("description", "ACP spend-check job")),
        url=str(requirement.get("url", "")),
        requested_by=str(requirement.get("requested_by", "acp-client")),
    )


def verdict_deliverable(dec: Decision, earning_id: str, job_id) -> dict:
    return {
        "type": "purser.spend-check.v1",
        "approve": dec.approve,
        "rule": dec.rule,
        "reason": dec.reason or (
            "no duplicate, within caps, vendor acceptable" if dec.approve else "refused"),
        "recalled": dec.recalled[:2],
        "earning_id": earning_id,
        "job_id": str(job_id),
    }


def journal_earning(mem: PurserMemory, job_id, req: PurchaseRequest,
                    dec: Decision, status: str = "paid") -> str:
    """The service's own bookkeeping: income row, never a payment row."""
    return mem.journal(
        acted=f"acp job {job_id}: verdict {dec.rule}",
        extra={
            "kind": "earning",
            "job_id": str(job_id),
            "amount_micro": PRICE_MICRO,
            "client": req.requested_by,
            "vendor": req.vendor,
            "sku": req.sku,
            "verdict_rule": dec.rule,
            "approve": dec.approve,
            "status": status,
            "date": date.today().isoformat(),
        },
    )


def handle_job_phase(phase: int, next_phase, job, mem: PurserMemory) -> dict | None:
    """React to one job/memo event. `phase`/`next_phase` are ints; `job` is any
    object with .id, .requirement, .accept, .create_requirement, .deliver.

    REQUEST (next NEGOTIATION): accept + terms.  TRANSACTION (next EVALUATION):
    the client has paid — journal the earning and deliver the verdict.
    """
    if phase == PHASE_REQUEST and next_phase == PHASE_NEGOTIATION:
        req = parse_job_requirement(job.requirement)
        dec = decide(req, mem)  # read-only: checks the real memory world, writes nothing
        job.accept(f"spend-check ready: rule {dec.rule}")
        job.create_requirement(
            f"verdict prepared (rule: {dec.rule}); payment releases the deliverable")
        return {"stage": "accepted", "approve": dec.approve, "rule": dec.rule}

    if phase == PHASE_TRANSACTION and next_phase == PHASE_EVALUATION:
        req = parse_job_requirement(job.requirement)
        dec = decide(req, mem)
        earning_id = journal_earning(mem, job.id, req, dec)
        mem._client.set_state("session:acp", {
            "status": "delivered",
            "last_job": str(job.id),
            "last_rule": dec.rule,
            "approve": dec.approve,
            "earned_micro": PRICE_MICRO,
            "date": date.today().isoformat(),
        })
        job.deliver(verdict_deliverable(dec, earning_id, job.id))
        return {"stage": "delivered", "approve": dec.approve, "rule": dec.rule,
                "earning_id": earning_id}

    return None


def make_on_new_task(mem: PurserMemory):
    """SDK callback: phase values arrive as ACPJobPhase (same ints as ours)."""
    def on_new_task(job, memo_to_sign=None):
        next_phase = memo_to_sign.next_phase if memo_to_sign is not None else None
        out = handle_job_phase(int(job.phase), int(next_phase) if next_phase is not None else None,
                               job, mem)
        if out:
            print(f"[purser acp] job {job.id}: {out['stage']} (rule {out['rule']})")
    return on_new_task


def _require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        raise SystemExit(
            f"{name} is not set. Register the agents at https://app.virtuals.io/acp/join,\n"
            "then fill the ACP block in .env (see .env.example).")
    return val


def acp_config(network: str):
    from virtuals_acp.configs.configs import BASE_MAINNET_CONFIG_V2, BASE_SEPOLIA_CONFIG_V2
    return BASE_MAINNET_CONFIG_V2 if network == "base-mainnet" else BASE_SEPOLIA_CONFIG_V2


def run_seller(db: str, network: str | None = None) -> None:
    if sys.version_info >= (3, 13):
        raise SystemExit("virtuals-acp needs Python <3.13. Use the ACP venv:\n"
                         "  ../.venv-acp/bin/python -m purser.acp_service --db ...")
    try:
        from virtuals_acp.client import VirtualsACP
        from virtuals_acp.contract_clients.contract_client_v2 import ACPContractClientV2
    except ImportError as exc:
        raise SystemExit("virtuals-acp is not installed. The ACP leg runs on its own venv:\n"
                         "  python3.11 -m venv .venv-acp && .venv-acp/bin/pip install -r requirements-acp.txt\n"
                         f"(import error: {exc})")

    _load_env_file()
    network = network or os.environ.get("ACP_NETWORK", "base-sepolia")
    mem = PurserMemory(db)
    VirtualsACP(
        acp_contract_clients=ACPContractClientV2(
            wallet_private_key=_require_env("WHITELISTED_WALLET_PRIVATE_KEY"),
            agent_wallet_address=_require_env("SELLER_AGENT_WALLET_ADDRESS"),
            entity_id=int(_require_env("SELLER_ENTITY_ID")),
            config=acp_config(network),
        ),
        on_new_task=make_on_new_task(mem),
    )
    print(f"purser ACP seller listening ({network}): sell the verdict, journal the earning.")
    threading.Event().wait()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="purser ACP seller: spend-check as a service")
    ap.add_argument("--db", required=True, help="path to the Sibyl memory DB")
    ap.add_argument("--network", default=None, help="base-sepolia (default) | base-mainnet")
    args = ap.parse_args()
    run_seller(args.db, args.network)
