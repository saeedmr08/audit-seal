import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { seedChain, type AuditEntry } from "./chain";

const DATA_FILE = path.join(process.cwd(), "data", "chain.json");

type StoreFile = {
  events: AuditEntry[];
};

export function readChain(): AuditEntry[] {
  try {
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as StoreFile;
    if (!Array.isArray(raw.events)) throw new Error("invalid");
    return raw.events;
  } catch {
    const events = seedChain();
    writeChain(events);
    return events;
  }
}

export function writeChain(events: AuditEntry[]): void {
  mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, `${JSON.stringify({ events }, null, 2)}\n`);
}
