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

**Positioning.** The agent-treasury lane is well proven — by deterministic
policy engines that treat memory as non-authoritative on the money path by
doctrine. Purser is the inversion those architectures refuse to build:
judgment that compounds. Qualitative memory (this vendor shorted us twice,
that bargain recurs, that exception was granted) drives every decision —
while hard deterministic caps (per-purchase, daily, non-positive-amount
refusal) still fence the money. Memory decides, code enforces, every decision
lands in an append-only journal you can verify without a wallet.

## Canonical run — real entries, paid and refused together

The refused row is the product working. Every id below is verifiable in the
public checker (`/proof?id=…` when the sidecar runs, or `eval/` scripts).

| ledger entry | what happened | amount | onchain |
|---|---|---|---|
| spike B, attempt 1 | PAID, response lost in flight, settled — caught by balance reconcile | $0.00375 | balance-verified (the journal-then-reconcile lesson) |
| spike B, attempt 2 | PAID, receipt in hand | $0.00375 | [0xbbb6d430…](https://basescan.org/tx/0xbbb6d430a7acbd7d8d98d622c6aee050468233bb1405f6e4dce8e7433d605052) |
| via panel API | PAID | $0.00375 | [0x28ce1b23…](https://basescan.org/tx/0x28ce1b23de3d23bf7945df729274b660e919290c944035b84f09000d6c9750a0) |
| `87341082-2edd` | PAID through `/api/request`, proof page live | $0.00375 | [0x53c9bb81…](https://basescan.org/tx/0x53c9bb81704cc27e2640cf62fe1b21289f99c056c99c7cd9ee7308235cc8955d) |
| `2db1f7df-07a7` | **REFUSED** — duplicate of the row above, memory cited the prior purchase | $0.00375 kept | no payment: the guardrail firing |

Ledger entry ids are per-database: the panel's local ledger resets when you
wipe it (that is the amnesia demo), so `87341082-2edd` / `2db1f7df-07a7`
resolve only until the next wipe. The **onchain tx hashes above are
permanent** — those verify on Basescan forever. To see a live refusal,
run the same request twice in the panel and open its "public proof" link.

## Honest status

| surface | state |
|---|---|
| Memory core + deterministic decision engine | 🟢 shipped, 18 tests |
| Fresh-session dedup demo + with/without-memory eval | 🟢 shipped, numbers diverge |
| Control room, landing, wallet-free proof pages | 🟢 shipped |
| Real x402 payments on Base mainnet | 🟢 4 settled, receipts above |
| Trust floor + retirement tombstones | 🟢 shipped |
| Trust updates from payment outcomes | 🟢 settled +0.05, failed −0.15, auto-retire below floor |
| Crew (scout → purser → auditor through HOT handoffs) | 🟢 shipped, fresh process per role, `scripts/demo_crew.py` |
| Auditor drift detection | 🟢 reconciles COLD journal vs WARM purchases, flags drift |
| Virtuals ACP job (spend-check service) | 🟡 code, tests + spike shipped; live earning pending agent registration |
| Demo video + build-in-public posts | 🔴 Phase 4 |
| Hash-anchored memory snapshots | 🔴 roadmap (provenance of memory) |

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

# the crew: scout -> purser -> auditor, three fresh processes per shift,
# coordinating ONLY through memory tiers (shift 2 refuses the duplicate)
python scripts/demo_crew.py

# optional: the control room (build once, then one process; Node fetches
# the two fonts at build time, so build with network)
cd panel && npm install && npm run build && cd ..

# optional: the ACP leg (earn on Virtuals) — the SDK needs Python <3.13,
# so it lives in its own venv; everything else runs without it
python3.11 -m venv .venv-acp
.venv-acp/bin/pip install -r requirements-acp.txt
# then register two agents at https://app.virtuals.io/acp/join, fill the ACP
# block in .env (see .env.example), and:
#   .venv-acp/bin/python spikes/spike_c_acp.py                # rail proof
#   .venv-acp/bin/python -m purser.acp_service --db runtime/panel_memory.db   # seller (from src/)
#   .venv-acp/bin/python scripts/acp_client.py --vendor weather.x402.press --sku x --amount-micro 3750
(cd src && python -m purser.api)       # http://localhost:8788
# /       landing with live ledger readout + paste-an-id proof checker
# /room   the control room (requests, decisions, tiers, wipe)
# /proof  public receipt page, no wallet no login
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
| ACP verdicts read the same world | `src/purser/acp_service.py` → `handle_job_phase()` | `decide()` reads dedup/caps/trust (read-only); the only write is the `earning` journal row + HOT `session:acp` |
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
