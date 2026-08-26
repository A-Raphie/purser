# Purser — Handoff

Read this first if you're picking up the project. Mirrors current state.

## Current state

Pre-build phase (Aug 26, 2026). Hackathon window opens Sep 1; submission
target Sep 9. **All engineering spikes PASS.** Sibyl authenticated + proven
(Spike A 10/10), two REAL x402 payments settled on Base mainnet (Spike B:
$0.00375 × 2 to weather.x402.press, tx 0xbbb6d430…, wallet now 0.9925 USDC),
ACP path researched (free). Gates passed. Remaining: Discord validation posts,
GitHub account choice + push, then Sep 1 core slice.

Lean budget locked (Raphie): $1 total, caps $0.02/purchase + $0.25/day,
Sepolia-first dev, mainnet receipts only for the final demo.

## What's done

- Concept/name/stacks locked (see Memory.md decisions)
- Repo: MIT, README skeleton (architecture + memory contract), Tasks, spec set
- Sibyl packages installed in `.venv`; `sibyl init` bound (browser auth done)
- Spike A green: `spikes/spike_a_tiers.py` — 10/10 checks, all five tiers
- Spike B/C research green: pure-Python stack (x402[httpx] + virtuals-acp),
  Mogami facilitator, real cents endpoints shortlisted, ACP ≈ free
- Gates: idea-autopsy SURVIVED (kill-test = Discord incident recognition),
  before-you-build CONTINUE; interview script in docs/user-interview-script.md

## In progress

- x402 live purchase — blocked on wallet creation + funding

## Blocked / waiting

- Wallet — Raphie: create EOA (cmd in .env.example), fund <$5 USDC on Base + gas ETH
- GitHub push — blocked on Ernxto vs A-Raphie account decision (Memory.md)
- Discord validation posts — Raphie, before Sep 3 (script ready)

## How to run it

```bash
cd /Users/raphie/Documents/Hackathons/purser
source .venv/bin/activate
python spikes/spike_a_tiers.py   # 10/10 expected
sibyl status                     # after browser bind
```

## Next steps

1. Raphie: fund the wallet (see .env.example), then Spike B live purchase
2. Raphie: Discord validation posts (docs/user-interview-script.md), pre-Sep 3
3. Raphie: pick GitHub account (Ernxto vs A-Raphie), push, set repo public
4. Sep 1: Phase 1 — dedup-across-fresh-session slice (`PurserMemory`, `decide()`)

## Open questions

- TS-vs-Python payment rail (Spike B)
- ACP job shape + cost (Spike C)
- Which real x402 endpoints become the demo vendors (Spike B)

## Pointers

- Spec: [PRD.md](./PRD.md) · [Architecture.md](./Architecture.md)
- Plan: [Tasks.md](./Tasks.md)
- History: [Memory.md](./Memory.md)
