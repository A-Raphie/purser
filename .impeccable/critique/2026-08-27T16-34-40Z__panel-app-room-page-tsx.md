---
target: room dashboard + landing + proof
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 5
timestamp: 2026-08-27T16-34-40Z
slug: panel-app-room-page-tsx
---
Method: dual-agent (A: design review sub-agent · B: detector sub-agent)

# Purser panel — impeccable critique (pre-fix baseline)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | LIVE dot never changes when sidecar is down; "LAST TX none yet" false when sim txs exist; no refresh timestamp |
| 2 | Match System / Real World | 3 | Ledger voice strong; "sku", "shift", unverifiable "5 tiers" unexplained |
| 3 | User Control and Freedom | 2 | Wipe has confirm but no scope preview; proof errors strand user |
| 4 | Consistency and Standards | 2 | Three empty-state idioms; "none yet" vs "pending"; idle crew uses rose (danger) dot |
| 5 | Error Prevention | 2 | "real x402 on base" spends real USDC from a bare dropdown, no confirm, no persistent badge |
| 6 | Recognition Rather Than Recall | 1 | Proof keyed on entry ids the UI never shows after reload (session-local feed); no copy affordance |
| 7 | Flexibility and Efficiency | 1 | No Enter-to-submit (cmdbar not a form); no presets; no repeat affordance |
| 8 | Aesthetic and Minimalist Design | 2 | Empty state ~40% dead canvas crowned by 56px $0.000000; two competing 56px numbers |
| 9 | Error Recovery | 2 | Fetch failure renders zeros-as-data with LIVE strip; Retry buried |
| 10 | Help and Documentation | 3 | cmd-note teaching copy good; tier/trust semantics only on landing |
| **Total** | | **20/40** | **Acceptable — significant improvements needed** |

## Design Specificity

Category-interchangeable shell wearing one genuinely product-specific organ: the ctx-chunk recall evidence (COLD·journal / WARM·entity pills) is the one element no other product could own. The journal doesn't look like a journal (no entry spine, no ids); the 5-tier memory system is claimed in the sidebar but only 3 tiers have surfaces (ARCHIVE/retired: none); receipts are a footer strip; refusals demoted to a gray chip though they're the product working. Detector (B): 2 real layout-transition findings (budget-fill, trustfill animate width), Geist flagged by overused-font policy (accepted: deliberate system choice), 1 false positive (side-tab on CSS checkmark, minified-line artifact). Built-HTML scan degraded (missing parser modules); compensating CSS-bundle scan confirmed source findings ship.

## Priority Issues

1. [P0] /proof empty state is a dead end — tells you to paste an id but renders no input, no example; ~90% blank canvas on the trust surface. Fix: checkrow input + Verify + example id.
2. [P0] Entry ids unobtainable when needed — decisions feed is session-local, journal rows show no ids, nothing copies. Fix: hydrate decisions from journal via /api/state; journal rows show short id + copy.
3. [P1] Post-wipe room is the demo's final beat and its emptiest — hero advertises $0.000000, chips read 0/0/0, ~40% dead canvas. Fix: state-aware hero + one-click litmus CTA; hide vacuous chips.
4. [P1] Real-money mode has no guardrail — real x402 among 4 form fields, no confirm, no persistent indicator. Fix: arm-to-confirm on first real run (wipe idiom) + mode badge in status strip.
5. [P1] Silent data failure renders zeros as truth — outage looks identical to empty ledger, strip stays LIVE. Fix: strip dot/text driven by fetch health + degraded banner with Retry.
6. [P1] Mobile 375px broken — sidebar consumes width, card grid overflows horizontally (parent-run screenshot). Fix: <900px collapse, sidebar to top strip, grid stacks.
7. [P2] Tier system invisible + idle uses danger color. Fix: archive tab + tier-ladder row; neutral gray idle dot.

## Persona Red Flags (condensed)

Alex: no Enter submit; no copy on ids/txs; journal capped at 8 with no "+N"; no deep links. Sam: tablist without roving tabindex; sparkline has no SR alternative; 10px labels borderline contrast; invisible wipe-disarm timeout; focus-visible and reduced-motion properly done. Jordan: landing action <5s pass; room first action pass; real-mode unlabeled; proof dead-end.

## Minor Observations

usd() 6dp noise on caps; "none yet…" ellipsis on non-hash; landing Tick wired to constant "0"; journal tab double counter (cold_count vs payments); .brass legacy name maps to green; toast truncates refusal reason at 70 chars; budget 0% big number; sidebar mixes anchors and pages; three verification entry points; crew "shift ?" when undefined.

## Questions to Consider

1. What if the hero of the room were the memory, not the money — a live tier ladder as the 56px object, spend demoted to a stat?
2. What if Wipe were a ceremony — showing exactly what will be forgotten before it goes?

## Run Notes

Target slug panel-app-room-page-tsx resolved; no ignore list; assessments ran isolated dual-agent; CLI detector ran on source (2 findings) + built CSS (3, 1 FP); built-HTML scan degraded (parser modules unavailable in skill dir), compensated via direct CSS-bundle scan; browser overlay skipped (no browser tooling in sub-agent; sidecar left untouched); mobile 375px screenshot captured by parent as extra evidence.
