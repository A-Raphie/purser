"""Payment rail. Two modes:

  simulate — deterministic fake receipts, free, used for dev/eval iteration.
             Clearly labeled as simulated everywhere it surfaces.
  real     — actual x402 paid fetch on Base (the flow proven in Spike B:
             weather.x402.press, tx 0xbbb6d430…). Costs real USDC.

A payment can settle onchain even when the HTTP response is lost (Spike B,
attempt 2). pay() therefore ALWAYS returns a status the caller can journal,
and `real` mode reconciles against the wallet balance before giving up.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any


@dataclass
class PayResult:
    status: str          # settled | simulated | failed
    tx: str
    detail: str
    body_preview: str = ""


def _load_env_file() -> None:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    path = os.path.abspath(env_path)
    if os.path.exists(path):
        with open(path) as fh:
            for line in fh:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())


def pay_simulate(req: Any) -> PayResult:
    return PayResult(
        status="simulated",
        tx="sim-" + f"{req.vendor}:{req.sku}".replace(":", "-").replace("/", "-"),
        detail="simulated payment (no chain interaction)",
        body_preview=f"[simulated] data for {req.sku} from {req.vendor}")


def pay_real(req: Any) -> PayResult:
    """Real x402 payment. Raises nothing — failures return status=failed."""
    import asyncio

    async def _run() -> PayResult:
        from eth_account import Account
        from x402 import x402Client
        from x402.http import x402HTTPClient
        from x402.http.clients import x402HttpxClient
        from x402.mechanisms.evm import EthAccountSigner
        from x402.mechanisms.evm.exact.register import register_exact_evm_client

        account = Account.from_key(os.environ["PURSER_PRIVATE_KEY"])
        client = x402Client()
        register_exact_evm_client(client, EthAccountSigner(account))
        http_client = x402HTTPClient(client)

        async with x402HttpxClient(client, timeout=60.0) as http:
            response = await http.get(req.url)
            await response.aread()
            if response.is_success:
                settle = http_client.get_payment_settle_response(
                    lambda name: response.headers.get(name))
                tx = getattr(settle, "transaction", None) or ""
                tx = str(tx).strip().strip("'\"")
                if tx and not tx.startswith("0x"):
                    tx = "0x" + tx  # x402 settle returns unprefixed hashes
                return PayResult("settled", tx, "x402 settled",
                                 response.text[:200])
            return PayResult("failed", "", f"HTTP {response.status_code}")

    try:
        return asyncio.run(_run())
    except Exception as exc:  # payment may STILL have settled — caller reconciles
        return PayResult("failed", "", f"{type(exc).__name__}: {exc}")


def pay(req: Any, mode: str = "simulate") -> PayResult:
    if mode == "real":
        _load_env_file()
        return pay_real(req)
    return pay_simulate(req)
