"use client";

export type DemoPlayer = {
  id: number;
  supabaseId: string;
  name: string;
  role: "Batsman" | "Bowler" | "All-rounder" | "Wicket Keeper";
  origin: "Local" | "Overseas";
  country: string;
  img: string;
  price: number;
  capped: boolean;
  reentryCount: number;
  isUnsoldFinal: boolean;
};

export type DemoTeam = {
  id: number;
  supabaseId: string;
  code: string;
  name: string;
  color: string;
  logo: string;
  roster: number;
};

export type DemoBid = {
  id: string;
  lotId: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  teamColor: string;
  amount: number;
  placedAt: number;
};

export type DemoLotStatus = "shuffling" | "pending" | "sold" | "unsold";

export type DemoLot = {
  id: string;
  playerId: string;
  playerName: string;
  playerImg: string;
  playerRole: string;
  playerCountry: string;
  basePrice: number;
  currentBid: number;
  winningTeamId: string | null;
  winningTeamCode: string | null;
  lotNumber: number;
  status: DemoLotStatus;
  startedAt: number | null;
};

export type CursorState = {
  panel: string | null;
  label: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
};

// ── Shuffle-reel state, consumed by <ShuffleOverlay /> ─────────────────
export type ShuffleState = {
  active: boolean;
  pool: DemoPlayer[];
  index: number;
  target: DemoPlayer | null;
};

// ── Re-entry round outcomes, mirrors the production /lib/auctionLiveDb
// startReentryRound() return shape so both UIs can share the same
// reasonToMessage()-style copy. ───────────────────────────────────────
export type ReentryReason =
  | "round_limit_reached"
  | "all_squads_full"
  | "no_team_can_afford"
  | "no_unsold_players";

export type ReentryResult =
  | { started: true; round: number; requeued: number }
  | { started: false; reason: ReentryReason; finalized: number };

const TIMER_SECONDS = 12;
const TICK_MS = 100;

// How long to hold on the settled player (status still "shuffling") before
// flipping the lot to "pending" and letting bidding / the watch panel go
// live. Gives owners + spectators a clean beat to actually see who got
// revealed instead of snapping straight into bid mode.
const REVEAL_HOLD_MS = 1000;
// Shuffle overlay itself stays mounted a little past the hold so the
// crossfade out doesn't feel abrupt.
const SHUFFLE_HIDE_MS = REVEAL_HOLD_MS + 300;
// Beat between "time's up" (clock hits zero) and the auto sold/unsold
// resolution — mirrors a real auctioneer's "going once, going twice" pause
// instead of snapping straight to the stamp the instant the clock dies.
const AUTO_RESOLVE_DELAY_MS = 1300;

// How many extra passes an unsold player gets before being finalized —
// kept small since the demo pool is only 5 players deep.
const UNSOLD_REENTRY_ROUNDS = 1;

const PLAYER_POOL: Omit<DemoPlayer, "id" | "supabaseId" | "reentryCount" | "isUnsoldFinal">[] = [
  { name: "Marcus Vane", role: "All-rounder", origin: "Overseas", country: "Australia", img: "", price: 1500, capped: true },
  { name: "Elena Rodas", role: "Batsman", origin: "Overseas", country: "South Africa", img: "", price: 1200, capped: false },
  { name: "Rohan Sharma", role: "Bowler", origin: "Local", country: "India", img: "", price: 2000, capped: true },
  { name: "Jaxon Kade", role: "Wicket Keeper", origin: "Overseas", country: "England", img: "", price: 900, capped: false },
  { name: "Li Wei", role: "Batsman", origin: "Overseas", country: "Sri Lanka", img: "", price: 1100, capped: false },
];

function makeTeams(): DemoTeam[] {
  return [
    { id: 1, supabaseId: "tA", code: "CSK", name: "Chennai Sabers", color: "#f5a623", logo: "", roster: 0 },
    { id: 2, supabaseId: "tB", code: "MI", name: "Mumbai Marauders", color: "#3b8bd4", logo: "", roster: 0 },
  ];
}

function makePlayers(): DemoPlayer[] {
  return PLAYER_POOL.map((p, i) => ({
    ...p,
    id: i + 1,
    supabaseId: `p${i + 1}`,
    reentryCount: 0,
    isUnsoldFinal: false,
  }));
}

