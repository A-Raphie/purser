"""Edge cases from the Aug 26 ship rehearsal — each named after the failure
it prevents from ever coming back."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from purser.decide import PurchaseRequest, decide  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402


def test_negative_amount_is_refused_2026_08_26(tmp_path):
    """Rehearsal bug: -5000 micro sailed under every cap. Never again."""
    mem = PurserMemory(tmp_path / "t.db", tenant="test")
    dec = decide(PurchaseRequest(vendor="v", sku="s", amount_micro=-5000), mem)
    assert not dec.approve and dec.rule == "invalid-amount"


def test_zero_amount_is_refused_2026_08_26(tmp_path):
    mem = PurserMemory(tmp_path / "t.db", tenant="test")
    dec = decide(PurchaseRequest(vendor="v", sku="s", amount_micro=0), mem)
    assert not dec.approve and dec.rule == "invalid-amount"


def test_unicode_sku_dedups_normally_2026_08_26(tmp_path):
    db = tmp_path / "t.db"
    mem = PurserMemory(db, tenant="test")
    r = PurchaseRequest(vendor="qr.wdh.sh", sku="ünïcødé-🎵", amount_micro=1_000)
    assert decide(r, mem).approve
    from purser.decide import learn_from_outcome
    learn_from_outcome(r, decide(r, mem), {"status": "settled", "tx": "0x1"}, mem)
    mem2 = PurserMemory(db, tenant="test")
    second = decide(r, mem2)
    assert not second.approve and second.rule == "dedup"


def test_cli_json_without_description_works_2026_08_26(tmp_path):
    """Rehearsal bug: omitted optional field crashed the CLI with a traceback."""
    req_file = tmp_path / "req.json"
    req_file.write_text(json.dumps(
        [{"vendor": "v", "sku": "s", "amount_micro": 1_000}]))
    root = Path(__file__).resolve().parent.parent
    proc = subprocess.run(
        [sys.executable, "-m", "purser.cli", "--db", str(tmp_path / "cli.db"),
         "--session", "1", "--requests", str(req_file)],
        cwd=str(root / "src"), capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    assert "APPROVE" in proc.stdout
