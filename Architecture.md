# Purser — Architecture

## Overview

Purser is a crew of three agent roles — **scout**, **purser**, **auditor** —
that never talk to each other directly. Their entire coordination channel is
Sibyl Memory: HOT state for handoffs and priorities, WARM entities for the
shared world-model (vendors, budgets), COLD journal for the append-only
purchase ledger, ARCHIVE for retired vendors with reasons. Money moves via
x402 on Base; income arrives via a Virtuals ACP job.

## Components

- **memory core** (`src/purser/memory/`) — typed wrappers over
  `sibyl_memory_client.MemoryClient`. Owns the tier discipline; nothing else
  touches the DB. Enforces: every archive carries a reason, journal is
  append-only, WARM upserts not duplicates.
- **decision engine** (`src/purser/decide/`) — deterministic, testable rules:
  duplicate check (COLD+WARM), budget check (WARM budgets + REFERENCE policy),
  trust check (WARM vendor trust score). LLM used for narrative/explanations
  only, never for spend/no-spend math (deterministic > LLM judgment — Sibyl's
  own house style).
- **crew runner** (`src/purser/crew/`) — runs scout/purser/auditor as fresh
  processes per session; handoff strictly via HOT `handoff:*` keys. A session
  starts cold, loads memory, acts, journals, hands off.
- **payment rail** (`src/purser/pay/`) — Python `x402[httpx]` v2.20+ (first-party
  x402 Foundation SDK), Base mainnet `eip155:8453`, USDC `0x8335…2913` via
  EIP-3009 gasless transfers, production facilitator **Mogami**
  (`facilitator.mogami.tech`, free, Base) — the default `x402.org/facilitator`
  is testnet-only. EOA wallet, `EVM_PRIVATE_KEY` env, SDK's built-in $1
  default spend cap kept on as a safety net.
- **acp service** (`src/purser/acp/`) — Virtuals ACP via `virtuals-acp` SDK
  (⚠ NOT IBM's `acp-sdk`). Path: sandbox first (sponsored gas, test USDC,
  self-evaluation buyer/seller examples), mainnet end-to-end via
  `BASE_MAINNET_ACP_X402_CONFIG_V2` for the demo if budget allows. Offering:
  procurement/spend-audit service priced $0.01–0.10 USDC fixed.
- **eval kit** (`eval/`) — scenario replays: same requests run with-memory
  and without-memory; scorer publishes both counts + raw logs + costs.
- **inspector panel** (`panel/`, stretch) — read-only web view of tier
  contents for the demo. Next.js.

## Data model (memory contract)

| Tier | Key / (category, name) | Body shape | Written by | Read by |
|---|---|---|---|---|
| HOT | `session` | `{n, started, agent, open_items[]}` | every role | every role |
| HOT | `handoff:scout→purser` etc. | `{request, vendor, quote, deadline}` | scout | purser |
| HOT | `priorities` | ranked, cap 15 | purser | all |
| WARM | `vendor:<name>` | `{trust: 0..1, purchases: n, last_price_usdc, notes}` | purser | all |
| WARM | `budget:<name>` | `{cap_usdc, spent_today_usdc, window}` | purser | purser, auditor |
| WARM | `purchase:<vendor>:<sku>` | `{ts, tx_hash, usdc, sku}` — dedup key | purser | purser (dedup) |
| COLD | events | `{acted[], evaluated[], forward[], extra}` — one per decision+payment | all | auditor, fresh sessions |
| REFERENCE | `spend-policy` | `{max_per_purchase_usdc, daily_cap_usdc, require_duplicate_check}` | setup | decide engine |
| ARCHIVE | retired vendors | entity + `reason` (mandatory) | purser | audit |

Delete-the-DB litmus: no vendors, no budgets, no ledger → dedup check misses,
budget check reads default-infinite, trust check sees unknown → agent would
pay duplicates and bad vendors. Product broken by construction. ✓

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Memory | Sibyl Memory (Python SDK 0.7.x) | mandatory sponsor tech; local SQLite+FTS5 |
| Agent core | Python 3.14 | Sibyl SDK, x402 SDK, and virtuals-acp are all Python-first — single-language stack |
| Payments | x402[httpx] on Base 8453 + Mogami facilitator | Spike B: Python SDK v2.20.0 is first-party and Base-complete |
| ACP | virtuals-acp (Python) | Spike C: sandbox free; mainnet via x402 route |
| Panel | Next.js (stretch) | Raphie's home turf |
| Tests | pytest, dated adversarial names | Sibyl house convention |

## Key decisions & trade-offs

- **Coordination via memory only** (no message bus) — aligns with the rubric's
  top band ("coordination and dynamic-storage patterns"). Trade-off: slower
  handoffs; acceptable — judgment, not latency, is the product.
- **Deterministic decision engine, LLM only for prose** — a wrong payment
  number is a real-money bug; rules are auditable and eval-able. Trade-off:
  less "magical" flexibility; flexibility is not what you want in a treasurer.
- **Fresh process per session** — makes "fresh-session recall" mechanically
  true (no in-process state leaks into the demo's claim). Trade-off: process
  startup cost per session; trivial at this scale.

## API surface

Internal Python API (stable seams for tests + eval kit):
`PurserMemory` (typed tier wrappers), `decide(request, memory) -> Decision`,
`pay(decision, wallet) -> Receipt`, `audit(session_n, memory) -> Report`.

## Open architectural questions

- [resolved D4 2026-08-26] Pure Python stack (x402 Python SDK + virtuals-acp
  are first-party and Base-capable); TS dropped — no service boundary needed
- Demo vendor shortlist (real x402 endpoints, cents-priced): GPUOps chain
  data `chain.gpuops.io` ($0.001+), AgentFund SEC/econ data
  `x402.agentfund.net` ($0.001–0.03), Lemon Toolshed ($0.001/call),
  GPUOps AI inference ($0.001–0.02), Business Day API ($0.001)
- [assumption: single-tenant demo — `tenant_id` default is fine for v1]
