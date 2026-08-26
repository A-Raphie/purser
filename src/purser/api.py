"""FastAPI sidecar — the panel's only backend.

Same code paths as the terminal demo (PurserMemory, decide, pay) — no
parallel logic. Serves the built panel from panel/out when it exists.

Run: python -m purser.api   (from src/ or with src on PYTHONPATH)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .decide import PurchaseRequest, decide, learn_from_outcome
from .memory import PurserMemory
from .pay import _load_env_file, pay

_load_env_file()  # wallet address + tenant for the masthead facts

DB_ENV = "PURSER_PANEL_DB"
PANEL_OUT = Path(__file__).resolve().parent.parent.parent / "panel" / "out"

app = FastAPI(title="purser control room")


def _db_path() -> str:
    return os.environ.get(DB_ENV, str(Path(__file__).resolve().parent.parent.parent
                                      / "runtime" / "panel_memory.db"))


def _mem() -> PurserMemory:
    return PurserMemory(_db_path(), tenant=os.environ.get("PURSER_TENANT_ID"))


class RequestIn(BaseModel):
    vendor: str
    sku: str
    description: str = ""
    amount_micro: int
    url: str = ""
    pay_mode: str = "simulate"   # simulate | real — real pays actual USDC


@app.get("/api/state")
def state() -> dict[str, Any]:
    mem = _mem()
    events = mem.recent_events(limit=100)
    tiers = {
        "warm": {"vendors": mem.list_vendors(), "purchases": []},
        "cold_count": len(events),
        "hot": {},
        "archive_note": "archived records live in the ARCHIVE tier",
    }
    purchases = []
    for ev in events:
        extra = ev.get("extra") or {}
        if extra.get("kind") == "payment" and extra.get("status") in ("settled", "simulated"):
            purchases.append(extra)
    tiers["warm"]["purchases"] = purchases
    session = mem.get_session()
    if session:
        tiers["hot"]["session"] = session
    handoff = mem.get_handoff("purser", "auditor")
    if handoff:
        tiers["hot"]["handoff_to_auditor"] = handoff
    return {"tiers": tiers, "db": _db_path()}


@app.post("/api/request")
def run_request(body: RequestIn) -> dict[str, Any]:
    mem = _mem()
    req = PurchaseRequest(**body.model_dump(exclude={"pay_mode"}))
    dec = decide(req, mem)
    if dec.approve:
        result = pay(req, mode=body.pay_mode)
        outcome = {"status": result.status, "tx": result.tx, "detail": result.detail}
    else:
        outcome = {"status": "refused", "tx": "", "detail": dec.reason}
    learn_from_outcome(req, dec, outcome, mem)
    return {
        "decision": {"approve": dec.approve, "rule": dec.rule,
                     "reason": dec.reason, "recalled": dec.recalled},
        "payment": outcome,
        "request": {"vendor": req.vendor, "sku": req.sku,
                    "amount_micro": req.amount_micro},
        "pay_mode": body.pay_mode,
    }


@app.post("/api/wipe")
def wipe(confirm: bool = False) -> dict[str, Any]:
    if not confirm:
        return {"error": "pass confirm=true — wiping deletes the ledger on purpose"}
    db = Path(_db_path())
    if db.exists():
        db.unlink()
        return {"wiped": str(db)}
    return {"wiped": None, "note": "nothing to wipe"}


@app.get("/api/wallet")
def wallet() -> dict[str, Any]:
    import json as _json
    import urllib.request

    address = os.environ.get("PURSER_WALLET_ADDRESS", "")
    usdc = None
    if address:
        try:
            data = "0x70a08231" + "0" * (64 - len(address[2:])) + address[2:]
            req = urllib.request.Request(
                "https://base.publicnode.com",
                data=_json.dumps({"jsonrpc": "2.0", "id": 1, "method": "eth_call",
                                  "params": [{"to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
                                              "data": data}, "latest"]}).encode(),
                headers={"Content-Type": "application/json",
                         "User-Agent": "purser-panel/0.1"})
            usdc = int(_json.loads(urllib.request.urlopen(req, timeout=10).read())
                       ["result"], 16) / 1e6
        except Exception:
            usdc = None

    mem = _mem()
    receipts = []
    for ev in mem.recent_events(limit=100):
        extra = ev.get("extra") or {}
        if extra.get("kind") == "payment" and str(extra.get("tx", "")).startswith("0x"):
            receipts.append({
                "tx": extra.get("tx"), "vendor": extra.get("vendor"),
                "amount_micro": extra.get("amount_micro"),
                "status": extra.get("status"),
                "basescan": f"https://basescan.org/tx/{extra.get('tx')}"})
    return {"wallet": address, "usdc": usdc, "receipts": receipts}


# Serve the built panel if present (python -m purser.api => one process).
if PANEL_OUT.exists():
    app.mount("/", StaticFiles(directory=str(PANEL_OUT), html=True), name="panel")
else:
    @app.get("/")
    def no_panel() -> JSONResponse:
        return JSONResponse({"note": "panel not built yet — run npm run build in panel/"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1",
                port=int(os.environ.get("PURSER_PANEL_PORT", "8788")))
