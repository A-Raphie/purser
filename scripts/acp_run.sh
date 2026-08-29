#!/bin/bash
# Canonical ACP earning run: the client hires purser for one spend-check,
# pays $0.01, purser delivers the verdict from Sibyl memory, the client
# accepts. Run AFTER funding the client wallet (>= $0.01 USDC on Base).
#
#   bash scripts/acp_run.sh            # run from the repo root
#
# Requires: .venv (verdict), .venv-acp not needed here; the acp CLI
# (npm i -g @virtuals-protocol/acp-cli) configured via `acp configure`.
set -euo pipefail
cd "$(dirname "$0")/.."

CLI=${ACP_CLI:-$HOME/.local/bin/acp}
SELLER=${SELLER_WALLET:-0xbe39cf6ee113b873c8a3a294816503fe33cd8263}
VENDOR=${VENDOR:-weather.x402.press}
SKU=${SKU:-lagos-weather-current}
AMOUNT=${AMOUNT_MICRO:-3750}
CHAIN=${CHAIN_ID:-8453}

req() { node "$(dirname "$0")/../.venv/bin/python" scripts/acp_verdict.py "$@"; }

echo "== 1. client creates the job =="
node "$CLI" agent use --agent-id 01a0489f-0c36-7b60-994c-a70dfc8e1fc3 >/dev/null
CREATE_OUT=$(node "$CLI" --json client create-job \
  --provider "$SELLER" --offering-name spend_check --chain-id "$CHAIN" \
  --requirements "{\"vendor\":\"$VENDOR\",\"sku\":\"$SKU\",\"amount_micro\":$AMOUNT,\"requested_by\":\"client\"}")
echo "$CREATE_OUT"
JOB_ID=$(echo "$CREATE_OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('jobId') or d.get('id') or d.get('data',{}).get('jobId',''))")
[ -n "$JOB_ID" ] || { echo "could not parse job id"; exit 1; }
echo "job: $JOB_ID"

echo "== 2. purser proposes the budget =="
node "$CLI" agent use --agent-id 01a04760-de0b-7f68-a335-a2a4c8e16103 >/dev/null
node "$CLI" provider set-budget --job-id "$JOB_ID" --amount 0.01 --chain-id "$CHAIN"

echo "== 3. client funds the job =="
node "$CLI" agent use --agent-id 01a0489f-0c36-7b60-994c-a70dfc8e1fc3 >/dev/null
node "$CLI" client fund --job-id "$JOB_ID" --amount 0.01 --chain-id "$CHAIN"

echo "== 4. purser computes the verdict from Sibyl memory and submits =="
node "$CLI" agent use --agent-id 01a04760-de0b-7f68-a335-a2a4c8e16103 >/dev/null
VERDICT=$(.venv/bin/python scripts/acp_verdict.py --db runtime/panel_memory.db \
  --vendor "$VENDOR" --sku "$SKU" --amount-micro "$AMOUNT" --job-id "$JOB_ID")
echo "verdict: $VERDICT"
node "$CLI" provider submit --job-id "$JOB_ID" --deliverable "$VERDICT" --chain-id "$CHAIN"

echo "== 5. client accepts the deliverable =="
node "$CLI" agent use --agent-id 01a0489f-0c36-7b60-994c-a70dfc8e1fc3 >/dev/null
node "$CLI" client complete --job-id "$JOB_ID" --reason "verdict verified" --chain-id "$CHAIN"

echo "== 6. job history =="
node "$CLI" agent use --agent-id 01a04760-de0b-7f68-a335-a2a4c8e16103 >/dev/null
node "$CLI" --json job history --job-id "$JOB_ID" 2>&1 | head -60
echo "DONE: job $JOB_ID"
