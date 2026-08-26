"""Proof-page adversarial tests: the public verification surface must be
honest, complete, and refuse gracefully."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

REQ = {"vendor": "weather.x402.press", "sku": "proof-test",
       "description": "t", "amount_micro": 3_750, "pay_mode": "simulate"}


def client(tmp_path, monkeypatch):
    monkeypatch.setenv("PURSER_PANEL_DB", str(tmp_path / "p.db"))
    monkeypatch.delenv("PURSER_TENANT_ID", raising=False)
    from purser.api import app
    return TestClient(app)


def test_proof_for_paid_and_refused_rows_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    c.post("/api/request", json=REQ)                    # pays
    refused = c.post("/api/request", json=REQ).json()   # refused: dedup
    assert refused["decision"]["approve"] is False

    state = c.get("/api/state").json()
    paid_rows = state["tiers"]["warm"]["purchases"]
    assert paid_rows, "ledger rows missing"
    proofs_found = 0
    import re as _re
    for ev_id in _recent_ids(c):
        p = c.get(f"/api/proof/{ev_id}").json()
        if p.get("kind") in ("payment", "refusal"):
            proofs_found += 1
            assert p.get("reason"), "proof must carry the reason verbatim"
            if p["kind"] == "refusal":
                assert p["rule"] == "dedup"
            real_tx = bool(p.get("tx") and _re.match(r"^0x[0-9a-fA-F]{64}$", p["tx"]))
            assert bool(p.get("basescan")) == real_tx, \
                "basescan link must exist exactly when the tx is a real 64-hex hash"
    assert proofs_found >= 2, "expected at least one payment + one refusal proof"


def _recent_ids(c):
    # /api/state hides raw ids by design; use the internal memory via a
    # request to journal-only path: read them through the sidecar's own
    # imports for test purposes.
    import os
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
    from purser.memory import PurserMemory
    mem = PurserMemory(os.environ["PURSER_PANEL_DB"])
    return [e["id"] for e in mem.recent_events(limit=10)]


def test_proof_unknown_id_fails_cleanly_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    p = c.get("/api/proof/00000000-0000-0000-0000-000000000000").json()
    assert "error" in p
    assert c.get("/api/proof/00000000-0000-0000-0000-000000000000").status_code == 200
