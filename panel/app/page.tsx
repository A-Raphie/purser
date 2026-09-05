"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkline } from "./Sparkline";
import { productOf } from "./names";

type Live = {
  payments: number;
  refusals: number;
  spent_micro: number;
  vendors: number;
  last_tx: string;
  series: number[];
  cold: number;
};

type LastDecision = {
  decision: { approve: boolean; rule: string; reason: string };
  request: { vendor: string; sku: string; amount_micro: number };
};

type Receipt = { tx: string; vendor: string; amount_micro: number; basescan: string };

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;

// These two transactions are permanently onchain (see README provenance
// table), so the static shell renders them before the ledger API answers.
const CANONICAL_RECEIPTS: Receipt[] = [
  { tx: "0x9eb6c3b7ebc29a60dbfbde302e71e54bac46088b2773ba31a1f210ba80822564", vendor: "x402.agentfund.net", amount_micro: 2000, basescan: "https://basescan.org/tx/0x9eb6c3b7ebc29a60dbfbde302e71e54bac46088b2773ba31a1f210ba80822564" },
  { tx: "0x9cc4bf9a6d2d26c7f984050c6f87f1b99f8a80d2d2e803126ca447c7768b95d0", vendor: "x402.agentfund.net", amount_micro: 1000, basescan: "https://basescan.org/tx/0x9cc4bf9a6d2d26c7f984050c6f87f1b99f8a80d2d2e803126ca447c7768b95d0" },
];

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
  const [receipts, setReceipts] = useState<Receipt[]>(CANONICAL_RECEIPTS);
  const [checkId, setCheckId] = useState("");
  const [checkResult, setCheckResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [last, setLast] = useState<LastDecision | null>(null);
  const [latestEntryId, setLatestEntryId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function loadLive() {
    try {
      const s = await fetch("/api/state").then((r) => r.json());
      const w = await fetch("/api/wallet").then((r) => r.json());
      const payments = s.tiers.warm.purchases ?? [];
      const rec = w.receipts ?? [];
      const series = (s.tiers.spend_series ?? []).map((x: { cumulative_micro: number }) => x.cumulative_micro);
      setLive({
        payments: payments.length,
        refusals: s.tiers.refusals_total ?? Math.max(0, s.tiers.cold_count - payments.length),
        spent_micro: payments.reduce((a: number, p: { amount_micro?: number }) => a + (p.amount_micro ?? 0), 0),
        vendors: (s.tiers.warm.vendors ?? []).length,
        cold: s.tiers.cold_count ?? 0,
        last_tx: (w.last_tx ?? "").slice(0, 12) || "pending",
        series,
      });
      setReceipts(rec);
      const firstDec = (s.tiers.recent_decisions ?? [])[0];
      if (firstDec) setLast(firstDec as LastDecision);
      const firstId = (s.tiers.recent_decisions ?? [])[0]?.ledger_id;
      setLatestEntryId(firstId ?? null);
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
      setCheckResult({ ok: false, text: "checker unreachable. Try again in a moment." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <span className="brand">purser<span className="mark">.</span></span>
        <span className="topstatus mono">live · ledger · base 8453 · mode sim</span>
        <span className="topnav">
          <a href="#problem">problem</a>
          <a href="#how">how</a>
          <a href="#proof">proof</a>
          <a href="https://github.com/A-Raphie/purser" target="_blank" rel="noreferrer">github ↗</a>
          <a className="roomcta" href="/room">ledger room ›</a>
        </span>
      </header>

      <section className="hero2">
        <div className="hero-grid">
          <div className="hero-copy rise">
            <span className="badge">SIBYL HACKATHON 2026 · MEMORY IS LOAD-BEARING</span>
            <h1 className="valueprop">
              Agents with wallets forget everything.<br />
              <span className="mark">The treasurer shouldn&apos;t.</span>
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
            {err && <div className="inst-body"><span className="dim">ledger offline: retrying</span></div>}
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
                  <Sparkline points={live.series} width={240} height={40} className="inst-spark" />
                  <span className="spark-note">cumulative spend · usdc on base · not a budget bar</span>
                  <span className="chip ok">{live.payments} payment{live.payments === 1 ? "" : "s"} settled</span>
                </div>
                <div className="stat-row">
                  <div className="stat"><span className="k">refused</span><span className="v small num"><Tick value={String(live?.refusals ?? 0)} /></span></div>
                  <div className="stat"><span className="k">vendors</span><span className="v small num"><Tick value={String(live.vendors)} /></span></div>
                  <div className="stat"><span className="k">last tx</span><span className="v small num">{live.last_tx}</span></div>
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
              <pre>{`$ purser --session 2 --request agentfund:oracle-price-eth
REFUSED [dedup]
  already purchased oracle-price-eth
  on 2026-08-26, tx 0xbbb6d430…
  recalled from: purchase entity (WARM)`}</pre>
            </div>
          </div>
          <div className="rise d1">
            <p className="tbl-title">same six requests, two worlds</p>
            <div className="table-scroll">
              <table className="mini">
              <thead><tr><th>metric</th><th className="num">with memory</th><th className="num">amnesia</th></tr></thead>
              <tbody>
                <tr><td>duplicates paid</td><td className="num hero-zero">0</td><td className="num bad">1</td></tr>
                <tr><td>retired vendors paid</td><td className="num hero-zero">0</td><td className="num bad">1</td></tr>
                <tr><td>requests refused</td><td className="num hero-zero">3</td><td className="num bad">1</td></tr>
              </tbody>
            </table>
            </div>
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

      <section className="sec" id="control-room">
        <div className="sec-head"><span className="sec-num num">03</span><span className="sec-label">the control room, live</span><span className="sec-rule" /></div>
        <p className="lede">Every surface on this site reads the same live ledger.</p>
        <p>This is the actual control room, scaled down: the same spent counter, the same decision cards, the same memory tiers the treasurer itself writes to. Nothing here is a screenshot. Purser buys live data for its crew on the x402 agent market: oracle prices, gas, portfolio reads, priced per call in USDC on Base.</p>
        <div className="room-preview">
          <div className="gcard">
            <span className="k">spent on record</span>
            <span className="rp-num num"><Tick value={usd(live?.spent_micro ?? 0)} /></span>
            <span className="chips">
              <span className="chip ok">{live?.payments ?? 0} payment{live?.payments === 1 ? "" : "s"}</span>
              <span className="chip refuse">{live?.refusals ?? 0} refused</span>
            </span>
          </div>
          <div className="gcard">
            <span className="k">latest decision</span>
            {last ? (
              <>
                <span className={`rp-verdict ${last.decision.approve ? "ok" : "bad"}`}>{last.decision.approve ? "PAID" : "REFUSED"}</span>
                <span className="rp-who">{productOf(last.request.vendor, last.request.sku)}</span>
                <span className="rp-amt num">{usd(last.request.amount_micro)}</span>
                <span className="dim">{last.decision.reason || "no duplicate, within caps, vendor acceptable"}</span>
              </>
            ) : (<span className="dim">loading the live ledger…</span>)}
          </div>
          <div className="gcard">
            <span className="k">memory tiers</span>
            <span className="rp-tiers">sibyl · tiered memory</span>
            <span className="dim">vendors and budgets in WARM, every payment in a COLD journal, handoffs in HOT state.</span>
            <span className="chip ok">{live?.vendors ?? 0} vendors known</span>
          </div>
        </div>
        <a className="primary" href="/room">Open the control room</a>
      </section>

      <section className="sec" id="proof">
        <div className="sec-head"><span className="sec-num num">04</span><span className="sec-label">proof, no wallet needed</span><span className="sec-rule" /></div>
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
                       placeholder="ledger entry id" />
                <button onClick={check} disabled={checking || !checkId.trim()}>
                  {checking ? "checking…" : "Verify entry"}
                </button>
              </div>
              {checkResult && (
                <p className={`checkresult ${checkResult.ok ? "ok" : "bad"}`} role="status">{checkResult.text}</p>
              )}
              {!checkId && latestEntryId && (
                <p className="cite">or verify the latest entry: <a className="mono" href={`/proof?id=${latestEntryId}`}>{latestEntryId.slice(0, 18)}…</a></p>
              )}
            </div>
          </div>
          <div className="rise d1">
            <p className="tbl-title">onchain receipts</p>
            {receipts.length === 0 && <p className="dim">no onchain receipts yet (sim runs are labeled, not receipted)</p>}
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
            <p className="cite">refused decisions have no tx: the refusal itself is the receipt.</p>
          </div>
        </div>
      </section>

      <section className="cta-sec">
        <div className="rise">
          <p className="cta-line">Watch a fresh session refuse what it already paid for.</p>
          <a className="primary" href="/room">Open the ledger room</a>
        </div>
      </section>

      <footer className="foot">
        <span className="brand">purser<span className="mark">.</span></span>
        <span className="credit mono">
          solo build · team Raphie leveling · built by{" "}
          <a href="https://x.com/a_raphie" target="_blank" rel="noreferrer">Raphie</a> ·
          <a href="https://github.com/A-Raphie/purser"> github.com/A-Raphie/purser</a> · MIT
        </span>
      </footer>
    </main>
  );
}
