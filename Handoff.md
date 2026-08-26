# Purser — Handoff

Read this first if you're picking up the project. Mirrors current state.

## Current state

Pre-build phase (Aug 26, 2026). Hackathon window opens Sep 1; submission
target Sep 9. Repo scaffolded, Sibyl SDK proven (Spike A 10/10) **and
authenticated** (account c92fba00…f4fd, FREE tier), spec docs written,
gates passed (autopsy SURVIVED), x402/ACP research complete — architecture
resolved to pure Python. Remaining pre-window items: wallet funding,
first real x402 purchase, Discord validation posts.

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
