"""PurserMemory — the ONLY module that touches Sibyl Memory.

Tier discipline (mirrors Sibyl's own sibyl-save pattern):
  HOT        set_state/get_state      session pointer, priorities, handoffs
  WARM       entities                 vendors, budgets, purchases (upsert, UNIQUE)
  COLD       events                   append-only journal, one per decision/payment
  REFERENCE  references               static spend policy
  ARCHIVE    archive_entity           retired vendors, reason REQUIRED

Money is stored in micro-USDC integers (1e-6 USDC) everywhere. No floats.

Dry-run mode mutates nothing and logs what it would have done.
"""
from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sibyl_memory_client import MemoryClient
from sibyl_memory_client.exceptions import NotFoundError

TENANT_DEFAULT = "00000000-0000-0000-0000-000000000001"  # local dev tenant

# ---------------------------------------------------------------- policy


@dataclass
class SpendPolicy:
    max_per_purchase_micro: int = 20_000       # $0.02 (matches .env cap)
    daily_cap_micro: int = 250_000             # $0.25
    require_duplicate_check: bool = True
    new_vendor_trust: float = 0.5
    min_vendor_trust: float = 0.2

    def to_body(self) -> dict[str, Any]:
        return {
            "max_per_purchase_micro": self.max_per_purchase_micro,
            "daily_cap_micro": self.daily_cap_micro,
            "require_duplicate_check": self.require_duplicate_check,
            "new_vendor_trust": self.new_vendor_trust,
            "min_vendor_trust": self.min_vendor_trust,
        }

    @classmethod
    def from_body(cls, body: dict[str, Any]) -> "SpendPolicy":
        known = {f: body[f] for f in cls.__dataclass_fields__ if f in body}
        return cls(**known)


DEFAULT_POLICY = SpendPolicy()


# ---------------------------------------------------------------- core


@dataclass
class DryRunLog:
    """Collects would-have-done writes when dry_run=True."""
    writes: list[str] = field(default_factory=list)

    def note(self, what: str) -> None:
        self.writes.append(what)


