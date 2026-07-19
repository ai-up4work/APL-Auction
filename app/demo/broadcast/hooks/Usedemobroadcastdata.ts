"use client";

// ---------------------------------------------------------------------------
// useDemoBroadcastData
// ---------------------------------------------------------------------------
// A self-contained, backend-free stand-in for the real live-scoring stack
// (useLiveScoringEngine + matchPersistence + Supabase). It runs a simple
// ball-by-ball simulation in memory and exposes exactly the shapes the
// overlay components already expect (MatchSetup / LiveState / innings
// cards / fall-of-wickets / run-rate), so every overlay can be dropped
// onto a demo page with zero wiring.
//
// It also calls `window.triggerBoundaryCelebration(type, payload)` at the
// right moments (four, six, wicket, fifty, hundred, maiden, matchWon) —
// the same global MatchMomentOverlay already listens for — so the queued
// celebration graphics fire on their own as the simulation plays out.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

// ---- Demo squads -----------------------------------------------------
const SQUAD_A = [
  "R. Silva", "K. Perera", "D. Fernando", "T. Jayasuriya", "M. Bandara",
  "A. Rathnayake", "S. Wickramasinghe", "N. Gunawardena", "H. Dissanayake",
  "P. Mendis", "L. Karunaratne",
];
const SQUAD_B = [
  "J. Okafor", "M. Adeyemi", "C. Mensah", "T. Boateng", "O. Diallo",
  "K. Osei", "F. Mwangi", "D. Kone", "R. Abara", "B. Nwosu", "S. Toure",
];
// Rough bowling rotation — first five/six names of each squad, in order.
const BOWLERS_A = SQUAD_A.slice(0, 6);
const BOWLERS_B = SQUAD_B.slice(0, 6);

export const DEMO_TEAM_A = {
  name: "COASTAL SHARKS",
  shortCode: "CS",
  short: "CS",
  color: "#3B8BD4",
  logoUrl: "/Franchises/CSK.png",
  logo: "/Franchises/CSK.png",
  image: "/Franchises/CSK.png",
  squad: SQUAD_A.map((name) => ({ name })),
};

export const DEMO_TEAM_B = {
  name: "DESERT FALCONS",
  shortCode: "DF",
  short: "DF",
  color: "#2A9D5C",
  logoUrl: "/Franchises/RCB.png",
  logo: "/Franchises/RCB.png",
  image: "/Franchises/RCB.png",
  squad: SQUAD_B.map((name) => ({ name })),
};

export const DEMO_MATCH_SETUP = {
  teamA: DEMO_TEAM_A,
  teamB: DEMO_TEAM_B,
  tournament: { name: "MOON KNIGHT CUP", edition: "SEASON 7 · T20", logo: "/valiant-league-logo.png" },
  tournamentName: "MOON KNIGHT CUP",
  tournamentLogoUrl: "/valiant-league-logo.png",
  season: "7",
  format: "T20" as const,
  venue: "Meridian Stadium",
  kickoffTime: "19:30",
  tossWinner: "A" as const,
  tossDecision: "bat" as const,
};

export const DEMO_WEATHER = {
  venue: "MERIDIAN STADIUM",
  temp: 29,
  unit: "C" as const,
  condition: "partly-cloudy",
  corner: "top-right" as const,
};

// Standing "other matches" contribution so TournamentBoundaries doesn't
// start at a suspiciously identical 0-0 to MatchBoundaries.
const TOURNAMENT_BOUNDARIES_HEAD_START = { fours: 34, sixes: 11 };

