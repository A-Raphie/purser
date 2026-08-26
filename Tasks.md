# Purser — Tasks

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

## Phase 0 — Pre-window (Aug 26–31)

- [x] Concept, name (Purser), multiplier stacks locked; decision log started
- [x] Repo skeleton: MIT, README (architecture + memory contract), .gitignore
- [x] Sibyl packages installed (cli 0.3.7, client 0.7.0, mcp 0.1.14, hermes)
- [x] `sibyl init` browser bind + `sibyl status` green — bound, health all green
- [x] Spike A: tier spike 10/10 (`spikes/spike_a_tiers.py`)
- [x] Spike B research: Python x402 SDK v2.20.0 confirmed (Base-complete,
      first-party); real cents endpoints found (GPUOps, AgentFund, Lemon
      Toolshed); Mogami facilitator for Base mainnet — DONE, D4 = pure Python
- [x] Spike C research: ACP agent creation free, sandbox w/ sponsored gas +
      test USDC, `virtuals-acp` SDK path, 1–2 dev-days estimate — DONE
- [x] Spike B live: **two real x402 payments settled on Base mainnet**
      (weather.x402.press, $0.00375 × 2, tx 0xbbb6d430…, wallet 1.000000 →
      0.9925). Dev strategy per Raphie: Sepolia-first (free, default
      facilitator); mainnet receipts only for final demo (~$0.10 of the $1)
- [x] Wallet: dedicated Base EOA 0x58bA…3BcE funded with **$1 USDC on Base**
      (key in .env, caps $0.02/purchase, $0.25/day)
- [x] Spec files (PRD/Architecture/Tasks/Memory/Handoff)
- [x] Gates: `idea-autopsy` SURVIVED + `before-you-build` CONTINUE; kill-test
      = Discord incident recognition (script in docs/)
- [~] talk-to-users: script drafted; **Raphie to post in Discords before Sep 3**
- [ ] GitHub: pick account (Ernxto vs A-Raphie), push, public — Raphie call

## Phase 1 — Smallest testable slice: dedup across a fresh session (Sep 1–2)

- [ ] `PurserMemory` typed wrapper over SDK (tier discipline enforced)
- [ ] `decide()`: duplicate check against WARM `purchase:*` + COLD events
- [ ] Two-session scripted run: session 1 buys, session 2 (fresh process)
  refuses the same purchase citing the ledger — **this is the core assumption
  in front of reality; everything else is revisable**
- [ ] Eval harness v0: run scenario with-memory vs without-memory, print both

## Phase 2 — Judgment + rails (Sep 2–5)

- [ ] Budget engine (WARM budgets + REFERENCE policy, mathguard tests)
- [ ] Trust engine (vendor trust updates on outcomes; archive-with-reason)
- [ ] x402 real payments wired to decision engine (≥3 real purchases)
- [ ] Crew: scout/purser/auditor via HOT handoff keys, fresh process each
- [ ] Auditor: reconciles COLD journal vs WARM entities, flags drift
- [ ] X build-in-public post #1 (tag @sibylcap) — drafted, Raphie posts
- [ ] Recall footage captured live each session (timestamp/commit hash visible)

## Phase 3 — Multiplier + evidence + panel (Sep 5–8)

- [ ] Virtuals registration (after cost approval) + one real ACP job
- [ ] Eval kit final: scorer, raw logs, cost/wall-clock/errors, failures kept
- [ ] Inspector panel (stretch — first cut if time): design.md via
  `design-direction` + `semantic-tokens`, Next.js, browser tests, Lighthouse,
  public Vercel deploy (no SSO)
- [ ] `mock-hunter` sweep: nothing fake in the demo path

## Phase 4 — Ship (Sep 8–10)

- [ ] README final: memory map with file:line, stack map, prior-work note
- [ ] Demo video: `demo-script` → `vo-first` → `demo-video`, 2–5 min, continuous unedited recall segment
- [ ] `humaniser` pass on VO + README; `youtube-description` for video post
- [ ] X post #2 (video); both posts live, tags checked
- [ ] Audits: `production-audit`, `pre-release-review`, `dos-verify-done-claims`
- [ ] `ship-rehearsal`: fresh-clone judge-mode run; `pre-ship-gate`
- [ ] Submit on private build page, mark ready — **target Sep 9**

## Dependencies

- Phase 1 depends on: Phase 0 wallet + memory wrapper (spikes already de-risk)
- ACP job depends on Spike C quote + Raphie's spend approval
- Panel depends on design.md confirmation (design-direction skill, user-confirm)
- Video depends on real recall footage existing from Phase 2 onward

## Kill criteria / fallback ladder

- If crew coordination isn't demoable by **Sep 5** → collapse to single agent
  (memory contract unchanged; coordination story told via HOT handoff keys)
- If x402 real payment fails irrecoverably by **Sep 6** → fall back to a real
  wallet op / B20 read on Base (still an "executed onchain action", ×1.15
  floor), keep Virtuals only if ACP already live
- If ACP job isn't exercisable by **Sep 7** → keep registration only if it
  transacts; otherwise drop to Base-only ×1.15 and re-declare
- If BOTH rails fail → submission continues memory-first at ×1.00 (never cut
  the memory contract, dedup demo, eval kit, or video)

## Done = 

Public repo (MIT, clean commits, README with memory map), 2–5 min video with
continuous unedited fresh-session recall, two public posts tagging @sibylcap,
≥3 real x402 payments on Base, 1 real ACP job, eval kit with both-numbers
honesty, submission marked ready on the private build page by Sep 9.
