"""Panel API adversarial tests — the sidecar must not drift from the core."""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402


def client(tmp_path, monkeypatch):
    monkeypatch.setenv("PURSER_PANEL_DB", str(tmp_path / "panel.db"))
    monkeypatch.delenv("PURSER_TENANT_ID", raising=False)
    from purser.api import app
    return TestClient(app)


REQ = {"vendor": "weather.x402.press", "sku": "lagos-weather",
       "description": "weather", "amount_micro": 3_750, "pay_mode": "simulate"}


def test_request_then_duplicate_refused_via_api_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    first = c.post("/api/request", json=REQ).json()
    assert first["decision"]["approve"] is True
    assert first["payment"]["status"] == "simulated"

    second = c.post("/api/request", json=REQ).json()
    assert second["decision"]["approve"] is False
    assert second["decision"]["rule"] == "dedup"
    assert second["decision"]["recalled"], "refusal must carry recalled evidence"


def test_wipe_requires_confirm_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    r = c.post("/api/wipe").json()
    assert "error" in r
    c.post("/api/request", json=REQ)
    wiped = c.post("/api/wipe", params={"confirm": True}).json()
    assert wiped.get("wiped")
    after = c.post("/api/request", json=REQ).json()
    assert after["decision"]["approve"] is True, "wipe must reset the ledger"


def test_state_lists_vendors_from_memory_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    c.post("/api/request", json=REQ)
    state = c.get("/api/state").json()
    vendors = [v["name"] for v in state["tiers"]["warm"]["vendors"]]
    assert "weather.x402.press" in vendors
    assert state["tiers"]["warm"]["purchases"], "ledger rows must appear in state"
    assert state["tiers"]["cold_count"] >= 1


def test_real_mode_is_labeled_never_silent_2026_08_26(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    r = c.post("/api/request", json={**REQ, "pay_mode": "real"})
    body = r.json()
    # Real mode with no funded path configured may fail, but must never
    # masquerade as simulated.
    assert body["pay_mode"] == "real"
    assert body["payment"]["status"] in ("settled", "failed", "refused")