// Sample points-table standings, in case you want to render a fully
// offline stand-in table alongside/instead of the live PointsTable
// component (which reads from Supabase via usePointsTableLedger).
export const DEMO_STANDINGS = [
  { rank: 1, short: "CS", name: "Coastal Sharks", color: "#3B8BD4", p: 6, w: 5, l: 1, t: 0, nr: 0, pts: 10, nrr: 1.284 },
  { rank: 2, short: "DF", name: "Desert Falcons", color: "#2A9D5C", p: 6, w: 4, l: 2, t: 0, nr: 0, pts: 8, nrr: 0.912 },
  { rank: 3, short: "IW", name: "Ironclad Wolves", color: "#C9971F", p: 6, w: 3, l: 3, t: 0, nr: 0, pts: 6, nrr: 0.114 },
  { rank: 4, short: "NR", name: "Northern Raptors", color: "#A32F2A", p: 6, w: 3, l: 3, t: 0, nr: 0, pts: 6, nrr: -0.221 },
  { rank: 5, short: "SS", name: "Sable Serpents", color: "#8FA6C9", p: 6, w: 2, l: 4, t: 0, nr: 0, pts: 4, nrr: -0.548 },
  { rank: 6, short: "VT", name: "Valiant Titans", color: "#6E8FC9", p: 6, w: 1, l: 5, t: 0, nr: 0, pts: 2, nrr: -1.402 },
];

const MAX_OVERS = 20;
export const DEFAULT_TICK_MS = 1800; // ~1 simulated ball every 1.8s

type Batter = { name: string; runs: number; balls: number; fours: number; sixes: number };
type Bowler = { name: string; overs: number; balls: number; maidens: number; runs: number; wickets: number };
type Score = { runs: number; wickets: number; overs: number; balls: number };
type WicketRow = { wicketNumber: number; score: string; overs: string; batter: string; howOut: string };

interface BookEntryBatting { runs: number; balls: number; fours: number; sixes: number; out: string | null }
interface BookEntryBowling { runs: number; balls: number; overs: number; wickets: number; maidens: number }
interface InningsBook {
  battingOrder: string[];
  batting: Record<string, BookEntryBatting>;
  bowlingOrder: string[];
  bowling: Record<string, BookEntryBowling>;
  finalScore: Score | null;
}

interface DemoState {
  inningsNumber: 1 | 2;
  target: number | undefined;
  matchComplete: boolean;
  matchResult: { winningTeamName: string; margin: string; method: string } | null;
  score: Score;
  striker: Batter;
  nonStriker: Batter;
  bowler: Bowler;
  thisOver: string[];
  partnership: { runs: number; balls: number };
  matchBoundaries: { fours: number; sixes: number };
  tournamentBoundaries: { fours: number; sixes: number };
  wickets: WicketRow[];
  battingQueue: string[];
  bowlingCursor: number;
  lastBowler: string | null;
  overRunsConceded: number;
  books: { 1: InningsBook; 2: InningsBook };
}

function emptyBatter(): Batter {
  return { name: "", runs: 0, balls: 0, fours: 0, sixes: 0 };
}
function emptyBowler(): Bowler {
  return { name: "", overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0 };
}
function emptyScore(): Score {
  return { runs: 0, wickets: 0, overs: 0, balls: 0 };
}
function emptyBook(): InningsBook {
  return { battingOrder: [], batting: {}, bowlingOrder: [], bowling: {}, finalScore: null };
}

function battingSquadFor(innings: 1 | 2) {
  return innings === 1 ? SQUAD_A : SQUAD_B;
}
function bowlingRotationFor(innings: 1 | 2) {
  return innings === 1 ? BOWLERS_B : BOWLERS_A;
}
function teamFor(innings: 1 | 2) {
  return innings === 1 ? DEMO_TEAM_A : DEMO_TEAM_B;
}

function startInnings(inningsNumber: 1 | 2, carry: Pick<DemoState, "matchBoundaries" | "tournamentBoundaries">): DemoState {
  const squad = battingSquadFor(inningsNumber);
  const queue = squad.slice(2); // first two open the batting
  return {
    inningsNumber,
    target: undefined,
    matchComplete: false,
    matchResult: null,
    score: emptyScore(),
    striker: { ...emptyBatter(), name: squad[0] },
    nonStriker: { ...emptyBatter(), name: squad[1] },
    bowler: emptyBowler(),
    thisOver: [],
    partnership: { runs: 0, balls: 0 },
    matchBoundaries: carry.matchBoundaries,
    tournamentBoundaries: carry.tournamentBoundaries,
    wickets: [],
    battingQueue: queue,
    bowlingCursor: -1,
    lastBowler: null,
    overRunsConceded: 0,
    books: { 1: emptyBook(), 2: emptyBook() },
  };
}

