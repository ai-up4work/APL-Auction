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

export type UploadKind = "team" | "player" | "logo";

export async function uploadAuctionImage(
  auctionId: string,
  kind:      UploadKind,
  file:      File
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("auctionId", auctionId);
  formData.append("kind", kind);

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

// Convenience wrappers
export const uploadTeamLogo    = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "team",   file);
export const uploadPlayerPhoto = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "player", file);
export const uploadAuctionLogo = (auctionId: string, file: File) => uploadAuctionImage(auctionId, "logo",   file);