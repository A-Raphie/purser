"use client";

import { useCallback, useEffect, useState } from "react";

type Decision = {
  decision: { approve: boolean; rule: string; reason: string; recalled: string[] };
  payment: { status: string; tx: string; detail: string };
  request: { vendor: string; sku: string; amount_micro: number };
  pay_mode: string;
};

type State = {
  tiers: {
    warm: { vendors: { name: string; trust?: number; status?: string; purchases?: number }[]; purchases: unknown[] };
    cold_count: number;
    hot: Record<string, unknown>;
  };
};

type Wallet = {
  wallet: string;
  usdc: number | null;
  receipts: { tx: string; vendor: string; amount_micro: number; basescan: string }[];
};

const usd = (micro: number) => `$${(micro / 1e6).toFixed(6)}`;

export default function ControlRoom() {
  const [vendor, setVendor] = useState("weather.x402.press");
  const [sku, setSku] = useState("lagos-weather-current");
  const [amount, setAmount] = useState("0.00375");
  const [mode, setMode] = useState("simulate");
  const [busy, setBusy] = useState(false);

  const [feed, setFeed] = useState<Decision[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [wipeArmed, setWipeArmed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await fetch("/api/state").then((r) => r.json());
      setState(s);
      const w = await fetch("/api/wallet").then((r) => r.json());
      setWallet(w);
    } catch {
      /* sidecar offline — feed still shows local history */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function runRequest() {
    const micro = Math.round(parseFloat(amount || "0") * 1e6);
    if (!vendor || !sku || !Number.isFinite(micro) || micro <= 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor, sku, description: `panel request ${sku}`,
          amount_micro: micro, pay_mode: mode,
        }),
      }).then((r) => r.json());
      setFeed((f) => [res, ...f]);
      refresh();
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
    refresh();
  }

  const vendors = state?.tiers.warm.vendors ?? [];
  const purchases = state?.tiers.warm.purchases ?? [];
  const receipts = wallet?.receipts ?? [];

  return (
    <main>
      <header className="masthead">
        <div>
          <h1>PURSER<span>.</span></h1>
          <div className="sub">manifest &amp; ledger · a treasurer that never forgets a payment</div>
        </div>
        <div className="mast-facts">
          <div className="fact">
            <span className="k">wallet</span>
            <span className="v">{wallet?.wallet ? `${wallet.wallet.slice(0, 8)}…${wallet.wallet.slice(-6)}` : "not set"}</span>
          </div>
          <div className="fact">
            <span className="k">usdc on base</span>
            <span className="v brass">{wallet?.usdc != null ? wallet.usdc.toFixed(6) : "…"}</span>
          </div>
          <div className="fact">
            <span className="k">memory</span>
            <span className="v">sibyl · 5 tiers</span>
          </div>
        </div>
      </header>

      <div className="deck">
        <section className="zone">
          <h2>Request</h2>
          <label>vendor</label>
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <label>sku</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
          <label>amount (usdc)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <label>pay mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
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
            <article key={i} className={`card ${d.decision.approve ? "approve" : "refuse"}`}>
              <div className="head">
                <span className="verdict">
                  {d.decision.approve ? `PAID · ${d.payment.status.toUpperCase()}` : "REFUSED"}
                </span>
                <span className="rule">{d.decision.rule}</span>
              </div>
              <div className="body">
                <div className="reason">
                  {d.request.vendor}:{d.request.sku} · {usd(d.request.amount_micro)} — {d.decision.reason}
                </div>
                {!d.decision.approve && d.decision.recalled.length > 0 && (
                  <div className="evidence">
                    recalled from memory:
                    {"\n"}
                    {d.decision.recalled.join("\n")}
                  </div>
                )}
                <div className="meta">
                  {d.pay_mode === "simulate" && <span className="sim-chip">simulated</span>}{" "}
                  {d.payment.tx && <span className="tx">tx {d.payment.tx.slice(0, 26)}…</span>}
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="zone">
          <h2>Memory tiers</h2>
          <div className="tier">
            <h3>warm · vendors <span className="count">{vendors.length}</span></h3>
            {vendors.length === 0 && <p className="empty">empty ledger</p>}
            {vendors.map((v) => (
              <div key={v.name} className="rowline">
                <span className={`n ${v.status === "retired" ? "retired" : ""}`}>{v.name}</span>
                <span className="d">
                  {v.status === "retired" ? "retired" : `trust ${v.trust ?? "—"} · ${v.purchases ?? 0} buys`}
                </span>
              </div>
            ))}
          </div>
          <div className="tier">
            <h3>cold · journal <span className="count">{state?.tiers.cold_count ?? 0}</span></h3>
            <div className="rowline">
              <span className="n">append-only events</span>
              <span className="d">{purchases.length} payments</span>
            </div>
          </div>
          <div className="tier">
            <h3>hot · session</h3>
            {state?.tiers.hot?.session ? (
              <div className="rowline">
                <span className="n">session {String((state.tiers.hot.session as { n?: number }).n ?? "?")}</span>
                <span className="d">active</span>
              </div>
            ) : (
              <p className="empty">no session state</p>
            )}
          </div>
        </section>
      </div>

      <footer className="receipts">
        <h2>Receipts</h2>
        {receipts.length === 0 && <span className="empty">no onchain receipts yet (sim runs are labeled, not receipted)</span>}
        {receipts.map((r) => (
          <span key={r.tx} className="receipt">
            <a href={r.basescan} target="_blank" rel="noreferrer">{r.tx.slice(0, 14)}…</a>{" "}
            <span className="who">{r.vendor} {usd(r.amount_micro)}</span>
          </span>
        ))}
      </footer>
    </main>
  );
}