function randomOutcome(): { runs: number; isWicket: boolean } {
  const r = Math.random();
  if (r < 0.06) return { runs: 0, isWicket: true };
  if (r < 0.42) return { runs: 0, isWicket: false };
  if (r < 0.66) return { runs: 1, isWicket: false };
  if (r < 0.74) return { runs: 2, isWicket: false };
  if (r < 0.78) return { runs: 3, isWicket: false };
  if (r < 0.91) return { runs: 4, isWicket: false };
  return { runs: 6, isWicket: false };
}

const HOW_OUT_OPTIONS = ["bowled", "caught", "lbw", "run out", "stumped"];

function fireMoment(celebrate: boolean, type: string, payload?: Record<string, unknown>) {
  if (!celebrate) return;
  if (typeof window !== "undefined" && (window as any).triggerBoundaryCelebration) {
    (window as any).triggerBoundaryCelebration(type, payload);
  }
}

function pickNextBowler(state: DemoState): string {
  const rotation = bowlingRotationFor(state.inningsNumber);
  let cursor = state.bowlingCursor;
  let next: string;
  do {
    cursor = (cursor + 1) % rotation.length;
    next = rotation[cursor];
  } while (next === state.lastBowler && rotation.length > 1);
  state.bowlingCursor = cursor;
  return next;
}

function ensureBatting(book: InningsBook, name: string) {
  if (!book.batting[name]) {
    book.battingOrder.push(name);
    book.batting[name] = { runs: 0, balls: 0, fours: 0, sixes: 0, out: null };
  }
}
function ensureBowling(book: InningsBook, name: string) {
  if (!book.bowling[name]) {
    book.bowlingOrder.push(name);
    book.bowling[name] = { runs: 0, balls: 0, overs: 0, wickets: 0, maidens: 0 };
  }
}

