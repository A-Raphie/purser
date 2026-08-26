# PURSER

```
                    ╭──────────────╮
   "the money       │  ┌────────┐  │   agent memory infrastructure
    officer who     │  │ PURSER │  │   onchain payments · zero double-spends
    never forgets"  │  └────────┘  │   built on Sibyl Memory
                    ╰──────────────╯
```

> A treasurer agent crew on Base that spends via x402 micropayments — and keeps
> every vendor trust score, budget rule, and purchase it ever made in persistent
> memory, so a fresh session never double-pays or trusts a bad vendor twice.

**Status: pre-build (hackathon window opens Sep 1, 2026).** Everything below is
the committed architecture; each section links the code that implements it as it
lands. Claims on this page are only written once they're runnable.

## What this is

For operators funding autonomous agents, Purser is the money officer of the
crew. A scout finds what's needed, the purser decides and pays (real x402
payments on Base), an auditor reconciles the ledger. Their coordination channel
is not messages — it is Sibyl Memory itself.

Delete the memory layer and the crew is lobotomized: it re-buys duplicates,
ignores learned budgets, and trusts vendors it swore off. That is the point.

## Architecture

```
                       ┌─────────────────────────────┐
                       │        SIBYL MEMORY         │
                       │  (SQLite + FTS5, local)     │
                       │                             │
    scout ──writes──▶  │ HOT      handoff state      │ ──reads──▶ purser
    purser ─writes──▶  │ WARM     vendor/budget      │ ──reads──▶ auditor
    auditor ─writes──▶ │ COLD     purchase journal   │
                       │ ARCHIVE  retired vendors    │
                       └──────────────┬──────────────┘
                                      │
                              ┌───────▼────────┐
                              │  Base (x402)   │  real USDC payments
                              │  + Virtuals    │  earns via ACP job
                              └────────────────┘
```

## Memory contract

| Tier | Key | Written by | Read by | Purpose |
|------|-----|-----------|---------|---------|
| HOT | `session`, `priorities`, `handoff:*` | scout/purser/auditor | next agent up | live working state, in-place |
| WARM | `vendor:<name>`, `budget:<name>` | purser | all | single source of truth, `UNIQUE(category, name)` |
| COLD | journal events | every payment | auditor, fresh sessions | append-only ledger |
| REFERENCE | policy docs | setup | all | static rules |
| ARCHIVE | retired vendors | purser (`reason` required) | audit | kept, never deleted |

(A full memory map with `file:line` links lands here during the build window —
the submission requires judges to find memory calls in under 2 minutes.)

## Install

Python 3.10+ and Node 18+ (panel only).

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt        # Sibyl Memory, x402, FastAPI, tests
python -m pytest tests/ -q             # 14 green

# the core demo: session 2 (fresh process) refuses the duplicate
python scripts/demo_two_sessions.py

# the numbers: with-memory vs amnesia
python eval/run_eval.py

# optional: the control room (build once, then one process; Node fetches
# the two fonts at build time, so build with network)
cd panel && npm install && npm run build && cd ..
(cd src && python -m purser.api)       # http://localhost:8788
```

Real payments need `.env` (copy `.env.example`): a funded Base EOA,
`PURSER_PRIVATE_KEY`, caps. Everything above runs without it in simulate
mode, clearly labeled.

## Memory map (judges: every memory read/write in under 2 minutes)

All memory access goes through ONE module — `src/purser/memory.py` — nothing
else in the codebase touches Sibyl. The interesting lines:

| What | Where | Calls |
|---|---|---|
| Tier wrapper (the only memory module) | `src/purser/memory.py` | `set_entity`/`get_entity` (WARM), `write_event`/`read_events` (COLD), `set_state`/`get_state` (HOT), `set_reference` (REFERENCE), `archive_entity` (ARCHIVE) |
| Duplicate check reads the ledger | `src/purser/decide.py` → `decide()` | `get_purchase` |
| Blacklist reads the WARM tombstone | `src/purser/decide.py` → `decide()` | `get_vendor` |
| Daily cap sums the COLD journal | `src/purser/memory.py` → `spent_today_micro()` | `read_events` |
| Every payment/decision journaled | `src/purser/decide.py` → `learn_from_outcome()` | `write_event`, `set_entity` |
| Fresh-session recall proof | `scripts/demo_two_sessions.py` | runs two separate processes; session 2 refuses what session 1 bought |
| With/without-memory numbers | `eval/run_eval.py` | both arms' raw JSON in `eval/results/` |

## Run the control room

```bash
cd panel && npm install && npm run build   # static export once
cd .. && source .venv/bin/activate
python -m purser.api                        # from src/: serves panel + API
# open http://localhost:8788
```

One process, no external services. Run the same request twice and watch the
second one get refused with the recalled receipt. Wipe the ledger and the
amnesia twin pays again. Real mode flips the same `pay()` the terminal uses.

## Prior work declared

- **Settle** (BOT Chain Builder Challenge) — agents with onchain budgets.
  Purser reuses the *problem*, not the code; the memory layer makes the
  judgment persistent, which Settle lacked.
- **MemLens** (Hack Hydra) — agent-memory debugger. Domain familiarity only.

## Provenance

Built for the [Sibyl Labs Hackathon](https://hack.sibyllabs.org), Sep 1–10 2026,
by Raphie Ohagwu (solo, team "Raphie leveling"). All payments shown in demos are
real onchain transactions; failures are published, not hidden.

## License

MIT
