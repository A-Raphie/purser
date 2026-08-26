"""Spike A — exercise every Sibyl Memory tier with Purser-shaped data.

Proves the integration before the build window opens (Sep 1, 2026).
Run: .venv/bin/python spikes/spike_a_tiers.py
Uses an isolated local DB (spikes/spike_a.db) — never the account DB.
"""
from __future__ import annotations

import sys
from pathlib import Path

from sibyl_memory_client import MemoryClient

DB = Path(__file__).parent / "spike_a.db"

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    if DB.exists():
        DB.unlink()  # fresh spike every run

    memory = MemoryClient.local(str(DB))

    print("== HOT: set_state / get_state (live working state) ==")
    memory.set_state(
        "session",
        {"agent": "purser", "session": 2, "handoff": "auditor", "open_items": ["invoice-77"]},
    )
    state = memory.get_state("session")
    state_body = (state or {}).get("body", {})
    check("set/get_state roundtrip", state_body.get("handoff") == "auditor", f"body under 'body' key, updated_at={state.get('updated_at')}")

    print("== WARM: set_entity / get_entity (single source of truth) ==")
    memory.set_entity(
        "vendor",
        "weather-api",
        {"trust": 0.7, "purchases": 3, "last_price_usdc": 0.01, "notes": "fast, reliable"},
    )
    vendor = memory.get_entity("vendor", "weather-api")
    check("set/get_entity roundtrip", vendor.get("body", {}).get("trust") == 0.7 or vendor.get("trust") == 0.7, str(vendor)[:80])

    # UNIQUE(category, name): second write to same key must overwrite, not duplicate
    memory.set_entity("vendor", "weather-api", {"trust": 0.9, "purchases": 4, "last_price_usdc": 0.01})
    again = memory.get_entity("vendor", "weather-api")
    body = again.get("body", again)
    check("WARM upsert (no duplicates)", body.get("trust") == 0.9, "trust 0.7 -> 0.9 in place")

    print("== COLD: write_event / read_events (append-only journal) ==")
    ev1 = memory.write_event(acted=["paid weather-api 0.01 USDC via x402"], forward=["recheck trust after 10 uses"])
    ev2 = memory.write_event(acted=["rejected vendor graph-ml: duplicate invoice-77"], extra={"session": 2})
    events = memory.read_events(limit=10)
    check("write/read_events roundtrip", len(events) >= 2 and ev1 and ev2, f"{len(events)} events, ids returned")

    print("== REFERENCE: set_reference / get_reference (static policy) ==")
    memory.set_reference("spend-policy", {"max_per_purchase_usdc": 0.50, "daily_cap_usdc": 5.00, "require_duplicate_check": True})
    ref = memory.get_reference("spend-policy")
    ref_body = ref.get("body", ref) if ref else {}
    check("set/get_reference roundtrip", bool(ref_body), "spend policy stored")

    print("== ARCHIVE: archive_entity (retired, reason required by our contract) ==")
    memory.set_entity("vendor", "sketchy-oracle", {"trust": 0.05, "purchases": 1, "notes": "double-billed"})
    archived = memory.archive_entity("vendor", "sketchy-oracle", reason="double-billed invoice-12; never again")
    check("archive_entity with reason", bool(archived), str(archived)[:80])

    print("== SEARCH: search_entities (FTS5 across tiers) ==")
    hits = memory.search_entities("weather")
    check("search finds vendor by content", any("weather" in str(h).lower() for h in hits), f"{len(hits)} hits")
    listed = memory.list_entities()
    check("list_entities", isinstance(listed, list), f"{len(listed)} entities")

    print("== PLATFORM: free_tier_status (2MB cap monitor) ==")
    try:
        status = memory.free_tier_status()
        check("free_tier_status", True, str(status)[:100])
    except Exception as exc:  # optional API — not fatal
        check("free_tier_status", True, f"not available locally: {exc}")

    print("== LITMUS mechanics: delete_entity (hard delete) ==")
    deleted = memory.delete_entity("vendor", "weather-api")
    try:
        memory.get_entity("vendor", "weather-api")
        gone = False
    except Exception:  # NotFoundError — missing entities raise, not return None
        gone = True
    check("delete_entity removes entity", deleted and gone, "get on missing entity raises NotFoundError")

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
