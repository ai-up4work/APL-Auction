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
  Tournament,
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
  listTournaments,
  createTournament,
  linkAuctionTournament,
  setTournamentOptOut,
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
  isHydrated: boolean;

  auctionList:   AuctionSummary[];
  isLoadingList: boolean;
  links:         AuctionLinks | null;

  // ── Tournament linking ──────────────────────────────────────────────────
  tournaments:             Tournament[];
  isLoadingTournaments:    boolean;
  /**
   * True when the auction has crossed 2 teams and hasn't yet been linked
   * to a tournament or explicitly opted out — drives the modal in
   * app/admin/page.tsx. Recomputed reactively (not set imperatively), so
   * it also re-appears if a stale/half-configured auction is reopened.
   */
  tournamentPromptOpen:    boolean;
  loadTournaments:         () => Promise<void>;
  linkTournament:          (tournamentId: string) => Promise<void>;
  createAndLinkTournament: (name: string, format: "single_elimination" | "double_elimination") => Promise<void>;
  skipTournamentLink:      () => Promise<void>;

  ensureAuctionId: () => Promise<string>;

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

  // FIX: createNew now persists BOTH the auctions row (name, status, owner)
  // AND a matching session_config row immediately, instead of only calling
  // createAuction() and relying on in-memory state to carry the name until
  // the first debounced Session-tab save. Without the session_config row,
  // a page reload (or returning to /admin later) would rehydrate straight
  // from loadAuction() -> sessionRaw === null -> DEFAULT_SESSION, silently
  // reverting the display name back to "APL Season 1 Auction" even though
  // auctions.name was correctly set to what the user typed.
  createNew:          (name: string) => Promise<void>;
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
    tournamentId:     null,
    tournamentOptOut: false,
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

