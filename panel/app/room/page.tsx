"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkline } from "../Sparkline";

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
    spend_series?: { date: string; cumulative_micro: number }[];
    spent_today_micro?: number;
    daily_cap_micro?: number;
    refusals_total?: number;
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
  const heroSpent = purchases.reduce((a, p) => a + (p.amount_micro ?? 0), 0);
  const lastTx = receipts[0]?.tx?.slice(0, 10) ?? "none yet";
  const series = (state?.tiers.spend_series ?? []).map((s) => s.cumulative_micro);
  const spentToday = state?.tiers.spent_today_micro ?? 0;
  const dailyCap = state?.tiers.daily_cap_micro ?? 250_000;
  const budgetPct = Math.min(100, (spentToday / Math.max(1, dailyCap)) * 100);
  const hot = (state?.tiers.hot ?? {}) as Record<string, { shift?: number; clean?: boolean; checked?: number } | undefined>;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "vendors", label: "vendors", count: vendors.length },
    { id: "journal", label: "journal", count: state?.tiers.cold_count ?? 0 },
    { id: "hot", label: "hot", count: Object.keys(hot).length },
  ];
  const activeIdx = tabs.findIndex((t) => t.id === tab);

  return (
    <main>
      <header className="topbar">
        <span className="brand">purser<span className="brass">.</span></span>
        <span className="topnav">
          <a href="/">landing</a>
          <a href="/proof">proof</a>
          <span className="sb-status"><span className="dot" aria-hidden="true" /> live</span>
        </span>
      </header>

      <div className="appshell">
        <aside className="sidebar">
          <div>
            <div className="sb-brand">purser<span>.</span></div>
            <div className="sb-status" style={{ marginTop: 6 }}>
              <span className="dot" aria-hidden="true" /> live · base 8453
            </div>
          </div>
          <div className="sb-facts">
            <div className="sb-fact">
              <span className="k">wallet</span>
              <span className="v">{wallet?.wallet ? `${wallet.wallet.slice(0, 8)}…${wallet.wallet.slice(-6)}` : "not set"}</span>
            </div>
            <div className="sb-fact">
              <span className="k">usdc on base</span>
              <span className="v green num">{wallet?.usdc != null ? wallet.usdc.toFixed(6) : "…"}</span>
            </div>
            <div className="sb-fact">
              <span className="k">memory</span>
              <span className="v">sibyl · 5 tiers</span>
            </div>
          </div>
          <nav className="sb-nav" aria-label="sections">
            <a href="#overview" className="on">overview</a>
            <a href="#ledger">ledger</a>
            <a href="#memory">memory</a>
            <a href="/proof">proof checker</a>
          </nav>
          <div className="sb-bottom">
            <button className="danger" onClick={wipe}>
              {wipeArmed ? "Confirm: wipe" : "Wipe ledger"}
            </button>
            <span className="sb-status">coordination via sibyl memory</span>
          </div>
        </aside>

        <div className="main">
          <div className="status-strip" role="status">
            <span className="dot" aria-hidden="true" /> LIVE · LEDGER · SIBYL MEMORY · BASE 8453 · LAST TX <span className="num">{lastTx}…</span>
          </div>

          <section className="cmdbar" aria-label="request">
            <div className="cmd-field">
              <label htmlFor="vendor">vendor</label>
              <input id="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="cmd-field">
              <label htmlFor="sku">sku</label>
              <input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div className="cmd-field cmd-amount">
              <label htmlFor="amount">amount (usdc)</label>
              <input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div className="cmd-field">
              <label htmlFor="mode">pay mode</label>
              <select id="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="simulate">simulate (free)</option>
                <option value="real">real x402 on base</option>
              </select>
            </div>
            <button className="cmd-run" onClick={runRequest} disabled={busy}>
              {busy ? "running…" : "Run request"}
            </button>
          </section>
          <p className="cmd-note">
            Run the same request twice: the second must be refused by the ledger.
            Wipe it and the amnesia twin pays again.
          </p>

          <div className="cardgrid">
            <section className="gcard span5" id="overview" aria-label="spent on record">
              <span className="k">spent on record</span>
              <span className="hero-num num">{usd(heroSpent)}</span>
              <Sparkline points={series} width={260} height={46} />
              <span className="chips">
                <span className="chip ok">{purchases.length} payments</span>
                <span className="chip ok">0 duplicates</span>
                <span className="chip">{String(state?.tiers.refusals_total ?? 0)} refusals</span>
              </span>
            </section>

            <section className="gcard span4" aria-label="daily budget">
              <span className="k">today vs daily cap</span>
              <span className="hero-num num dim-num">{Math.round(budgetPct)}%</span>
              <div className="budget-bar" role="progressbar"
                   aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className={`budget-fill ${budgetPct > 80 ? "over" : ""}`}
                     style={{ width: `${Math.max(2, budgetPct)}%` }} />
              </div>
              <span className="spark-note mono num">
                {usd(spentToday)} / {usd(dailyCap)}
              </span>
            </section>

            <section className="gcard span3" aria-label="crew">
              <span className="k">crew</span>
              {(["scout", "purser", "auditor"] as const).map((role) => {
                const s = hot[`session_${role}`];
                return (
                  <div key={role} className="rowline">
                    <span className="n">
                      <span className={`dot sm ${s ? "" : "dead"}`} aria-hidden="true" /> {role}
                    </span>
                    <span className="d">{s ? `shift ${String(s.shift ?? "?")}` : "idle"}</span>
                  </div>
                );
              })}
              {hot.audit && (
                <div className="rowline">
                  <span className="n">audit</span>
                  <span className={`d ${hot.audit.clean ? "" : "retired"}`}>
                    {hot.audit.clean ? `clean · ${String(hot.audit.checked ?? 0)}✓` : "drift"}
                  </span>
                </div>
              )}
            </section>

            <section className="gcard span7" id="ledger" aria-label="decisions">
              <span className="k">decisions</span>
              {feed.length === 0 && (
                <p className="empty">No decisions yet this viewing. Run a request above.</p>
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

            <section className="gcard span5" id="memory" aria-label="memory tiers">
              <span className="k">memory tiers</span>
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
                        <div key={v.name} className="vendor-row">
                          <div className="rowline">
                            <span className={`n ${v.status === "retired" ? "retired" : ""}`}>
                              <span className={`dot sm ${v.status === "retired" ? "dead" : ""}`} aria-hidden="true" /> {v.name}
                            </span>
                            <span className="d">
                              {v.status === "retired" ? "retired" : `${v.purchases ?? 0} buys`}
                            </span>
                          </div>
                          <div className="trustbar" role="img"
                               aria-label={`trust ${(v.trust ?? 0).toFixed(2)} of 1`}>
                            <div className={`trustfill ${v.status === "retired" ? "dead" : ""}`}
                                 style={{ width: `${Math.round((v.trust ?? 0) * 100)}%` }} />
                          </div>
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
                      {(["scout", "purser", "auditor"] as const).map((role) => {
                        const s = hot[`session_${role}`];
                        return s ? (
                          <div key={role} className="rowline">
                            <span className="n"><span className="dot sm" aria-hidden="true" /> {role}</span>
                            <span className="d">shift {String(s.shift ?? "?")}</span>
                          </div>
                        ) : null;
                      })}
                      {!hot.session_scout && <p className="empty">no session state yet.</p>}
                      {hot.handoff_to_auditor && (
                        <div className="rowline">
                          <span className="n">handoff → auditor</span>
                          <span className="d">queued</span>
                        </div>
                      )}
                      {hot.audit && (
                        <div className="rowline">
                          <span className="n">audit</span>
                          <span className={`d ${hot.audit.clean ? "" : "retired"}`}>
                            {hot.audit.clean ? `${String(hot.audit.checked ?? 0)} checked · clean` : "drift flagged"}
                          </span>
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
        </div>
      </div>

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
