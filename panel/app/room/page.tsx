"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Decision = {
  ledger_id: string | null;
  pending?: boolean;
  decision: { approve: boolean; rule: string; reason: string; recalled: string[] };
  payment: { status: string; tx: string; detail: string };
  request: { vendor: string; sku: string; amount_micro: number };
  pay_mode: string;
};

type State = {
  tiers: {
    warm: { vendors: { name: string; trust?: number; status?: string; purchases?: number }[]; purchases: { vendor?: string; amount_micro?: number; date?: string }[] };
    cold_count: number;
    hot: Record<string, unknown>;
  };
};

type Wallet = {
  wallet: string;
  usdc: number | null;
  receipts: { tx: string; vendor: string; amount_micro: number; basescan: string }[];
};

type Toast = { id: number; kind: "ok" | "bad"; text: string };
type Tab = "vendors" | "journal" | "hot";

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;
const MICRO = 1e6;

export default function Room() {
  const [vendor, setVendor] = useState("weather.x402.press");
  const [sku, setSku] = useState("lagos-weather-current");
  const [amount, setAmount] = useState("0.00375");
  const [mode, setMode] = useState("simulate");
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [tab, setTab] = useState<Tab>("vendors");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const [feed, setFeed] = useState<Decision[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wipeArmed, setWipeArmed] = useState(false);

  function toast(kind: Toast["kind"], text: string) {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }

  const refresh = useCallback(async () => {
    try {
      const s = await fetch("/api/state").then((r) => r.json());
      setState(s);
      setLoadErr(false);
      const w = await fetch("/api/wallet").then((r) => r.json());
      setWallet(w);
    } catch {
      setLoadErr(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function runRequest() {
    const micro = Math.round(parseFloat(amount || "0") * MICRO);
    if (!vendor || !sku || !Number.isFinite(micro) || micro <= 0) {
      toast("bad", "amount must be a positive number");
      return;
    }
    setBusy(true);
    // optimistic pending card: the spinner morphs to a check on settlement
    setFeed((f) => [{
      pending: true,
      ledger_id: null,
      decision: { approve: true, rule: "checking", reason: "recalling memory…", recalled: [] },
      payment: { status: "pending", tx: "", detail: "" },
      request: { vendor, sku, amount_micro: micro },
      pay_mode: mode,
    }, ...f]);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor, sku, description: `panel request ${sku}`,
          amount_micro: micro, pay_mode: mode,
        }),
      }).then((r) => r.json());
      // only one request can be in flight (busy gate): replace the pending card
      setFeed((f) => f.map((d) => (d.pending ? res : d)));
      if (res.decision.approve) {
        toast("ok", `paid ${res.request.vendor} ${usd(res.request.amount_micro)}`);
      } else {
        toast("bad", `refused [${res.decision.rule}]: ${res.decision.reason.slice(0, 70)}`);
      }
      refresh();
    } catch {
      setFeed((f) => f.filter((d) => !d.pending));
      toast("bad", "request failed. Is the sidecar running?");
    } finally {
      setBusy(false);
    }
  }

  async function wipe() {
    if (!wipeArmed) {
      setWipeArmed(true);
      setTimeout(() => setWipeArmed(false), 4000);
      return;
    }
    await fetch("/api/wipe?confirm=true", { method: "POST" });
    setWipeArmed(false);
    toast("ok", "ledger wiped. The amnesia twin will now pay again.");
    refresh();
  }

  const vendors = state?.tiers.warm.vendors ?? [];
  const purchases = state?.tiers.warm.purchases ?? [];
  const receipts = wallet?.receipts ?? [];
  const refusals = feed.filter((d) => !d.pending && !d.decision.approve).length;
  const heroSpent = purchases.reduce((a, p) => a + (p.amount_micro ?? 0), 0);
  const lastTx = receipts[0]?.tx?.slice(0, 10) ?? "none yet";

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "vendors", label: "vendors", count: vendors.length },
    { id: "journal", label: "journal", count: state?.tiers.cold_count ?? 0 },
    { id: "hot", label: "hot", count: Object.keys(state?.tiers.hot ?? {}).length },
  ];
  const activeIdx = tabs.findIndex((t) => t.id === tab);

  return (
    <main>
      <header className="masthead">
        <div>
          <h1>purser<span>.</span></h1>
          <div className="sub">a treasurer that never forgets a payment</div>
        </div>
        <div className="mast-facts">
          <div className="fact">
            <span className="k">wallet</span>
            <span className="v">{wallet?.wallet ? `${wallet.wallet.slice(0, 8)}…${wallet.wallet.slice(-6)}` : "not set"}</span>
          </div>
          <div className="fact">
            <span className="k">usdc on base</span>
            <span className="v brass num">{wallet?.usdc != null ? wallet.usdc.toFixed(6) : "…"}</span>
          </div>
          <div className="fact">
            <span className="k">memory</span>
            <span className="v">sibyl · 5 tiers</span>
          </div>
          <a className="ghostlink" href="/">landing</a>
        </div>
      </header>

      <div className="status-strip" role="status">
        <span className="dot" aria-hidden="true" /> LIVE · LEDGER · SIBYL MEMORY · BASE 8453 · LAST TX <span className="num">{lastTx}…</span>
      </div>

      <section className="hero-metric" aria-label="ledger totals">
        <div className="hm">
          <span className="k">spent on record</span>
          <span className="v num">{usd(heroSpent)}</span>
          <span className="chip ok">{purchases.length} payments</span>
        </div>
        <div className="hm">
          <span className="k">duplicates paid</span>
          <span className="v num">0</span>
          <span className="chip ok">memory active</span>
        </div>
        <div className="hm">
          <span className="k">refusals this viewing</span>
          <span className="v num">{String(refusals)}</span>
          <span className="chip">{feed.length} decisions</span>
        </div>
      </section>

      <div className="deck">
        <section className="zone">
          <h2>Request</h2>
          <label htmlFor="vendor">vendor</label>
          <input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <label htmlFor="sku">sku</label>
          <input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
          <label htmlFor="amount">amount (usdc)</label>
          <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <label htmlFor="mode">pay mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="simulate">simulate (free)</option>
            <option value="real">real x402 on base</option>
          </select>
          <button onClick={runRequest} disabled={busy}>
            {busy ? "running…" : "Run request"}
          </button>
          <p className="note">
            Run the same request twice. The second one must be refused by the
            ledger. Wipe the ledger and the amnesia twin pays again.
          </p>
          <button className="danger" onClick={wipe}>
            {wipeArmed ? "Confirm: wipe the ledger" : "Wipe ledger (demo amnesia)"}
          </button>
        </section>

        <section className="zone">
          <h2>Decisions</h2>
          {feed.length === 0 && (
            <p className="empty">No decisions yet this viewing. Run a request.</p>
          )}
          {feed.map((d, i) => (
            <article key={i} className={`card ${d.pending ? "pending" : d.decision.approve ? "approve" : "refuse"}`}>
              <div className="head">
                <span className="verdict">
                  {d.pending
                    ? (<><span className="spinner" aria-label="paying" /> PAYING…</>)
                    : d.decision.approve
                      ? (<><span className="check" aria-hidden="true" /> PAID · {d.payment.status.toUpperCase()}</>)
                      : "REFUSED"}
                </span>
                {!d.pending && <span className="rule">{d.decision.rule}</span>}
              </div>
              <div className="body">
                <div className="reason">
                  {d.request.vendor}:{d.request.sku} · <span className="num">{usd(d.request.amount_micro)}</span>
                  {d.pending ? " — recalling memory…" : ` — ${d.decision.reason}`}
                </div>
                {!d.pending && !d.decision.approve && d.decision.recalled.length > 0 && (
                  <div className="ctx">
                    <div className="ctx-head">recalled from memory</div>
                    {d.decision.recalled.map((r, j) => (
                      <div className="ctx-chunk" key={j}>
                        <span className={`ctx-src ${/journal|event/i.test(r) ? "src-cold" : "src-warm"}`}>
                          {/journal|event/i.test(r) ? "COLD · journal" : "WARM · entity"}
                        </span>
                        <span className="ctx-body mono">{r}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!d.pending && (
                  <div className="meta">
                    <span className="tchip">x402</span>
                    <span className="tchip">{d.decision.approve ? "memory·ok" : `memory·${d.decision.rule}`}</span>
                    {d.pay_mode === "simulate" && <span className="sim-chip">simulated</span>}
                    {d.ledger_id && (
                      <a className="tx num" href={`/proof?id=${d.ledger_id}`}>
                        {d.decision.approve ? `tx ${d.payment.tx.slice(0, 20)}…` : "public proof"} ›
                      </a>
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="zone">
          <h2>Memory tiers</h2>
          {loadErr && (
            <div className="rowline">
              <span className="n">ledger unreachable</span>
              <button className="linklike" onClick={refresh}>Retry</button>
            </div>
          )}
          {!loadErr && !state && <div className="skeleton tall" aria-label="loading tiers" />}
          {state && (
            <>
              <div className="tabs" role="tablist" aria-label="memory tiers">
                <span className="tab-pill" style={{ transform: `translateX(${activeIdx * 100}%)` }} aria-hidden="true" />
                {tabs.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tab === t.id}
                          className={`tab ${tab === t.id ? "on" : ""}`} onClick={() => setTab(t.id)}>
                    {t.label} <span className="num">{String(t.count)}</span>
                  </button>
                ))}
              </div>

              {tab === "vendors" && (
                <div className="tier">
                  {vendors.length === 0 && <p className="empty">empty ledger. Run a request.</p>}
                  {vendors.map((v) => (
                    <div key={v.name} className="rowline">
                      <span className={`n ${v.status === "retired" ? "retired" : ""}`}>
                        <span className={`dot sm ${v.status === "retired" ? "dead" : ""}`} aria-hidden="true" /> {v.name}
                      </span>
                      <span className="d">
                        {v.status === "retired" ? "retired" : `trust ${v.trust ?? "—"} · ${v.purchases ?? 0} buys`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "journal" && (
                <div className="tier">
                  <div className="rowline"><span className="n">append-only events</span><span className="d num">{String(purchases.length)} payments</span></div>
                  {purchases.slice(0, 8).map((p, j) => (
                    <div key={j} className="rowline">
                      <span className="n">{p.vendor ?? "?"}</span>
                      <span className="d num">{p.date ?? ""} · {usd(p.amount_micro ?? 0)}</span>
                    </div>
                  ))}
                </div>
              )}

              {tab === "hot" && (
                <div className="tier">
                  {state.tiers.hot?.session ? (
                    <div className="rowline">
                      <span className="n">session {String((state.tiers.hot.session as { n?: number }).n ?? "?")}</span>
                      <span className="d">active</span>
                    </div>
                  ) : (
                    <p className="empty">no session state yet. Run a request.</p>
                  )}
                  {state.tiers.hot?.handoff_to_auditor && (
                    <div className="rowline">
                      <span className="n">handoff → auditor</span>
                      <span className="d">queued</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <footer className="receipts">
        <h2>Receipts</h2>
        {receipts.length === 0 && <span className="empty">no onchain receipts yet (sim runs are labeled, not receipted)</span>}
        {receipts.map((r) => (
          <span key={r.tx} className="receipt">
            <a href={r.basescan} target="_blank" rel="noreferrer">{r.tx.slice(0, 14)}…</a>{" "}
            <span className="who">{r.vendor} <span className="num">{usd(r.amount_micro)}</span></span>
          </span>
        ))}
      </footer>

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className={`dot sm ${t.kind === "bad" ? "dead" : ""}`} aria-hidden="true" />
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
