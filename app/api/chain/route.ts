import { NextResponse } from "next/server";

import {
  appendEntry,
  type AuditAction,
  type AuditEventInput,
} from "@/lib/chain";
import { readChain, writeChain } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ events: readChain() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    action?: AuditAction;
    actor?: string;
    resource?: string;
    detail?: string;
  };

  if (!body.action || !body.actor?.trim()) {
    return NextResponse.json(
      { error: "action and actor required" },
      { status: 400 },
    );
  }

  const input: AuditEventInput = {
    action: body.action,
    actor: body.actor.trim(),
    resource: body.resource?.trim() || "resource",
    detail: body.detail?.trim() || "",
  };

  const chain = readChain();
  const entry = appendEntry(chain, input);
  const next = [...chain, entry];
  writeChain(next);
  return NextResponse.json({ entry, events: next }, { status: 201 });
}
