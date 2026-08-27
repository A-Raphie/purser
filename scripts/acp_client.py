"""ACP client — hires Purser for a spend-check, pays, prints the verdict.

The buyer-side half of the ACP demo. Runs on the ACP venv:
    .venv-acp/bin/python scripts/acp_client.py --vendor weather.x402.press \
        --sku lagos-weather-current --amount-micro 3750

Life cycle: initiate job -> Purser accepts -> pay -> Purser delivers -> accept
the deliverable (buyer is the default evaluator) -> print the verdict.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

from dotenv import load_dotenv

from virtuals_acp.client import VirtualsACP
from virtuals_acp.contract_clients.contract_client_v2 import ACPContractClientV2
from virtuals_acp.env import EnvSettings

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from purser.acp_service import acp_config  # noqa: E402

load_dotenv(override=True)

# The SDK's EnvSettings reads BUYER_* names; our .env uses CLIENT_* for the
# buyer role. Alias before EnvSettings() so one .env serves both scripts.
os.environ.setdefault("BUYER_AGENT_WALLET_ADDRESS",
                      os.environ.get("CLIENT_AGENT_WALLET_ADDRESS", ""))
os.environ.setdefault("BUYER_ENTITY_ID",
                      os.environ.get("CLIENT_ENTITY_ID", ""))

TERMINALS = {4, 5, 6}  # COMPLETED, REJECTED, EXPIRED


def main() -> int:
    ap = argparse.ArgumentParser(description="hire purser for a spend-check")
    ap.add_argument("--vendor", required=True)
    ap.add_argument("--sku", required=True)
    ap.add_argument("--amount-micro", type=int, required=True)
    ap.add_argument("--description", default="ACP spend-check job")
    ap.add_argument("--wait", type=int, default=120, help="seconds to wait for completion")
    args = ap.parse_args()

    env = EnvSettings()
    provider = os.environ.get("SELLER_AGENT_WALLET_ADDRESS", "")
    if not provider:
        raise SystemExit("SELLER_AGENT_WALLET_ADDRESS is not set (see .env.example)")

    got = {}

    def on_new_task(job, memo_to_sign=None):
        phase = int(job.phase)
        nxt = int(memo_to_sign.next_phase) if memo_to_sign is not None else None
        # NEGOTIATION -> TRANSACTION: the provider's terms memo — pay it
        if phase == 1 and nxt == 2:
            print(f"[client] job {job.id}: paying ${job.price / 1e6:.2f}" if hasattr(job, "price") else f"[client] job {job.id}: paying")
            job.pay_and_accept_requirement("verdict please")
            print(f"[client] job {job.id}: paid (escrowed)")
        # TRANSACTION -> REJECTED: sign the rejection so escrow returns
        elif phase == 2 and nxt == 5:
            memo_to_sign.sign(True, "client accepts the rejection")
        elif phase == 4:
            got["completed"] = True
            print(f"[client] job {job.id}: COMPLETED")
        elif phase == 5:
            got["rejected"] = True
            print(f"[client] job {job.id}: REJECTED")

    client = VirtualsACP(
        acp_contract_clients=ACPContractClientV2(
            wallet_private_key=env.WHITELISTED_WALLET_PRIVATE_KEY,
            agent_wallet_address=env.BUYER_AGENT_WALLET_ADDRESS,
            entity_id=env.BUYER_ENTITY_ID,
            config=acp_config(os.environ.get("ACP_NETWORK", "base-sepolia")),
        ),
        on_new_task=on_new_task,
    )

    # The SDK reads BUYER_* names; our .env uses CLIENT_* — alias them so one
    # .env serves both scripts without confusing the seller/client roles.
    requirement = {
        "vendor": args.vendor,
        "sku": args.sku,
        "amount_micro": args.amount_micro,
        "description": args.description,
        "requested_by": "acp-client",
    }
    job_id = client.initiate_job(
        provider_address=provider,
        service_requirement=requirement,
        fare_amount=0.01,
    )
    print(f"[client] job {job_id} initiated: {json.dumps(requirement)}")

    deadline = time.time() + args.wait
    while time.time() < deadline and not (got.get("completed") or got.get("rejected")):
        time.sleep(3)

    if not (got.get("completed") or got.get("rejected")):
        print(f"[client] job {job_id}: no terminal phase within {args.wait}s")
        return 1

    job = client.get_job_by_onchain_id(job_id)
    print(f"[client] final phase: {job.phase}")
    try:
        deliverable = job.get_deliverable()
        print("[client] verdict:", json.dumps(deliverable, indent=2, default=str))
    except Exception as exc:  # deliverable read is best-effort after REJECTED
        print(f"[client] no deliverable ({exc})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
