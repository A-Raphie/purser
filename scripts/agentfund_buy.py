"""One-shot: two real agent-market lookups from the crew wallet.

Purser buys live data for its crew on the x402 agent market:
  1. onchain_oracle_price (ETH/USD on Base)  — $0.002
  2. onchain_gas (all chains)                — $0.001
MCP over streamable HTTP at x402.agentfund.net/mcp, USDC on Base.
The tx hashes become canonical receipts. Usage: .venv/bin/python scripts/agentfund_buy.py
"""
import asyncio
import json
import os
import sys

from eth_account import Account
from x402 import x402Client
from x402.http import x402HTTPClient
from x402.http.clients import x402HttpxClient
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from purser.pay import _load_env_file

_load_env_file()

MCP = "https://x402.agentfund.net/mcp"
CALLS = [
    ("oracle-eth-usd", {
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": "onchain_oracle_price",
                   "arguments": {"pair": "ETH/USD", "chain": "base"}},
    }),
    ("gas-all-chains", {
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {"name": "onchain_gas", "arguments": {}},
    }),
]
HEADERS = {"Content-Type": "application/json",
           "Accept": "application/json, text/event-stream"}


async def mcp_buy(account, http_client, label, rpc):
    client = x402Client()
    register_exact_evm_client(client, EthAccountSigner(account))
    body = json.dumps(rpc).encode()
    async with x402HttpxClient(client, timeout=60.0) as http:
        response = await http.post(MCP, content=body, headers=HEADERS)
        await response.aread()
        if response.status_code == 402:
            pay_headers, _ = await http_client.handle_402_response(
                dict(response.headers), body, MCP)
            response = await http.post(MCP, content=body,
                                       headers={**HEADERS, **pay_headers})
            await response.aread()
        if response.status_code == 200:
            settle = http_client.get_payment_settle_response(
                lambda name: response.headers.get(name))
            tx = str(getattr(settle, "transaction", "") or "").strip().strip("'\"")
            if tx and not tx.startswith("0x"):
                tx = "0x" + tx
            text = response.text
            if text.startswith("event:") or "\ndata:" in text:  # SSE-wrapped
                text = "\n".join(l[5:] for l in text.splitlines() if l.startswith("data:"))
            return tx, text[:300]
        return "", f"HTTP {response.status_code}: {response.text[:200]}"


async def main():
    account = Account.from_key(os.environ["PURSER_PRIVATE_KEY"])
    http_client = x402HTTPClient(x402Client())
    for label, rpc in CALLS:
        print(f"buying {label}...", flush=True)
        tx, body = await mcp_buy(account, http_client, label, rpc)
        print(f"  tx={tx or 'FAILED'}\n  body={body}", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
