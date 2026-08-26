"use client";

import { useEffect, useRef, useState } from "react";

type Live = {
  payments: number;
  refusals: number;
  spent_micro: number;
  vendors: number;
  last_tx: string;
};

type Receipt = { tx: string; vendor: string; amount_micro: number; basescan: string };

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;

function Tick({ value }: { value: string }) {
  // numbers flash brass when they change: the ledger is alive
  const prev = useRef(value);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setHot(true);
      const t = setTimeout(() => setHot(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);
  return <span className={`num tick ${hot ? "hot" : ""}`}>{value}</span>;
}

export default function Landing() {
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  async function loadLive() {
    try {
      const s = await fetch("/api/state").then((r) => r.json());
      const w = await fetch("/api/wallet").then((r) => r.json());
      const payments = s.tiers.warm.purchases ?? [];
      const rec = w.receipts ?? [];
      setLive({
        payments: payments.length,
        refusals: Math.max(0, s.tiers.cold_count - payments.length),
        spent_micro: payments.reduce((a: number, p: { amount_micro?: number }) => a + (p.amount_micro ?? 0), 0),
        vendors: (s.tiers.warm.vendors ?? []).length,
        last_tx: rec[0]?.tx?.slice(0, 12) ?? "pending",
      });
      setReceipts(rec);
      setErr(false);
    } catch {
      setErr(true);
    }
  }

  useEffect(() => { loadLive(); const t = setInterval(loadLive, 4000); return () => clearInterval(t); }, []);

  async function check() {
    const id = checkId.trim();
    if (!id) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const p = await fetch(`/api/proof/${encodeURIComponent(id)}`).then((r) => r.json());
      setCheckResult(p.error
        ? { ok: false, text: `not found: ${p.error}` }
        : { ok: true, text: `${p.kind === "refusal" ? "REFUSED" : "PAID"} · ${p.vendor} · ${usd(p.amount_micro ?? 0)} · rule ${p.rule}${p.basescan ? " · onchain receipt linked" : ""}` });
    } catch {
      setCheckResult({ ok: false, text: "checker unreachable. Is the sidecar running? (python -m purser.api)" });
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <span className="brand">PURSER<span className="brass">.</span></span>
        <span className="topnav">
          <a href="#problem">problem</a>
          <a href="#how">how</a>
          <a href="#proof">proof</a>
          <a className="roomcta" href="/room">open the ledger room ›</a>
        </span>
      </header>

      <section className="hero2">
        <div className="hero-grid">
          <div className="hero-copy rise">
            <span className="badge">SIBYL HACKATHON 2026 · MEMORY IS LOAD-BEARING</span>
            <h1 className="valueprop">
              Agents with wallets forget everything.<br />
              <span className="brass">The treasurer shouldn&apos;t.</span>
            </h1>
            <p className="herosub">
              Purser keeps every vendor, budget rule, and purchase in persistent
              memory. A fresh session never double-pays, never re-trusts a
              vendor that burned it. Delete the memory and the product breaks:
              that is the design.
            </p>
            <div className="ctas">
              <a className="primary" href="/room">Open the ledger room</a>
              <a className="ghost" href="#proof">Verify a decision yourself</a>
            </div>
          </div>

          <aside className="instrument rise d1" aria-label="live ledger readout">
            <div className="inst-head">
              <span className="dot" aria-hidden="true" />
              <span>THE LEDGER, LIVE</span>
              <span className="dim">sibyl memory · base 8453</span>
            </div>
            {err && <div className="inst-body"><span className="dim">ledger offline (sidecar not running)</span></div>}
            {!err && !live && (
              <div className="inst-body">
                <div className="skel-row" /><div className="skel-row short" /><div className="skel-row" />
              </div>
            )}
            {!err && live && (
              <div className="inst-body">
                <div className="stat big">
                  <span className="k">spent on record</span>
                  <span className="v"><Tick value={usd(live.spent_micro)} /></span>
                  <span className="chip ok">{live.payments} payments settled</span>
                </div>
                <div className="stat-row">
                  <div className="stat"><span className="k">duplicates paid</span><span className="v"><Tick value="0" /></span></div>
                  <div className="stat"><span className="k">vendors known</span><span className="v"><Tick value={String(live.vendors)} /></span></div>
                  <div className="stat"><span className="k">last tx</span><span className="v small"><Tick value={`${live.last_tx}…`} /></span></div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="sec" id="problem">
        <div className="sec-head"><span className="sec-num num">01</span><span className="sec-label">the problem</span><span className="sec-rule" /></div>
        <div className="split">
          <div className="rise">
            <p className="lede">The operator becomes the memory.</p>
            <p>
              Re-reading logs. Re-stating budgets. Watching for double-spends.
              Every agent-with-a-wallet ships with amnesia, so a human holds
              the ledger in their head. Purser moves that ledger into tiers:
              vendors and budgets in WARM, every payment in a COLD journal,
              handoffs in HOT state, retirements in ARCHIVE with the reason.
            </p>
            <div className="term" aria-label="a fresh session refusing a duplicate">
              <div className="term-bar"><span />SESSION 2 · FRESH PROCESS</div>
              <pre>{`$ purser --session 2 --request weather:lagos-current
REFUSED [dedup]
  already purchased lagos-weather-current
  on 2026-08-26, tx 0xbbb6d430…
  recalled from: purchase entity (WARM)`}</pre>
            </div>
          </div>
          <div className="rise d1">
            <p className="tbl-title">same six requests, two worlds</p>
            <table className="mini">
              <thead><tr><th>metric</th><th className="num">with memory</th><th className="num">amnesia</th></tr></thead>
              <tbody>
                <tr><td>duplicates paid</td><td className="num hero-zero">0</td><td className="num bad">1</td></tr>
                <tr><td>blacklisted vendors paid</td><td className="num hero-zero">0</td><td className="num bad">1</td></tr>
                <tr><td>requests refused</td><td className="num">3</td><td className="num">1</td></tr>
              </tbody>
            </table>
            <p className="cite">live output of <span className="mono">eval/run_eval.py</span> · raw JSON committed in <span className="mono">eval/results/</span></p>
          </div>
        </div>
      </section>

      <section className="sec" id="how">
        <div className="sec-head"><span className="sec-num num">02</span><span className="sec-label">how it works</span><span className="sec-rule" /></div>
        <div className="steps rise">
          <div className="step"><span className="n num">1</span><span className="t">scout writes the need</span><span className="d">a handoff lands in HOT state</span></div>
          <div className="step"><span className="n num">2</span><span className="t">purser recalls</span><span className="d">dedup · caps · trust · blacklist, all from memory</span></div>
          <div className="step"><span className="n num">3</span><span className="t">x402 pays on Base</span><span className="d">gasless USDC, real receipts</span></div>
          <div className="step"><span className="n num">4</span><span className="t">journal + learn</span><span className="d">every decision appended with its evidence</span></div>
        </div>
        <p className="cite">
          Deterministic engine, no LLM on the money path. <span className="mono">src/purser/memory.py</span> is the
          only module that touches Sibyl Memory.
        </p>
      </section>

      <section className="sec" id="proof">
        <div className="sec-head"><span className="sec-num num">03</span><span className="sec-label">proof, no wallet needed</span><span className="sec-rule" /></div>
        <div className="split">
          <div className="rise">
            <p className="lede">Check any decision yourself.</p>
            <p>Every payment and every refusal lands in the append-only journal
              with its memory reason. Paste an entry id:</p>
            <div className="checker">
              <div className="checkrow">
                <label className="sr-only" htmlFor="pid">ledger entry id</label>
                <input id="pid" value={checkId} onChange={(e) => setCheckId(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") check(); }}
                       placeholder="ledger entry id, e.g. 2db1f7df-07a7-…" />
                <button onClick={check} disabled={checking || !checkId.trim()}>
                  {checking ? "checking…" : "Verify entry"}
                </button>
              </div>
              {checkResult && (
                <p className={`checkresult ${checkResult.ok ? "ok" : "bad"}`} role="status">{checkResult.text}</p>
              )}
            </div>
          </div>
          <div className="rise d1">
            <p className="tbl-title">onchain receipts</p>
            {receipts.length === 0 && <p className="dim">no onchain receipts visible (sidecar offline?)</p>}
            <div className="recrows">
              {receipts.slice(0, 4).map((r) => (
                <a className="recrow" key={r.tx} href={r.basescan} target="_blank" rel="noreferrer">
                  <span className="mono tx num">{r.tx.slice(0, 16)}…</span>
                  <span className="who">{r.vendor}</span>
                  <span className="amt num">{usd(r.amount_micro)}</span>
                  <span className="go">basescan ↗</span>
                </a>
              ))}
            </div>
            <p className="cite">refused decisions have no tx: that row in the README table is the guardrail firing.</p>
          </div>
        </div>
      </section>

      <section className="cta-sec">
        <div className="rise">
          <p className="cta-line">Watch a fresh session refuse what it already paid for.</p>
          <a className="primary big" href="/room">Open the ledger room</a>
        </div>
      </section>

      <footer className="foot">
        <span className="brand">PURSER<span className="brass">.</span></span>
        <span className="credit mono">
          solo build · team Raphie leveling ·
          <a href="https://github.com/A-Raphie/purser"> github.com/A-Raphie/purser</a> · MIT
        </span>
      </footer>
    </main>
  );
}
