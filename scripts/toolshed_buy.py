"""One-shot: two real Toolshed conversions from the crew wallet.

The crew's spend CSV -> JSON, and the weekly report HTML -> Markdown.
Real x402 payments on Base; the tx hashes become canonical receipts.
Usage: .venv/bin/python scripts/toolshed_buy.py
"""
import asyncio
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

BASE = "https://toolshed.lemon-agent.dev/convert"
JOBS = [
    ("csv-json", "text/csv", "crew-spend.csv",
     "date,vendor,sku,amount_usd,reason\n"
     "2026-09-04,weather.x402.press,lagos-weather-current,0.00375,field weather\n"
     "2026-09-05,toolshed.lemon-agent.dev,convert-csv-json,0.002,crew file conversion\n"),
    ("html-markdown", "text/html", "weekly-report.html",
     "<h1>Crew weekly report</h1>"
     "<p>Purser paid two Toolshed calls and one field purchase this week. "
     "One duplicate was refused by memory. Ledger balanced.</p>"),
]


async def buy(account, http_client, path, content_type, body):
    client = x402Client()
    register_exact_evm_client(client, EthAccountSigner(account))
    url = f"{BASE}/{path}"
    headers = {"Content-Type": content_type}
    # manual 402 flow: the automatic wrapper drops the POST body on its paid
    # retry, and Toolshed answers an empty-body conversion with a 503.
    async with x402HttpxClient(client, timeout=60.0) as http:
        response = await http.post(url, content=body.encode(), headers=headers)
        await response.aread()
        if response.status_code == 402:
            pay_headers, _ = await http_client.handle_402_response(
                dict(response.headers), body.encode(), url)
            response = await http.post(url, content=body.encode(),
                                       headers={**headers, **pay_headers})
            await response.aread()
        if response.is_success:
            settle = http_client.get_payment_settle_response(
                lambda name: response.headers.get(name))
            tx = str(getattr(settle, "transaction", "") or "").strip().strip("'\"")
            if tx and not tx.startswith("0x"):
                tx = "0x" + tx
            return tx, response.text[:200]
        return "", f"HTTP {response.status_code}: {response.text[:160]}"


async def main():
    account = Account.from_key(os.environ["PURSER_PRIVATE_KEY"])
    http_client = x402HTTPClient(x402Client())
    results = []
    for path, ctype, fname, body in JOBS:
        print(f"buying {path} ({fname})...", flush=True)
        tx, preview = await buy(account, http_client, path, ctype, body)
        print(f"  tx={tx or 'FAILED'}\n  preview={preview[:140]}", flush=True)
        results.append((path, tx))
    print("---")
    for path, tx in results:
        print(f"{path}  {tx}")


if __name__ == "__main__":
    asyncio.run(main())
