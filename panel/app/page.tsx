"use client";

import { useEffect, useState } from "react";

type Live = {
  payments: number;
  refusals: number;
  spent_micro: number;
  vendors: number;
  last_tx: string;
};

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;

export default function Landing() {
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState(false);
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function loadLive() {
    try {
      const s = await fetch("/api/state").then((r) => r.json());
      const w = await fetch("/api/wallet").then((r) => r.json());
      const payments = s.tiers.warm.purchases ?? [];
      const receipts = w.receipts ?? [];
      setLive({
        payments: payments.length,
        refusals: receipts.length >= 0 ? s.tiers.cold_count - payments.length : 0,
        spent_micro: payments.reduce((a: number, p: { amount_micro?: number }) => a + (p.amount_micro ?? 0), 0),
        vendors: (s.tiers.warm.vendors ?? []).length,
        last_tx: receipts[0]?.tx?.slice(0, 12) ?? "pending",
      });
      setErr(false);
    } catch {
      setErr(true);
    }
  }

  useEffect(() => { loadLive(); const t = setInterval(loadLive, 5000); return () => clearInterval(t); }, []);

  async function check() {
    const id = checkId.trim();
    if (!id) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const p = await fetch(`/api/proof/${encodeURIComponent(id)}`).then((r) => r.json());
      setCheckResult(p.error
        ? `not found: ${p.error}`
        : `${p.kind.toUpperCase()} · ${p.vendor} · ${usd(p.amount_micro ?? 0)} · rule ${p.rule}${p.basescan ? " · onchain tx verified" : ""}`);
    } catch {
      setCheckResult("checker unreachable. Is the sidecar running? (python -m purser.api)");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <header className="masthead slim">
        <div>
          <h1>PURSER<span>.</span></h1>
          <div className="sub">a treasurer agent whose judgment lives in memory</div>
        </div>
        <a className="runlink" href="/room">open the ledger room ›</a>
      </header>

      <section className="hero">
        <span className="badge">SIBYL HACKATHON 2026 · MEMORY IS LOAD-BEARING</span>
        <p className="valueprop">
          Agents with wallets start every session with amnesia: they re-buy what
          they own, ignore budgets, re-trust vendors that burned them.
          Purser keeps the ledger, so it never double-pays.
        </p>
        <div className="ctas">
          <a className="primary" href="/room">Open the ledger room</a>
          <a className="ghost" href="#proof">Read the proof</a>
        </div>
        <div className="readout" role="status" aria-label="live ledger readout">
          {err && <span className="ro-k">ledger</span>}
          {err && <span className="ro-v">offline (sidecar not running)</span>}
          {!err && !live && <span className="ro-k">reading ledger…</span>}
          {!err && live && (
            <>
              <span className="ro-k">payments</span><span className="ro-v num">{String(live.payments)}</span>
              <span className="ro-k">spent</span><span className="ro-v num brass">{usd(live.spent_micro)}</span>
              <span className="ro-k">vendors known</span><span className="ro-v num">{String(live.vendors)}</span>
              <span className="ro-k">last tx</span><span className="ro-v num">{live.last_tx}…</span>
            </>
          )}
        </div>
      </section>

      <section className="sec">
        <div className="sec-head"><span className="sec-num num">01</span> <span className="sec-label">the problem</span></div>
        <div className="cols">
          <p>
            Delete Purser&apos;s memory and watch it fail: it re-buys the same
            data, trusts the vendor it blacklisted, blows past the day&apos;s
            cap. The operator becomes the memory. That is the bug Purser exists
            to fix, and the test it must fail.
          </p>
          <table className="mini">
            <thead><tr><th>same 6 requests</th><th className="num">with memory</th><th className="num">amnesia</th></tr></thead>
            <tbody>
              <tr><td>duplicates paid</td><td className="num">0</td><td className="num bad">1</td></tr>
              <tr><td>blacklisted vendors paid</td><td className="num">0</td><td className="num bad">1</td></tr>
              <tr><td>requests refused</td><td className="num">3</td><td className="num">1</td></tr>
            </tbody>
          </table>
          <p className="cite">live numbers from <span className="mono">eval/run_eval.py</span>, raw JSON in the repo.</p>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head"><span className="sec-num num">02</span> <span className="sec-label">how it works</span></div>
        <pre className="diagram" aria-label="architecture diagram">{`
  scout ──writes──▶  SIBYL MEMORY (SQLite+FTS5, local)
                      HOT   handoff state      WARM  vendors·budgets
                      COLD  purchase journal   ARCHIVE  retired + reason
                                      │
  purser ──pays───▶  x402 on Base (USDC, gasless EIP-3009)
  auditor ─reads──▶  every decision journaled with its recalled evidence`}</pre>
        <p className="cite">
          Deterministic engine, no LLM on the money path. Memory decides:
          dedup, caps, trust, blacklist. <span className="mono">src/purser/memory.py</span> is the only module that touches Sibyl.
        </p>
      </section>

      <section className="sec" id="proof">
        <div className="sec-head"><span className="sec-num num">03</span> <span className="sec-label">proof, no wallet needed</span></div>
        <p>
          Every decision lands in an append-only journal. Paste a ledger entry
          id and verify it yourself, right here.
        </p>
        <div className="checker">
          <label htmlFor="pid">ledger entry id</label>
          <div className="checkrow">
            <input id="pid" value={checkId} onChange={(e) => setCheckId(e.target.value)}
                   placeholder="e.g. 736eeda2-412c-438e-9b8e-0e5ef5e98f12" />
            <button onClick={check} disabled={checking || !checkId.trim()}>
              {checking ? "checking…" : "Verify entry"}
            </button>
          </div>
          {checkResult && <p className="checkresult mono" role="status">{checkResult}</p>}
        </div>
        <p className="cite">
          Onchain receipts so far: <a href="https://basescan.org/tx/0xbbb6d430a7acbd7d8d98d622c6aee050468233bb1405f6e4dce8e7433d605052" target="_blank" rel="noreferrer">0xbbb6d430…</a> · real USDC on Base.
          The canonical run table (paid and refused rows together) is in the README.
        </p>
      </section>

      <footer className="foot">
        <span className="brand">PURSER</span>
        <span className="credit mono">solo build · team Raphie leveling · MIT</span>
      </footer>
    </main>
  );
}
