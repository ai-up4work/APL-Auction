"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

interface ShotClockContextValue {
  shotClock:   number;
  isLocked:    boolean;
  resetClock:  (anchorTime?: string | number, force?: boolean) => void;
  freezeClock: () => void;
  pauseClock:  () => void;
}

const ShotClockContext = createContext<ShotClockContextValue | null>(null);

export function useShotClock(): ShotClockContextValue {
  const ctx = useContext(ShotClockContext);
  if (!ctx) throw new Error("useShotClock must be used inside <ShotClockProvider>");
  return ctx;
}

interface ShotClockProviderProps {
  children:     React.ReactNode;
  timerSeconds: number;
}

type ClockMode = "running" | "paused" | "frozen";

export function ShotClockProvider({ children, timerSeconds }: ShotClockProviderProps) {
  const [shotClock, setShotClock] = useState(100);
  const [isLocked,  setIsLocked]  = useState(false);

  const modeRef   = useRef<ClockMode>("paused");
  const timerRef  = useRef(timerSeconds);
  const anchorRef = useRef<number>(Date.now());

  useEffect(() => { timerRef.current = timerSeconds; }, [timerSeconds]);

  useEffect(() => {
    const id = setInterval(() => {
      if (modeRef.current !== "running") return;
      const secs      = timerRef.current ?? 15;
      const elapsedMs = Date.now() - anchorRef.current;
      const pct       = Math.max(0, 100 - (elapsedMs / (secs * 1000)) * 100);
      setShotClock(pct);
      if (pct <= 0 && modeRef.current === "running") {
        modeRef.current = "frozen";
        setIsLocked(true);
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  const resetClock = useCallback((anchorTime?: string | number, force = false) => {
    const ts    = anchorTime ? new Date(anchorTime).getTime() : Date.now();
    const ageMs = Date.now() - ts;
    console.log('[shotclock] resetClock called, force=', force, 'ageMs=', ageMs, 'mode=', modeRef.current);
    if (!force) {
      const maxAge = (timerRef.current ?? 15) * 1000;
      if (ageMs > maxAge) { console.log('[shotclock] bailed - too old'); return; }
    }
    anchorRef.current = ts;
    modeRef.current   = "running";
    setShotClock(Math.max(0, 100 - (ageMs / ((timerRef.current ?? 15) * 1000)) * 100));
    setIsLocked(false);
    console.log('[shotclock] anchor reset successfully');
  }, []);

  const freezeClock = useCallback(() => {
    modeRef.current = "frozen";
    setShotClock(0);
    setIsLocked(false);
  }, []);

  const pauseClock = useCallback(() => {
    modeRef.current = "paused";
  }, []);

  return (
    <ShotClockContext.Provider value={{ shotClock, isLocked, resetClock, freezeClock, pauseClock }}>
      {children}
    </ShotClockContext.Provider>
  );
}