export type DemoAuction = {
  auctionId: string;
  status: "live" | "paused" | "completed";
  teams: DemoTeam[];
  players: DemoPlayer[];
  rules: {
    totalPoints: number;
    teamSize: number;
    basePrice: number;
    tiers: { from: number; to: number | null; increment: number }[];
    // How many re-entry passes an unsold player is allowed before being
    // finalized as unsold-for-good. Mirrors the production auction's
    // `unsoldReentryRounds` rule.
    unsoldReentryRounds: number;
  };
  session: {
    auctionName: string;
    auctionLogo: string;
    timerSeconds: number;
  };
};

export type DemoTeamPurse = { remaining: number; roster: number };

// Panel keys this model / page know about. Kept as a plain union (not an
// enum) so both demoOrchestrator.ts and page.tsx can keep using bare
// strings without importing a type they don't need.
export type DemoPanelKey = "auctioneer" | "watch" | "ownerA" | "ownerB";

type Snapshot = {
  auction: DemoAuction;
  currentLot: DemoLot | null;
  bidHistory: DemoBid[];
  completedLots: DemoLot[];
  lotNumber: number;
  teamPurses: Record<string, DemoTeamPurse>;
  clockPct: number;
  isLocked: boolean;
  shuffleReady: boolean;
  cursors: Record<string, CursorState>;
  // Zero, one, or several panels can be spotlighted at once. Empty array
  // means "no spotlight" → caller falls back to the neutral overview grid.
  activePanels: string[];
  syncPanels: string[];
  narratorText: string;
  shuffle: ShuffleState;
  // "demo": demoOrchestrator drives cursors/clicks/timing (spectator mode).
  // "interactive": nobody is puppeted — real clicks on the real buttons
  // drive everything.
  mode: "demo" | "interactive";
  // When true, the model decides `activePanels` itself on every state
  // transition (shuffle → bidding open → resolved). A manual chip click
  // sets this false so the person's choice sticks; the next shuffle, or
  // an explicit "resume auto" call, turns it back on.
  autoFocusEnabled: boolean;
  // Which owner the bidding-open beat should spotlight, so a manual choice
  // via the stepper (focusOwner) carries forward to the next lot instead
  // of always resetting to Owner A.
  lastOwnerFocus: "ownerA" | "ownerB";
  // Players who went unsold and are still eligible for a re-entry pass —
  // kept separate from `auction.players` (the not-yet-called queue) so a
  // lot resolving unsold doesn't just vanish the player from the demo.
  unsoldPlayers: DemoPlayer[];
  // Players who went unsold and then failed/exhausted re-entry — out for
  // good, kept around only so a completion summary can name them.
  finalizedUnsoldPlayers: DemoPlayer[];
  roundInfo: { current: number; limit: number };
};

function initialSnapshot(): Snapshot {
  const teams = makeTeams();
  const totalPoints = 50000;
  const purses: Record<string, DemoTeamPurse> = {};
  teams.forEach((t) => (purses[t.supabaseId] = { remaining: totalPoints, roster: 0 }));
  return {
    auction: {
      auctionId: "demo",
      status: "live",
      teams,
      players: makePlayers(),
      rules: {
        totalPoints,
        teamSize: 16,
        basePrice: 500,
        tiers: [
          { from: 500, to: 1000, increment: 100 },
          { from: 1000, to: 3000, increment: 200 },
          { from: 3000, to: 6000, increment: 500 },
          { from: 6000, to: null, increment: 1000 },
        ],
        unsoldReentryRounds: UNSOLD_REENTRY_ROUNDS,
      },
      session: {
        auctionName: "Valiant League · Live Demo",
        auctionLogo: "",
        timerSeconds: TIMER_SECONDS,
      },
    },
    currentLot: null,
    bidHistory: [],
    completedLots: [],
    lotNumber: 0,
    teamPurses: purses,
    clockPct: 100,
    isLocked: false,
    shuffleReady: true,
    cursors: {},
    activePanels: [],
    syncPanels: [],
    narratorText: "",
    shuffle: { active: false, pool: [], index: 0, target: null },
    mode: "demo",
    autoFocusEnabled: true,
    lastOwnerFocus: "ownerA",
    unsoldPlayers: [],
    finalizedUnsoldPlayers: [],
    roundInfo: { current: 0, limit: UNSOLD_REENTRY_ROUNDS },
  };
}

