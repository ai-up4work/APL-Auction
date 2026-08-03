// app/api/invites/send/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

interface SendInviteBody {
  email: string;
  token: string;
  orgId: string;
  role: string;
}

export async function POST(req: NextRequest) {
  let body: SendInviteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
  }

  const { email, token, orgId, role } = body;
  if (!email || !token || !orgId || !role) {
    return NextResponse.json({ ok: false, error: "Missing email, token, orgId, or role." }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();
    const redirectTo = `${req.nextUrl.origin}/invite/${token}`;

    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { org_id: orgId, role, invite_token: token, password_set: false },
    });

    if (error) {
      // Pull every useful field explicitly — Supabase's AuthError (and Error
      // objects generally) serialize to {} via JSON.stringify because their
      // properties aren't own-enumerable, so grabbing them by name here is
      // required or the client only ever sees an empty object.
      const details = {
        message: error.message ?? "Unknown Supabase error",
        status: (error as any).status ?? null,
        code: (error as any).code ?? null,
        name: error.name ?? null,
      };
      console.error("inviteUserByEmail failed:", details);
      return NextResponse.json({ ok: false, error: details.message, details }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-invite route crashed:", message, err);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}