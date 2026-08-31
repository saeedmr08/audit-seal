import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  appendEntry,
  appendMany,
  dropEntry,
  seedChain,
  tamperDetail,
  verify,
} from "../lib/chain";

describe("appendEntry", () => {
  it("seals the first entry to genesis", () => {
    const entry = appendEntry([], {
      action: "LOGIN",
      actor: "a",
      resource: "r",
      detail: "d",
      at: "2026-01-01T00:00:00.000Z",
    });
    expect(entry.index).toBe(0);
    expect(entry.prevHash).toBe(GENESIS_HASH);
    expect(entry.hash).toHaveLength(64);
  });

  it("chains prevHash to the previous entry hash", () => {
    const first = appendEntry([], {
      action: "CREATE",
      actor: "a",
      resource: "r",
      detail: "one",
      at: "2026-01-01T00:00:00.000Z",
    });
    const second = appendEntry([first], {
      action: "UPDATE",
      actor: "a",
      resource: "r",
      detail: "two",
      at: "2026-01-01T00:01:00.000Z",
    });
    expect(second.prevHash).toBe(first.hash);
    expect(second.index).toBe(1);
  });
});

describe("verify", () => {
  it("accepts an intact seeded chain", () => {
    const chain = seedChain();
    const result = verify(chain);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(chain.length);
    expect(result.issues).toHaveLength(0);
  });

  it("detects content tampering via hash mismatch", () => {
    const chain = seedChain();
    const tainted = tamperDetail(chain, 1, "rewritten by attacker");
    const result = verify(tainted);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.kind === "hash_mismatch")).toBe(true);
  });

  it("detects a missing link when an entry is dropped", () => {
    const chain = seedChain();
    const broken = dropEntry(chain, 1);
    const result = verify(broken);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (i) =>
          i.kind === "missing_link" ||
          i.kind === "index_gap" ||
          i.kind === "prev_hash_mismatch",
      ),
    ).toBe(true);
  });

  it("detects a broken prevHash splice", () => {
    const chain = appendMany([], [
      {
        action: "LOGIN",
        actor: "a",
        resource: "s",
        detail: "ok",
        at: "2026-01-01T00:00:00.000Z",
      },
      {
        action: "EXPORT",
        actor: "a",
        resource: "report",
        detail: "csv",
        at: "2026-01-01T00:02:00.000Z",
      },
    ]);
    const spliced = chain.map((e, i) =>
      i === 1 ? { ...e, prevHash: "deadbeef".repeat(8) } : e,
    );
    // Recompute would still fail because prevHash is wrong AND hash no longer matches content
    const result = verify(spliced);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (i) => i.kind === "prev_hash_mismatch" || i.kind === "hash_mismatch",
      ),
    ).toBe(true);
  });

  it("accepts an empty chain", () => {
    expect(verify([]).ok).toBe(true);
  });
});
