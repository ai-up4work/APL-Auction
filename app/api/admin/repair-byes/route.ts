// app/api/admin/repair-byes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { reconcileByeMatches } from "@/lib/tournament/bracketData";

export async function POST(req: NextRequest) {
  let tournamentId: string | undefined;
  try {
    const body = await req.json();
    tournamentId = body?.tournamentId;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!tournamentId) {
    return NextResponse.json({ ok: false, error: "tournamentId is required" }, { status: 400 });
  }

  try {
    const { touched } = await reconcileByeMatches(tournamentId);
    return NextResponse.json({ ok: true, touched });
  } catch (e: any) {
    console.error("repair-byes failed:", e);
    return NextResponse.json({ ok: false, error: e.message ?? String(e) }, { status: 500 });
  }
}