export function getNextBidAmount(currentBid: number, tiers: DemoAuction["rules"]["tiers"]): number {
  const tier = tiers.find((t) => currentBid >= t.from && (t.to === null || currentBid < t.to)) ?? tiers[tiers.length - 1];
  return currentBid + (tier?.increment ?? 100);
}

export function fmtPts(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString();
}

class DemoModelImpl {
  private snap: Snapshot = initialSnapshot();
  private listeners = new Set<() => void>();
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private uidCounter = 0;
  private syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  private shuffleTicker: ReturnType<typeof setTimeout> | null = null;
  private shuffleHideTimer: ReturnType<typeof setTimeout> | null = null;
  // Holds the "settled but not yet live" pause after the shuffle stops.
  private revealDelayTimer: ReturnType<typeof setTimeout> | null = null;
  // Fires the automatic sold/unsold resolution once the clock hits zero.
  private autoResolveTimer: ReturnType<typeof setTimeout> | null = null;

  private emit() {
    this.listeners.forEach((l) => l());
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  getSnapshot(): Snapshot {
    return this.snap;
  }
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.emit();
  }
  private uid(prefix: string) {
    this.uidCounter += 1;
    return `${prefix}-${this.uidCounter}`;
  }

  // ── Mode ─────────────────────────────────────────────────────────────
  setMode(mode: Snapshot["mode"]) {
    this.set({ mode, autoFocusEnabled: true });
  }

  // ── Auto-focus ───────────────────────────────────────────────────────
  /** Called at the handful of transitions that should always reclaim the
   * spotlight even if the person manually pinned a panel via a chip or the
   * owner stepper — shuffle starting, bidding opening, and the lot
   * resolving. Those are "the director cuts the broadcast" moments; a
   * stale manual pin (e.g. an owner panel left up from before a reshuffle)
   * shouldn't leave someone staring at the wrong screen while the pool
   * reshuffles or a new player's bid clock is running. Manual pins still
   * work freely *between* these checkpoints (e.g. flipping owners mid-bid
   * via the stepper) — this only fires at the four checkpoints above, not
   * on every single state change. Scoped to interactive mode — demo mode's
   * own scripted focus steps (via setActivePanel) remain the only thing
   * driving the spotlight there. */
  private forceFocus(panels: DemoPanelKey[]) {
    if (this.snap.mode !== "interactive") return;
    this.set({ activePanels: panels });
  }

  /** Chip clicks in interactive mode call this — it's a deliberate human
   * choice, so it takes over from auto-focus until the next transition (or
   * until resumeAutoFocus() is called). */
  toggleActivePanel(panel: string) {
    const isOnlyThisOne = this.snap.activePanels.length === 1 && this.snap.activePanels[0] === panel;
    this.set({
      autoFocusEnabled: false,
      activePanels: isOnlyThisOne ? [] : [panel],
    });
  }

  /** Interactive-mode "shuffle down" control. Bidding only ever spotlights
   * one owner at a time (alongside the auctioneer) — this jumps straight to
   * the requested owner, swapping out whichever owner (if any) was showing.
   * Used by both the header "Show Owner B →" button and the right-side dot
   * switcher. Marked as a manual pin (same as toggleActivePanel) so it
   * sticks until the lot resolves or the person hits resume-auto, instead
   * of getting silently reverted by the next auto-focus transition.
   * Also records the choice in lastOwnerFocus so the *next* lot's
   * bidding-open beat (and resumeAutoFocus) reopens on this same owner
   * instead of always resetting to Owner A. */
  focusOwner(owner: "ownerA" | "ownerB") {
    const panels = this.snap.activePanels;
    if (panels.includes(owner)) {
      this.set({ lastOwnerFocus: owner });
      return; // already showing this one
    }
    const other = owner === "ownerA" ? "ownerB" : "ownerA";
    const next = panels.includes(other)
      ? panels.map((p) => (p === other ? owner : p))
      : [...panels.filter((p) => p !== "ownerA" && p !== "ownerB"), owner];
    this.set({ autoFocusEnabled: false, activePanels: next, lastOwnerFocus: owner });
  }

