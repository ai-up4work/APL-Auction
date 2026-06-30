// context/AuctionContext.tsx
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  AuctionState,
  AuctionStatus,
  Team,
  Player,
  AuctionRules,
  SessionConfig,
} from "@/types/auction";
import {
  createAuction,
  updateAuctionStatus,
  upsertTeam,
  deleteTeamFromDb,
  upsertPlayer,
  deletePlayerFromDb,
  saveRules,
  saveSession,
  saveFullAuctionAndLaunch,
  loadAuction,
  listAuctions,
  cloneAuction,
  resetAuctionInDb,
  generateLinks,
  shufflePlayerOrder,
  DEFAULT_RULES,
  DEFAULT_SESSION,
  type AuctionSummary,
  type AuctionLinks,
} from "@/lib/auctionDb";
import { DEFAULT_TEAMS, DEFAULT_PLAYERS } from "@/lib/auctionDefaults";

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────
interface AuctionContextValue {
  auction:       AuctionState;
  isSaving:      boolean;
  saveError:     string | null;
  shuffleReady:  boolean;

  auctionList:   AuctionSummary[];
  isLoadingList: boolean;
  links:         AuctionLinks | null;

  addTeam:    (data: Omit<Team, "id" | "roster" | "supabaseId">) => Promise<void>;
  editTeam:   (id: number, data: Omit<Team, "id" | "roster" | "supabaseId">) => Promise<void>;
  deleteTeam: (id: number) => Promise<void>;

  addPlayer:    (data: Omit<Player, "id" | "supabaseId">) => Promise<void>;
  editPlayer: (id: number, data: Omit<Player, "id" | "supabaseId">) => Promise<void>;
  deletePlayer: (id: number) => Promise<void>;

  updateRules:   (rules: AuctionRules) => void;
  updateSession: (session: SessionConfig) => void;

  handleLaunch:    () => Promise<void>;
  handlePause:     () => Promise<void>;
  handleResume:    () => Promise<void>;
  handleStop:      () => Promise<void>;
  handleReauction: () => Promise<void>;
  handleShuffle:   () => Promise<void>;

  createNew:          (name?: string) => void;
  switchAuction:      (id: string) => Promise<void>;
  cloneFromPrevious:  (sourceId: string, newName: string) => Promise<void>;
  refreshAuctionList: () => Promise<void>;

