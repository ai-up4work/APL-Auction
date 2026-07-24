export const CONFIG_STEPS = [
  "teams", "players", "rules", "session"
] as const;

export type AuctionStatus = "setup" | "live" | "paused" | "completed";