# Purser · Demo Video Script

Target: 3:00, single continuous take on the hosted app
(https://purser-production-ef37.up.railway.app), real Chrome, drawn cursor,
VO-first. One message the judge should repeat: **it remembers every decision,
so it never pays twice, and it earns by refusing.**

Format: timestamp · Show (screen) · Say (exact VO) · Do (actions) · Criterion
(judging weight). Time budget follows the criteria: Memory 40 (~72s),
Innovation 25 (~45s), Execution 20 (~36s), Pitch 15 (~27s).

Recording notes are at the bottom (preflight, cursor, VO order, confirmation
gate). Nothing is published until you approve the final cut.

---

## Scene 1 · 0:00–0:12 · Landing hook · Pitch

**Show:** the landing at the hosted URL, scrolled to the hero: "Agents with
wallets forget everything. The treasurer shouldn't." and the live instrument
($0.012750 spent, requests refused, ACP earned).

**Say:** "You just gave an AI agent a wallet. Take away its memory, and it
will happily pay the same invoice twice. This is Purser: a treasurer that
never forgets a decision, because every decision is written down."

**Do:** page loads cold (already scrolled to hero), cursor drifts across the
hero stats. No clicks. Hold the hero numbers for a beat.

**Criterion:** Pitch (hook: danger first, name second; question planted:
"what stops it paying twice?" · answered in Scene 5 and the close).

## Scene 2 · 0:12–0:30 · Deployment proof · Execution

**Show:** zoom out briefly so the URL bar is readable:
purser-production-ef37.up.railway.app. Then into the control room: the
$0.012750 hero, chips (2 payments, 2 refused, +$0.010000 EARNED · 1 ACP),
crew card with audit `clean · 1✓`.

**Say:** "This is the live control room, hosted on Railway right now. The
treasurer has spent about a cent across real X 4 0 2 payments on Base, and
it has already earned a penny of its own, selling verdicts to another agent.
Every number here is read from the ledger, live."

**Do:** cursor circles the URL, then the hero number, then the EARNED chip.
Hold 3 beats, one per stat group.

**Criterion:** Execution (live hosted deploy, real data, no mocks).

## Scene 3 · 0:30–1:12 · The memory loop · Memory (core)

**Show:** the command bar. Type the canned request (weather.x402.press,
lagos-weather-current, $0.003750). Click Run request. The PAID · SIMULATED
card lands. Click Run request again. The REFUSED card lands with the recalled
evidence block.

**Say:** "Watch the simplest test in the world. Buy the same thing twice.
First request: the treasurer checks its memory, finds nothing, pays.
Nine tenths of a cent, spent. Second request: same vendor, same item.
The ledger already holds this purchase, and the receipt comes back with it.
Same request, and this time: refused. The money stays."

**Do:** click into the vendor field (fields are pre-filled: matches skip),
click Run request, hold on the PAID card ($0.000900 SPENT, green). Click Run
request again, hold on the REFUSED card ($0.000900 KEPT) while the cursor
moves down the recalled evidence: WARM entity, the stored purchase with its
date and tx. This is the longest hold in the video.

**Criterion:** Memory load-bearing (the dedup loop with recalled evidence).

## Scene 4 · 1:12–1:36 · Guardrails · Memory

**Show:** scroll the decisions feed to the cap refusal (storage.x402.example,
$0.030000 vs the $0.02 per-purchase cap, policy reference recalled), then the
crew card: scout, purser, auditor on shift 1, audit `clean · 1✓`.

**Say:** "Deduplication is one rule of many. Ask for something over budget:
refused, and the policy itself is the evidence. Every shift, an independent
auditor replays the journal against the ledger. On screen: clean."

**Do:** slow scroll (two wheel ticks) to the cap card, hold on the recalled
`policy reference` line, then drift to the crew card audit row.

**Criterion:** Memory (guardrail breadth: caps, policy recall, auditor).

## Scene 5 · 1:36–2:06 · The amnesia twin · Memory (thesis)

**Show:** the sidebar Wipe ledger. First click arms it: "Confirm: wipe" plus
the scope line ("forgets 2 vendors · 7 entries"). Second click wipes. The
room empties to the teaching state. Then run the same request again: it PAYS.

**Say:** "Now the part that matters. Delete the memory. On purpose. The
treasurer warns me exactly what it is about to forget. Gone. Same request
again: and it pays. No memory, no refusal. That is the whole thesis in one
click: the behavior was never in the code. It was in the memory."

**Do:** click Wipe ledger (arm), hold 2 beats on the scope line, click again
(confirm), hold on the empty room, then Run request, hold on the PAID card.
Silent beat after "it pays."

**Criterion:** Memory (the litmus: delete DB, double-pays; this is the
sponsor's top criterion performed live).

## Scene 6 · 2:06–2:30 · Fresh-session proof · Execution

**Show:** split view: terminal on the left. `git log -1` shows the commit
hash on screen. Then `python scripts/demo_two_sessions.py` runs: session 1
buys, session 2 (a fresh process) refuses the duplicate, citing the receipt.

**Say:** "Not a browser trick. Two separate processes, sharing nothing but
the memory. The commit on screen is the build being recorded. Session one
buys. Session two, a cold process, reads the same ledger and refuses."
Hold the refusal line.

**Do:** run `git log -1 --oneline` first (hash readable, 2 beats), then run
the demo script, stop after session 2's REFUSE line prints.

**Criterion:** Execution (fresh-session recall proof, the submission
requirement: continuous, unedited, timestamp/commit on screen).

## Scene 7 · 2:30–2:50 · It earns · Innovation

**Show:** back to the control room, memory tiers journal tab: the earning
entry (+$0.01, ACP job 75160). Terminal or README beside it showing the
deliverable hash `0xb0569dd2…` and "escrow released".

**Say:** "And refusing is a product. On Virtuals, another agent paid Purser
one cent to ask that question, should I buy this? The answer was no, the
refusal was delivered as the product, and the contract released the escrow.
A treasurer that costs money is normal. A treasurer that earns is the point."

**Do:** scroll the journal to the earning row, cursor holds on `+$0.01`,
then on the deliverable hash. Two beats on "earn".

**Criterion:** Innovation (memory as a sellable service, Virtuals leg live).

## Scene 8 · 2:50–3:00 · Close · Pitch

**Show:** the landing, both links readable: the live URL and
github.com/A-Raphie/purser. Final frame holds both.

**Say:** "Purser. Memory is load-bearing. The live room and the full ledger
are one click away: try to make it pay twice."

**Do:** no clicks, hold the links, end.

**Criterion:** Pitch (callback to the hook; links on screen per the rules).

---

## Rule checklist

- [x] Total ≤ 3:00 (180s)
- [x] Opens on the landing, hook sentence inside 5s
- [x] Every scene carries a criterion tag; time matches weights
- [x] Deployment proof (hosted URL) inside the first third
- [x] Real data only: every number traces to the hosted ledger or the repo
- [x] Links on screen at the close (live URL, repo)
- [x] No explorer tabs: tx/deliverable hashes shown from the room and README
- [x] Fresh-session requirement: commit hash on screen in scene 6
- [x] Cursor overlay on every click moment (desktop-demo drawn cursor)
- [x] No em dashes or double hyphens in any spoken or on-screen line

## TTS notes

- "X 4 0 2" is spelled in the VO, written x402 on screen
- "USDC" is never spoken; amounts are said as cents ("nine tenths of a cent")
- Hashes, job ids and URLs stay on screen only; the voice says "the hash on
  screen", "the job on screen"
- "Purser" is spoken "purser" (as written)

## Recording notes (desktop-demo)

1. `terminal-preflight` before the take: no stale Chrome, no recorders.
2. One Chrome window on the empty desktop space, hosted URL, centered; the
   terminal (scene 6) joins as a second window in the same space.
3. Drawn cursor from the skill's CDP driver; every click gets the ring.
4. VO-first: this script is the narration source; dry take for timing, then
   record VO, then the paced take. Silent beats hold after "spent", after
   "refused", after "it pays".
5. The take runs against the hosted app in sim mode. Nothing on camera spends
   real money; the five real x402 receipts live in the README table, shown in
   scene 2's framing, never a wallet popup.
6. Confirmation gate: you watch the final cut (path + duration) and nothing
   is published until your explicit yes.
