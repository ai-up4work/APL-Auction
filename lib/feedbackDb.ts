import { supabase } from "./supabase";

export interface FeedbackPayload {
  auctionId:      string;
  teamId?:        string;
  role:           "owner" | "auctioneer" | "spectator";
  trigger:        "paused" | "completed";
  rating?:        number;
  whatWentWell?:  string;
  whatToImprove?: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const { error } = await supabase.from("feedback").insert({
    auction_id:      payload.auctionId,
    team_id:         payload.teamId ?? null,
    role:            payload.role,
    trigger:         payload.trigger,
    rating:          payload.rating ?? null,
    what_went_well:  payload.whatWentWell  ?? null,
    what_to_improve: payload.whatToImprove ?? null,
  });

  if (error) throw new Error(error.message);
}

export async function hasFeedback(
  auctionId: string,
  role: string,
  teamId?: string
): Promise<boolean> {
  let query = supabase
    .from("feedback")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("role", role)
    .limit(1);

  if (teamId) query = query.eq("team_id", teamId);

  const { data } = await query;
  return (data?.length ?? 0) > 0;
}