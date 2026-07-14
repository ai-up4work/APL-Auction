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
  logo: string;
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

// Headshots via pravatar.cc (stable per-number, photo-realistic placeholders —
// fine for demo/sandbox use, not meant for production player photos).
const avatar = (n: number) => `https://i.pravatar.cc/300?img=${n}`;

const PLAYER_POOL: DemoPlayer[] = [
  { id: "p1",  name: "Marcus Vane",      role: "All-rounder",  country: "Australia",     img: avatar(12), basePrice: 1500 },
  { id: "p2",  name: "Elena Rodas",      role: "Batsman",      country: "South Africa",  img: avatar(45), basePrice: 1200 },
  { id: "p3",  name: "Rohan Sharma",     role: "Bowler",       country: "India",         img: avatar(33), basePrice: 2000 },
  { id: "p4",  name: "Jaxon Kade",       role: "Wicket Keeper",country: "England",       img: avatar(8),  basePrice: 900  },
  { id: "p5",  name: "Li Wei",           role: "Batsman",      country: "Sri Lanka",     img: avatar(21), basePrice: 1100 },
  { id: "p6",  name: "Devon Marsh",      role: "Bowler",       country: "New Zealand",   img: avatar(15), basePrice: 1800 },
  { id: "p7",  name: "Arjun Nair",       role: "All-rounder",  country: "India",         img: avatar(52), basePrice: 2500 },
  { id: "p8",  name: "Kieran Bolt",      role: "Bowler",       country: "West Indies",   img: avatar(4),  basePrice: 1600 },
  { id: "p9",  name: "Priya Deshmukh",   role: "Batsman",      country: "India",         img: avatar(47), basePrice: 1300 },
  { id: "p10", name: "Tariq Al-Farsi",   role: "Wicket Keeper",country: "Pakistan",      img: avatar(29), basePrice: 1000 },
  { id: "p11", name: "Connor Blake",     role: "All-rounder",  country: "England",       img: avatar(18), basePrice: 2200 },
  { id: "p12", name: "Naveed Iqbal",     role: "Bowler",       country: "Pakistan",      img: avatar(11), basePrice: 1700 },
  { id: "p13", name: "Sanjay Rathore",   role: "Batsman",      country: "India",         img: avatar(60), basePrice: 3000 },
  { id: "p14", name: "Ollie Trent",      role: "Bowler",       country: "Australia",     img: avatar(23), basePrice: 1400 },
  { id: "p15", name: "Farhan Malik",     role: "Wicket Keeper",country: "Bangladesh",    img: avatar(36), basePrice: 950  },
  { id: "p16", name: "Ben Coetzee",      role: "All-rounder",  country: "South Africa",  img: avatar(7),  basePrice: 2100 },
  { id: "p17", name: "Ishaan Kapoor",    role: "Batsman",      country: "India",         img: avatar(50), basePrice: 1250 },
  { id: "p18", name: "Ryan Fernando",    role: "Bowler",       country: "Sri Lanka",     img: avatar(41), basePrice: 1150 },
];

// Simple, license-free geometric crests via DiceBear's "shapes" set,
// seeded per team so each logo is stable across reloads.
const teamLogo = (seed: string) => `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}&backgroundColor=transparent`;

function makeTeams(): DemoTeam[] {
  return [
    { id: "tA", code: "CSK", name: "Chennai Sabers",   color: "#f5a623", logo: teamLogo("Chennai-Sabers"),   totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tB", code: "MI",  name: "Mumbai Marauders", color: "#3b8bd4", logo: teamLogo("Mumbai-Marauders"), totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tC", code: "RCB", name: "Bengaluru Bulls",  color: "#e2685a", logo: teamLogo("Bengaluru-Bulls"),  totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tD", code: "KKR", name: "Kolkata Krakens",  color: "#8b5cf6", logo: teamLogo("Kolkata-Krakens"),  totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
    { id: "tE", code: "DC",  name: "Delhi Dragons",    color: "#22c55e", logo: teamLogo("Delhi-Dragons"),    totalPurse: 50000, remaining: 50000, roster: 0, teamSize: 16 },
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