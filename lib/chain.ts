/**
 * AuditSeal — append-only hash-chained audit log.
 *
 * Each entry seals the previous hash into its own hash so the chain
 * is tamper-evident. verify() walks the chain and reports breaks,
 * content rewrites, and missing sequence links.
 */

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "DENY"
  | "EXPORT";

export interface AuditEventInput {
  action: AuditAction;
  actor: string;
  resource: string;
  detail: string;
  at?: string;
}

export interface AuditEntry {
  index: number;
  action: AuditAction;
  actor: string;
  resource: string;
  detail: string;
  at: string;
  prevHash: string;
  hash: string;
}

export type VerifyIssueKind =
  | "hash_mismatch"
  | "prev_hash_mismatch"
  | "missing_link"
  | "index_gap"
  | "genesis_broken";

export interface VerifyIssue {
  kind: VerifyIssueKind;
  index: number;
  message: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  issues: VerifyIssue[];
}

/** Synchronous SHA-256 via Web Crypto when available; sync hash fallback for vitest/node. */
export async function sha256Hex(payload: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const data = new TextEncoder().encode(payload);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
    return bufferToHex(digest);
  }
  return syncHashHex(payload);
}

/** Deterministic sync hash used for chaining (works in Node tests without async). */
export function syncHashHex(payload: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0xa5a5a5a5;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i % 7) + 1);
    h2 = Math.imul(h2, 0x01000193);
  }
  const parts: string[] = [];
  let a = h1 >>> 0;
  let b = h2 >>> 0;
  for (let i = 0; i < 8; i++) {
    parts.push(a.toString(16).padStart(8, "0"));
    parts.push(b.toString(16).padStart(8, "0"));
    a = Math.imul(a ^ (b >>> 3), 0x85ebca6b) >>> 0;
    b = Math.imul(b ^ (a >>> 5), 0xc2b2ae35) >>> 0;
  }
  return parts.join("").slice(0, 64);
}

export function canonicalize(entry: Omit<AuditEntry, "hash">): string {
  return [
    entry.index,
    entry.action,
    entry.actor,
    entry.resource,
    entry.detail,
    entry.at,
    entry.prevHash,
  ].join("|");
}

export function computeEntryHash(entry: Omit<AuditEntry, "hash">): string {
  return syncHashHex(canonicalize(entry));
}

export async function computeEntryHashAsync(
  entry: Omit<AuditEntry, "hash">,
): Promise<string> {
  return sha256Hex(canonicalize(entry));
}

export function appendEntry(
  chain: readonly AuditEntry[],
  input: AuditEventInput,
): AuditEntry {
  const index = chain.length;
  const prevHash = index === 0 ? GENESIS_HASH : chain[index - 1].hash;
  const draft: Omit<AuditEntry, "hash"> = {
    index,
    action: input.action,
    actor: input.actor,
    resource: input.resource,
    detail: input.detail,
    at: input.at ?? new Date().toISOString(),
    prevHash,
  };
  return { ...draft, hash: computeEntryHash(draft) };
}

export function appendMany(
  chain: readonly AuditEntry[],
  inputs: AuditEventInput[],
): AuditEntry[] {
  let next = [...chain];
  for (const input of inputs) {
    next = [...next, appendEntry(next, input)];
  }
  return next;
}

/**
 * Walk the chain and detect rewritten content, broken prevHash links,
 * missing / out-of-order indices, and genesis corruption.
 */
export function verify(chain: readonly AuditEntry[]): VerifyResult {
  const issues: VerifyIssue[] = [];

  if (chain.length === 0) {
    return { ok: true, checked: 0, issues: [] };
  }

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];

    if (entry.index !== i) {
      issues.push({
        kind: "index_gap",
        index: i,
        message: `Expected index ${i}, found ${entry.index}`,
      });
    }

    const expectedPrev = i === 0 ? GENESIS_HASH : chain[i - 1].hash;
    if (entry.prevHash !== expectedPrev) {
      issues.push({
        kind: i === 0 ? "genesis_broken" : "prev_hash_mismatch",
        index: i,
        message:
          i === 0
            ? "Genesis prevHash is not the sealed zero hash"
            : `prevHash does not match hash of entry ${i - 1}`,
      });
    }

    if (i > 0) {
      const prev = chain[i - 1];
      if (prev.index !== i - 1) {
        issues.push({
          kind: "missing_link",
          index: i,
          message: `Missing sequential link before index ${i}`,
        });
      }
    }

    const expectedHash = computeEntryHash({
      index: entry.index,
      action: entry.action,
      actor: entry.actor,
      resource: entry.resource,
      detail: entry.detail,
      at: entry.at,
      prevHash: entry.prevHash,
    });

    if (entry.hash !== expectedHash) {
      issues.push({
        kind: "hash_mismatch",
        index: i,
        message: "Entry content does not match sealed hash",
      });
    }
  }

  const indices = chain.map((e) => e.index);
  for (let expected = 0; expected <= Math.max(...indices); expected++) {
    if (!indices.includes(expected)) {
      issues.push({
        kind: "missing_link",
        index: expected,
        message: `Missing entry at index ${expected}`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    checked: chain.length,
    issues,
  };
}

export function tamperDetail(
  chain: readonly AuditEntry[],
  index: number,
  detail: string,
): AuditEntry[] {
  return chain.map((entry, i) =>
    i === index ? { ...entry, detail } : { ...entry },
  );
}

export function dropEntry(
  chain: readonly AuditEntry[],
  index: number,
): AuditEntry[] {
  return chain.filter((_, i) => i !== index).map((e) => ({ ...e }));
}

export function seedChain(): AuditEntry[] {
  return appendMany([], [
    {
      action: "LOGIN",
      actor: "clerk.marina",
      resource: "session",
      detail: "Signed in from ledger console",
      at: "2026-03-01T09:00:00.000Z",
    },
    {
      action: "CREATE",
      actor: "clerk.marina",
      resource: "grant:vault-7",
      detail: "Provisional access for auditor.nile",
      at: "2026-03-01T09:04:12.000Z",
    },
    {
      action: "APPROVE",
      actor: "steward.vale",
      resource: "grant:vault-7",
      detail: "Approved with 4h TTL",
      at: "2026-03-01T09:11:40.000Z",
    },
  ]);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