class PurserMemory:
    """Typed tier wrapper. Nothing else in Purser writes memory directly."""

    def __init__(self, db: str | Path, tenant: str | None = None,
                 dry_run: bool = False, policy: SpendPolicy | None = None) -> None:
        self._client = MemoryClient.local(str(db), tenant_id=tenant or TENANT_DEFAULT)
        self.dry_run = dry_run
        self.dry = DryRunLog()
        self._policy = policy

    # ------------------------------------------------ WARM: entities

    def get_vendor(self, name: str) -> dict[str, Any] | None:
        try:
            rec = self._client.get_entity("vendor", name)
        except NotFoundError:
            return None
        return rec.get("body", rec)

    def upsert_vendor(self, name: str, body: dict[str, Any]) -> None:
        if self.dry_run:
            self.dry.note(f"would upsert vendor {name}: {body}")
            return
        self._client.set_entity("vendor", name, body)

    def get_budget(self, name: str) -> dict[str, Any] | None:
        try:
            rec = self._client.get_entity("budget", name)
        except NotFoundError:
            return None
        return rec.get("body", rec)

    def upsert_budget(self, name: str, body: dict[str, Any]) -> None:
        if self.dry_run:
            self.dry.note(f"would upsert budget {name}: {body}")
            return
        self._client.set_entity("budget", name, body)

    def get_purchase(self, vendor: str, sku: str) -> dict[str, Any] | None:
        try:
            rec = self._client.get_entity("purchase", f"{vendor}:{sku}")
        except NotFoundError:
            return None
        return rec.get("body", rec)

    def record_purchase(self, vendor: str, sku: str, body: dict[str, Any]) -> None:
        if self.dry_run:
            self.dry.note(f"would record purchase {vendor}:{sku}: {body}")
            return
        self._client.set_entity("purchase", f"{vendor}:{sku}", body)

    def list_vendors(self) -> list[dict[str, Any]]:
        """All vendor entities in WARM (name + body, flattened)."""
        out: list[dict[str, Any]] = []
        for rec in self._client.list_entities():
            if isinstance(rec, dict) and rec.get("category") == "vendor":
                body = rec.get("body", rec)
                row = {"name": rec.get("name", "?")}
                if isinstance(body, dict):
                    row.update(body)
                out.append(row)
            elif isinstance(rec, str) and ":" in rec:
                name = rec.split(":", 1)[1]
                body = self.get_vendor(name)
                if body is not None:
                    out.append({"name": name, **body})
        return out

    # ------------------------------------------------ ARCHIVE: retirement

    def retire_vendor(self, name: str, reason: str) -> None:
        """Retire a vendor: full record -> ARCHIVE, tombstone -> WARM.

        The WARM tombstone matters: archive_entity removes the entity from
        WARM, and an absent vendor reads as "new vendor, default trust" to
        the decision engine. The tombstone is what the blacklist IS.
        """
        if not reason or not reason.strip():
            raise ValueError("archive without reason is forbidden by the memory contract")
        if self.dry_run:
            self.dry.note(f"would archive vendor {name}: {reason}")
            return
        full = self.get_vendor(name) or {}
        if full:
            self._client.archive_entity("vendor", name, reason=reason)
        self._client.set_entity("vendor", name, {
            "status": "retired", "retire_reason": reason,
            "trust": 0.0, "purchases": full.get("purchases", 0),
            "archived_full_record": True})

    # ------------------------------------------------ COLD: journal

    def journal(self, acted: list[str], evaluated: list[str] | None = None,
                forward: list[str] | None = None, extra: dict[str, Any] | None = None) -> str:
        if self.dry_run:
            self.dry.note(f"would journal acted={acted}")
            return "dry-run"
        return self._client.write_event(
            acted=acted, evaluated=evaluated, forward=forward, extra=extra)

    def recent_events(self, limit: int = 50) -> list[dict[str, Any]]:
        return self._client.read_events(limit=limit)

    def spent_today_micro(self, today: str | None = None) -> int:
        """Sum settled payments from today's journal entries (micro-USDC)."""
        today = today or _dt.date.today().isoformat()
        total = 0
        for ev in self.recent_events(limit=200):
            extra = ev.get("extra") or {}
            if extra.get("kind") == "payment" \
                    and extra.get("status") in ("settled", "simulated") \
                    and str(extra.get("date", "")).startswith(today):
                total += int(extra.get("amount_micro", 0))
        return total

    # ------------------------------------------------ HOT: state

    def set_session(self, body: dict[str, Any]) -> None:
        if self.dry_run:
            self.dry.note(f"would set session: {body}")
            return
        self._client.set_state("session", body)

    def get_session(self) -> dict[str, Any] | None:
        rec = self._client.get_state("session")
        return (rec or {}).get("body")

    def set_handoff(self, role_from: str, role_to: str, body: dict[str, Any]) -> None:
        key = f"handoff:{role_from}-to-{role_to}"  # '>' is forbidden in state keys
        if self.dry_run:
            self.dry.note(f"would set {key}: {body}")
            return
        self._client.set_state(key, body)

    def get_handoff(self, role_from: str, role_to: str) -> dict[str, Any] | None:
        rec = self._client.get_state(f"handoff:{role_from}-to-{role_to}")
        return (rec or {}).get("body")

    # ------------------------------------------------ REFERENCE: policy

    def load_policy(self) -> SpendPolicy:
        if self._policy is not None:
            return self._policy
        rec = self._client.get_reference("spend-policy")
        if rec is None:
            return DEFAULT_POLICY
        body = rec.get("body", rec)
        return SpendPolicy.from_body(body if isinstance(body, dict) else {})

    def save_policy(self, policy: SpendPolicy) -> None:
        if self.dry_run:
            self.dry.note(f"would save policy: {policy.to_body()}")
            return
        self._client.set_reference("spend-policy", policy.to_body())

    # ------------------------------------------------ search (FTS)

    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        return self._client.search_entities(query, limit=limit)
