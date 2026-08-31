"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  dropEntry,
  tamperDetail,
  verify,
  type AuditAction,
  type AuditEntry,
  type VerifyResult,
} from "@/lib/chain";
import styles from "./page.module.css";

const ACTIONS: AuditAction[] = [
  "LOGIN",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "APPROVE",
  "DENY",
  "EXPORT",
];

export default function HomePage() {
  const [chain, setChain] = useState<AuditEntry[]>([]);
  const [serverVerify, setServerVerify] = useState<VerifyResult | null>(null);
  const [action, setAction] = useState<AuditAction>("UPDATE");
  const [actor, setActor] = useState("clerk.marina");
  const [resource, setResource] = useState("grant:vault-7");
  const [detail, setDetail] = useState("Amended justification note");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localAttack, setLocalAttack] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setLocalAttack(false);
    const [chainRes, verifyRes] = await Promise.all([
      fetch("/api/chain"),
      fetch("/api/chain/verify"),
    ]);
    if (!chainRes.ok || !verifyRes.ok) {
      setError("Failed to load chain");
      setLoading(false);
      return;
    }
    const chainData = (await chainRes.json()) as { events: AuditEntry[] };
    const verifyData = (await verifyRes.json()) as VerifyResult;
    setChain(chainData.events);
    setServerVerify(verifyData);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const localResult = useMemo(() => verify(chain), [chain]);
  const result = localAttack ? localResult : (serverVerify ?? localResult);

  async function onAppend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/chain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, actor, resource, detail }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Append failed");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <main className={styles.ledger}>
        <p className={styles.okCopy}>Loading sealed ledger…</p>
      </main>
    );
  }

  return (
    <main className={styles.ledger}>
      <header className={styles.masthead}>
        <div className={styles.seal} aria-hidden>
          <span className={styles.sealRing}>AS</span>
        </div>
        <div>
          <p className={styles.eyebrow}>Integrity ledger · Saeed Rumaneh</p>
          <h1 className={styles.brand}>AuditSeal</h1>
          <p className={styles.tagline}>
            Append-only hash chain. Every entry seals the previous hash — verify
            detects tampering and missing links. Events persist in{" "}
            <code>data/chain.json</code>.
          </p>
        </div>
        <div
          className={`${styles.status} ${result.ok ? styles.statusOk : styles.statusBad}`}
        >
          <strong>{result.ok ? "SEAL INTACT" : "SEAL BROKEN"}</strong>
          <span>
            {result.checked} checked · {result.issues.length} issue
            {result.issues.length === 1 ? "" : "s"}
            {localAttack ? " · local attack" : " · disk"}
          </span>
        </div>
      </header>

      {error && <p className={styles.okCopy}>{error}</p>}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Stamp a new entry</h2>
          <form className={styles.form} onSubmit={(e) => void onAppend(e)}>
            <label>
              Action
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as AuditAction)}
              >
                {ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Actor
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label>
              Resource
              <input
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                spellCheck={false}
              />
            </label>
            <label>
              Detail
              <textarea
                rows={3}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            </label>
            <button type="submit" className={styles.btnPrimary}>
              Append &amp; seal
            </button>
          </form>

          <div className={styles.attack}>
            <h3>Simulate attack</h3>
            <p className={styles.okCopy}>
              Attacks mutate the in-browser view only — disk stays sealed until you reload.
            </p>
            <div className={styles.attackRow}>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={chain.length < 2}
                onClick={() => {
                  setLocalAttack(true);
                  setChain((prev) =>
                    tamperDetail(prev, 1, "TAMPERED — silent rewrite"),
                  );
                }}
              >
                Rewrite entry #1
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={chain.length < 2}
                onClick={() => {
                  setLocalAttack(true);
                  setChain((prev) => dropEntry(prev, 1));
                }}
              >
                Drop entry #1
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() => void load()}
              >
                Reload from disk
              </button>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Verification</h2>
          {result.ok ? (
            <p className={styles.okCopy}>
              Chain hashes and previous-hash links verify cleanly from genesis
              through the tip.
            </p>
          ) : (
            <ul className={styles.issues}>
              {result.issues.map((issue, i) => (
                <li key={`${issue.kind}-${issue.index}-${i}`}>
                  <code>{issue.kind}</code>
                  <span>
                    #{issue.index} — {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${styles.panel} ${styles.chainPanel}`}>
          <h2 className={styles.panelTitle}>Sealed chain</h2>
          {chain.length === 0 ? (
            <p className={styles.okCopy}>
              Chain length is 0. Append an event to start a sealed ledger — nothing is hashed yet.
            </p>
          ) : (
          <ol className={styles.chain}>
            {chain.map((entry) => (
              <li key={`${entry.index}-${entry.hash}`}>
                <div className={styles.entryHead}>
                  <span className={styles.index}>#{entry.index}</span>
                  <strong>{entry.action}</strong>
                  <time dateTime={entry.at}>
                    {new Date(entry.at).toLocaleString()}
                  </time>
                </div>
                <p>
                  <em>{entry.actor}</em> on <code>{entry.resource}</code> —{" "}
                  {entry.detail}
                </p>
                <div className={styles.hashes}>
                  <div>
                    <span>prev</span>
                    <code title={entry.prevHash}>
                      {entry.prevHash.slice(0, 16)}…
                    </code>
                  </div>
                  <div>
                    <span>hash</span>
                    <code title={entry.hash}>{entry.hash.slice(0, 16)}…</code>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        AuditSeal · MIT 2026 · Saeed Rumaneh · chain persists on disk
      </footer>
    </main>
  );
}
