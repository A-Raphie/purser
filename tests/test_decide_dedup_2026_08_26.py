"""Dated adversarial tests for the decision engine (Sibyl house convention:
date-stamped, named after the failure they hunt)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from purser.decide import PurchaseRequest, decide, learn_from_outcome  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402


def req(**kw):
    base = dict(vendor="weather.x402.press", sku="lagos-weather",
                description="weather", amount_micro=3_750)
    base.update(kw)
    return PurchaseRequest(**base)


def fresh(tmp_path):
    return PurserMemory(tmp_path / "t.db", tenant="test")


def test_duplicate_is_refused_across_sessions_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    r = req()
    first = decide(r, mem)
    assert first.approve
    learn_from_outcome(r, first, {"status": "settled", "tx": "0xabc"}, mem)
    # NEW PurserMemory instance = new session against the same DB
    mem2 = PurserMemory(tmp_path / "t.db", tenant="test")
    second = decide(r, mem2)
    assert not second.approve and second.rule == "dedup"
    assert "already purchased" in second.reason


def test_per_purchase_cap_refuses_big_spend_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    dec = decide(req(amount_micro=500_000), mem)  # $0.50 > $0.02 cap
    assert not dec.approve and dec.rule == "cap"


def test_retired_vendor_is_refused_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    mem.upsert_vendor("bad-co", {"trust": 0.05, "status": "retired",
                                 "retire_reason": "double-billed us"})
    dec = decide(req(vendor="bad-co"), mem)
    assert not dec.approve and dec.rule == "archived"
    assert "double-billed" in dec.reason


def test_archive_without_reason_is_forbidden_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    mem.upsert_vendor("x", {"trust": 0.5})
    try:
        mem.retire_vendor("x", reason="   ")
        raise AssertionError("blank reason must raise")
    except ValueError:
        pass


def test_trust_floor_refuses_shaky_vendor_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    mem.upsert_vendor("shaky", {"trust": 0.1, "purchases": 2})
    dec = decide(req(vendor="shaky"), mem)
    assert not dec.approve and dec.rule == "trust"


def test_dry_run_writes_nothing_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    mem.set_session({"n": 1})
    r = req()
    dec = decide(r, mem)
    learn_from_outcome(r, dec, {"status": "settled", "tx": "0x1"}, mem)

    dry = PurserMemory(tmp_path / "t.db", tenant="test", dry_run=True)
    r2 = req(sku="other-thing")
    dec2 = decide(r2, dry)
    assert dec2.approve
    learn_from_outcome(r2, dec2, {"status": "settled", "tx": "0x2"}, dry)
    assert dry.dry.writes, "dry run should log its would-be writes"
    check = PurserMemory(tmp_path / "t.db", tenant="test")
    assert check.get_purchase("weather.x402.press", "other-thing") is None


def test_retire_vendor_keeps_wARM_tombstone_2026_08_26(tmp_path):
    """archive_entity removes from WARM; the tombstone must survive so the
    blacklist still bites (caught live by eval/run_eval.py on Aug 26)."""
    mem = fresh(tmp_path)
    mem.upsert_vendor("flake", {"trust": 0.9, "purchases": 3})
    mem.retire_vendor("flake", reason="delivered twice, charged twice")
    tomb = mem.get_vendor("flake")
    assert tomb is not None and tomb.get("status") == "retired"
    dec = decide(req(vendor="flake"), mem)
    assert not dec.approve and dec.rule == "archived"
    assert "charged twice" in dec.reason


def test_money_is_integer_micro_usdc_2026_08_26(tmp_path):
    mem = fresh(tmp_path)
    r = req()
    dec = decide(r, mem)
    learn_from_outcome(r, dec, {"status": "settled", "tx": "0xabc"}, mem)
    purchase = mem.get_purchase("weather.x402.press", "lagos-weather")
    assert isinstance(purchase["amount_micro"], int)
    assert purchase["amount_micro"] == 3_750
