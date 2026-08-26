"""Crew adversarial tests: coordination through memory tiers ONLY, real
reconciliation, trust that moves with outcomes."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from purser.crew import run_auditor, run_purser, run_scout  # noqa: E402
from purser.decide import PurchaseRequest, decide, learn_from_outcome  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402

ARGS = dict(vendor="weather.x402.press", sku="crew-test",
            amount_micro=3_750, url="", pay_mode="simulate")


def fresh(db):
    return PurserMemory(db)  # new instance == new session, same world


def test_full_shift_coordinates_through_tiers_2026_08_26(tmp_path):
    db = str(tmp_path / "crew.db")
    run_scout(db, 1, "crew test", **ARGS)                    # fresh process 1
    result = run_purser(db, 1)                               # fresh process 2
    assert result["approve"] is True

    handoff = fresh(db).get_handoff("scout", "purser")
    assert handoff["status"] == "consumed"
    to_aud = fresh(db).get_handoff("purser", "auditor")
    assert to_aud["approved"] is True and to_aud["ledger_id"]

    verdict = run_auditor(db, 1)                             # fresh process 3
    assert verdict["clean"] and verdict["checked"] == 1
    assert fresh(db)._client.get_state("audit")["body"]["clean"]


def test_duplicate_shift_refused_and_auditor_still_clean_2026_08_26(tmp_path):
    db = str(tmp_path / "crew.db")
    run_scout(db, 1, "crew test", **ARGS)
    run_purser(db, 1)
    run_auditor(db, 1)

    run_scout(db, 2, "same need again", **ARGS)
    scout_note = fresh(db).get_handoff("scout", "purser")["scout_note"]
    assert "duplicate" in scout_note
    result = run_purser(db, 2)
    assert result["approve"] is False and result["rule"] == "dedup"
    verdict = run_auditor(db, 2)
    assert verdict["clean"], verdict


def test_auditor_flags_injected_drift_2026_08_26(tmp_path):
    db = str(tmp_path / "crew.db")
    run_scout(db, 1, "x", **ARGS)
    run_purser(db, 1)
    # inject a journal payment with NO matching WARM purchase entity
    fresh(db).journal(acted=["ghost payment"],
                      extra={"kind": "payment", "status": "settled",
                             "vendor": "ghost.vendor", "sku": "ghost-sku",
                             "amount_micro": 1, "tx": "0xdead"})
    verdict = run_auditor(db, 1)
    assert not verdict["clean"]
    assert any("ghost" in d for d in verdict["drift"])


def test_trust_rises_on_settled_and_falls_on_failure_2026_08_26(tmp_path):
    db = str(tmp_path / "t.db")
    mem = PurserMemory(db)
    r = PurchaseRequest(vendor="v", sku="s", amount_micro=1_000)
    learn_from_outcome(r, decide(r, mem), {"status": "settled", "tx": "0x1"}, mem)
    assert PurserMemory(db).get_vendor("v")["trust"] == 0.55  # 0.5 + 0.05

    r2 = PurchaseRequest(vendor="v", sku="s2", amount_micro=1_000)
    learn_from_outcome(r2, decide(r2, PurserMemory(db)),
                       {"status": "failed", "detail": "HTTP 500"}, PurserMemory(db))
    v = PurserMemory(db).get_vendor("v")
    assert v["trust"] == 0.4  # 0.55 - 0.15


def test_repeated_failure_auto_retires_with_reason_2026_08_26(tmp_path):
    db = str(tmp_path / "t.db")
    mem = PurserMemory(db)
    mem.upsert_vendor("flaky", {"trust": 0.25, "purchases": 2})
    r = PurchaseRequest(vendor="flaky", sku="s", amount_micro=1_000)
    learn_from_outcome(r, decide(r, mem), {"status": "failed", "detail": "down"},
                       mem)
    v = PurserMemory(db).get_vendor("flaky")
    assert v["status"] == "retired"  # 0.25 - 0.15 = 0.10 < floor 0.2
    assert "below floor" in v["retire_reason"]
    # and the decision engine now refuses the vendor outright
    assert decide(PurchaseRequest(vendor="flaky", sku="x", amount_micro=1),
                  PurserMemory(db)).rule == "archived"
