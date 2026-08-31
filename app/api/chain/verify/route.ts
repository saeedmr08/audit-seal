import { NextResponse } from "next/server";

import { verify } from "@/lib/chain";
import { readChain } from "@/lib/store";

export async function GET() {
  const events = readChain();
  return NextResponse.json(verify(events));
}
