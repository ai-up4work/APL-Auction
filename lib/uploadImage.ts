// lib/uploadImage.ts
// Client-side helper for uploading team logos / player photos / auction
// logos to Supabase Storage via the server-side /api/uploads route (see
// app/api/uploads/route.ts). We go through that API rather than uploading
// directly from the browser so the Supabase Storage bucket's INSERT policy
// can stay locked to the service role — the anon/browser client never needs
// storage write access.

export interface UploadResult {
  url:  string; // public URL — store this directly on teams.logo / players.img / session.auctionLogo
  path: string; // storage path — keep this if you want to support deleting/replacing later
}

export type UploadKind = "team" | "player" | "logo" | "tournament" | "organization" | "match" | "award";

// Kinds in this set map to the route's LEGACY branch — sent as
// auctionId + kind, unchanged from before. Everything else maps to the
// route's newer multi-context branch (context + contextId + subType),
// since normalizeLegacyKind() in /api/uploads only ever accepts
// team/player/logo (and their string variants) — passing anything else
// as `kind` there (e.g. "match") always 400s.
const LEGACY_KINDS = new Set<UploadKind>(["team", "player", "logo"]);

// Default subType per new-style kind, used when the caller doesn't pass
// one explicitly. Matches what the route's context branches expect —
// see the path templates in app/api/uploads/route.ts.
const DEFAULT_SUBTYPE: Partial<Record<UploadKind, string>> = {
  tournament: "banner",
  organization: "logo",
  match: "banner",
  award: "award-images",
};

// Maps our UploadKind to the route's `context` value. Only relevant for
// non-legacy kinds.
const CONTEXT_FOR_KIND: Partial<Record<UploadKind, string>> = {
  tournament: "tournament",
  organization: "organization",
  match: "match",
  award: "award",
};

export interface UploadOptions {
  // Overrides the default subType for this kind (e.g. "player-images"
  // instead of "banner" for a match-context upload).
  subType?: string;
  // Only read when kind === "award" — forwarded as awardId to the route.
  awardId?: string;
}

export async function uploadAuctionImage(
  // For legacy kinds (team/player/logo) this is the auction id, exactly
  // as before. For new-style kinds (tournament/organization/match/award)
  // this is that entity's own id (tournamentId/orgId/matchId/tournamentId
  // respectively) — same parameter, different meaning depending on kind,
  // so every existing call site keeps working unchanged.
  auctionOrContextId: string,
  kind: UploadKind,
  file: File,
  options?: UploadOptions
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (LEGACY_KINDS.has(kind)) {
    formData.append("auctionId", auctionOrContextId);
    formData.append("kind", kind);
  } else {
    const context = CONTEXT_FOR_KIND[kind];
    if (!context) {
      throw new Error(`uploadAuctionImage: no context mapping for kind "${kind}"`);
    }
    formData.append("context", context);
    formData.append("contextId", auctionOrContextId);
    formData.append("subType", options?.subType ?? DEFAULT_SUBTYPE[kind] ?? "default");
    if (context === "award" && options?.awardId) {
      formData.append("awardId", options.awardId);
    }
  }

  const res = await fetch("/api/uploads", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error ?? `Upload failed (${res.status})`);
  }

  return data as UploadResult;
}

export async function deleteAuctionImage(path: string): Promise<void> {
  const res = await fetch("/api/uploads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? `Delete failed (${res.status})`);
  }
}

// Convenience wrappers — unchanged, still legacy team/player/logo
export const uploadTeamLogo    = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "team",   file);
export const uploadPlayerPhoto = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "player", file);
export const uploadAuctionLogo = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "logo",   file);