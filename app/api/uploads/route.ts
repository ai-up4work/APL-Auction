// app/api/uploads/route.ts
//
// Handles image uploads for the auction app. Used for both:
//   - Team logos   → {auctionId}/Auction-Images/team-images/{filename}
//   - Player photos → {auctionId}/Auction-Images/player-images/{filename}
//
// Runs server-side so we can use the Supabase SERVICE ROLE key — this lets
// the bucket itself stay locked down (no public/anon INSERT policy needed)
// while still allowing uploads from the admin UI. The bucket should be
// PUBLIC for read (so the stored URLs work directly in <img>/<Image>),
// but write access should NOT be granted to the anon key — that's the
// whole point of doing this server-side.
//
// Required env vars (server-only, do NOT prefix with NEXT_PUBLIC_):
//   SUPABASE_SERVICE_ROLE_KEY
// Already-existing public env vars reused:
//   NEXT_PUBLIC_SUPABASE_URL

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const { supabase } = await import("@/lib/supabse");

const BUCKET = "Auction-Images";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !supabaseAnon) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars"
    );
  }
  return createClient(url, supabaseAnon, { auth: { persistSession: false } });
}

function safeFileName(originalName: string): string {
  const ext = (originalName.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = crypto.randomUUID();
  return `${rand}.${ext || "png"}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file      = formData.get("file");
    const auctionId = formData.get("auctionId");
    const kind      = formData.get("kind"); // "team" | "player"

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof auctionId !== "string" || !auctionId.trim()) {
      return NextResponse.json({ error: "Missing auctionId" }, { status: 400 });
    }
    if (kind !== "team" && kind !== "player") {
      return NextResponse.json({ error: "kind must be 'team' or 'player'" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.` },
        { status: 400 }
      );
    }

    const folder   = kind === "team" ? "team-images" : "player-images";
    const fileName = safeFileName(file.name);
    const path     = `${auctionId}/Auction-Images/${folder}/${fileName}`;

    const supabase = admin();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      url:  publicUrlData.publicUrl,
      path,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown upload error" }, { status: 500 });
  }
}

// Optional: delete an image (e.g. when replacing a logo/photo).
// Body: { path: string }  — the storage path returned by POST above.
export async function DELETE(req: NextRequest) {
  try {
    const { path } = await req.json();
    if (typeof path !== "string" || !path.trim()) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }

    const supabase = admin();
    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) {
      return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown delete error" }, { status: 500 });
  }
}