// Advances the simulation by exactly one legal delivery. Pure-ish: takes
// the previous state and returns a brand new state object. Side effect:
// fires celebration moments via the global trigger as things happen — but
// only when `celebrate` is true. Left off by default: the sim runs every
// ~1.8s, and firing a queued celebration graphic on every boundary/wicket
// would mean something is popping up almost constantly. With it off, the
// score/stats update silently and MatchMomentOverlay's own trigger
// buttons (or a manual call) are the only way a celebration shows up.
function advanceOneBall(prev: DemoState, celebrate: boolean): DemoState {
  if (prev.matchComplete) return prev;

  const state: DemoState = JSON.parse(JSON.stringify(prev));
  const book = state.books[state.inningsNumber];

  // Fill empty slots.
  if (!state.striker.name && state.battingQueue.length) state.striker.name = state.battingQueue.shift()!;
  if (!state.nonStriker.name && state.battingQueue.length) state.nonStriker.name = state.battingQueue.shift()!;
  if (!state.bowler.name || state.bowler.balls === 0) {
    // Only rotate at the start of an over (balls === 0 covers both
    // "brand new spell" and "just rolled over").
    if (!state.bowler.name) {
      state.bowler = emptyBowler();
      state.bowler.name = pickNextBowler(state);
    }
  }
  ensureBatting(book, state.striker.name);
  ensureBatting(book, state.nonStriker.name);
  ensureBowling(book, state.bowler.name);

  const outcome = randomOutcome();
  const bowlerNameThisBall = state.bowler.name;
  const strikerNameBefore = state.striker.name;

  let ballValue: string;
  let maidenFired = false;

  if (outcome.isWicket) {
    ballValue = "W";
    const dismissed = state.striker;
    const runsAtOut = dismissed.runs;
    const ballsAtOut = dismissed.balls + 1;
    const howOut = HOW_OUT_OPTIONS[Math.floor(Math.random() * HOW_OUT_OPTIONS.length)];

    dismissed.balls = ballsAtOut;
    book.batting[dismissed.name] = { ...book.batting[dismissed.name], balls: ballsAtOut, out: howOut };

    state.bowler.balls += 1;
    state.bowler.wickets += 1;
    if (state.bowler.balls >= 6) {
      state.bowler.overs += 1;
      state.bowler.balls = 0;
    }
    book.bowling[bowlerNameThisBall] = {
      ...book.bowling[bowlerNameThisBall],
      wickets: book.bowling[bowlerNameThisBall].wickets + 1,
      overs: state.bowler.overs,
      balls: state.bowler.balls,
    };

    state.score.wickets = Math.min(10, state.score.wickets + 1);
    state.score.balls += 1;
    if (state.score.balls >= 6) {
      state.score.overs += 1;
      state.score.balls = 0;
    }

    state.wickets = [
      ...state.wickets,
      {
        wicketNumber: state.score.wickets,
        score: `${state.score.runs}`,
        overs: `${state.score.overs}.${state.score.balls}`,
        batter: dismissed.name,
        howOut,
      },
    ];

    fireMoment(celebrate, "wicket", { player: dismissed.name, score: `${runsAtOut}(${ballsAtOut})` });

    const nextName = state.battingQueue.shift();
    state.striker = nextName ? { ...emptyBatter(), name: nextName } : emptyBatter();
    state.partnership = { runs: 0, balls: 0 };
    if (nextName) ensureBatting(book, nextName);
  } else {
    const runs = outcome.runs;
    ballValue = runs === 0 ? "." : String(runs);

    const runsBefore = state.striker.runs;
    state.striker.runs += runs;
    state.striker.balls += 1;
    if (runs === 4) state.striker.fours += 1;
    if (runs === 6) state.striker.sixes += 1;

    book.batting[strikerNameBefore] = {
      ...book.batting[strikerNameBefore],
      runs: state.striker.runs,
      balls: state.striker.balls,
      fours: state.striker.fours,
      sixes: state.striker.sixes,
    };

    state.bowler.runs += runs;
    state.bowler.balls += 1;
    if (state.bowler.balls >= 6) {
      state.bowler.overs += 1;
      state.bowler.balls = 0;
    }
    book.bowling[bowlerNameThisBall] = {
      ...book.bowling[bowlerNameThisBall],
      runs: state.bowler.runs,
      overs: state.bowler.overs,
      balls: state.bowler.balls,
    };

    state.score.runs += runs;
    state.score.balls += 1;
    if (state.score.balls >= 6) {
      state.score.overs += 1;
      state.score.balls = 0;
    }

    state.partnership = { runs: state.partnership.runs + runs, balls: state.partnership.balls + 1 };

    if (runs === 4) {
      state.matchBoundaries.fours += 1;
      state.tournamentBoundaries.fours += 1;
      fireMoment(celebrate, "four", { player: strikerNameBefore, score: `${state.striker.runs}(${state.striker.balls})` });
    }
    if (runs === 6) {
      state.matchBoundaries.sixes += 1;
      state.tournamentBoundaries.sixes += 1;
      fireMoment(celebrate, "six", { player: strikerNameBefore, score: `${state.striker.runs}(${state.striker.balls})` });
    }
    if (runsBefore < 50 && state.striker.runs >= 50) {
      fireMoment(celebrate, "fifty", { player: strikerNameBefore, score: `${state.striker.runs}(${state.striker.balls})` });
    }
    if (runsBefore < 100 && state.striker.runs >= 100) {
      fireMoment(celebrate, "hundred", { player: strikerNameBefore, score: `${state.striker.runs}(${state.striker.balls})` });
    }

    // Strike rotation on odd runs.
    if (runs % 2 === 1) {
      const tmp = state.striker;
      state.striker = state.nonStriker;
      state.nonStriker = tmp;
    }
  }

  // Over-runs tracking (for maiden detection) and this-over ticker.
  const overJustCompleted = state.bowler.balls === 0; // rolled over to 0 above means over finished
  state.overRunsConceded += outcome.isWicket ? 0 : outcome.runs;

  const startFreshRow = state.thisOver.length >= 6;
  state.thisOver = [...(startFreshRow ? [] : state.thisOver), ballValue];

  if (overJustCompleted) {
    maidenFired = state.overRunsConceded === 0;
    if (maidenFired) {
      state.bowler.maidens += 1;
      book.bowling[bowlerNameThisBall] = { ...book.bowling[bowlerNameThisBall], maidens: state.bowler.maidens };
      fireMoment(celebrate, "maiden", { bowler: bowlerNameThisBall, maidens: state.bowler.maidens });
    }
    state.overRunsConceded = 0;
    state.lastBowler = bowlerNameThisBall;
    // Strike swaps at the end of every over too (standard cricket rule).
    if (state.striker.name && state.nonStriker.name) {
      const tmp = state.striker;
      state.striker = state.nonStriker;
      state.nonStriker = tmp;
    }
    state.bowler = emptyBowler(); // forces pickNextBowler() next ball
  }

  // ---- End-of-innings / end-of-match checks ----
  const allOut = state.score.wickets >= 10;
  const oversDone = state.score.overs >= MAX_OVERS;

  if (state.inningsNumber === 1) {
    if (allOut || oversDone) {
      book.finalScore = { ...state.score };
      const target = state.score.runs + 1;
      const carried = { matchBoundaries: state.matchBoundaries, tournamentBoundaries: state.tournamentBoundaries };
      const next = startInnings(2, carried);
      next.target = target;
      next.books[1] = book;
      return next;
    }
  } else {
    const target = state.target ?? 0;
    if (state.score.runs >= target) {
      book.finalScore = { ...state.score };
      const wicketsInHand = Math.max(0, 10 - state.score.wickets);
      state.matchComplete = true;
      state.matchResult = {
        winningTeamName: DEMO_TEAM_B.name,
        margin: `won by ${wicketsInHand} wicket${wicketsInHand === 1 ? "" : "s"}`,
        method: "wickets",
      };
      fireMoment(celebrate, "matchWon", {
        player: DEMO_TEAM_B.name,
        score: state.matchResult.margin,
        teamColor: DEMO_TEAM_B.color,
        teamLogoUrl: DEMO_TEAM_B.logoUrl,
      });
    } else if (allOut || oversDone) {
      book.finalScore = { ...state.score };
      const marginRuns = target - 1 - state.score.runs;
      state.matchComplete = true;
      if (marginRuns <= 0) {
        state.matchResult = { winningTeamName: "Tie", margin: "Match Tied", method: "tie" };
        fireMoment(celebrate, "matchWon", { player: "Match Tied", score: "Scores level", teamColor: "#C7CFDE" });
      } else {
        state.matchResult = {
          winningTeamName: DEMO_TEAM_A.name,
          margin: `won by ${marginRuns} run${marginRuns === 1 ? "" : "s"}`,
          method: "runs",
        };
        fireMoment(celebrate, "matchWon", {
          player: DEMO_TEAM_A.name,
          score: state.matchResult.margin,
          teamColor: DEMO_TEAM_A.color,
          teamLogoUrl: DEMO_TEAM_A.logoUrl,
        });
      }
    }
  }

  return state;
}

