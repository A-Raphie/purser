"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Proof = {
  id?: string; ts?: string; kind?: string; rule?: string; reason?: string;
  vendor?: string; amount_micro?: number; status?: string; tx?: string | null;
  basescan?: string | null; recalled?: string[]; acted?: string[]; error?: string;
};

const usd = (micro?: number) => micro != null ? `$${(micro / 1e6).toFixed(6)}` : "n/a";

function ProofBody() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const [proof, setProof] = useState<Proof | null>(null);
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [example, setExample] = useState<string | null>(null);

  useEffect(() => {
    if (id) return;
    fetch("/api/state").then((r) => r.json())
      .then((s) => {
        const first = s?.tiers?.recent_decisions?.[0];
        if (first?.ledger_id) setExample(first.ledger_id);
      })
      .catch(() => {});
  }, [id]);

  const load = useCallback(async () => {
    if (!id) { setState("done"); setProof(null); return; }
    setState("loading");
    try {
      const p = await fetch(`/api/proof/${encodeURIComponent(id)}`).then((r) => r.json());
      setProof(p);
      setState("done");
    } catch {
      setState("error");
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <main>
      <header className="masthead slim">
        <div>
          <h1>purser<span>.</span></h1>
          <div className="sub">public ledger proof · no wallet, no login</div>
        </div>
        <a className="runlink" href="/room">ledger room ›</a>
      </header>

      <section className="proofcard">
        {!id && (
          <div className="empty-state">
            <p className="mono">verify a ledger entry</p>
            <p>Every payment and refusal is a public entry. Paste an id, or take one from a decision card in the ledger room:</p>
            <form className="checkrow" action="/proof" method="get">
              <input name="id" placeholder="ledger entry id" aria-label="ledger entry id" />
              <button type="submit">Verify</button>
            </form>
            {example && (
              <p className="cite">or verify the latest entry: <a className="mono" href={`/proof?id=${example}`}>{example.slice(0, 18)}…</a></p>
            )}
            <p className="cite"><a href="/">back to the landing ›</a></p>
          </div>
        )}
        {id && state === "loading" && <div className="skeleton tall" aria-label="loading proof" />}
        {id && state === "error" && (
          <div className="empty-state">
            <p>ledger unreachable. Try again in a moment.</p>
            <button onClick={load}>Retry</button>
          </div>
        )}
        {id && state === "done" && proof?.error && (
          <div className="empty-state">
            <p>No ledger entry with that id. Entry ids live on the decision cards in the ledger room.</p>
            <a href="/room">back to the ledger room ›</a>
          </div>
        )}
        {id && state === "done" && proof?.id && (
          <article className={`card ${proof.kind === "refusal" ? "refuse" : "approve"}`}>
            <div className="head">
              <span className="verdict">{proof.kind === "refusal" ? "REFUSED" : `PAID · ${String(proof.status).toUpperCase()}`}</span>
              <span className="rule">{proof.rule}</span>
            </div>
            <div className="body">
              <table className="fields">
                <tbody>
                  <tr><th>entry</th><td className="mono num">{proof.id}</td></tr>
                  <tr><th>when</th><td className="mono">{proof.ts}</td></tr>
                  <tr><th>vendor</th><td>{proof.vendor}</td></tr>
                  <tr><th>amount</th><td className="num">{usd(proof.amount_micro)}</td></tr>
                  <tr><th>memory reason</th><td>{proof.reason}</td></tr>
                  {proof.recalled && proof.recalled.length > 0 && (
                    <tr><th>recalled</th><td className="mono dim">{proof.recalled.join(" · ")}</td></tr>
                  )}
                  <tr>
                    <th>onchain</th>
                    <td>
                      {proof.basescan
                        ? <a href={proof.basescan} target="_blank" rel="noreferrer">{proof.tx?.slice(0, 26)}… on Basescan</a>
                        : <span className="dim">{proof.kind === "refusal" ? "no payment (this is the guardrail firing)" : "simulated, not onchain"}</span>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}

export default function ProofPage() {
  return (
    <Suspense>
      <ProofBody />
    </Suspense>
  );
}
