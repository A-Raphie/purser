# Purser — PRD

## Problem

Operators funding autonomous agents have no money officer. Agents that pay for
things (APIs, data, services) start every session with amnesia: they re-buy
what was already purchased, ignore budgets their operator set weeks ago, and
re-trust vendors that burned them. The operator becomes the memory — re-reading
logs, re-stating rules, watching for double-spends. Persistent memory is the
missing layer between "agent has a wallet" and "agent can be trusted with one."

## Personas

- **Primary: Agent operator ("the captain")** — runs one or more autonomous
  agents with funded wallets on Base. Wants to delegate purchasing without
  babysitting. Fears: double-pays, budget blowouts, trusting flaky vendors.
- **Secondary: Hackathon judge (Sibyl Labs)** — evaluates whether memory is
  load-bearing, whether the demo is real, and whether the artifact is
  verifiable in 5 minutes. The demo is designed for this persona too.
- **Tertiary: Other agents (via ACP)** — hire Purser's service through the
  Agent Commerce Protocol; they are Purser's customers, not its users.

## Jobs to be Done

1. When an agent needs to buy something, I want the purchase checked against
   everything the crew has ever learned, so that duplicates, budget breaches,
   and known-bad vendors are refused automatically.
2. When I open a fresh session, I want the crew to pick up exactly where the
   last one left off, so that I never re-explain budgets or vendor history.
3. When a vendor misbehaves, I want that memory to change future decisions
   (trust down, archive, never-again), so the crew gets safer over time.
4. When another agent wants to pay for procurement/audit work, I want Purser
   to take the job via ACP, so the crew earns as well as spends.

## Scope (v1 — hackathon submission, Sep 1–10 2026)

- Crew of three agent roles (scout, purser, auditor) coordinating **only**
  through Sibyl Memory tiers (HOT handoff, WARM entities, COLD journal)
- Real x402 payments on Base (USDC micropayments to real paid endpoints)
- One real ACP job on Virtuals (service sold to another agent)
- Dedup/budget/trust decision engine reading memory every session
- Eval kit: replay harness scoring decisions with-memory vs without-memory,
  raw logs published, failures included
- Memory inspector panel (stretch): web view of live tier contents
- Demo: 2–5 min video incl. continuous unedited fresh-session recall

## Non-goals

- Not a custodial wallet service — Purser holds a demo hot wallet only, no
  user funds, no key management product
- No fiat rails, no off-chain refunds, no human approval queues
- Not a general payments API for third parties in v1
- No production security hardening beyond spend caps (max-per-purchase,
  daily cap enforced by policy in REFERENCE + code guard)
- No multi-chain support beyond Base in v1

## Success metrics

- Rubric-targeted: memory load-bearing (40 pts) — deleting the Sibyl DB
  changes agent decisions visibly in the demo and in eval-kit numbers
- Eval kit: dedup + budget + trust decisions ≥ 90% correct with memory,
  ~0% without (that delta IS the product)
- Real artifacts: ≥3 real x402 payments on Base, 1 ACP job completed
- Submission: repo, video, two posts live and judge-checkable by Sep 9

## Open questions

- [pending Spike B] TS-first (x402 SDK + Sibyl MCP) vs Python-first (Sibyl
  SDK + TS payment service) — decided by x402 SDK maturity research
- [pending Spike C] ACP minimum-viable shape and Virtuals registration cost
- [assumption: paid x402 endpoints exist on Base at cents-level prices —
  verifying in Spike B before committing the demo to them]