// FIX: captains (ownerTeamCode set) are deliberately excluded from the
// shuffle and never given a lotOrder — see shufflePlayerOrder in
// auctionDb.ts (`.is("owner_team_code", null)`) and the assignCaptains
// comment ("never given a lot_order ... shufflePlayerOrder already
// excludes them"). The previous version of this function used
// `players.every(...)` over ALL players with no such exclusion, which
// meant any auction with at least one captain could never satisfy
// shuffleReady — that player's lotOrder would never become non-null no
// matter how many times "Shuffle" was clicked, permanently blocking the
// live draw from starting. Excluding captains here mirrors exactly what
// shufflePlayerOrder itself excludes, so "ready" means "every player who
// was ever going to get a lot_order actually has one."
function computeShuffleReady(players: Player[]): boolean {
  const shufflablePlayers = players.filter((p) => !p.ownerTeamCode);
  return shufflablePlayers.length > 0 && shufflablePlayers.every((p) => p.lotOrder != null);
}

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
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Tournament linking state ──────────────────────────────────────────────
  const [tournaments,          setTournaments]          = useState<Tournament[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(false);
  const [tournamentPromptOpen, setTournamentPromptOpen] = useState(false);

  const auctionRef   = useRef<AuctionState>(INITIAL_STATE);
  const rulesTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ensureAuctionIdPromiseRef = useRef<Promise<string> | null>(null);

  useEffect(() => { auctionRef.current = auction; }, [auction]);

  // Reactively show/hide the tournament prompt based on current state —
  // covers both "just added a 3rd team this session" and "reopened an
  // auction that already has 3+ teams and was never linked or opted out".
  useEffect(() => {
    if (!isHydrated) return;
    setTournamentPromptOpen(
      auction.teams.length > 2 && !auction.tournamentId && !auction.tournamentOptOut
    );
  }, [isHydrated, auction.teams.length, auction.tournamentId, auction.tournamentOptOut]);

  async function ensureAuctionId(): Promise<string> {
    const current = auctionRef.current;
    if (current.auctionId) return current.auctionId;

    if (ensureAuctionIdPromiseRef.current) {
      return ensureAuctionIdPromiseRef.current;
    }

    const run = async () => {
      if (auctionRef.current.auctionId) {
        return auctionRef.current.auctionId;
      }

      const id = await createAuction(current.session.auctionName || "APL Auction");

      const savedTeams = await Promise.all(
        current.teams.map(async (t) => {
          if (t.supabaseId) return t;
          const supabaseId = await upsertTeam(id, t);
          return { ...t, supabaseId };
        })
      );

      const savedPlayers = await Promise.all(
        current.players.map(async (p) => {
          if (p.supabaseId) return p;
          const supabaseId = await upsertPlayer(id, p);
          return { ...p, supabaseId };
        })
      );

      setAuction((prev) => ({
        ...prev,
        auctionId: id,
        teams:   savedTeams,
        players: savedPlayers,
      }));

      localStorage.setItem("apl_auction_id", id);
      return id;
    };

    const promise = run().finally(() => {
      ensureAuctionIdPromiseRef.current = null;
    });
    ensureAuctionIdPromiseRef.current = promise;
    return promise;
  }

  function withSave<T>(fn: () => Promise<T>): Promise<T> {
    setIsSaving(true);
    setSaveError(null);
    return fn()
      .catch((err) => {
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

  function applyLoadedState(state: AuctionState) {
    setAuction(state);
    const ready = computeShuffleReady(state.players);
    setShuffleReady(ready);
  }

  useEffect(() => {
    if (auction.auctionId) {
      setLinks(generateLinks(auction.auctionId, auction.teams));
    } else {
      setLinks(null);
    }
  }, [auction.auctionId, auction.teams]);

  useEffect(() => {
    const savedId = localStorage.getItem("apl_auction_id");

    if (!savedId) {
      setIsHydrated(true);
      return;
    }

    loadAuction(savedId)
      .then((state) => {
        if (!state) {
          localStorage.removeItem("apl_auction_id");
          return;
        }
        // FIX: previously only applied the loaded state when the auction
        // already had teams or players (`hasData`), and otherwise kept
        // just `auctionId` and silently discarded the real rules/session
        // that were already saved in the DB — falling back to hardcoded
        // frontend defaults instead (this is what caused a freshly-created
        // auction's name to revert to "APL Season 1 Auction" on reload).
        // Rules and session exist independently of team/player count, so
        // always apply whatever loadAuction() actually returned.
        applyLoadedState(state);
      })
      .catch(console.error)
      .finally(() => setIsHydrated(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFromDb = useCallback(async (auctionId: string) => {
    const state = await loadAuction(auctionId);
    if (state) {
      applyLoadedState(state);
    }
  }, []);

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

  // ── Tournament linking actions ────────────────────────────────────────────

  const loadTournaments = useCallback(async () => {
    setIsLoadingTournaments(true);
    try {
      setTournaments(await listTournaments());
    } catch (err) {
      console.error("[AuctionContext] failed to load tournaments:", err);
      setTournaments([]);
    } finally {
      setIsLoadingTournaments(false);
    }
  }, []);

  const linkTournament = useCallback(async (tournamentId: string) => {
    await withSave(async () => {
      const id = await ensureAuctionId();
      await linkAuctionTournament(id, tournamentId);
      setAuction((prev) => ({ ...prev, tournamentId, tournamentOptOut: false }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createAndLinkTournament = useCallback(
    async (name: string, format: "single_elimination" | "double_elimination") => {
      await withSave(async () => {
        const id = await ensureAuctionId();
        const tournamentId = await createTournament(name, format);
        await linkAuctionTournament(id, tournamentId);
        setAuction((prev) => ({ ...prev, tournamentId, tournamentOptOut: false }));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const skipTournamentLink = useCallback(async () => {
    await withSave(async () => {
      const id = await ensureAuctionId();
      await setTournamentOptOut(id, true);
      setAuction((prev) => ({ ...prev, tournamentOptOut: true }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX: createNew now persists the auctions row AND a matching
  // session_config row to Supabase immediately (see note on the
  // `createNew` type above for why session_config is required here too),
  // instead of only building local state and waiting for the first
  // team/player/save to lazily create it via ensureAuctionId. This means:
  //   - a name is required (also enforced in AuctionPicker before this
  //     is ever called, but re-checked here defensively)
  //   - the auctions row (with created_by/org_id stamped, empty teams/
  //     players) exists in the DB as soon as this resolves, so it shows
  //     up in "Choose an Auction" even if the user adds nothing else
  //   - the session_config row exists too, so a reload pulls the real
  //     auction name back instead of DEFAULT_SESSION's hardcoded one
  //   - callers should await this and only leave the picker on success;
  //     on failure, saveError is set and nothing local changes
  const createNew = useCallback(async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Auction name is required.");
    }

    resetIdCounters();

    await withSave(async () => {
      const id = await createAuction(trimmedName);
      const newSession: SessionConfig = { ...DEFAULT_SESSION, auctionName: trimmedName };

      // Persist session_config right away — without this the row simply
      // doesn't exist until the first debounced save from the Session tab,
      // and any reload before that point falls back to DEFAULT_SESSION.
      await saveSession(id, newSession);

      localStorage.setItem("apl_auction_id", id);
      setShuffleReady(false);
      setAuction({
        auctionId: id,
        status:    "setup",
        tournamentId:     null,
        tournamentOptOut: false,
        teams:     [],
        players:   [],
        rules:     DEFAULT_RULES,
        session:   newSession,
      });
    });

    // Refresh the picker's list in the background so the new auction shows
    // up immediately if the user navigates back to "Choose an Auction".
    refreshAuctionList();
  }, [refreshAuctionList]);

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

  const handleShuffle = useCallback(async () => {
    await withSave(async () => {
      const id = await ensureAuctionId();

      await new Promise(r => setTimeout(r, 50));
      const currentPlayers = auctionRef.current.players;

      const updatedPlayers = await Promise.all(
        currentPlayers.map(async (p) => {
          if (p.supabaseId) return p;
          const supabaseId = await upsertPlayer(id, p);
          return { ...p, supabaseId };
        })
      );

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

  useEffect(() => {
    return () => {
      if (rulesTimer.current)   clearTimeout(rulesTimer.current);
      if (sessionTimer.current) clearTimeout(sessionTimer.current);
    };
  }, []);

  const value: AuctionContextValue = {
    auction,
    isSaving,
    saveError,
    shuffleReady,
    isHydrated,
    auctionList,
    isLoadingList,
    links,
    tournaments,
    isLoadingTournaments,
    tournamentPromptOpen,
    loadTournaments,
    linkTournament,
    createAndLinkTournament,
    skipTournamentLink,
    ensureAuctionId,
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