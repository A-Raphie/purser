"""Spike B — first REAL x402 payment on Base mainnet.

Pays $0.00375 USDC for current weather (weather.x402.press) from the agent's
dedicated wallet. Proves: EOA signing, EIP-3009 flow, settlement, and gives
us the first receipt for the ledger.

Run: .venv/bin/python spikes/spike_b_x402.py   (needs .env with PURSER_PRIVATE_KEY)
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import urllib.request
from pathlib import Path

ENDPOINT = "https://weather.x402.press/weather/current?latitude=6.45&longitude=3.39"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
RPC = "https://base.publicnode.com"


def load_env() -> None:
    env = Path(__file__).parent.parent / ".env"
    if not env.exists():
        sys.exit("no .env — copy .env.example and fill it first")
    for line in env.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def usdc_balance(wallet: str) -> float:
    data = "0x70a08231" + "0" * (64 - len(wallet[2:])) + wallet[2:]
    req = urllib.request.Request(
        RPC,
        data=json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": "eth_call",
            "params": [{"to": USDC, "data": data}, "latest"],
        }).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "purser-spike/0.1"},
    )
    result = json.loads(urllib.request.urlopen(req, timeout=15).read())["result"]
    return int(result, 16) / 1e6


async def main() -> int:
    load_env()
    from eth_account import Account
    from x402 import x402Client
    from x402.http import x402HTTPClient
    from x402.http.clients import x402HttpxClient
    from x402.mechanisms.evm import EthAccountSigner
    from x402.mechanisms.evm.exact.register import register_exact_evm_client

    account = Account.from_key(os.environ["PURSER_PRIVATE_KEY"])
    print(f"buyer wallet: {account.address}")

    before = usdc_balance(account.address)
    print(f"USDC before: {before:.6f}")

    client = x402Client()
    register_exact_evm_client(client, EthAccountSigner(account))
    http_client = x402HTTPClient(client)

    print(f"GET {ENDPOINT}")
    settled_headers = None
    try:
        async with x402HttpxClient(client, timeout=60.0) as http:
            response = await http.get(ENDPOINT)
            await response.aread()
            print(f"HTTP {response.status_code}")
            body = response.text
            print(f"body (first 300): {body[:300]}")

            if response.is_success:
                settle = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name)
                )
                settled_headers = settle
                print("\nSETTLEMENT:")
                print(json.dumps(settle, indent=2, default=str)[:800])
    except Exception as exc:
        # A payment can settle even if the response never arrives. The balance
        # is the ground truth — an idea Purser itself will journal around.
        print(f"\nrequest error after payment attempt: {type(exc).__name__}: {exc}")
        print("(checking onchain balance for settlement...)")

    import asyncio as _aio
    await _aio.sleep(5)  # EIP-3009 settle tx needs a block; don't race it
    after = usdc_balance(account.address)
    print(f"\nUSDC after:  {after:.6f}")
    print(f"spent:       {before - after:.6f}")
    settled_onchain = (before - after) >= 0.003
    receipt_ok = bool(settled_headers and "transaction" in str(settled_headers)
                      and "success=True" in str(settled_headers))
    ok = settled_onchain or receipt_ok
    print("SPIKE B:", "PASS — settled onchain" if settled_onchain else
          ("PASS — settlement receipt (balance read raced the tx)" if receipt_ok else "FAIL"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