function initialState(): DemoState {
  return startInnings(1, {
    matchBoundaries: { fours: 0, sixes: 0 },
    tournamentBoundaries: { ...TOURNAMENT_BOUNDARIES_HEAD_START },
  });
}

function buildInningsCard(book: InningsBook, label: string, liveScore: Score) {
  const score = book.finalScore ?? liveScore;
  const batting = book.battingOrder.map((name) => {
    const b = book.batting[name];
    return { name, runs: b.runs, balls: b.balls, out: b.out, top: false };
  });
  if (batting.length) {
    const maxRuns = Math.max(...batting.map((r) => r.runs));
    batting.forEach((r) => {
      if (r.runs === maxRuns && maxRuns > 0) r.top = true;
    });
  }
  const bowling = book.bowlingOrder.map((name) => {
    const b = book.bowling[name];
    return { name, figures: `${b.wickets}-${b.runs}`, overs: `${b.overs}.${b.balls}`, top: false, _w: b.wickets };
  });
  if (bowling.length) {
    const maxW = Math.max(...bowling.map((r) => r._w));
    bowling.forEach((r) => {
      if (r._w === maxW && maxW > 0) r.top = true;
    });
  }
  return {
    label,
    score: `${score.runs}/${score.wickets}`,
    overs: `${score.overs}.${score.balls}`,
    batting,
    bowling: bowling.map(({ _w, ...rest }) => rest),
  };
}

