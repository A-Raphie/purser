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
  const series = (state?.tiers.spend_series ?? []).map((s) => s.cumulative_micro);
  const spentToday = state?.tiers.spent_today_micro ?? 0;
  const dailyCap = state?.tiers.daily_cap_micro ?? 250_000;
  const budgetPct = Math.min(100, (spentToday / Math.max(1, dailyCap)) * 100);
  const hot = (state?.tiers.hot ?? {}) as Record<string, { shift?: number; clean?: boolean; checked?: number } | undefined>;

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
        </div>        <div className="mast-facts">
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

      <div className="shell">
      <section className="bridge" aria-label="the bridge: totals, spend curve, budget">
        <div className="bridge-hero">
          <span className="k">spent on record</span>
          <span className="hero-num num">{usd(heroSpent)}</span>
          <span className="chips">
            <span className="chip ok">{purchases.length} payments</span>
            <span className="chip ok">0 duplicates</span>
            <span className="chip">{String(state?.tiers.refusals_total ?? 0)} refusals all-time</span>
          </span>
        </div>
        <div className="bridge-spark">
          <span className="k">spend curve · cumulative</span>
          <Sparkline points={series} width={220} height={52} />
          <span className="spark-note mono dim">
            {series.length > 0
              ? `${series.length} day${series.length > 1 ? "s" : ""} · ${usd(series[series.length - 1])} total`
              : "no payments yet"}
          </span>
        </div>
        <div className="bridge-budget">
          <span className="k">today vs daily cap</span>
          <div className="budget-bar" role="progressbar"
               aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`budget-fill ${budgetPct > 80 ? "over" : ""}`}
                 style={{ width: `${Math.max(2, budgetPct)}%` }} />
          </div>
          <span className="spark-note mono num">
            {usd(spentToday)} / {usd(dailyCap)} · {Math.round(budgetPct)}%
          </span>
        </div>
      </section>

      <section className="crew-strip" aria-label="crew coordination">
        {(["scout", "purser", "auditor"] as const).map((role, i) => {
          const s = hot[`session_${role}`];
          return (
            <div key={role} className="crew-card">
              {i > 0 && <span className="crew-arrow" aria-hidden="true">→</span>}
              <span className={`dot sm ${s ? "" : "dead"}`} aria-hidden="true" />
              <span className="crew-role">{role}</span>
              <span className="crew-meta mono dim">
                {s ? `shift ${String(s.shift ?? "?")} · active` : "idle"}
              </span>
            </div>
          );
        })}
        {hot.audit && (
          <div className="crew-card audit">
            <span className="crew-role">audit</span>
            <span className={`crew-meta mono ${hot.audit.clean ? "oklive" : "retired"}`}>
              {hot.audit.clean
                ? `${String(hot.audit.checked ?? 0)} checked · clean`
                : "drift flagged"}
            </span>
          </div>
        )}
      </section>

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
        <button className="danger cmd-wipe" onClick={wipe}>
          {wipeArmed ? "Confirm: wipe" : "Wipe ledger"}
        </button>
      </section>
      <p className="cmd-note">
        Run the same request twice: the second must be refused by the ledger.
        Wipe it and the amnesia twin pays again.
      </p>

      <div className="main-rail">
        <section className="zone main">
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

        <section className="zone rail">
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
                    const s = state.tiers.hot?.[`session_${role}`] as { shift?: number } | undefined;
                    return s ? (
                      <div key={role} className="rowline">
                        <span className="n"><span className="dot sm" aria-hidden="true" /> {role}</span>
                        <span className="d">shift {String(s.shift ?? "?")} · active</span>
                      </div>
                    ) : null;
                  })}
                  {!state.tiers.hot?.session_scout && !state.tiers.hot?.session && (
                    <p className="empty">no session state yet. Run a request or a crew shift.</p>
                  )}
                  {state.tiers.hot?.handoff_to_auditor && (
                    <div className="rowline">
                      <span className="n">handoff → auditor</span>
                      <span className="d">queued</span>
                    </div>
                  )}
                  {state.tiers.hot?.audit && (
                    <div className="rowline">
                      <span className="n">audit · shift {String((state.tiers.hot.audit as { shift?: number }).shift ?? "?")}</span>
                      <span className={`d ${(state.tiers.hot.audit as { clean?: boolean }).clean ? "" : "retired"}`}>
                        {(state.tiers.hot.audit as { clean?: boolean }).clean
                          ? `${String((state.tiers.hot.audit as { checked?: number }).checked ?? 0)} checked · clean`
                          : "drift flagged"}
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
