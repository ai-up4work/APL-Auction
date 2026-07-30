// app/owner/[auctionId]/join/page.tsx
"use client";

import React, { use, useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import MobileOnlyWrapper from "@/components/MobileOnlyWrapper";
import { supabase } from "@/lib/supabase";

interface TeamOption {
  id:    string;
  code:  string;
  name:  string;
  color: string;
  logo:  string | null;
  owner: string | null;
}

type Step        = "select" | "pin";
type VerifyState = "idle" | "loading" | "error" | "granted";

// Fallback used only when a team has no color set in the DB — matches the
// app's real theme-orange token instead of an unrelated hardcoded hex.
const THEME_ORANGE = "#c9971f";

function sessionKey(auctionId: string, teamCode: string) {
  return `owner_auth_${auctionId}_${teamCode.toLowerCase()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEAM CAROUSEL  (replaces FranchiseCarousel, uses real TeamOption shape)
// ─────────────────────────────────────────────────────────────────────────────

function TeamCarousel({
  teams,
  selectedCode,
  onChange,
}: {
  teams:        TeamOption[];
  selectedCode: string;
  onChange:     (code: string) => void;
}) {
  const currentIdx         = teams.findIndex((t) => t.code === selectedCode);
  const dragStartX         = useRef<number | null>(null);
  const draggingPointerId  = useRef<number | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      const next = ((idx % teams.length) + teams.length) % teams.length;
      onChange(teams[next].code);
    },
    [teams, onChange]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current        = e.clientX;
    draggingPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const finishDrag = (e: React.PointerEvent) => {
    if (dragStartX.current === null || draggingPointerId.current !== e.pointerId) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current        = null;
    draggingPointerId.current = null;
    if (Math.abs(dx) > 30) goTo(currentIdx + (dx < 0 ? 1 : -1));
  };

  const onPointerCancel = () => {
    dragStartX.current        = null;
    draggingPointerId.current = null;
  };

  const getStyle = (rel: number): React.CSSProperties => {
    const n    = teams.length;
    const norm = ((rel % n) + n) % n;
    const r    = norm > n / 2 ? norm - n : norm;

    if (r === 0)
      return {
        transform: "translateX(0) translateZ(0) rotateY(0deg) scale(1)",
        opacity:   1,
        filter:    "none",
        zIndex:    10,
      };

    const side = r < 0 ? -1 : 1;
    const far  = Math.abs(r) > 1;
    return {
      transform: `translateX(${side * (far ? 230 : 128)}px) translateZ(${far ? -160 : -80}px) rotateY(${-side * (far ? 45 : 28)}deg) scale(${far ? 0.65 : 0.82})`,
      opacity:   far ? 0 : 0.6,
      filter:    far ? "blur(3px) grayscale(0.7)" : "blur(1px) grayscale(0.6)",
      zIndex:    far ? 1 : 5,
    };
  };

  const selectedTeam = teams[currentIdx];
  const accentColor  = selectedTeam?.color ?? THEME_ORANGE;

  return (
    <div className="w-full flex flex-col items-center select-none">
      {/* 3-D scene */}
      <div
        className="relative w-full h-[280px] overflow-hidden touch-none"
        style={{ perspective: "900px", perspectiveOrigin: "50% 50%" }}
        onPointerDown={onPointerDown}
        onPointerUp={finishDrag}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
      >
        <div className="absolute inset-0 flex items-center justify-center [transform-style:preserve-3d]">
          {teams.map((team, i) => {
            const rel      = i - currentIdx;
            const isActive = rel === 0;

            return (
              <div
                key={team.code}
                onClick={() => goTo(i)}
                className="absolute cursor-pointer w-[172px] [transform-style:preserve-3d] [transition:transform_0.45s_cubic-bezier(0.25,0.46,0.45,0.94),opacity_0.45s_ease,filter_0.45s_ease] [will-change:transform,opacity,filter]"
                style={getStyle(rel)}
              >
                <div
                  className="relative rounded-[18px] overflow-hidden border [transition:border-color_0.4s_ease,box-shadow_0.4s_ease] bg-gradient-to-br from-[#1a1f20] to-[#111415]"
                  style={{
                    borderColor: isActive ? `${team.color}70` : "rgba(255,255,255,0.07)",
                    boxShadow:   isActive ? `0 0 28px ${team.color}40` : "none",
                  }}
                >
                  {/* Top accent bar */}
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5 z-10 transition-[background] duration-400"
                    style={{ background: isActive ? team.color : "transparent" }}
                  />

                  {/* Shimmer */}
                  <div className="absolute inset-0 pointer-events-none rounded-[18px] z-10 bg-gradient-to-br from-white/[0.04] to-transparent" />

                  {/* Logo / initials area */}
                  <div
                    className="relative w-full h-[148px] flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${team.color}18 0%, rgba(11,15,16,0.95) 100%)` }}
                  >
                    {team.logo ? (
                      <div className="relative w-full h-full">
                        <img
                          src={team.logo}
                          alt={team.code}
                          className="w-full h-full object-cover"
                          style={{ filter: isActive ? "none" : "grayscale(0.4)" }}
                        />
                      </div>
                    ) : (
                      <span
                        className="font-archivo text-[52px] font-bold italic leading-none tracking-[-0.02em]"
                        style={{ color: isActive ? team.color : `${team.color}80` }}
                      >
                        {team.code}
                      </span>
                    )}

                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-b from-transparent to-[#111415]" />

                    {/* Ember glow */}
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full pointer-events-none w-20 h-10 blur-[18px] transition-[background] duration-450"
                      style={{ background: isActive ? `${team.color}45` : "transparent" }}
                    />
                  </div>

                  {/* Name + owner */}
                  <div className="flex flex-col items-center gap-0.5 px-3 pt-2 pb-4 relative">
                    <p className="font-archivo text-[13px] font-bold uppercase tracking-[0.04em] text-[#e0e3e4] leading-tight text-center">
                      {team.name}
                    </p>
                    {team.owner && (
                      <p className="font-mono-geist text-[9px] tracking-[0.14em] uppercase text-[#3a4a54] text-center">
                        {team.owner}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected label */}
      <p
        className="font-mono-geist text-[9px] tracking-[0.16em] uppercase mt-0.5 transition-colors duration-300"
        style={{ color: accentColor }}
      >
        {selectedTeam?.name ?? "Select franchise"}
      </p>

      {/* Pip dots */}
      <div className="flex items-center gap-[7px] mt-3">
        {teams.map((team, i) => (
          <button
            key={team.code}
            onClick={() => goTo(i)}
            className="h-[5px] transition-all duration-300"
            style={{
              width:        i === currentIdx ? 18 : 5,
              background:   i === currentIdx ? accentColor : "rgba(255,255,255,0.15)",
              borderRadius: i === currentIdx ? 3 : "50%",
            }}
            aria-label={`Select ${team.name}`}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN KEY
// ─────────────────────────────────────────────────────────────────────────────

function PinKey({
  label, sub, icon, onPress, variant = "default",
}: {
  label?:   string;
  sub?:     string;
  icon?:    string;
  onPress:  () => void;
  variant?: "default" | "clear" | "back";
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onPress(); }}
      onPointerLeave={() => setPressed(false)}
      className={[
        "flex flex-col items-center justify-center rounded-2xl transition-all duration-100 select-none h-full w-full",
        variant === "back" ? "border-none" : "border border-white/[0.07]",
        pressed
          ? variant === "clear" ? "bg-theme-orange/15" : "bg-white/[0.08]"
          : variant === "back" ? "bg-transparent" : "bg-white/[0.04]",
        pressed ? "scale-[0.94]" : "scale-100",
      ].join(" ")}
    >
      {icon ? (
        <span
          className={`material-symbols-outlined text-[26px] [font-variation-settings:'FILL'_0,'wght'_300] ${variant === "clear" ? "text-theme-orange" : "text-[#c6c6cd]"}`}
        >
          {icon}
        </span>
      ) : (
        <>
          <span className={`font-archivo text-[26px] font-semibold leading-none ${variant === "clear" ? "text-theme-orange" : "text-[#e0e3e4]"}`}>
            {label}
          </span>
          {sub && (
            <span className="font-mono-geist text-[8px] text-[#3a4a54] tracking-[0.12em] mt-0.5">
              {sub}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FLOW
// ─────────────────────────────────────────────────────────────────────────────

function JoinFlow({ auctionId }: { auctionId: string }) {
  const router = useRouter();

  const [step,         setStep]        = useState<Step>("select");
  const [teams,        setTeams]       = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadError,    setLoadError]   = useState<string | null>(null);
  const [auctionName,  setAuctionName] = useState<string>("Auction");
  const [auctionLogo,  setAuctionLogo] = useState<string | null>(null);  // ← NEW
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [pin,          setPin]         = useState("");
  const [verifyState,  setVerifyState] = useState<VerifyState>("idle");
  const [errorMsg,     setErrorMsg]    = useState("");

  const PIN_LENGTH = 6;

  // ── Load teams + auction name ─────────────────────────────────────────────
  useEffect(() => {
    async function fetchTeams() {
        const [{ data, error }, { data: auctionRow }, { data: sc }] = await Promise.all([
        supabase
            .from("teams")
            .select("id, code, name, color, logo, owner")
            .eq("auction_id", auctionId)
            .order("created_at", { ascending: true }),
        supabase
            .from("auctions")
            .select("name")
            .eq("id", auctionId)
            .single(),
        supabase
            .from("session_config")
            .select("auction_logo")
            .eq("auction_id", auctionId)
            .maybeSingle(),
        ]);

        if (auctionRow?.name) setAuctionName(auctionRow.name);
        if (sc?.auction_logo) setAuctionLogo(sc.auction_logo);

      if (error || !data) {
        setLoadError("Couldn't load teams. Check the auction link.");
        setLoadingTeams(false);
        return;
      }

      const mapped: TeamOption[] = data.map((t: any) => ({
        id:    t.id,
        code:  t.code,
        name:  t.name,
        color: t.color || THEME_ORANGE,
        logo:  t.logo  || null,
        owner: t.owner || null,
      }));

      setTeams(mapped);
      if (mapped.length > 0) setSelectedCode(mapped[0].code);
      setLoadingTeams(false);
    }

    fetchTeams().catch(() => {
      setLoadError("Network error. Please try again.");
      setLoadingTeams(false);
    });
  }, [auctionId]);

  // ── PIN input ─────────────────────────────────────────────────────────────
  const appendDigit = (d: string) => {
    if (pin.length >= PIN_LENGTH || verifyState !== "idle") return;
    const next = pin + d;
    setPin(next);
    setErrorMsg("");
    if (next.length === PIN_LENGTH) verify(next);
  };

  const backspace = () => {
    if (verifyState === "loading") return;
    setPin((p) => p.slice(0, -1));
    setErrorMsg("");
    if (verifyState === "error") setVerifyState("idle");
  };

  const clear = () => {
    if (verifyState === "loading") return;
    setPin("");
    setErrorMsg("");
    setVerifyState("idle");
  };

  // ── Verify ────────────────────────────────────────────────────────────────
  async function verify(pinToCheck: string) {
    if (!selectedCode) return;
    setVerifyState("loading");
    setErrorMsg("");

    try {
        const { data, error } = await supabase.rpc("verify_team_pin", {
        p_auction_id: auctionId,
        p_team_code:  selectedCode,
        p_pin:        pinToCheck,
        });

        if (error || !data) {
        setVerifyState("error");
        setErrorMsg("Wrong PIN. Try again.");
        setPin("");
        // ← reset after shake animation completes (350ms) + small buffer
        setTimeout(() => {
            setVerifyState("idle");
            setErrorMsg("");
        }, 1000);
        return;
        }

        sessionStorage.setItem(
        sessionKey(auctionId, selectedCode),
        JSON.stringify({ teamId: data.id, verifiedAt: Date.now() })
        );

        setVerifyState("granted");
        setTimeout(() => {
        router.push(`/owner/${auctionId}/${selectedCode.toLowerCase()}`);
        }, 700);
    } catch {
        setVerifyState("error");
        setErrorMsg("Something went wrong. Try again.");
        setPin("");
        setTimeout(() => {
        setVerifyState("idle");
        setErrorMsg("");
        }, 2000);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedTeam = teams.find((t) => t.code === selectedCode) ?? null;
  const accentColor  = selectedTeam?.color ?? THEME_ORANGE;

  // ── Loading / error states ────────────────────────────────────────────────
  if (loadingTeams) {
    return (
      <div className="h-dvh bg-[#0b0f10] flex flex-col items-center justify-center gap-4">
        <span className="material-symbols-outlined animate-spin text-theme-orange text-[40px] [font-variation-settings:'FILL'_1]">
          progress_activity
        </span>
        <p className="font-mono-geist text-[10px] text-[#3a4a54] uppercase tracking-[0.16em]">
          Loading teams…
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-dvh bg-[#0b0f10] flex flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="material-symbols-outlined text-red-500 text-[40px] [font-variation-settings:'FILL'_1]">error</span>
        <p className="font-mono-geist text-[11px] text-red-500 tracking-[0.08em]">{loadError}</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-dvh overflow-hidden text-[#e0e3e4] font-inter"
      style={{
        background: "radial-gradient(circle at 50% 0%, rgba(56,82,131,0.1) 0%, rgb(16,20,21) 80%), linear-gradient(rgb(11,15,16) 0%, rgb(16,20,21) 100%)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:ital,wght@0,400;0,600;0,700;1,700&family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        .material-symbols-outlined {
          font-family: 'Material Symbols Outlined';
          font-style: normal; line-height: 1;
          display: inline-block; user-select: none;
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        @keyframes slide-up   { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slide-left { from { opacity:0; transform:translateX(20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 5px rgba(201,151,31,0.3)} 50%{box-shadow:0 0 20px rgba(201,151,31,0.6)} }
        .anim-up    { animation: slide-up   0.28s ease both; }
        .anim-left  { animation: slide-left 0.28s ease both; }
        .anim-shake { animation: shake 0.35s ease both; }
        .pulse-glow { animation: pulse-glow 2s infinite ease-in-out; }
      `}</style>

      {/* ── Header ── */}
      <header className="shrink-0 h-14 flex items-center justify-between px-4 border-b z-50 bg-[#0b0f10]/90 backdrop-blur-2xl border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-13 h-13 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src={auctionLogo || "/valiant-league-logo.png"}
              alt="Auction logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-archivo text-[17px] font-bold italic text-white tracking-[-0.01em] uppercase">
              {auctionName}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="pulse-glow w-1.5 h-1.5 rounded-full inline-block bg-theme-orange" />
              <span className="font-mono-geist text-[8px] text-[#5a6a74] uppercase tracking-[0.16em]">
                Session Live
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === "pin" && (
            <button
              onClick={() => { setPin(""); setVerifyState("idle"); setErrorMsg(""); setStep("select"); }}
              className="bg-transparent border-none text-[#5a6a74] cursor-pointer flex items-center"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
          )}
          {/* Step pills */}
          <div className="flex items-center gap-1.5">
            {[1, 2].map((n) => {
              const active = (n === 1 && step === "select") || (n === 2 && step === "pin");
              const done   = n === 1 && step === "pin";
              return (
                <div
                  key={n}
                  className={[
                    "flex items-center justify-center rounded-full transition-all duration-300 w-[22px] h-[22px]",
                    done
                      ? "bg-theme-orange border-[1.5px] border-theme-orange"
                      : active
                      ? "bg-theme-orange/15 border-[1.5px] border-theme-orange/50"
                      : "bg-white/5 border-[1.5px] border-white/[0.08]",
                  ].join(" ")}
                >
                  {done ? (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span className={`font-mono-geist text-[9px] font-semibold ${active ? "text-theme-orange" : "text-[#3a4a54]"}`}>
                      {n}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* ════════════ STEP 1 — CAROUSEL ════════════ */}
      {step === "select" && (
        <div className="anim-up flex-1 flex flex-col min-h-0">
          <div className="shrink-0 px-4 pt-5 pb-2">
            <p className="font-mono-geist text-[10px] text-[#3a4a54] uppercase tracking-[0.18em]">
              Swipe to browse · tap to select
            </p>
            <h2 className="font-archivo text-[26px] font-bold italic text-white uppercase tracking-[-0.01em] leading-none mt-1">
              Who are you?
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-0">
            {teams.length > 0 && (
              <TeamCarousel
                teams={teams}
                selectedCode={selectedCode ?? teams[0].code}
                onChange={setSelectedCode}
              />
            )}
          </div>

          <div className="shrink-0 px-4 pt-3 pb-8">
            <button
              onClick={() => { if (selectedCode) setStep("pin"); }}
              disabled={!selectedCode}
              className="w-full h-[58px] rounded-xl border-none flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              style={{
                background: selectedCode ? accentColor : "rgba(255,255,255,0.05)",
                boxShadow:  selectedCode ? `0 6px 28px ${accentColor}50` : "none",
                cursor:     selectedCode ? "pointer" : "not-allowed",
              }}
            >
              <span className={`font-archivo text-[17px] font-bold italic uppercase tracking-[0.06em] ${selectedCode ? "text-white" : "text-[#3a4a54]"}`}>
                {selectedCode
                  ? `Join as ${selectedTeam?.name ?? selectedCode}`
                  : "Select a team first"}
              </span>
              {selectedCode && (
                <span className="material-symbols-outlined text-white text-xl [font-variation-settings:'FILL'_1]">
                  arrow_forward
                </span>
              )}
            </button>
          </div>
        </div>
      )}

    {/* ════════════ STEP 2 — PIN ════════════ */}
    {step === "pin" && (
        <div className="anim-in flex-1 flex flex-col min-h-0 px-4 pt-6 pb-5">

            {/* Team context */}
            <div className="shrink-0 text-center mb-5">
            <p className="font-mono-geist text-[10px] text-[#909097] uppercase tracking-[0.14em] mb-1">
                Joining as <span style={{ color: accentColor }}>{selectedTeam?.name}</span>
            </p>
            <h2 className="font-archivo text-2xl font-bold text-[#e0e3e4] uppercase tracking-[0.04em] m-0">
                Enter Secure PIN
            </h2>
            <p className="font-mono-geist text-[10px] text-[#3a4a54] uppercase tracking-[0.14em] mt-1">
                Authorized personnel only
            </p>
            </div>

            {/* PIN boxes */}
            <div
            className={`shrink-0 flex gap-3 mb-2 ${verifyState === "error" ? "anim-shake" : ""}`}
            key={verifyState === "error" ? "shake" : "still"}
            >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => {
                const filled  = i < pin.length;
                const isGrant = verifyState === "granted";
                const isErr   = verifyState === "error";
                return (
                <div
                    key={i}
                    className={[
                      "flex-1 h-16 rounded-xl flex items-center justify-center transition-all duration-200 backdrop-blur-xl",
                      isGrant ? "bg-green-500/[0.08] border border-green-500/50"
                        : isErr ? "bg-red-500/[0.08] border border-red-500/40"
                        : "bg-[#101415]/60",
                      filled ? "scale-105" : "scale-100",
                    ].join(" ")}
                    style={{
                      border: !isGrant && !isErr
                        ? filled ? `1px solid ${accentColor}60` : "1px solid rgba(255,255,255,0.1)"
                        : undefined,
                      boxShadow: filled && !isErr && !isGrant ? `0 0 10px ${accentColor}30` : "none",
                    }}
                >
                    <span
                      className="font-archivo text-[22px] font-bold"
                      style={{ color: isGrant ? "#22c55e" : isErr ? "#ef4444" : accentColor }}
                    >
                    {filled ? "●" : ""}
                    </span>
                </div>
                );
            })}
            </div>

            {/* Status message row */}
            <div className="shrink-0 h-7 flex items-center justify-center mb-3">
            {verifyState === "error" && errorMsg && (
                <p className="font-mono-geist text-[10px] text-red-500 uppercase tracking-[0.1em]">
                {errorMsg}
                </p>
            )}
            {verifyState === "granted" && (
                <p className="font-mono-geist text-[10px] text-green-500 uppercase tracking-[0.1em]">
                Access granted — entering bid room…
                </p>
            )}
            </div>

            {/* Keypad */}
            <div
            className={`flex-1 min-h-0 grid grid-cols-3 gap-4 mb-4 transition-opacity duration-200 ${
              verifyState === "loading" || verifyState === "granted" ? "opacity-40 pointer-events-none" : "opacity-100 pointer-events-auto"
            }`}
            style={{ gridTemplateRows: "repeat(4, 1fr)" }}
            >
            {["1","2","3","4","5","6","7","8","9"].map((num) => (
                <button
                key={num}
                onClick={() => appendDigit(num)}
                className="flex flex-col items-center justify-center rounded-xl transition-all duration-150 active:scale-95 bg-[#101415]/60 border border-white/10 backdrop-blur-xl font-archivo text-2xl font-semibold text-[#e0e3e4] cursor-pointer"
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(201,151,31,0.15)"; (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                >
                {num}
                </button>
            ))}

            {/* CLR */}
            <button
                onClick={clear}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 bg-[#101415]/60 border border-white/10 backdrop-blur-xl font-mono-geist text-[11px] font-semibold tracking-[0.12em] text-error cursor-pointer"
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(201,151,31,0.15)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)"; }}
            >
                CLEAR
            </button>

            {/* 0 */}
            <button
                onClick={() => appendDigit("0")}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 bg-[#101415]/60 border border-white/10 backdrop-blur-xl font-archivo text-2xl font-semibold text-[#e0e3e4] cursor-pointer"
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(201,151,31,0.15)"; (e.currentTarget as HTMLElement).style.transform = "scale(0.95)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.background = "rgba(16,20,21,0.6)";  (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
                0
            </button>

            {/* Backspace */}
            <button
                onClick={backspace}
                className="flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 bg-transparent border-none cursor-pointer"
                onPointerDown={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(0.9)"; }}
                onPointerUp={(e)   => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                onPointerLeave={(e)=> { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
            >
                <span className="material-symbols-outlined text-[28px] text-[#c6c6cd]">backspace</span>
            </button>
            </div>

            {/* Verify button — matches mock exactly */}
            <button
            onClick={() => { if (pin.length === PIN_LENGTH && verifyState === "idle") verify(pin); }}
            disabled={pin.length < PIN_LENGTH || verifyState === "loading" || verifyState === "granted"}
            className="shrink-0 w-full h-16 rounded-xl border-none flex items-center justify-center gap-2 transition-all duration-300 font-archivo text-lg font-bold uppercase tracking-[0.12em]"
            style={{
                cursor: pin.length < PIN_LENGTH || verifyState !== "idle" ? "not-allowed" : "pointer",
                background: verifyState === "granted"
                ? "rgba(34,197,94,0.85)"
                : verifyState === "loading"
                ? `${accentColor}80`
                : pin.length === PIN_LENGTH
                ? accentColor
                : "rgba(144,144,151,0.1)",
                color: pin.length === PIN_LENGTH || verifyState !== "idle"
                ? "#fff"
                : "rgba(224,227,228,0.3)",
                boxShadow: pin.length === PIN_LENGTH && verifyState === "idle"
                ? `0 0 25px ${accentColor}50`
                : "none",
            }}
            >
            {verifyState === "loading" && (
                <span className="material-symbols-outlined animate-spin text-[22px] [font-variation-settings:'FILL'_1]">
                sync
                </span>
            )}
            {verifyState === "granted" ? "Access Granted" : verifyState === "loading" ? "" : "Verify Access"}
            </button>
        </div>
    )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function JoinPage({ params }: { params: Promise<{ auctionId: string }> }) {
  const { auctionId } = use(params);
  return (
    <MobileOnlyWrapper>
      <JoinFlow auctionId={auctionId} />
    </MobileOnlyWrapper>
  );
}