export function useDemoBroadcastData(
  opts: { autoPlay?: boolean; tickMs?: number; celebrate?: boolean } = {}
) {
  const { autoPlay = true, tickMs = DEFAULT_TICK_MS, celebrate: celebrateDefault = false } = opts;

  const [state, setState] = useState<DemoState>(() => initialState());
  const [playing, setPlaying] = useState(autoPlay);
  // Off by default — see the comment above advanceOneBall(). Flip this on
  // if you actually want the sim to auto-fire celebration graphics as it
  // plays; otherwise moments only show when triggered by hand (e.g. via
  // MatchMomentOverlay's own test buttons).
  const [celebrate, setCelebrate] = useState(celebrateDefault);
  const celebrateRef = useRef(celebrate);
  useEffect(() => {
    celebrateRef.current = celebrate;
  }, [celebrate]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing || state.matchComplete) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setState((prev) => advanceOneBall(prev, celebrateRef.current));
    }, tickMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, tickMs, state.matchComplete]);

  const step = useCallback(() => setState((prev) => advanceOneBall(prev, celebrateRef.current)), []);
  const toggleCelebrate = useCallback(() => setCelebrate((c) => !c), []);
  const reset = useCallback(() => setState(initialState()), []);
  const togglePlaying = useCallback(() => setPlaying((p) => !p), []);

  const battingTeam = teamFor(state.inningsNumber);
  const bowlingTeam = state.inningsNumber === 1 ? DEMO_TEAM_B : DEMO_TEAM_A;

  const oversAsDecimal = state.score.overs + state.score.balls / 6;
  const crr = oversAsDecimal > 0 ? state.score.runs / oversAsDecimal : 0;
  const ballsRemaining = state.target !== undefined ? Math.max(0, MAX_OVERS * 6 - (state.score.overs * 6 + state.score.balls)) : 0;
  const runsNeeded = state.target !== undefined ? Math.max(0, state.target - state.score.runs) : 0;

  const liveState = {
    inningsNumber: state.inningsNumber,
    target: state.target,
    matchComplete: state.matchComplete,
    matchResult: state.matchResult,
    score: state.score,
    striker: state.striker,
    nonStriker: state.nonStriker,
    bowler: state.bowler.name ? state.bowler : { ...emptyBowler(), name: bowlingRotationFor(state.inningsNumber)[0] },
    thisOver: state.thisOver,
    partnership: state.partnership,
    matchBoundaries: state.matchBoundaries,
    tournamentBoundaries: state.tournamentBoundaries,
  };

  const scorecardInnings = {
    1: buildInningsCard(state.books[1], state.inningsNumber === 1 && !state.books[1].finalScore ? "1st Innings (in progress)" : "1st Innings", state.inningsNumber === 1 ? state.score : state.score),
    2: buildInningsCard(state.books[2], "2nd Innings", state.inningsNumber === 2 ? state.score : emptyScore()),
  };

  return {
    playing,
    togglePlaying,
    step,
    reset,
    celebrate,
    toggleCelebrate,
    matchSetup: DEMO_MATCH_SETUP,
    weather: DEMO_WEATHER,
    standings: DEMO_STANDINGS,
    liveState,
    battingTeam,
    bowlingTeam,
    runRate: { crr, target: state.target, runsNeeded, ballsRemaining },
    wickets: state.wickets,
    scorecardInnings,
  };
}