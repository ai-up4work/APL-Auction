// lib/demo/demoStore.ts
"use client";

export type DemoPlayer = {
  id: string;
  name: string;
  role: "Batsman" | "Bowler" | "All-rounder" | "Wicket Keeper";
  country: string;
  img: string;
  basePrice: number;
};

export type DemoTeam = {
  id: string;
  code: string;
  name: string;
  color: string;
  totalPurse: number;
  remaining: number;
  roster: number;
  teamSize: number;
};

export type DemoBid = {
  id: string;
  teamId: string;
  teamCode: string;
  teamName: string;
  teamColor: string;
  amount: number;
  placedAt: number;
};

export type DemoLotStatus = "idle" | "shuffling" | "pending" | "sold" | "unsold";

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
  panel: "auctioneer" | "ownerA" | "ownerB" | "watch" | null;
  label: string;
  color: string;
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
};

export type DemoState = {
  players: DemoPlayer[];
  teams: DemoTeam[];
  currentLot: DemoLot | null;
  bidHistory: DemoBid[];
  completedLots: DemoLot[];
  lotNumber: number;
  auctionStatus: "live" | "paused" | "completed";
  clockPct: number;
  isLocked: boolean;
  cursors: Record<string, CursorState>;
};

const TIMER_SECONDS = 12;
const TICK_MS = 100;

const PLAYER_POOL: DemoPlayer[] = [
  { id: "p1", name: "Marcus Vane", role: "All-rounder", country: "Australia", img: "", basePrice: 1500 },
  { id: "p2", name: "Elena Rodas", role: "Batsman", country: "South Africa", img: "", basePrice: 1200 },
  { id: "p3", name: "Rohan Sharma", role: "Bowler", country: "India", img: "", basePrice: 2000 },
  { id: "p4", name: "Jaxon Kade", role: "Wicket Keeper", country: "England", img: "", basePrice: 900 },
  { id: "p5", name: "Li Wei", role: "Batsman", country: "Sri Lanka", img: "", basePrice: 1100 },
];

function makeTeams(): DemoTeam[] {
  return [
    { id: "tA", code: "CSK", name: "Chennai Sabers", color: "#f5a623", totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tB", code: "MI", name: "Mumbai Marauders", color: "#3b8bd4", totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tC", code: "RCB", name: "Bengaluru Bulls", color: "#e2685a", totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
  ];
}

function makeInitialState(): DemoState {
  return {
    players: [...PLAYER_POOL],
    teams: makeTeams(),
    currentLot: null,
    bidHistory: [],
    completedLots: [],
    lotNumber: 0,
    auctionStatus: "live",
    clockPct: 100,
    isLocked: false,
    cursors: {},
  };
}

function nextBidAmount(currentBid: number): number {
  if (currentBid < 1000) return currentBid + 100;
  if (currentBid < 3000) return currentBid + 200;
  if (currentBid < 6000) return currentBid + 500;
  return currentBid + 1000;
}

class DemoStoreImpl {
  private state: DemoState = makeInitialState();
  private listeners = new Set<() => void>();
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private idCounter = 0;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): DemoState {
    return this.state;
  }

  private uid(prefix: string) {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  private set(patch: Partial<DemoState>) {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  // ── Clock ──────────────────────────────────────────────────────────────
  private startClock() {
    this.stopClock();
    this.set({ clockPct: 100, isLocked: false });
    this.clockTimer = setInterval(() => {
      const dec = 100 / ((TIMER_SECONDS * 1000) / TICK_MS);
      const next = Math.max(0, this.state.clockPct - dec);
      this.set({ clockPct: next, isLocked: next <= 0 });
    }, TICK_MS);
  }
  private stopClock() {
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clockTimer = null;
  }
  private resetClockFromBid() {
    this.set({ clockPct: 100, isLocked: false });
  }

  // ── Lot lifecycle ────────────────────────────────────────────────────────
  startShuffle(player: DemoPlayer) {
    this.stopClock();
    const lot: DemoLot = {
      id: this.uid("lot"),
      playerId: player.id,
      playerName: player.name,
      playerImg: player.img,
      playerRole: player.role,
      playerCountry: player.country,
      basePrice: player.basePrice,
      currentBid: player.basePrice,
      winningTeamId: null,
      winningTeamCode: null,
      lotNumber: this.state.lotNumber + 1,
      status: "shuffling",
      startedAt: null,
    };
    this.set({ currentLot: lot, bidHistory: [], lotNumber: lot.lotNumber });
  }

  revealLot() {
    if (!this.state.currentLot) return;
    const lot = { ...this.state.currentLot, status: "pending" as const, startedAt: Date.now() };
    this.set({ currentLot: lot });
    this.startClock();
  }

  placeBid(teamId: string) {
    const lot = this.state.currentLot;
    const team = this.state.teams.find((t) => t.id === teamId);
    if (!lot || !team || lot.status !== "pending" || this.state.isLocked) return;
    const amount = nextBidAmount(lot.currentBid);
    if (amount > team.remaining) return;

    const bid: DemoBid = {
      id: this.uid("bid"),
      teamId: team.id,
      teamCode: team.code,
      teamName: team.name,
      teamColor: team.color,
      amount,
      placedAt: Date.now(),
    };
    this.set({
      currentLot: { ...lot, currentBid: amount, winningTeamId: team.id, winningTeamCode: team.code },
      bidHistory: [bid, ...this.state.bidHistory].slice(0, 20),
    });
    this.resetClockFromBid();
  }

  hammerSold() {
    const lot = this.state.currentLot;
    if (!lot || !lot.winningTeamId) return;
    this.stopClock();
    const closed: DemoLot = { ...lot, status: "sold" };
    const teams = this.state.teams.map((t) =>
      t.id === lot.winningTeamId
        ? { ...t, remaining: t.remaining - lot.currentBid, roster: t.roster + 1 }
        : t
    );
    this.set({
      currentLot: closed,
      completedLots: [closed, ...this.state.completedLots],
      teams,
      players: this.state.players.filter((p) => p.id !== lot.playerId),
    });
  }

  markUnsold() {
    const lot = this.state.currentLot;
    if (!lot) return;
    this.stopClock();
    const closed: DemoLot = { ...lot, status: "unsold" };
    this.set({
      currentLot: closed,
      completedLots: [closed, ...this.state.completedLots],
      players: this.state.players.filter((p) => p.id !== lot.playerId),
    });
  }

  // Loops the demo forever: once the pool empties, refill it so the sandbox
  // never runs out of players to auction.
  refillPoolIfEmpty() {
    if (this.state.players.length === 0) {
      this.set({ players: [...PLAYER_POOL], teams: makeTeams(), completedLots: [], lotNumber: 0 });
    }
  }

  // ── Cursors ──────────────────────────────────────────────────────────────
  setCursor(actorId: string, patch: Partial<CursorState>) {
    const prev = this.state.cursors[actorId] ?? {
      panel: null, label: "", color: "#c9971f", x: 0, y: 0, visible: false, clicking: false,
    };
    this.set({ cursors: { ...this.state.cursors, [actorId]: { ...prev, ...patch } } });
  }

  reset() {
    this.stopClock();
    this.state = makeInitialState();
    this.emit();
  }
}

export const demoStore = new DemoStoreImpl();
export { nextBidAmount };