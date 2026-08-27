"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkline } from "../Sparkline";

type Decision = {
  ledger_id: string | null;
  seq?: number;
  pending?: boolean;
  decision: { approve: boolean; rule: string; reason: string; recalled: string[] };
  payment: { status: string; tx: string; detail: string };
  request: { vendor: string; sku: string; amount_micro: number };
  pay_mode: string;
};

type State = {
  tiers: {
    warm: { vendors: { name: string; trust?: number; status?: string; purchases?: number }[]; purchases: { vendor?: string; amount_micro?: number; date?: string; tx?: string }[] };
    cold_count: number;
    hot: Record<string, unknown>;
    spend_series?: { date: string; cumulative_micro: number }[];
    spent_today_micro?: number;
    daily_cap_micro?: number;
    refusals_total?: number;
    recent_decisions?: Decision[];
    ledger_total?: number;
  };
};

type Wallet = {
  wallet: string;
  usdc: number | null;
  receipts: { tx: string; vendor: string; amount_micro: number; basescan: string }[];
};

type Toast = { id: number; kind: "ok" | "bad"; text: string };
type Tab = "vendors" | "journal" | "hot" | "archive";

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;
const usdCap = (micro: number) => `$${(micro / 1e6).toFixed(2)}`;
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
  const [realArmed, setRealArmed] = useState(false);
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

  function post(body: Record<string, unknown>) {
    return fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }

  async function fire(body: Record<string, unknown>) {
    setBusy(true);
    setFeed((f) => [{
      pending: true,
      ledger_id: null,
      decision: { approve: true, rule: "checking", reason: "recalling memory…", recalled: [] },
      payment: { status: "pending", tx: "", detail: "" },
      request: { vendor: String(body.vendor), sku: String(body.sku),
                 amount_micro: Number(body.amount_micro) },
      pay_mode: String(body.pay_mode ?? "simulate"),
    }, ...f]);
    try {
      const res = await post(body);
      setFeed((f) => f.map((d) => (d.pending ? res : d)));
      if (res.decision.approve) {
        toast("ok", `paid ${res.request.vendor} ${usd(res.request.amount_micro)}`);
      } else {
        toast("bad", `refused [${res.decision.rule}]: ${res.decision.reason.slice(0, 120)}`);
      }
      refresh();
    } catch {
      setFeed((f) => f.filter((d) => !d.pending));
      toast("bad", "request failed. Is the sidecar running?");
    } finally {
      setBusy(false);
    }
  }

  async function runRequest() {
    const micro = Math.round(parseFloat(amount || "0") * MICRO);
    if (!vendor || !sku || !Number.isFinite(micro) || micro <= 0) {
      toast("bad", "amount must be a positive number");
      return;
    }
    if (mode === "real" && !realArmed) {
      setRealArmed(true);
      setTimeout(() => setRealArmed(false), 4000);
      toast("bad", "real mode: press again to send actual USDC on base");
      return;
    }
    setRealArmed(false);
    await fire({ vendor, sku, description: `panel request ${sku}`,
                 amount_micro: micro, pay_mode: mode });
  }

  async function runLitmus() {
    if (busy) return;
    const body = { vendor: "weather.x402.press", sku: "lagos-weather-current",
                   description: "litmus demo", amount_micro: 3750, pay_mode: "simulate" };
    await fire(body);   // pays once
    await fire(body);   // same request again: memory must refuse it
  }

  function copyText(text: string, what: string) {
    navigator.clipboard?.writeText(text)
      .then(() => toast("ok", `${what} copied`))
      .catch(() => toast("bad", "copy blocked by the browser"));
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
  const series = (state?.tiers.spend_series ?? []).map((s) => s.cumulative_micro);
  const spentToday = state?.tiers.spent_today_micro ?? 0;
  const dailyCap = state?.tiers.daily_cap_micro ?? 250_000;
  const budgetPct = Math.min(100, (spentToday / Math.max(1, dailyCap)) * 100);
  const hot = (state?.tiers.hot ?? {}) as Record<string, { shift?: number; clean?: boolean; checked?: number } | undefined>;
  const ledgerTotal = state?.tiers.ledger_total ?? 0;
  const retired = vendors.filter((v) => v.status === "retired");
  const history = (state?.tiers.recent_decisions ?? []).filter(
    (h) => !feed.some((d) => !d.pending && d.ledger_id === h.ledger_id));
  const decisions = [...feed, ...history];
  const lastPay = purchases[0];
  const lastEntry = loadErr ? "—"
    : lastPay ? (String(lastPay.tx ?? "").startsWith("0x") ? String(lastPay.tx).slice(0, 12) : "simulated")
    : "none";
  const isEmpty = !loadErr && purchases.length === 0 && (state?.tiers.refusals_total ?? 0) === 0;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "vendors", label: "vendors", count: vendors.length - retired.length },
    { id: "journal", label: "journal", count: ledgerTotal },
    { id: "hot", label: "hot", count: Object.keys(hot).length },
    { id: "archive", label: "archive", count: retired.length },
  ];
  const activeIdx = tabs.findIndex((t) => t.id === tab);

  return (
    <main>
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
            <a href="/">landing</a>
          </nav>
          <div className="sb-bottom">
            <button className="danger" onClick={wipe}>
              {wipeArmed ? "Confirm: wipe" : "Wipe ledger"}
            </button>
            {wipeArmed && (
              <span className="sb-status">forgets {vendors.length} vendors · {ledgerTotal} entries</span>
            )}
            <span className="sb-status">coordination via sibyl memory</span>
          </div>
        </aside>

        <div className="main">
          <div className={`status-strip ${loadErr ? "off" : ""}`} role="status">
            <span className={`dot ${loadErr ? "dead" : ""}`} aria-hidden="true" />
            {loadErr ? (
              <>OFFLINE · SIDECAR UNREACHABLE · <button className="linklike" onClick={refresh}>retry</button></>
            ) : (
              <>LIVE · LEDGER · SIBYL MEMORY · BASE 8453 · MODE {mode === "real" ? "REAL" : "SIM"} · LAST PAYMENT <span className="num">{lastEntry}</span></>
            )}
          </div>

          <form className="cmdbar" aria-label="request"
                onSubmit={(e) => { e.preventDefault(); runRequest(); }}>
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
            <button className="cmd-run" type="submit" disabled={busy}>
              {busy ? "running…" : mode === "real" && realArmed ? "Confirm: pay real USDC" : "Run request"}
            </button>
          </form>
          <p className="cmd-note">
            Run the same request twice: the second must be refused by the ledger.
            Wipe it and the amnesia twin pays again.
          </p>

          <div className="cardgrid">
            <section className="gcard span5" id="overview" aria-label="spent on record">
              {isEmpty ? (
                <>
                  <span className="k">no ledger yet</span>
                  <p className="empty-lede">
                    The ledger is empty. Run the same request twice: the second
                    must be refused by memory.
                  </p>
                  <button onClick={runLitmus} disabled={busy}>
                    {busy ? "running…" : "Run the litmus demo"}
                  </button>
                  <span className="spark-note">pays once, refuses the duplicate · simulated, no chain</span>
                </>
              ) : (
                <>
                  <span className="k">spent on record</span>
                  <span className="hero-num num">{loadErr ? "—" : usd(heroSpent)}</span>
                  {series.length > 0 ? (
                    <>
                      <Sparkline points={series} width={260} height={46} />
                      <span className="sr-only">
                        cumulative spend, {series.length} day{series.length === 1 ? "" : "s"}, latest {usd(series[series.length - 1])}
                      </span>
                    </>
                  ) : (
                    <span className="spark-note">no spend recorded yet</span>
                  )}
                  <span className="chips">
                    <span className="chip ok">{purchases.length} payments</span>
                    {(state?.tiers.refusals_total ?? 0) > 0 && (
                      <span className="chip refuse">{String(state?.tiers.refusals_total)} refused</span>
                    )}
                  </span>
                </>
              )}
            </section>

            <section className="gcard span4" aria-label="daily budget">
              <span className="k">today vs daily cap</span>
              <span className="stat-num num dim-num">{Math.round(budgetPct)}%</span>
              <div className="budget-bar" role="progressbar"
                   aria-valuenow={Math.round(budgetPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className={`budget-fill ${budgetPct > 80 ? "over" : ""}`}
                     style={{ transform: `scaleX(${Math.max(0.02, budgetPct / 100)})` }} />
              </div>
              <span className="spark-note mono num">
                {usd(spentToday)} / {usdCap(dailyCap)}
              </span>
            </section>

            <section className="gcard span3" aria-label="crew">
              <span className="k">crew</span>
              {(["scout", "purser", "auditor"] as const).map((role) => {
                const s = hot[`session_${role}`];
                return (
                  <div key={role} className="rowline">
                    <span className="n">
                      <span className={`dot sm ${s ? "" : "idle"}`} aria-hidden="true" /> {role}
                    </span>
                    <span className="d">{s?.shift != null ? `shift ${String(s.shift)}` : s ? "active" : "idle"}</span>
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
              {decisions.length === 0 && (
                <p className="empty">No decisions on record. Run a request above.</p>
              )}
              {decisions.map((d, i) => (
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
                          <>
                            <a className="tx num" href={`/proof?id=${d.ledger_id}`}>
                              {d.decision.approve ? `tx ${d.payment.tx.slice(0, 20)}…` : "public proof"} ›
                            </a>
                            <button className="linklike" onClick={() => copyText(String(d.ledger_id), "entry id")}>copy id</button>
                          </>
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
                      <div className="ladder mono">
                        <span>hot <b className="num">{Object.keys(hot).length}</b></span>
                        <span>warm <b className="num">{vendors.length - retired.length}</b></span>
                        <span>cold <b className="num">{ledgerTotal}</b></span>
                        <span>archive <b className="num">{retired.length}</b></span>
                      </div>
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
                                 style={{ transform: `scaleX(${v.trust ?? 0})` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tab === "journal" && (
                    <div className="tier">
                      <div className="rowline"><span className="n">append-only events</span><span className="d num">{String(ledgerTotal)} entries</span></div>
                      {(state?.tiers.recent_decisions ?? []).map((h) => (
                        <div key={h.ledger_id ?? h.seq} className={`rowline jrow ${h.decision.approve ? "" : "refrow"}`}>
                          <span className="jseq num">#{String(h.seq ?? 0).padStart(4, "0")}</span>
                          <span className="n">{h.request.vendor}</span>
                          <span className="d num">{usd(h.request.amount_micro)}</span>
                          <button className="linklike" title={`copy ${h.ledger_id}`}
                                  onClick={() => h.ledger_id && copyText(h.ledger_id, "entry id")}>
                            {String(h.ledger_id ?? "").slice(0, 8)}…
                          </button>
                        </div>
                      ))}
                      {ledgerTotal > 8 && (
                        <div className="rowline"><span className="n dim">…</span><span className="d num">+{String(ledgerTotal - 8)} earlier</span></div>
                      )}
                      {ledgerTotal === 0 && <p className="empty">no journal entries yet.</p>}
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

                  {tab === "archive" && (
                    <div className="tier">
                      {retired.length === 0 && (
                        <p className="empty">no retired vendors. A failed settle retires the vendor and archives its full record.</p>
                      )}
                      {retired.map((v) => (
                        <div key={v.name} className="vendor-row">
                          <div className="rowline">
                            <span className="n retired"><span className="dot sm dead" aria-hidden="true" /> {v.name}</span>
                            <span className="d">retired · trust 0.00</span>
                          </div>
                          <div className="trustbar" aria-label="trust retired">
                            <div className="trustfill dead" style={{ transform: "scaleX(0)" }} />
                          </div>
                        </div>
                      ))}
                      {retired.length > 0 && (
                        <span className="spark-note">tombstone in WARM · full record in ARCHIVE</span>
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
