# Purser — Design (control room)

The source of truth for the panel. Every screen defers to this file.

## Feel

Ledger — dense, evidential, calm. A ship's purser keeps records, not moods.

## Audience

Judge-engineers at a memory-infra company, crypto-native, terminal-literate.
They read monospace as truth and evidence as beauty. The page must survive a
screenshare at 1080p in a 3-minute video.

## Visual direction (confirmed 2026-08-26: "Ship's ledger")

Editorial brutalism × terminal command center. Dark ink ground, warm paper
text, brass reserved for money and tx hashes, harsh borders, zero radius.
Ledger language throughout: MANIFEST, LEDGER, WATCH. No nautical kitsch
(no anchors, wheels, waves) — the restraint IS the ship.

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
