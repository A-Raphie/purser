"""FastAPI sidecar — the panel's only backend.

Same code paths as the terminal demo (PurserMemory, decide, pay) — no
parallel logic. Serves the built panel from panel/out when it exists.

Run: python -m purser.api   (from src/ or with src on PYTHONPATH)
"""
from __future__ import annotations

import datetime as _dt
import os
import re
from pathlib import Path
from typing import Any

_REAL_TX = re.compile(r"^0x[0-9a-fA-F]{64}$")  # sim- and malformed rows never link

from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
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
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def cache_static(request: Request, call_next):
    """Hashed build assets never change: let the browser keep them."""
    response = await call_next(request)
    if request.url.path.startswith("/_next/static"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


def _db_path() -> str:
    return os.environ.get(DB_ENV, str(Path(__file__).resolve().parent.parent.parent
                                      / "runtime" / "panel_memory.db"))


def _mem() -> PurserMemory:
    # The panel shares the SAME default tenant as the terminal demos and
    # spikes (NOT the .env account tenant) or recall reads a different world.
    return PurserMemory(_db_path())


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

    # bridge-band data: spend sparkline, budget bar, refusal count
    by_date: dict[str, int] = {}
    refusals_total = 0
    acp_earned_micro = 0
    acp_jobs = 0
    for ev in events:
        extra = ev.get("extra") or {}
        if extra.get("kind") == "payment" and extra.get("status") in ("settled", "simulated"):
            day = str(extra.get("date", "?"))
            by_date[day] = by_date.get(day, 0) + int(extra.get("amount_micro", 0))
        elif extra.get("kind") == "refusal":
            refusals_total += 1
        elif extra.get("kind") == "earning":
            acp_jobs += 1
            acp_earned_micro += int(extra.get("amount_micro", 0))
    series, run = [], 0
    for day in sorted(by_date):
        run += by_date[day]
        series.append({"date": day, "cumulative_micro": run})
    today = _dt.date.today().isoformat()
    tiers["spend_series"] = series
    tiers["spent_today_micro"] = by_date.get(today, 0)
    tiers["daily_cap_micro"] = mem.load_policy().daily_cap_micro
    tiers["refusals_total"] = refusals_total
    tiers["acp_earned_micro"] = acp_earned_micro
    tiers["acp_jobs"] = acp_jobs

    # Decision history straight from the COLD journal (payments + refusals),
    # shaped like the panel's live decision cards. The feed survives reload
    # and entry ids stay reachable — the proof flow is keyed on them.
    ledger_total = sum(1 for ev in events
                       if (ev.get("extra") or {}).get("kind") in ("payment", "refusal"))
    recent: list[dict[str, Any]] = []
    seq = ledger_total
    for ev in events:
        extra = ev.get("extra") or {}
        if extra.get("kind") not in ("payment", "refusal"):
            continue
        recent.append({
            "ledger_id": ev.get("id"),
            "seq": seq,
            "decision": {"approve": extra.get("kind") == "payment",
                         "rule": extra.get("rule", "ok"),
                         "reason": extra.get("reason", ""),
                         "recalled": extra.get("recalled") or []},
            "payment": {"status": extra.get("status", ""), "tx": extra.get("tx", ""),
                        "detail": ""},
            "request": {"vendor": extra.get("vendor", "?"), "sku": extra.get("sku", ""),
                        "amount_micro": extra.get("amount_micro", 0)},
            "pay_mode": "simulate" if extra.get("status") == "simulated" else "real",
        })
        seq -= 1
        if len(recent) >= 8:
            break
    tiers["recent_decisions"] = recent
    tiers["ledger_total"] = ledger_total

    session = mem.get_session()
    if session:
        tiers["hot"]["session"] = session
    handoff = mem.get_handoff("purser", "auditor")
    if handoff:
        tiers["hot"]["handoff_to_auditor"] = handoff
    audit = mem._client.get_state("audit")
    if audit:
        tiers["hot"]["audit"] = audit.get("body", audit)
    for role in ("scout", "purser", "auditor", "acp"):
        s = mem._client.get_state(f"session:{role}")
        if s:
            tiers["hot"][f"session_{role}"] = s.get("body", s)
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
    ledger_id = learn_from_outcome(req, dec, outcome, mem)
    return {
        "ledger_id": ledger_id,
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


@app.get("/api/proof/{event_id}")
def proof(event_id: str) -> dict[str, Any]:
    """Wallet-free verification of one ledger entry (payment or refusal)."""
    mem = _mem()
    for ev in mem.recent_events(limit=500):
        if ev.get("id") != event_id:
            continue
        extra = ev.get("extra") or {}
        if extra.get("kind") not in ("payment", "refusal"):
            return {"error": "event exists but is not a ledger entry", "ts": ev.get("ts")}
        tx = str(extra.get("tx", "")).strip().strip("'\"")
        if tx and not tx.startswith("0x"):
            tx = "0x" + tx  # older journal rows may be unprefixed
        return {
            "id": ev.get("id"), "ts": ev.get("ts"), "kind": extra.get("kind"),
            "rule": extra.get("rule", "ok"),
            "reason": extra.get("reason", "no duplicate, within caps, vendor acceptable"),
            "vendor": extra.get("vendor"), "amount_micro": extra.get("amount_micro"),
            "status": extra.get("status"), "tx": tx or None,
            "basescan": f"https://basescan.org/tx/{tx}" if _REAL_TX.match(tx) else None,
            "recalled": extra.get("recalled", []),
            "acted": ev.get("acted"),
        }
    return {"error": f"no ledger entry with id {event_id}"}


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
        tx = str(extra.get("tx", "")).strip().strip("'\"")
        if tx and not tx.startswith("0x"):
            tx = "0x" + tx
        if extra.get("kind") == "payment" and _REAL_TX.match(tx):
            receipts.append({
                "tx": tx, "vendor": extra.get("vendor"),
                "amount_micro": extra.get("amount_micro"),
                "status": extra.get("status"),
                "basescan": f"https://basescan.org/tx/{tx}"})
    return {"wallet": address, "usdc": usdc, "receipts": receipts}


# Serve the built panel if present (python -m purser.api => one process).
if PANEL_OUT.exists():
    # StaticFiles(html=True) doesn't resolve /room -> room.html in this
    # Starlette version, so the routes are explicit.
    @app.get("/room")
    def room_page() -> FileResponse:
        return FileResponse(str(PANEL_OUT / "room.html"))

    @app.get("/proof")
    def proof_page() -> FileResponse:
        return FileResponse(str(PANEL_OUT / "proof.html"))

    app.mount("/", StaticFiles(directory=str(PANEL_OUT), html=True), name="panel")
else:
    @app.get("/")
    def no_panel() -> JSONResponse:
        return JSONResponse({"note": "panel not built yet — run npm run build in panel/"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1",
                port=int(os.environ.get("PURSER_PANEL_PORT", "8788")))
