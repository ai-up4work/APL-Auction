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

const TIMER_SECONDS = 12;
const TICK_MS = 100;

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
  };
  session: {
    auctionName: string;
    auctionLogo: string;
    timerSeconds: number;
  };
};

export type DemoTeamPurse = { remaining: number; roster: number };

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
  activePanel: string | null;
  syncPanels: string[];
  narratorText: string;
  shuffle: ShuffleState;
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
    activePanel: null,
    syncPanels: [],
    narratorText: "",
    shuffle: { active: false, pool: [], index: 0, target: null },
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

  // ── Clock ──────────────────────────────────────────────────────────────
  private startClock() {
    this.stopClock();
    this.set({ clockPct: 100, isLocked: false });
    this.clockTimer = setInterval(() => {
      const dec = 100 / ((TIMER_SECONDS * 1000) / TICK_MS);
      const next = Math.max(0, this.snap.clockPct - dec);
      this.set({ clockPct: next, isLocked: next <= 0 });
    }, TICK_MS);
  }
  private stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }

  pause() { this.set({ auction: { ...this.snap.auction, status: "paused" } }); }
  resume() { this.set({ auction: { ...this.snap.auction, status: "live" } }); }
  complete() { this.stopClock(); this.set({ auction: { ...this.snap.auction, status: "completed" } }); }

  // ── Shuffle reel ─────────────────────────────────────────────────────
  // Decelerating tick loop — mirrors a real slot-reel spin, and lets
  // <ShuffleOverlay> infer blur/speed from real elapsed time between ticks.
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
    this.stopShuffleTicker();
    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);

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

    // Reel candidates: whole remaining pool (falls back to just the
    // selected player if the pool is down to one).
    const reelPool = pool.length > 1 ? pool : [player];

    this.set({
      currentLot: lot,
      bidHistory: [],
      lotNumber: lot.lotNumber,
      shuffle: { active: true, pool: reelPool, index: 0, target: null },
    });
    this.tickShuffle();
  }

  revealLot() {
    if (!this.snap.currentLot) return;
    const lot = { ...this.snap.currentLot, status: "pending" as const, startedAt: Date.now() };
    const target = this.snap.auction.players.find((p) => p.supabaseId === lot.playerId) ?? null;

    this.stopShuffleTicker();
    this.set({
      currentLot: lot,
      shuffle: { ...this.snap.shuffle, active: true, target },
    });
    this.startClock();

    // Hold the "winner locked" celebration state briefly before the
    // overlay dismisses and normal bidding UI takes over underneath.
    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);
    this.shuffleHideTimer = setTimeout(() => {
      this.set({ shuffle: { active: false, pool: [], index: 0, target: null } });
    }, 900);
  }

  placeBid(teamId: string) {
    const lot = this.snap.currentLot;
    const team = this.snap.auction.teams.find((t) => t.supabaseId === teamId);
    const purse = this.snap.teamPurses[teamId];
    if (!lot || !team || !purse || lot.status !== "pending" || this.snap.isLocked) return;
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
  }

  hammerSold() {
    const lot = this.snap.currentLot;
    if (!lot || !lot.winningTeamId) return;
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
  }

  markUnsold() {
    const lot = this.snap.currentLot;
    if (!lot) return;
    this.stopClock();
    const closed: DemoLot = { ...lot, status: "unsold" };
    this.set({
      currentLot: closed,
      completedLots: [closed, ...this.snap.completedLots],
      auction: { ...this.snap.auction, players: this.snap.auction.players.filter((p2) => p2.supabaseId !== lot.playerId) },
    });
  }

  refillIfEmpty() {
    if (this.snap.auction.players.length === 0) {
      const teams = makeTeams();
      const purses: Record<string, DemoTeamPurse> = {};
      teams.forEach((t) => (purses[t.supabaseId] = { remaining: this.snap.auction.rules.totalPoints, roster: 0 }));
      this.set({
        auction: { ...this.snap.auction, players: makePlayers(), teams, status: "live" },
        teamPurses: purses,
        completedLots: [],
        lotNumber: 0,
      });
    }
  }

  setCursor(actorId: string, patch: Partial<CursorState>) {
    const prev = this.snap.cursors[actorId] ?? { panel: null, label: "", color: "#c9971f", x: 0, y: 0, visible: false, clicking: false };
    this.set({ cursors: { ...this.snap.cursors, [actorId]: { ...prev, ...patch } } });
  }

  setActivePanel(panel: string | null) {
    this.set({ activePanel: panel });
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
    this.stopShuffleTicker();
    if (this.shuffleHideTimer) clearTimeout(this.shuffleHideTimer);
    this.shuffleHideTimer = null;
    Object.values(this.syncTimers).forEach(clearTimeout);
    this.syncTimers = {};
    this.snap = initialSnapshot();
    this.emit();
  }
}

export const demoModel = new DemoModelImpl();