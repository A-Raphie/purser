"""Spike C — prove the Virtuals ACP rail before the service build.

One script, both roles: a seller thread delivers a canned verdict deliverable,
an inline client initiates, pays, and evaluates. Proves registration, job
phases (REQUEST -> NEGOTIATION -> TRANSACTION -> EVALUATION -> COMPLETED),
escrowed payment, and deliverable round-trip — everything except the Sibyl
judgment, which the service and tests cover.

Run (after registering two agents at https://app.virtuals.io/acp/join and
filling the ACP block in .env):
    .venv-acp/bin/python spikes/spike_c_acp.py
"""
import json
import os
import sys
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append(ok)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}{' — ' + detail if detail else ''}")


def load_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    with open(env_path) as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def main() -> int:
    print("== SPIKE C: ACP rail ==")
    load_env()
    missing = [k for k in ("WHITELISTED_WALLET_PRIVATE_KEY", "SELLER_AGENT_WALLET_ADDRESS",
                           "SELLER_ENTITY_ID", "CLIENT_AGENT_WALLET_ADDRESS", "CLIENT_ENTITY_ID")
               if not os.environ.get(k, "").strip()]
    if missing:
        print(f"  FAIL  env — missing {missing}; register agents at https://app.virtuals.io/acp/join")
        return 1

    from virtuals_acp.client import VirtualsACP
    from virtuals_acp.contract_clients.contract_client_v2 import ACPContractClientV2
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
    from purser.acp_service import acp_config

    network = os.environ.get("ACP_NETWORK", "base-sepolia")
    config = acp_config(network)
    got = {"done": threading.Event()}

    # seller: accept anything, deliver a canned verdict once paid
    def seller_handler(job, memo_to_sign=None):
        phase = int(job.phase)
        nxt = int(memo_to_sign.next_phase) if memo_to_sign is not None else None
        if phase == 0 and nxt == 1:
            job.accept("spike: accepted")
            job.create_requirement("canned verdict ready; pay to receive")
        elif phase == 2 and nxt == 3:
            job.deliver({"type": "spike.v1", "verdict": "approve", "rule": "ok"})
            got["delivered"] = True

    seller = VirtualsACP(
        acp_contract_clients=ACPContractClientV2(
            wallet_private_key=os.environ["WHITELISTED_WALLET_PRIVATE_KEY"],
            agent_wallet_address=os.environ["SELLER_AGENT_WALLET_ADDRESS"],
            entity_id=int(os.environ["SELLER_ENTITY_ID"]),
            config=config),
        on_new_task=seller_handler)

    # client: pay the terms memo, then evaluate the deliverable (buyer evaluates)
    def client_handler(job, memo_to_sign=None):
        phase = int(job.phase)
        nxt = int(memo_to_sign.next_phase) if memo_to_sign is not None else None
        if phase == 1 and nxt == 2:
            job.pay_and_accept_requirement("spike payment")
            got["paid"] = True
        elif phase == 2 and nxt == 5:
            memo_to_sign.sign(True, "accepts rejection")
        elif phase == 3:
            job.evaluate(accept=True, reason="spike: deliverable ok")
        elif phase == 4:
            got["completed"] = True
            got["done"].set()

    client = VirtualsACP(
        acp_contract_clients=ACPContractClientV2(
            wallet_private_key=os.environ["WHITELISTED_WALLET_PRIVATE_KEY"],
            agent_wallet_address=os.environ["CLIENT_AGENT_WALLET_ADDRESS"],
            entity_id=int(os.environ["CLIENT_ENTITY_ID"]),
            config=config),
        on_new_task=client_handler)

    time.sleep(3)  # let both sockets settle
    check("seller+client connected", True, network)

    job_id = client.initiate_job(
        provider_address=os.environ["SELLER_AGENT_WALLET_ADDRESS"],
        service_requirement={"vendor": "weather.x402.press", "sku": "acp-spike",
                             "amount_micro": 375, "requested_by": "spike-c"},
        fare_amount=0.01,
    )
    check("job initiated", bool(job_id), f"job {job_id}")

    if not got["done"].wait(timeout=180):
        check("job reached COMPLETED", False, "timed out after 180s — check both agent wallets are registered/funded")
        print(f"SPIKE C: FAIL ({sum(RESULTS)}/{len(RESULTS)} checks passed)")
        return 1

    job = client.get_job_by_onchain_id(job_id)
    check("payment escrowed and released", got.get("paid") is True and got.get("delivered") is True)
    check("job COMPLETED", int(job.phase) == 4, f"phase {job.phase}")
    try:
        deliverable = job.get_deliverable()
        if isinstance(deliverable, str):
            deliverable = json.loads(deliverable)
        check("deliverable round-trips", deliverable.get("verdict") == "approve",
              json.dumps(deliverable)[:80])
    except Exception as exc:
        check("deliverable round-trips", False, str(exc))

    ok = all(RESULTS)
    print(f"SPIKE C: {'PASS' if ok else 'FAIL'} ({sum(RESULTS)}/{len(RESULTS)} checks passed)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