  /** Hands focus control back to the model and immediately re-applies the
   * right spotlight for whatever's happening right now, rather than
   * waiting for the next transition to fire. */
  resumeAutoFocus() {
    this.set({ autoFocusEnabled: true });
    const lot = this.snap.currentLot;
    if (!lot) this.set({ activePanels: [] });
    else if (lot.status === "shuffling") this.set({ activePanels: ["auctioneer", "watch"] });
    else if (lot.status === "pending") this.set({ activePanels: ["auctioneer", this.snap.lastOwnerFocus] });
    else this.set({ activePanels: ["auctioneer", "watch"] });
  }

  // ── All-panel "something just happened" flourish ────────────────────
  // Used by placeBid / hammerSold / markUnsold / startShuffle / reentry so
  // the pulse ring + narrator caption fire the same way regardless of
  // whether a bot script or a real click triggered the state change.
  private broadcastEvent(text: string, panels: DemoPanelKey[] = ["auctioneer", "watch", "ownerA", "ownerB"]) {
    this.setNarrator(text);
    this.pulsePanels(panels);
  }

  // ── Clock ──────────────────────────────────────────────────────────────
  // Factored out of startClock so pause()/resume() can stop and restart
  // the interval without re-running the "reset to 100%" side effect that
  // startClock() does for a brand-new lot.
  private clockTick = () => {
    const dec = 100 / ((TIMER_SECONDS * 1000) / TICK_MS);
    const next = Math.max(0, this.snap.clockPct - dec);
    const justLocked = next <= 0 && !this.snap.isLocked;
    this.set({ clockPct: next, isLocked: next <= 0 });
    if (justLocked) this.scheduleAutoResolve();
  };
  private startClock() {
    this.stopClock();
    this.set({ clockPct: 100, isLocked: false });
    this.clockTimer = setInterval(this.clockTick, TICK_MS);
  }
  private stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }
  /** Restarts the interval from whatever clockPct currently is, instead of
   * resetting to 100% — used by resume() so unpausing a mid-countdown lot
   * picks up where it left off rather than restarting the clock. */
  private resumeClockFromCurrent() {
    this.stopClock();
    this.clockTimer = setInterval(this.clockTick, TICK_MS);
  }

  // ── Time's up → resolve automatically ───────────────────────────────
  // If someone's leading when the clock hits zero, the lot is sold to them.
  // If nobody ever bid, it goes unsold. Fires on its own — no manual
  // "Hammer Sold" click required, though that button still works if the
  // auctioneer wants to close it early (see cancelAutoResolve below).
  private scheduleAutoResolve() {
    const lot = this.snap.currentLot;
    if (!lot) return;
    const lotId = lot.id;
    if (this.autoResolveTimer) clearTimeout(this.autoResolveTimer);
    this.autoResolveTimer = setTimeout(() => {
      const current = this.snap.currentLot;
      // Bail if the lot moved on already — e.g. the auctioneer manually
      // hammered it before this fired, or a reset happened mid-countdown.
      if (!current || current.id !== lotId || current.status !== "pending") return;
      if (current.winningTeamId) this.hammerSold();
      else this.markUnsold();
    }, AUTO_RESOLVE_DELAY_MS);
  }
  private cancelAutoResolve() {
    if (this.autoResolveTimer) clearTimeout(this.autoResolveTimer);
    this.autoResolveTimer = null;
  }

  /** Freezes the bidding clock in place (if one is running) and flags the
   * auction as paused. Used by the header pause control — previously this
   * only flipped the status label while the clockTimer kept ticking
   * silently underneath, so a "paused" lot could still resolve itself. */
  pause() {
    this.stopClock();
    this.set({ auction: { ...this.snap.auction, status: "paused" } });
  }
  /** Un-freezes the clock from its current percentage (not a reset to
   * 100%) if a lot is actively pending and unlocked when resume happens. */
  resume() {
    this.set({ auction: { ...this.snap.auction, status: "live" } });
    if (this.snap.currentLot?.status === "pending" && !this.snap.isLocked) {
      this.resumeClockFromCurrent();
    }
  }
  complete() {
    this.stopClock();
    this.cancelAutoResolve();
    this.set({ auction: { ...this.snap.auction, status: "completed" } });
  }

  // ── Shuffle reel ─────────────────────────────────────────────────────
  private tickShuffle(delay = 65, elapsed = 0) {
    this.shuffleTicker = setTimeout(() => {
      if (!this.snap.shuffle.active || this.snap.shuffle.target) return;
      this.set({ shuffle: { ...this.snap.shuffle, index: this.snap.shuffle.index + 1 } });
      const nextDelay = Math.min(delay * 1.14, 320);
      const nextElapsed = elapsed + delay;
      if (nextElapsed < 1850) this.tickShuffle(nextDelay, nextElapsed);
    }, delay);
  }
  private stopShuffleTicker() {
    if (this.shuffleTicker) clearTimeout(this.shuffleTicker);
    this.shuffleTicker = null;
  }

  // ── Lot lifecycle ────────────────────────────────────────────────────────
  startShuffle() {
    this.stopClock();
    this.cancelAutoResolve();
    this.stopShuffleTicker();
    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);
    if (this.revealDelayTimer) clearTimeout(this.revealDelayTimer);

    const pool = this.snap.auction.players;
    if (pool.length === 0) return;
    const player = pool[0];
    const lot: DemoLot = {
      id: this.uid("lot"),
      playerId: player.supabaseId,
      playerName: player.name,
      playerImg: player.img,
      playerRole: player.role,
      playerCountry: player.country,
      basePrice: player.price,
      currentBid: player.price,
      winningTeamId: null,
      winningTeamCode: null,
      lotNumber: this.snap.lotNumber + 1,
      status: "shuffling",
      startedAt: null,
    };

    const reelPool = pool.length > 1 ? pool : [player];

    this.set({
      currentLot: lot,
      bidHistory: [],
      lotNumber: lot.lotNumber,
      shuffle: { active: true, pool: reelPool, index: 0, target: null },
    });
    this.tickShuffle();
    this.broadcastEvent("Shuffling the pool — revealing next player…");
    // Shuffle starting is a director's-cut moment — always jump to the
    // Watch panel even if an owner panel was manually pinned before this,
    // since there's nothing to show on an owner's phone during a reshuffle.
    this.forceFocus(["auctioneer", "watch"]);
  }

  /**
   * Called once the shuffle reel has landed on the target player.
   *
   * Sequence:
   *  1. Stop the ticker and set shuffle.target so the reel visually settles
   *     on the right card, but keep lot.status === "shuffling" — panels
   *     (owner bid screen, watch panel) still treat this as "not revealed"
   *     and show their shuffling / "???" state.
   *  2. After REVEAL_HOLD_MS (1s), flip lot.status to "pending", set
   *     startedAt, and start the bidding clock. This is the moment the
   *     watch panel / owner panel actually shows the real player + opens
   *     bidding — giving everyone a clean 1s beat to see who was revealed
   *     before things go live.
   *  3. Slightly after that, fade out the shuffle overlay itself.
   */
  revealLot() {
    if (!this.snap.currentLot) return;
    const lotId = this.snap.currentLot.id;
    const target = this.snap.auction.players.find((p) => p.supabaseId === this.snap.currentLot!.playerId) ?? null;

    this.stopShuffleTicker();
    this.set({
      shuffle: { ...this.snap.shuffle, active: true, target },
    });

    if (this.revealDelayTimer) clearTimeout(this.revealDelayTimer);
    this.revealDelayTimer = setTimeout(() => {
      // Guard: bail if the lot changed / was reset during the hold.
      if (!this.snap.currentLot || this.snap.currentLot.id !== lotId) return;
      const lot = { ...this.snap.currentLot, status: "pending" as const, startedAt: Date.now() };
      this.set({ currentLot: lot });
      this.startClock();
      this.broadcastEvent(`${lot.playerName} steps up — bidding is open`);
      // Bidding opening is also a director's-cut moment — always reclaim
      // the spotlight (even over a stale manual pin left on the Watch
      // panel from during the shuffle) and land on whichever owner was
      // last shown (defaults to Owner A on the very first lot), so a
      // manual pick via the stepper carries forward to this lot instead
      // of always resetting to Owner A. One owner at a time keeps every
      // panel at a sane size; focusOwner() lets the person jump to the
      // other one mid-bid.
      this.forceFocus(["auctioneer", this.snap.lastOwnerFocus]);
    }, REVEAL_HOLD_MS);

    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);
    this.shuffleHideTimer = setTimeout(() => {
      this.set({ shuffle: { active: false, pool: [], index: 0, target: null } });
    }, SHUFFLE_HIDE_MS);
  }

  placeBid(teamId: string) {
    const lot = this.snap.currentLot;
    const team = this.snap.auction.teams.find((t) => t.supabaseId === teamId);
    const purse = this.snap.teamPurses[teamId];
    if (!lot || !team || !purse || lot.status !== "pending" || this.snap.isLocked) return;

    // Guard against the same bid firing twice in quick succession (e.g. a
    // simulated cursor click AND a direct model call both triggering for
    // the same click, or a real double-click). Without this, a single bid
    // visually doubles the increment and creates a duplicate bidHistory row.
    const lastBid = this.snap.bidHistory[0];
    if (
      lastBid &&
      lastBid.lotId === lot.id &&
      lastBid.teamId === teamId &&
      Date.now() - lastBid.placedAt < 200
    ) {
      return;
    }

    const amount = getNextBidAmount(lot.currentBid, this.snap.auction.rules.tiers);
    if (amount > purse.remaining) return;

    const bid: DemoBid = {
      id: this.uid("bid"),
      lotId: lot.id,
      teamId: team.supabaseId,
      teamCode: team.code,
      teamName: team.name,
      teamColor: team.color,
      amount,
      placedAt: Date.now(),
    };
    this.set({
      currentLot: { ...lot, currentBid: amount, winningTeamId: team.supabaseId, winningTeamCode: team.code },
      bidHistory: [bid, ...this.snap.bidHistory].slice(0, 20),
      clockPct: 100,
      isLocked: false,
    });
    this.broadcastEvent(`${team.name} bids ${fmtPts(amount)} pts — live on every screen`);
    // Layout doesn't change on every single bid — the person can switch
    // owners manually via focusOwner() — the pulse ring is enough
    // signal that something happened.
  }

  hammerSold() {
    const lot = this.snap.currentLot;
    if (!lot || !lot.winningTeamId) return;
    this.cancelAutoResolve();
    this.stopClock();
    const closed: DemoLot = { ...lot, status: "sold" };
    const purses = { ...this.snap.teamPurses };
    const p = purses[lot.winningTeamId];
    if (p) purses[lot.winningTeamId] = { remaining: p.remaining - lot.currentBid, roster: p.roster + 1 };
    this.set({
      currentLot: closed,
      completedLots: [closed, ...this.snap.completedLots],
      teamPurses: purses,
      auction: { ...this.snap.auction, players: this.snap.auction.players.filter((p2) => p2.supabaseId !== lot.playerId) },
    });
    this.broadcastEvent(`SOLD — ${closed.playerName} to ${closed.winningTeamCode} for ${fmtPts(closed.currentBid)} pts!`);
    // Result plays out on the broadcast screen — that's where the SOLD
    // stamp and ticker live, so send everyone's eyes there, overriding
    // any manual pin (another director's-cut moment).
    this.forceFocus(["auctioneer", "watch"]);
    this.maybeComplete();
  }

  markUnsold() {
    const lot = this.snap.currentLot;
    if (!lot) return;
    this.cancelAutoResolve();
    this.stopClock();
    const closed: DemoLot = { ...lot, status: "unsold" };
    const player = this.snap.auction.players.find((p2) => p2.supabaseId === lot.playerId) ?? null;
    this.set({
      currentLot: closed,
      completedLots: [closed, ...this.snap.completedLots],
      auction: {
        ...this.snap.auction,
        players: this.snap.auction.players.filter((p2) => p2.supabaseId !== lot.playerId),
      },
      // Player moves to the unsold pile — still in play, waiting on a
      // possible re-entry round — rather than being dropped entirely.
      unsoldPlayers: player ? [...this.snap.unsoldPlayers, player] : this.snap.unsoldPlayers,
    });
    this.broadcastEvent(`${closed.playerName} went unsold — no bids before time ran out`);
    this.forceFocus(["auctioneer", "watch"]);
    this.maybeComplete();
  }

  // ── Unsold re-entry ──────────────────────────────────────────────────
  private canAffordCheapestUnsold(): boolean {
    const unsold = this.snap.unsoldPlayers;
    if (unsold.length === 0) return true;
    const cheapest = Math.min(...unsold.map((p) => p.price));
    return this.snap.auction.teams.some((t) => {
      const purse = this.snap.teamPurses[t.supabaseId];
      return !!purse && purse.remaining >= cheapest && purse.roster < this.snap.auction.rules.teamSize;
    });
  }

  private allSquadsFull(): boolean {
    return this.snap.auction.teams.every(
      (t) => (this.snap.teamPurses[t.supabaseId]?.roster ?? 0) >= this.snap.auction.rules.teamSize
    );
  }

  /** Moves everything still in unsoldPlayers into finalizedUnsoldPlayers
   * (marking isUnsoldFinal) and checks whether that was the last thing
   * standing between the auction and being genuinely done. */
  private finalizeUnsold() {
    if (this.snap.unsoldPlayers.length === 0) return;
    const finalized = this.snap.unsoldPlayers.map((p) => ({ ...p, isUnsoldFinal: true }));
    this.set({
      unsoldPlayers: [],
      finalizedUnsoldPlayers: [...this.snap.finalizedUnsoldPlayers, ...finalized],
    });
    this.maybeComplete();
  }

  /** Fires once the queue AND the unsold pile are both empty — the
   * auction has genuinely run its course, nothing left to call or
   * re-enter. Safe to call defensively from multiple places. */
  private maybeComplete() {
    if (
      this.snap.auction.players.length === 0 &&
      this.snap.unsoldPlayers.length === 0 &&
      this.snap.auction.status !== "completed"
    ) {
      this.complete();
    }
  }

  /** Mirrors the production "Start Re-entry Round" action: reshuffles
   * every currently-unsold player back into the live queue for one more
   * pass, up to rules.unsoldReentryRounds total passes. Bails out — and
   * permanently finalizes whoever's still unsold — if the round limit's
   * hit, every squad is already full, or no team can even afford the
   * cheapest unsold player: the same three reasons the real console
   * surfaces via reasonToMessage(). */
  startReentryRound(): ReentryResult {
    const unsold = this.snap.unsoldPlayers;
    if (unsold.length === 0) return { started: false, reason: "no_unsold_players", finalized: 0 };

    const limit = this.snap.auction.rules.unsoldReentryRounds;
    const current = this.snap.roundInfo.current;

    if (current >= limit) {
      const finalizedCount = unsold.length;
      this.finalizeUnsold();
      this.broadcastEvent(
        `Re-entry round limit reached — ${finalizedCount} player${finalizedCount === 1 ? "" : "s"} marked Unsold (Final).`
      );
      return { started: false, reason: "round_limit_reached", finalized: finalizedCount };
    }
    if (this.allSquadsFull()) {
      const finalizedCount = unsold.length;
      this.finalizeUnsold();
      this.broadcastEvent(
        `Every team's squad is full — ${finalizedCount} player${finalizedCount === 1 ? "" : "s"} marked Unsold (Final).`
      );
      return { started: false, reason: "all_squads_full", finalized: finalizedCount };
    }
    if (!this.canAffordCheapestUnsold()) {
      const finalizedCount = unsold.length;
      this.finalizeUnsold();
      this.broadcastEvent(
        `No team can afford the cheapest unsold player — ${finalizedCount} player${finalizedCount === 1 ? "" : "s"} marked Unsold (Final).`
      );
      return { started: false, reason: "no_team_can_afford", finalized: finalizedCount };
    }

    // Requeue: bump each player's reentryCount, clear isUnsoldFinal (in
    // case this is somehow a second lap), and append to the back of the
    // live queue so they're called again like any other lot.
    const requeued = unsold.map((p) => ({
      ...p,
      reentryCount: (p.reentryCount ?? 0) + 1,
      isUnsoldFinal: false,
    }));
    const nextRound = current + 1;
    this.set({
      auction: { ...this.snap.auction, players: [...this.snap.auction.players, ...requeued], status: "live" },
      unsoldPlayers: [],
      roundInfo: { current: nextRound, limit },
    });
    this.broadcastEvent(
      `Re-entry Round ${nextRound} started — ${requeued.length} player${requeued.length === 1 ? "" : "s"} shuffled back into the pool.`
    );
    return { started: true, round: nextRound, requeued: requeued.length };
  }

  /** Full reset used to loop the demo showcase once a completion beat has
   * played out — clears players, purses, unsold piles, and round
   * counters back to a clean slate. Only ever called by the demo
   * orchestrator; a real person driving the console in interactive mode
   * doesn't get a magic refill — they either start a re-entry round via
   * startReentryRound(), or the auction is just done. */
  startNewCycle() {
    const teams = makeTeams();
    const purses: Record<string, DemoTeamPurse> = {};
    teams.forEach((t) => (purses[t.supabaseId] = { remaining: this.snap.auction.rules.totalPoints, roster: 0 }));
    this.set({
      auction: { ...this.snap.auction, players: makePlayers(), teams, status: "live" },
      teamPurses: purses,
      completedLots: [],
      lotNumber: 0,
      unsoldPlayers: [],
      finalizedUnsoldPlayers: [],
      roundInfo: { current: 0, limit: this.snap.auction.rules.unsoldReentryRounds },
    });
  }

  setCursor(actorId: string, patch: Partial<CursorState>) {
    const prev = this.snap.cursors[actorId] ?? { panel: null, label: "", color: "#c9971f", x: 0, y: 0, visible: false, clicking: false };
    this.set({ cursors: { ...this.snap.cursors, [actorId]: { ...prev, ...patch } } });
  }

  /**
   * Sets which panel(s) are spotlighted. Accepts:
   *  - a single panel key (spotlight just that one)
   *  - an array of panel keys (spotlight a combo — e.g. auctioneer + owner)
   *  - null / undefined / [] to clear the spotlight entirely
   *
   * Used directly by demoOrchestrator's scripted focus steps in demo mode
   * (unconditional — doesn't touch autoFocusEnabled). In interactive mode,
   * use toggleActivePanel / forceFocus instead so manual overrides and
   * the director's-cut moments don't fight each other.
   */
  setActivePanel(panel: string | string[] | null | undefined) {
    const panels = panel == null ? [] : Array.isArray(panel) ? panel : [panel];
    this.set({ activePanels: panels });
  }

  pulsePanels(panels: string[], durationMs = 900) {
    panels.forEach((p) => {
      if (this.syncTimers[p]) clearTimeout(this.syncTimers[p]);
    });
    const nextSync = Array.from(new Set([...this.snap.syncPanels, ...panels]));
    this.set({ syncPanels: nextSync });
    panels.forEach((p) => {
      this.syncTimers[p] = setTimeout(() => {
        this.set({ syncPanels: this.snap.syncPanels.filter((x) => x !== p) });
        delete this.syncTimers[p];
      }, durationMs);
    });
  }

  setNarrator(text: string) {
    this.set({ narratorText: text });
  }

  reset() {
    this.stopClock();
    this.cancelAutoResolve();
    this.stopShuffleTicker();
    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);
    this.shuffleHideTimer = null;
    if (this.revealDelayTimer) clearTimeout(this.revealDelayTimer);
    this.revealDelayTimer = null;
    Object.values(this.syncTimers).forEach(clearTimeout);
    this.syncTimers = {};
    const keepMode = this.snap.mode;
    this.snap = { ...initialSnapshot(), mode: keepMode };
    this.emit();
  }
}

export const demoModel = new DemoModelImpl();

// Stable reference for useSyncExternalStore's getSnapshot / getServerSnapshot.
// Using the same function for both avoids hydration mismatches, since the
// model's initial state is identical on server and first client render
// (nothing mutates it until demoOrchestrator.start() runs client-side).
export const getDemoSnapshot = () => demoModel.getSnapshot();