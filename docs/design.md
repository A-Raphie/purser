# Purser — Design (control room)

The source of truth for the panel. Every screen defers to this file.

## Feel

Ledger — dense, evidential, calm. A ship's purser keeps records, not moods.

## Audience

Judge-engineers at a memory-infra company, crypto-native, terminal-literate.
They read monospace as truth and evidence as beauty. The page must survive a
screenshare at 1080p in a 3-minute video.

## Visual direction (pivot confirmed 2026-08-26: "winsznx house style")

The ship's-ledger dossier look was replaced at the builder's call after two
review passes. New system (his nine-placement recipe):

- Canvas near-black slate `#0a0b0f`, surfaces `#14161f`/`#1b1e2a`
- **Two accents**: Sibyl amber `#e0a63c` for actions/links/brand (sponsor-brand
  rule applied Aug 27: sibyllabs.org and hack.sibyllabs.org both brand
  amber/gold on dark and cream; indigo `#7c6cff` was the pre-swap generic),
  neon green `#34d399`
  for live/settled/positive states (status dots glow); bad = rose `#fb7185`
- Geist Sans for everything prose (weight up to 800, tracking -0.02em on
  numbers/headlines), IBM Plex Mono for data/labels/status
- 14px radius cards, 10px controls, 999px pills; soft shadow
  `0 10px 30px -12px rgba(0,0,0,.6)`; hover = border → accent + faint glow
- Tabular numerals everywhere; live numbers flash green on change
- Anatomy: landing → room → public proof; status strip with live dot;
  code/terminal as hero elements; no dead links

## Legacy tokens (superseded, kept for reference)

ink/paper/brass palette and zero-radius rules were the ship's-ledger system;
`.brass` class names now map to the live-green token.

## Design tokens

```css
--ink:        #0B0E11;  /* page ground */
--surface:    #12161B;  /* panels */
--surface-2:  #1A2027;  /* nested rows */
--paper:      #E6E1D6;  /* primary text */
--paper-dim:  #8D8878;  /* secondary text */
--brass:      #C9A227;  /* money, tx hashes, masthead rule */
--settle:     #5B9A6E;  /* settled / approve */
--refuse:     #C05B44;  /* refused / danger */
--border:     1px solid rgba(230,225,214,0.22);
--border-strong: 2px solid var(--paper);
--radius:     0;
--font-display: 'Fraunces', Georgia, serif;      /* masthead only */
--font-data:    'JetBrains Mono', ui-monospace, monospace;
--font-scale:   12px base, 20px section heads, 40px masthead;
```

## Copy tone

Ledger voice: short, declarative, dated. "Paid weather.x402.press $0.003750.
Refusing duplicate: bought 2026-08-26, tx sim-…". Sentence case, straight
quotes, no em dashes, no buzzwords, no exclamation. Buttons are verbs:
"Run request", "Wipe ledger". Simulated state is always labeled: "SIMULATED"
chip, brass outline.

## User flow (single screen, build order)

1. Control room (the only screen) — zones in reading order:
   masthead (name, wallet, USDC balance, sim/real state) → request box →
   decision feed (newest first, refusal evidence expands inline) →
   tier inspector (WARM/COLD/HOT/ARCHIVE tabs, counts, drill-down rows) →
   receipts strip (tx + Basescan links) → wipe control (danger, confirm-gated)

## Avoid-list

Gradients (any), rounded corners (any), glow/shadow decoration, mascots,
illustrations, pastels, fade-in-up, emoji icons, centered hero with stacked
CTAs, three-column feature grids, purple/indigo anything.

## Ship gate (added Aug 27, after the atmosphere drift)

Any visual change ships with a three-page screenshot comparison (/, /room,
/proof at the same viewport) — pages are verified *together*, never alone.
The comparison is part of the commit message evidence. Known-accepted
difference: the proof page's slimmer surface header (focused page, not an
app surface).

## Audit battery (standing rule, Aug 27)

Before every UI commit, run — against the RENDERED build, not the code alone:
(1) ui-craft pre-ship checklist incl. cross-screen consistency; (2) winsznx-ui
avoid-list + anatomy conformance (sidebar OR topbar, never both); (3)
duplicate-action sweep (any action/text rendered twice on a page);
(4) system conformance (type scale, radius, one label/empty/brand rule);
(5) dead-class + link sweep; (6) three-page screenshot gate. A change is not
done until the battery passes clean. Checklists are gates, not reading.
