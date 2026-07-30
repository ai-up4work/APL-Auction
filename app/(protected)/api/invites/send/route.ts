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

    // Send users straight to our own accept-invite page. Supabase's invite
    // link logs the person in (or lets them set a password) and then
    // forwards them to redirectTo, where /invite/[token]/page.tsx picks up
    // and calls acceptInvite(token, user.id, user.email).
    const redirectTo = `${req.nextUrl.origin}/invite/${token}`;

    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      // password_set: false marks this as a fresh, passwordless invite account.
      // /invite/[token]/page.tsx checks this flag and makes the person set a
      // password before finishing — otherwise they'd have no way to sign back
      // in later. It flips to true via supabase.auth.updateUser once they do.
      data: { org_id: orgId, role, invite_token: token, password_set: false },
    });

    if (error) {
      // The most common failure here is "User already registered" — Supabase
      // only sends this particular email to brand-new auth users. The invite
      // row itself is unaffected either way; the admin can still copy the
      // /invite/[token] link by hand for someone who already has an account.
      console.error("inviteUserByEmail failed:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Anything unexpected (missing env vars, a bad service role key, a
    // network failure reaching Supabase) previously crashed this route
    // before it could return JSON at all — the client then saw an empty
    // 500 body and choked trying to parse it. Catching here guarantees a
    // real, readable error message reaches the browser console instead.
    const message = err instanceof Error ? err.message : "Unknown server error.";
    console.error("send-invite route crashed:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}