  loadFromDb: (auctionId: string) => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────────────────────
function buildInitialState(): AuctionState {
  let tid = 10;
  let pid = 10;
  return {
    auctionId: null,
    status:    "setup",
    teams:     DEFAULT_TEAMS.map((t) => ({ ...t, id: tid++, supabaseId: undefined, roster: 0 })),
    players:   DEFAULT_PLAYERS.map((p) => ({ ...p, id: pid++, supabaseId: undefined })),
    rules:     DEFAULT_RULES,
    session:   DEFAULT_SESSION,
  };
}

const INITIAL_STATE: AuctionState = buildInitialState();

let _teamId   = 10 + DEFAULT_TEAMS.length;
let _playerId = 10 + DEFAULT_PLAYERS.length;
function nextTeamId()   { return _teamId++;   }
function nextPlayerId() { return _playerId++; }

// ─────────────────────────────────────────────────────────────────────────────
// Helper — the ONLY correct definition of "is the pool ready to draw from".
// Every player must have a non-null lot_order. A single shuffled player does
// NOT mean the pool is ready — this was the bug (previously used .some()).
// ─────────────────────────────────────────────────────────────────────────────
function computeShuffleReady(players: Player[]): boolean {
  return players.length > 0 && players.every((p) => p.lotOrder != null);
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX: Shared reset helper used by both createNew and handleReauction.
// Previously both functions duplicated the same 6-line reset sequence.
// ─────────────────────────────────────────────────────────────────────────────
function resetIdCounters() {
  _teamId   = 10 + DEFAULT_TEAMS.length;
  _playerId = 10 + DEFAULT_PLAYERS.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context + hook
// ─────────────────────────────────────────────────────────────────────────────
const AuctionContext = createContext<AuctionContextValue | null>(null);

export function useAuction(): AuctionContextValue {
  const ctx = useContext(AuctionContext);
  if (!ctx) throw new Error("useAuction must be used inside <AuctionProvider>");
  return ctx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — fetch players from DB with retries to beat race condition
// ─────────────────────────────────────────────────────────────────────────────
async function fetchPlayersWithRetry(
  auctionId: string,
  expectedCount: number,
  maxAttempts = 8,   // was 5
  delayMs = 600      // was 400
): Promise<Player[] | null> {
  const { supabase } = await import("@/lib/supabse");

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    const { data, error } = await supabase
      .from("players")
      .select("*")
      .eq("auction_id", auctionId)
      .order("lot_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });

    if (error) continue;

    const players = (data ?? []).map((p: any, i: number) => ({
      id:         i + 1,
      supabaseId: p.id,
      name:       p.name,
      role:       p.role,
      origin:     p.origin,
      price:      p.price,
      capped:     p.capped,
      img:        p.img ?? "",
      country:    p.country ?? "",
      lotOrder:   p.lot_order ?? null,
    }));

    // Accept if we got all players back with lot_order set
    if (players.length >= expectedCount && players.every((p) => p.lotOrder !== null)) {
      return players;
    }
  }

  return null; // all attempts failed
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────
export function AuctionProvider({ children }: { children: React.ReactNode }) {
  const [auction,       setAuction]       = useState<AuctionState>(INITIAL_STATE);
  const [isSaving,      setIsSaving]      = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [auctionList,   setAuctionList]   = useState<AuctionSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [links,         setLinks]         = useState<AuctionLinks | null>(null);
  const [shuffleReady,  setShuffleReady]  = useState(false);

  const auctionRef   = useRef<AuctionState>(INITIAL_STATE);
  const rulesTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { auctionRef.current = auction; }, [auction]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  async function ensureAuctionId(): Promise<string> {
    const current = auctionRef.current;
    if (current.auctionId) return current.auctionId;

    // Create the auction row
    const id = await createAuction(current.session.auctionName || "APL Auction");

    // Persist all teams that have no supabaseId yet
    const savedTeams = await Promise.all(
      current.teams.map(async (t) => {
        if (t.supabaseId) return t;
        const supabaseId = await upsertTeam(id, t);
        return { ...t, supabaseId };
      })
    );

    // Persist all players that have no supabaseId yet
    const savedPlayers = await Promise.all(
      current.players.map(async (p) => {
        if (p.supabaseId) return p;
        const supabaseId = await upsertPlayer(id, p);
        return { ...p, supabaseId };
      })
    );

    // Commit everything to state atomically
    setAuction((prev) => ({
      ...prev,
      auctionId: id,
      teams:   savedTeams,
      players: savedPlayers,
    }));

    localStorage.setItem("apl_auction_id", id);
    return id;
}

  function withSave<T>(fn: () => Promise<T>): Promise<T> {
    setIsSaving(true);
    setSaveError(null);
    return fn()
      .catch((err) => {
        // FIX: simplified error serialization — the elaborate key-iteration
        // added no value over a straightforward message extraction.
        const msg =
          err?.message ||
          err?.details ||
          err?.hint ||
          err?.code ||
          (typeof err === "string" ? err : null) ||
          "Unknown error (check console for details)";
        console.error("[AuctionContext] save error:", err);
        setSaveError(msg);
        throw err;
      })
      .finally(() => setIsSaving(false));
  }

  // Apply a freshly-loaded AuctionState and (re)compute shuffleReady from
  // the DB truth — always recomputed, never read from localStorage.
  function applyLoadedState(state: AuctionState) {
    setAuction(state);
    // FIX: shuffleReady is always derived from DB data; localStorage flag
    // was written but never read as the source of truth, so it's removed.
    const ready = computeShuffleReady(state.players);
    setShuffleReady(ready);
  }

  // Recompute links whenever auction id or teams change
  useEffect(() => {
    if (auction.auctionId) {
      setLinks(generateLinks(auction.auctionId, auction.teams));
    } else {
      setLinks(null);
    }
  }, [auction.auctionId, auction.teams]);

  // ── Re-hydrate on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const savedId = localStorage.getItem("apl_auction_id");

    if (savedId) {
      loadAuction(savedId)
        .then((state) => {
          if (!state) { localStorage.removeItem("apl_auction_id"); return; }
          const hasData = state.teams.length > 0 || state.players.length > 0;
          if (hasData) {
            applyLoadedState(state);
          } else {
            setAuction((prev) => ({ ...prev, auctionId: state.auctionId }));
          }
        })
        .catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load from Supabase ────────────────────────────────────────────────────
  const loadFromDb = useCallback(async (auctionId: string) => {
    const state = await loadAuction(auctionId);
    if (state) {
      applyLoadedState(state);
    }
  }, []);

  // ── Auction list ──────────────────────────────────────────────────────────

  const refreshAuctionList = useCallback(async () => {
    setIsLoadingList(true);
    try {
      setAuctionList(await listAuctions());
    } catch (err) {
      console.error("[AuctionContext] failed to load auction list:", err);
      setAuctionList([]);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // FIX: createNew and handleReauction now share resetIdCounters() instead
  // of each duplicating the same counter-reset lines.
  const createNew = useCallback((name?: string) => {
    localStorage.removeItem("apl_auction_id");
    resetIdCounters();
    setShuffleReady(false);
    setAuction({
      ...buildInitialState(),
      session: { ...DEFAULT_SESSION, auctionName: name ?? "APL Auction" },
    });
  }, []);

  const switchAuction = useCallback(async (id: string) => {
    localStorage.setItem("apl_auction_id", id);
    await loadFromDb(id);
  }, [loadFromDb]);

  const cloneFromPrevious = useCallback(async (sourceId: string, newName: string) => {
    await withSave(async () => {
      const newId = await cloneAuction(sourceId, newName);
      localStorage.setItem("apl_auction_id", newId);
      setShuffleReady(false);
      await loadFromDb(newId);
      await refreshAuctionList();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFromDb, refreshAuctionList]);

  // ── TEAMS ─────────────────────────────────────────────────────────────────

  const addTeam = useCallback(
    async (data: Omit<Team, "id" | "roster" | "supabaseId">) => {
      const newTeam: Team = { ...data, id: nextTeamId(), roster: 0 };
      setAuction((prev) => ({ ...prev, teams: [...prev.teams, newTeam] }));
      await withSave(async () => {
        const auctionId  = await ensureAuctionId();
        const supabaseId = await upsertTeam(auctionId, newTeam);
        setAuction((prev) => ({
          ...prev,
          teams: prev.teams.map((t) => t.id === newTeam.id ? { ...t, supabaseId } : t),
        }));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editTeam = useCallback(
    async (id: number, data: Omit<Team, "id" | "roster" | "supabaseId">) => {
      setAuction((prev) => ({
        ...prev,
        teams: prev.teams.map((t) => (t.id === id ? { ...t, ...data } : t)),
      }));
      await withSave(async () => {
        const team = auctionRef.current.teams.find((t) => t.id === id);
        if (!team) return;
        const auctionId = await ensureAuctionId();
        await upsertTeam(auctionId, { ...team, ...data });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deleteTeam = useCallback(
    async (id: number) => {
      const team = auctionRef.current.teams.find((t) => t.id === id);
      setAuction((prev) => ({ ...prev, teams: prev.teams.filter((t) => t.id !== id) }));
      if (team?.supabaseId) {
        await withSave(() => deleteTeamFromDb(team.supabaseId!));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── PLAYERS ───────────────────────────────────────────────────────────────

  const addPlayer = useCallback(
    async (data: Omit<Player, "id" | "supabaseId">) => {
      const newPlayer: Player = { ...data, id: nextPlayerId() };
      setAuction((prev) => ({ ...prev, players: [...prev.players, newPlayer] }));
      await withSave(async () => {
        const auctionId  = await ensureAuctionId();
        const supabaseId = await upsertPlayer(auctionId, newPlayer);
        setAuction((prev) => ({
          ...prev,
          players: prev.players.map((p) => p.id === newPlayer.id ? { ...p, supabaseId } : p),
        }));
      });
      // A brand new player has no lot_order yet — pool is no longer ready
      // until the next shuffle, regardless of auction status (live or not).
      setShuffleReady(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editPlayer = useCallback(
    async (id: number, data: Omit<Player, "id" | "supabaseId">) => {
      setAuction((prev) => ({
        ...prev,
        players: prev.players.map((p) => (p.id === id ? { ...p, ...data } : p)),
      }));
      await withSave(async () => {
        const player = auctionRef.current.players.find((p) => p.id === id);
        if (!player) return;
        const auctionId = await ensureAuctionId();
        await upsertPlayer(auctionId, { ...player, ...data });
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deletePlayer = useCallback(
    async (id: number) => {
      const player = auctionRef.current.players.find((p) => p.id === id);
      setAuction((prev) => ({ ...prev, players: prev.players.filter((p) => p.id !== id) }));
      if (player?.supabaseId) {
        await withSave(() => deletePlayerFromDb(player.supabaseId!));
      }
      setShuffleReady(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ── RULES (debounced) ─────────────────────────────────────────────────────

  const updateRules = useCallback((rules: AuctionRules) => {
    setAuction((prev) => ({ ...prev, rules }));
    if (rulesTimer.current) clearTimeout(rulesTimer.current);
    rulesTimer.current = setTimeout(async () => {
      try {
        const id = auctionRef.current.auctionId;
        if (!id) return;
        await saveRules(id, rules);
      } catch (err) {
        console.error("[AuctionContext] rules auto-save failed:", err);
      }
    }, 1000);
  }, []);

  // ── SESSION (debounced) ───────────────────────────────────────────────────

  const updateSession = useCallback((session: SessionConfig) => {
    setAuction((prev) => ({ ...prev, session }));
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    sessionTimer.current = setTimeout(async () => {
      try {
        const id = auctionRef.current.auctionId;
        if (!id) return;
        await saveSession(id, session);
      } catch (err) {
        console.error("[AuctionContext] session auto-save failed:", err);
      }
    }, 1000);
  }, []);

  // ── SHUFFLE ───────────────────────────────────────────────────────────────
  const handleShuffle = useCallback(async () => {
    await withSave(async () => {
      const id = await ensureAuctionId(); // this already persists unpersisted teams/players
      
      // Re-read from ref after ensureAuctionId, which may have updated state
      // Wait a tick for state to settle
      await new Promise(r => setTimeout(r, 50));
      const currentPlayers = auctionRef.current.players;

      // Persist any still-unpersisted players (edge case: added after ensureAuctionId ran)
      const updatedPlayers = await Promise.all(
        currentPlayers.map(async (p) => {
          if (p.supabaseId) return p;
          const supabaseId = await upsertPlayer(id, p);
          return { ...p, supabaseId };
        })
      );

      // Commit any newly-persisted players to state
      const hadNewlySaved = updatedPlayers.some((p, i) => p.supabaseId !== currentPlayers[i].supabaseId);
      if (hadNewlySaved) {
        setAuction(prev => ({ ...prev, players: updatedPlayers }));
      }

      const orderPayload = await shufflePlayerOrder(id);
      const orderMap = new Map(orderPayload.map(({ id, lot_order }) => [id, lot_order]));

      const shuffledPlayers = [...updatedPlayers]
        .map(p => ({ ...p, lotOrder: orderMap.get(p.supabaseId ?? "") ?? p.lotOrder }))
        .sort((a, b) => (a.lotOrder ?? 0) - (b.lotOrder ?? 0));

      setAuction(prev => ({ ...prev, players: shuffledPlayers }));
      setShuffleReady(computeShuffleReady(shuffledPlayers));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── LIFECYCLE ─────────────────────────────────────────────────────────────

  const handleLaunch = useCallback(async () => {
    await withSave(async () => {
      const id = await saveFullAuctionAndLaunch(auctionRef.current);
      localStorage.setItem("apl_auction_id", id);
      setAuction((prev) => ({ ...prev, auctionId: id, status: "live" }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePause = useCallback(async () => {
    const id = auctionRef.current.auctionId;
    if (!id) return;
    await withSave(() => updateAuctionStatus(id, "paused"));
    setAuction((prev) => ({ ...prev, status: "paused" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResume = useCallback(async () => {
    const id = auctionRef.current.auctionId;
    if (!id) return;
    await withSave(() => updateAuctionStatus(id, "live"));
    setAuction((prev) => ({ ...prev, status: "live" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStop = useCallback(async () => {
    const id = auctionRef.current.auctionId;
    if (!id) return;
    await withSave(() =>
      updateAuctionStatus(id, "completed", { completed_at: new Date().toISOString() })
    );
    setAuction((prev) => ({ ...prev, status: "completed" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resets the CURRENT auction in place (DB-side: clears bid_history /
  // auction_lots / feedback, resets player sold/lot/unsold/reentry fields,
  // resets team roster/remaining_purse, resets rules.current_round, sets
  // auctions.status back to 'setup') and reloads it — keeping the same
  // teams/players/rules/session rather than wiping back to
  // DEFAULT_TEAMS/DEFAULT_PLAYERS. Falls back to a local-only reset if
  // there's no persisted auction yet (nothing in the DB to reset).
  const handleReauction = useCallback(async () => {
    const id = auctionRef.current.auctionId;
    if (!id) {
      localStorage.removeItem("apl_auction_id");
      resetIdCounters();
      setShuffleReady(false);
      setAuction(buildInitialState());
      return;
    }

    await withSave(async () => {
      await resetAuctionInDb(id);
      const state = await loadAuction(id);
      if (state) {
        applyLoadedState(state);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rulesTimer.current)   clearTimeout(rulesTimer.current);
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  const value: AuctionContextValue = {
    auction,
    isSaving,
    saveError,
    shuffleReady,
    auctionList,
    isLoadingList,
    links,
    addTeam,
    editTeam,
    deleteTeam,
    addPlayer,
    editPlayer,
    deletePlayer,
    updateRules,
    updateSession,
    handleLaunch,
    handlePause,
    handleResume,
    handleStop,
    handleReauction,
    handleShuffle,
    createNew,
    switchAuction,
    cloneFromPrevious,
    refreshAuctionList,
    loadFromDb,
  };

  return (
    <AuctionContext.Provider value={value}>
      {children}
    </AuctionContext.Provider>
  );
}