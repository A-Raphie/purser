# Purser — Memory

Running log of decisions, conventions, and gotchas. Newest at the top.
Supersedes the earlier `decision-log.md` (entries folded in below).

## Decisions

- **2026-08-26** — D4 RESOLVED: pure Python stack. Python `x402` SDK v2.20.0
  (first-party, Base-complete, httpx) + `virtuals-acp` SDK; TS dropped.
- **2026-08-26** — ACP cost reality: agent creation free (Launch Radar 100
  VIRTUAL ≈ $75 is OPTIONAL); sandbox has sponsored gas + test USDC → demo-
  able at $0; mainnet ACP via `BASE_MAINNET_ACP_X402_CONFIG_V2` cheap.
  Virtuals budget risk downgraded from "real money at risk" to "≈$0–5".
- **2026-08-26** — x402 treasurer crew on Sibyl + Base + Virtuals ×1.25:
  sponsor-house-pattern + be-early x402 window + schlep-moat + judge-checkable
  PMF artifact. (Rejected: YouTube Channel Brain — workflow smell; research
  crew — the crowded archetype.)
- **2026-08-26** — Name **Purser** (ship's money officer; crew metaphor maps
  to the coordination pattern). (Rejected: Bursar, Quaestor, Tamias, Tally.)
- **2026-08-26** — Coordination via memory tiers ONLY; deterministic decision
  engine, LLM never decides spends; fresh process per session.
- **2026-08-26** — Budget: gas cents + x402 ≤$5 pre-approved; Virtuals
  registration quoted first; hard cap ~$25 without approval.
- **2026-08-26** — Architecture D4 RESOLVED: Python-first payment rail (see above).
- **2026-08-26** — ⚠ `gh` CLI authed as **Ernxto** but registrations say
  **github.com/A-Raphie** — resolve before the public repo exists.

## Conventions

- Tier discipline per Sibyl's `sibyl-save` pattern: no raw memory-file writes,
  WARM = upsert single source of truth, every archive carries `reason`,
  COLD append-only, config stored in memory itself, dry-run mutates nothing.
- Test files use dated adversarial names (Sibyl house convention).
- Claims in README only once runnable; failures published (both-numbers rule).

## Gotchas

- x402 default facilitator `x402.org/facilitator` is **testnet-only** — Base
  mainnet needs Mogami (`facilitator.mogami.tech`, free) or CDP.
- Base mainnet chain id **8453** vs Sepolia **84532** mix-up = #1 x402 failure.
- PyPI `acp-sdk` is IBM's — the Virtuals package is **`virtuals-acp`**.
- `get_state`/`get_reference` wrap payloads in `{"body": ...}`.
- `get_entity` on missing key raises `NotFoundError` (does not return None).
- `pip install 'sibyl-memory-cli[mcp]'` — the extra doesn't exist in 0.3.7;
  install `sibyl-memory-mcp` separately.
- Free-tier soft cap is **5MB** (not 2MB as docs research claimed); empty DB
  ≈ 274KB → ~4.7MB usable.

## Things to not forget

- `sibyl init` browser bind pending (session c7893286…, code 697 982, 30-min
  window from 09:46 local Aug 26 — re-run if expired).
- Private build-page token lives ONLY in `~/Documents/Youtube/hackathon-registrations.md`.
- Partner workshops Sep 5–7 (Discord) — attend for ACP specifics.
- RYO-CHAN deadline ~Sep 8: timebox to evenings; Purser has priority.
