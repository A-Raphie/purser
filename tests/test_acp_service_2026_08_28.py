"""ACP service tests — the verdict must never pollute the ledger.

The spend-check service sells judgments: decide() runs read-only, only the
`earning` journal row is written. These tests hunt the failure where a
spend-check poisons dedup (a checked-but-never-made purchase blocking a real
one) or leaks payment/refusal rows the auditor would reconcile against nothing.
House style: real local Sibyl DB, plain stub objects, no mock libraries.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from purser.acp_service import (  # noqa: E402
    PHASE_EVALUATION,
    PHASE_NEGOTIATION,
    PHASE_REQUEST,
    PHASE_TRANSACTION,
    handle_job_phase,
    journal_earning,
    parse_job_requirement,
    verdict_deliverable,
)
from purser.decide import PurchaseRequest, decide  # noqa: E402
from purser.memory import PurserMemory  # noqa: E402

REQ = {"vendor": "weather.x402.press", "sku": "lagos-weather-current",
       "amount_micro": 3750, "requested_by": "acp-client"}


class StubJob:
    """The surface handle_job_phase touches — no SDK, no mocks."""

    def __init__(self, job_id="job-1", requirement=None):
        self.id = job_id
        self.requirement = requirement if requirement is not None else dict(REQ)
        self.accepted = None
        self.terms = None
        self.delivered = None

    def accept(self, reason):
        self.accepted = reason

    def create_requirement(self, content):
        self.terms = content

    def deliver(self, deliverable):
        self.delivered = deliverable


def fresh(tmp_path):
    return PurserMemory(tmp_path / "acp.db", tenant="test")


def test_parse_requirement_from_dict_and_json_2026_08_28():
    req = parse_job_requirement(REQ)
    assert req.vendor == "weather.x402.press" and req.amount_micro == 3750
    assert req.requested_by == "acp-client"
    import json
    as_json = parse_job_requirement(json.dumps(REQ))
    assert as_json.sku == req.sku
    try:
        parse_job_requirement({"vendor": "v", "amount_micro": 1})  # no sku
        raise AssertionError("missing sku must raise")
    except KeyError:
        pass


def test_verdict_deliverable_shape_2026_08_28(tmp_path):
    mem = fresh(tmp_path)
    dec = decide(PurchaseRequest(**REQ), mem)
    d = verdict_deliverable(dec, "earn-1", "job-1")
    assert d["type"] == "purser.spend-check.v1"
    assert d["approve"] is True and d["rule"] == "ok"
    assert d["reason"] and d["earning_id"] == "earn-1" and d["job_id"] == "job-1"
    assert isinstance(d["recalled"], list)


def test_request_phase_accepts_without_writing_2026_08_28(tmp_path):
    mem = fresh(tmp_path)
    before = len(mem.recent_events(limit=100))
    job = StubJob()
    out = handle_job_phase(PHASE_REQUEST, PHASE_NEGOTIATION, job, mem)
    assert out == {"stage": "accepted", "approve": True, "rule": "ok"}
    assert job.accepted and job.terms
    assert job.delivered is None
    # read-only verdict: no journal rows, no WARM purchase recorded
    assert len(mem.recent_events(limit=100)) == before
    assert mem.get_purchase(REQ["vendor"], REQ["sku"]) is None


def test_transaction_phase_journals_earning_and_delivers_2026_08_28(tmp_path):
    mem = fresh(tmp_path)
    job = StubJob(job_id="job-9")
    out = handle_job_phase(PHASE_TRANSACTION, PHASE_EVALUATION, job, mem)
    assert out["stage"] == "delivered" and out["approve"] is True
    assert job.delivered["type"] == "purser.spend-check.v1"
    assert job.delivered["approve"] is True and job.delivered["earning_id"]
    earnings = [e for e in mem.recent_events(limit=100)
                if (e.get("extra") or {}).get("kind") == "earning"]
    assert len(earnings) == 1
    extra = earnings[0]["extra"]
    assert extra["amount_micro"] == 10_000 and extra["verdict_rule"] == "ok"
    assert extra["job_id"] == "job-9"
    hot = mem._client.get_state("session:acp")
    hot = hot.get("body", hot) if isinstance(hot, dict) else hot
    assert hot and hot.get("last_job") == "job-9"
    # the guardrail rows must NOT exist for a verdict-only service
    kinds = [(e.get("extra") or {}).get("kind") for e in mem.recent_events(limit=100)]
    assert "payment" not in kinds and "refusal" not in kinds


def test_spend_check_never_poisons_dedup_2026_08_28(tmp_path):
    mem = fresh(tmp_path)
    for _ in range(2):  # check the same purchase twice via ACP
        handle_job_phase(PHASE_TRANSACTION, PHASE_EVALUATION, StubJob(), mem)
    real = decide(PurchaseRequest(**REQ), mem)
    assert real.approve is True and real.rule == "ok", \
        "a checked-but-never-made purchase must not block the real one"


def test_refusal_verdict_is_a_deliverable_2026_08_28(tmp_path):
    mem = fresh(tmp_path)
    job = StubJob(requirement=dict(REQ, amount_micro=999_999))  # over cap
    out = handle_job_phase(PHASE_TRANSACTION, PHASE_EVALUATION, job, mem)
    assert out["approve"] is False and out["rule"] == "cap"
    assert job.delivered["approve"] is False and "cap" in job.delivered["reason"]
    earnings = [e for e in mem.recent_events(limit=100)
                if (e.get("extra") or {}).get("kind") == "earning"]
    assert len(earnings) == 1 and earnings[0]["extra"]["approve"] is False


def test_api_state_sums_earnings_2026_08_28(tmp_path, monkeypatch):
    monkeypatch.setenv("PURSER_PANEL_DB", str(tmp_path / "panel.db"))
    monkeypatch.delenv("PURSER_TENANT_ID", raising=False)
    from purser.api import app
    panel = PurserMemory(tmp_path / "panel.db")
    journal_earning(panel, "job-a", PurchaseRequest(**REQ),
                    decide(PurchaseRequest(**REQ), panel))
    client = TestClient(app)
    tiers = client.get("/api/state").json()["tiers"]
    assert tiers["acp_jobs"] == 1
    assert tiers["acp_earned_micro"] == 10_000
