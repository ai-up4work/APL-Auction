// app/api/uploads/route.ts
//
// Handles image uploads for the entire application. Supports multiple contexts:
//   - Auction Images:     {auctionId}/Auction-Images/{team|player}-images/{filename}
//   - Tournament:         tournaments/{tournamentId}/banner/{filename}
//   - Tournament Logo:    tournaments/{tournamentId}/logo/{filename}
//   - Organization:       organizations/{orgId}/logo/{filename}
//   - Awards:             tournaments/{tournamentId}/awards/{awardId}/{filename}
//   - Match Player:       matches/{matchId}/player-images/{filename}
//
// Runs server-side so we can use the Supabase SERVICE ROLE key — this lets
// the bucket itself stay locked down (no public/anon INSERT/DELETE policy
// needed) while still allowing uploads/deletes from the admin UI. The bucket
// should be PUBLIC for read (so stored URLs work directly in <img>/<Image>),
// but write access should NOT be granted to the anon key.
//
// Required env vars (server-only, do NOT prefix with NEXT_PUBLIC_):
//   SUPABASE_SERVICE_ROLE_KEY
// Already-existing public env vars reused:
//   NEXT_PUBLIC_SUPABASE_URL
//
// AUTOMATIC OLD-IMAGE CLEANUP:
// Two complementary mechanisms:
//
// 1. `oldImageUrl` / `oldPath` (optional form fields) — the client already
//    holds the current image's URL as its `value` state before uploading a
//    replacement. Pass it along and the API deletes exactly that file
//    after the new upload succeeds. This works for EVERY context,
//    including auction team-images / player-images / match player-images,
//    since it identifies the specific file being replaced rather than
//    guessing based on folder contents.
//
// 2. Folder-clear fallback — for contexts where a folder inherently holds
//    exactly one image (tournament banner/logo, organization logo, award
//    image, auction logo), the API also wipes that folder before writing
//    the new file. This is a safety net for callers that haven't been
//    updated to send oldImageUrl yet; it's only safe because nothing else
//    is ever stored alongside it in that folder. It is NOT applied to
//    team-images / player-images / match player-images, since those
//    folders hold many different entities' images together — clearing
//    them would delete images that were never meant to be replaced.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "Valiant-League-Images";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

// Context/subType combinations where the destination folder is guaranteed
// to hold exactly one logical image, so it's safe to clear-then-write.
// (Legacy auctionId+kind team/player folders and match player-images are
// deliberately NOT here — see comment above.)
const SINGLETON_FOLDER_TYPES = new Set(["tournament", "organization", "award"]);

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function safeFileName(originalName: string): string {
  const ext = (originalName.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rand = crypto.randomUUID();
  return `${rand}.${ext || "png"}`;
}

// Given either a raw storage path ("auctionId/Auction-Images/logos/xyz.png",
// assumed to live in the default BUCKET) or a full Supabase public URL
// (which may point at ANY bucket, e.g. an older "Auction Images" bucket
// from before this app standardized on BUCKET), resolve which bucket +
// path to operate on. Returns null if it can't confidently resolve one —
// never guess, since a wrong path could delete an unrelated file.
function resolveStorageRef(raw: unknown): { bucket: string; path: string } | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();

  if (!/^https?:\/\//i.test(value)) {
    // Bare path, no bucket info available — assume the default bucket.
    return { bucket: BUCKET, path: value.replace(/^\/+/, "") };
  }

  // Supabase public storage URLs look like:
  //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path...>
  // Capture the bucket name dynamically rather than assuming BUCKET, so
  // this also resolves images sitting in older/differently-named buckets.
  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);
  if (idx === -1) return null;

  const rest = value.slice(idx + marker.length); // "<bucket>/<path...>"
  const slashIdx = rest.indexOf("/");
  if (slashIdx === -1) return null;

  const bucket = decodeURIComponent(rest.slice(0, slashIdx));
  const path = decodeURIComponent(rest.slice(slashIdx + 1));
  if (!bucket || !path) return null;

  return { bucket, path };
}

// Normalizes whatever variant of "kind" a caller sends (old or new naming)
// into exactly "team" | "player" | "logo" for the legacy auctionId branch.
function normalizeLegacyKind(raw: unknown): "team" | "player" | "logo" | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();

  if (v === "team" || v === "team-images" || v === "team-image" || v === "team-logo" || v === "teams") {
    return "team";
  }
  if (v === "player" || v === "player-images" || v === "player-image" || v === "player-photo" || v === "players") {
    return "player";
  }
  if (v === "logo" || v === "logos") {
    return "logo";
  }
  return null;
}

