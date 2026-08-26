# Purser — Handoff

Read this first if you're picking up the project. Mirrors current state.

## Current state

Pre-build phase (Aug 26, 2026). Hackathon window opens Sep 1; submission
target Sep 9. Repo scaffolded, Sibyl SDK proven locally (Spike A 10/10),
spec docs written. Two research spikes in flight (x402, Virtuals/ACP).

## What's done

- Concept/name/stacks locked (see Memory.md decisions)
- Repo: MIT, README skeleton (architecture + memory contract), Tasks, spec set
- Sibyl packages installed in `.venv` (cli 0.3.7, client 0.7.0, mcp 0.1.14)
- Spike A green: `spikes/spike_a_tiers.py` — 10/10 checks, all five tiers

## In progress

- Spike B (x402 SDKs, real paid endpoints, cents purchase, TS-vs-Python call)
- Spike C (Virtuals registration cost, ACP minimum-viable shape)
- `sibyl init` browser bind — waiting on Raphie

## Blocked / waiting

- Account bind — Raphie must complete browser auth (`sibyl init`, re-run if expired)
- GitHub push — blocked on Ernxto vs A-Raphie account decision (Memory.md)
- Virtuals registration — blocked on cost quote + spend approval

## How to run it

```bash
cd /Users/raphie/Documents/Hackathons/purser
source .venv/bin/activate
python spikes/spike_a_tiers.py   # 10/10 expected
sibyl status                     # after browser bind
```

## Next steps

1. Complete `sibyl init` bind; verify `sibyl status`
2. Fold Spike B/C findings into Architecture.md (resolve D4)
3. Run `idea-autopsy` + `before-you-build` gates
4. Create + fund the dedicated Base wallet (<$5 USDC, key → .env)
5. Sep 1: Phase 1 — dedup-across-fresh-session slice

## Open questions

- TS-vs-Python payment rail (Spike B)
- ACP job shape + cost (Spike C)
- Which real x402 endpoints become the demo vendors (Spike B)

## Pointers

- Spec: [PRD.md](./PRD.md) · [Architecture.md](./Architecture.md)
- Plan: [Tasks.md](./Tasks.md)
- History: [Memory.md](./Memory.md)
