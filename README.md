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

TBD — lands with the first working build (Sep 1+). Python 3.10+, Sibyl Memory,
x402 on Base.

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