// Deletes every existing file directly inside `folder`. Only ever called
// for folders known to hold a single logical image (see
// SINGLETON_FOLDER_TYPES). Best-effort: a listing/delete failure here
// should not block the new upload from proceeding.
async function clearFolder(supabase: ReturnType<typeof admin>, folder: string) {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder);
  if (error || !data || data.length === 0) return;

  // list() can return a placeholder entry for "empty" folders; filter to
  // real files only (they have an id in supabase-js's storage response).
  const toRemove = data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
  if (toRemove.length > 0) {
    await supabase.storage.from(BUCKET).remove(toRemove);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file      = formData.get("file");
    const auctionId = formData.get("auctionId");
    const kindRaw   = formData.get("kind"); // "team" | "player" | "logo" (legacy) — normalized below

    // New multi-context fields (take precedence over legacy auctionId)
    const context   = formData.get("context"); // "auction" | "tournament" | "organization" | "award" | "match"
    const contextId = formData.get("contextId"); // auctionId, tournamentId, orgId, matchId, etc.
    const subType   = formData.get("subType"); // "banner" | "logo" | "team-images" | "player-images" | "award-images" etc.

    // Precise old-image reference, when the caller has one (this is the
    // component's current `value` — see comment at top of file). May
    // point at a different bucket than BUCKET (e.g. older images).
    const oldRef =
      resolveStorageRef(formData.get("oldPath")) ??
      resolveStorageRef(formData.get("oldImageUrl"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
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

    let folder: string;
    let clearOldBeforeUpload = false;

    // Handle new multi-context API
    if (context && contextId) {
      const contextType = (context as string).toLowerCase();
      const finalSubType = (subType as string || "default").toLowerCase();

      if (!["auction", "tournament", "organization", "award", "match"].includes(contextType)) {
        return NextResponse.json({ error: "Invalid context type" }, { status: 400 });
      }

      if (contextType === "auction") {
        folder = `${contextId}/Auction-Images/${finalSubType}`;
        // Multi-item folder (many teams/players share it) — do NOT clear.
      } else if (contextType === "tournament") {
        folder = `tournaments/${contextId}/${finalSubType}`;
        clearOldBeforeUpload = true;
      } else if (contextType === "organization") {
        folder = `organizations/${contextId}/${finalSubType}`;
        clearOldBeforeUpload = true;
      } else if (contextType === "award") {
        const awardId = formData.get("awardId") as string || "default";
        folder = `tournaments/${contextId}/awards/${awardId}`;
        clearOldBeforeUpload = true;
      } else if (contextType === "match") {
        folder = `matches/${contextId}/${finalSubType}`;
        // Multi-item folder (many players share it) — do NOT clear.
      } else {
        return NextResponse.json({ error: "Invalid context" }, { status: 400 });
      }

      clearOldBeforeUpload = clearOldBeforeUpload && SINGLETON_FOLDER_TYPES.has(contextType);
    } else if (auctionId) {
      // Legacy API (backward compatibility)
      if (typeof auctionId !== "string" || !auctionId.trim()) {
        return NextResponse.json({ error: "Missing auctionId" }, { status: 400 });
      }

      const kind = normalizeLegacyKind(kindRaw);
      if (!kind) {
        return NextResponse.json(
          { error: "kind must be 'team', 'player', or 'logo' (or a recognized variant like 'team-images', 'player-photo', etc.)" },
          { status: 400 }
        );
      }

      if (kind === "logo") {
        // A single auction logo — safe to treat as singleton.
        folder = `${auctionId}/Auction-Images/logos`;
        clearOldBeforeUpload = true;
      } else {
        // team-images / player-images hold many entities — do NOT clear.
        const legacyFolder = kind === "team" ? "team-images" : "player-images";
        folder = `${auctionId}/Auction-Images/${legacyFolder}`;
      }
    } else {
      return NextResponse.json({ error: "Missing upload context (context + contextId) or legacy auctionId" }, { status: 400 });
    }

    const supabase = admin();

    if (clearOldBeforeUpload) {
      await clearFolder(supabase, folder);
    }

    const fileName = safeFileName(file.name);
    const path = `${folder}/${fileName}`;
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

    // Best-effort precise cleanup: delete the exact old file the caller
    // told us about, from whichever bucket it's actually in (older images
    // may live in a different bucket than BUCKET), as long as it isn't
    // the file we just wrote. This runs AFTER the new upload succeeds, so
    // a failure here never leaves the user without an image — it just
    // leaves an orphaned file.
    let oldImageDeleted = false;
    let oldImageDeleteError: string | undefined;

    if (oldRef && !(oldRef.bucket === BUCKET && oldRef.path === path)) {
      const { error: deleteErr } = await supabase.storage.from(oldRef.bucket).remove([oldRef.path]);
      if (deleteErr) {
        oldImageDeleteError = deleteErr.message;
      } else {
        oldImageDeleted = true;
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: publicUrlData.publicUrl,
      url: publicUrlData.publicUrl,
      path,
      oldImageCleared: clearOldBeforeUpload,
      ...(oldRef ? { oldImageDeleted, oldImageDeleteError } : {}),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown upload error" }, { status: 500 });
  }
}

// Delete an image directly (e.g. the field's "remove image" button).
// Body: { path: string } | { imageUrl: string } — either the storage path
// (assumed in the default bucket) or the full public URL (resolved to
// whichever bucket it actually lives in — handles older images stored in
// a differently-named bucket) both work.
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const ref = resolveStorageRef(body?.path) ?? resolveStorageRef(body?.imageUrl);

    if (!ref) {
      return NextResponse.json({ error: "Missing or unresolvable path/imageUrl" }, { status: 400 });
    }

    const supabase = admin();
    const { error } = await supabase.storage.from(ref.bucket).remove([ref.path]);

    if (error) {
      return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown delete error" }, { status: 500 });
  }
}