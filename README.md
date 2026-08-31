# AuditSeal

AuditSeal is an append-only, hash-chained audit ledger by **Saeed Rumaneh**. Each event seals the previous hash into its own fingerprint so the chain is tamper-evident. A `verify()` walk detects content rewrites, broken previous-hash links, and missing sequence entries. Events persist to disk through Next.js route handlers.

## Why it exists

Audit logs that can be silently edited are not evidence. AuditSeal shows the core invariant of a sealed ledger:

```text
entry[n].prevHash === entry[n-1].hash
entry[n].hash     === H(index | action | actor | resource | detail | at | prevHash)
```

If either equality fails, the seal is broken.

## Capabilities

- Append synthetic audit events (login, create, approve, export, …)
- Hash-chain each entry to its predecessor (genesis for the first)
- Verify the full chain and surface issue kinds
- Simulate tampering and missing links in the UI (local view only)
- Persist sealed events in `data/chain.json` (gitignored)

## API

| Method | Path | Behavior |
|---|---|---|
| GET | `/api/chain` | Load `{ events }` |
| POST | `/api/chain` | Body `{ action, actor }` (+ optional `resource`, `detail`) → append & seal |
| GET | `/api/chain/verify` | Walk disk chain and return verify result |

## Development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Append an entry, restart — the chain is still sealed on disk.

```bash
npm test
npm run typecheck
npm run build
```

## Complete product flows

1. Stamp a new entry (**Append & seal**) — it appears in the chain with prev/hash fingerprints.
2. Click **Rewrite entry #1** — the local seal breaks (disk is untouched).
3. Click **Reload from disk** — the seal is intact again from `data/chain.json`.

## Security posture

Demonstration only. See [SECURITY.md](SECURITY.md).

## License

MIT © 2026 Saeed Rumaneh
