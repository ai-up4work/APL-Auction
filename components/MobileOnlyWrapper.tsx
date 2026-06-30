"use client";
import { useEffect, useRef } from "react";

/* Reusable icon-font utility strings — keeps the Material Symbols setup
   as Tailwind utility classes (incl. arbitrary properties) instead of a
   global CSS selector. */
const ICON_BASE =
  "font-['Material_Symbols_Outlined'] not-italic normal-case leading-none tracking-normal inline-block whitespace-nowrap antialiased [direction:ltr] [font-feature-settings:'liga'] [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]";
const ICON_FILLED =
  "font-['Material_Symbols_Outlined'] not-italic normal-case leading-none tracking-normal inline-block whitespace-nowrap antialiased [direction:ltr] [font-feature-settings:'liga'] [font-variation-settings:'FILL'_1,'wght'_400,'GRAD'_0,'opsz'_24]";

function DesktopBlocker() {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x > 0 && y > 0 && x < rect.width && y < rect.height) {
        card.style.boxShadow = `0 10px 40px -10px rgba(0,0,0,0.5), ${x / 10}px ${y / 10}px 100px -50px rgba(201, 151, 31, 0.2)`;
      }
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText("https://console.apl.pro/live-auction-node-4").then(() => {
      const el = document.getElementById("apl-copy-success");
      if (!el) return;
      el.style.opacity = "1";
      el.style.pointerEvents = "auto";
      setTimeout(() => {
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }, 2000);
    });
  };

  return (
    <>
      {/* Only the things Tailwind utilities truly can't express: font imports
         and two custom keyframes with non-default durations/properties. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;600;700&family=Inter:wght@400;500&family=Geist:wght@400;500&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        @keyframes apl-pulse-glow {
          0%, 100% { opacity: 0.3; filter: blur(40px); }
          50%       { opacity: 0.6; filter: blur(60px); }
        }
        @keyframes apl-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div className="fixed inset-0 overflow-hidden bg-background text-on-background font-sans z-[9999] flex flex-col">
        {/* ── Atmospheric blobs ── */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-theme-orange opacity-10 [animation:apl-pulse-glow_4s_ease-in-out_infinite]" />
          <div className="absolute -bottom-[10%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-theme-orange opacity-5 [animation:apl-pulse-glow_4s_ease-in-out_infinite]" />
        </div>

        {/* ── Header ── */}
        <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-center h-[clamp(64px,8vw,72px)] px-[clamp(20px,4vw,40px)]">
          <div className="flex items-center gap-2.5">
            <span className={`${ICON_FILLED} text-theme-orange text-[clamp(22px,2.4vw,28px)]`}>security</span>
            <h1 className="font-archivo font-bold uppercase text-white tracking-[0.04em] leading-tight text-[clamp(22px,2.4vw,30px)] m-0">
              APL <span className="text-theme-orange">OWNER CONSOLE</span>
            </h1>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center overflow-hidden h-screen px-[clamp(16px,4vw,40px)] pt-[clamp(64px,8vw,72px)] pb-[clamp(40px,6vw,52px)]">

          {/* ── Center Console Card ── */}
          <div
            ref={cardRef}
            className="relative flex-shrink-0 w-full max-w-[clamp(560px,90vw,920px)] flex flex-row items-center overflow-visible rounded-lg border border-white/10 bg-surface-container/60 backdrop-blur-[20px] shadow-2xl p-[clamp(24px,4vw,36px)_clamp(28px,5vw,40px)] gap-[clamp(24px,5vw,180px)]"
          >
            {/* Internal glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-theme-orange/10 blur-2xl pointer-events-none" />

            {/* ── Phone graphic ── */}
            <div className="flex-shrink-0 flex items-center justify-center">
              <div className="group relative inline-block">
                {/* Rotating dashed ring */}
                <div className="absolute -top-3.5 -right-3.5 -bottom-3.5 -left-3.5 rounded-[44px] border-[1.5px] border-dashed border-theme-orange/30 [animation:apl-spin-slow_20s_linear_infinite]" />
                {/* Phone frame */}
                <div className="relative w-[clamp(160px,18vw,200px)] aspect-[200/370] bg-surface-container border-[5px] border-surface-container-high rounded-[34px] overflow-hidden shadow-[0_24px_48px_-10px_rgba(0,0,0,0.6)]">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-5 bg-surface-container-high rounded-b-[10px] z-20" />
                  {/* Phone content */}
                  <div className="absolute inset-0 flex flex-col items-center gap-3 p-[clamp(14px,2vw,18px)] pt-9 bg-gradient-to-br from-surface-container to-surface-container-high">
                    <div className="w-full h-1.5 rounded-full bg-theme-orange/20" />
                    <div className="self-start w-2/3 h-1.5 rounded-full bg-secondary/20" />
                    {/* QR */}
                    <div className="mt-5 p-3 rounded-xl bg-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.3)]">
                      <img
                        className="block w-[clamp(80px,9vw,100px)] h-[clamp(80px,9vw,100px)] transition-transform duration-500 group-hover:scale-105"
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuApRxH3oMh83BsKczCbC3rqq7i5LUXkwKq9YxZEPWEO0WzGuwSrr0uigizf7uJb80ceq_5i2WiZalDRuqheCrGWCcWnL3eju25kB5IoniGunIfhuKYPbxHx40mbLOCIoAjQmzTvFjZoaGlQB-_UKaJppOH8OW005AthlYA3mvt3aXhPM_ZsPIKFNkGHy0Swx5Qh8d04gt45YkkDt_DziZQnDj7z5i4J8vKBJN73kPeHRpXhtDknTFrCte7rtRFtyVSUtphxiDgTw4dc"
                        alt="QR Code"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="mt-5 flex flex-col gap-2.5 w-full">
                      <div className="w-full h-[26px] rounded bg-theme-orange shadow-[0_4px_16px_rgba(201,151,31,0.3)]" />
                      <div className="w-full h-[26px] rounded bg-white/5" />
                    </div>
                  </div>
                  {/* Reflective overlay */}
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                </div>
              </div>
            </div>

            {/* ── Content side ── */}
            <div className="flex-1 flex flex-col gap-[clamp(14px,2vw,18px)]">
              {/* Protocol Active badge */}
              <div className="w-fit flex items-center gap-[7px] px-3 py-1 rounded-full bg-theme-orange/10 border border-theme-orange/20 text-theme-orange font-['Geist',sans-serif] text-[10px] font-medium uppercase tracking-[0.1em]">
                <span className="relative flex w-[7px] h-[7px]">
                  <span className="absolute inset-0 rounded-full bg-theme-orange opacity-75 animate-ping" />
                  <span className="relative w-[7px] h-[7px] rounded-full bg-theme-orange inline-block" />
                </span>
                Protocol Active
              </div>

              {/* Heading */}
              <div className="flex flex-col gap-2.5">
                <h2 className="font-archivo font-bold uppercase text-white tracking-[0.02em] leading-[1.18] text-[clamp(26px,3vw,34px)] m-0">
                  MOBILE DEVICE <br /><span className="text-theme-orange">REQUIRED</span>
                </h2>
                <p className="m-0 text-on-surface-variant leading-[1.55] text-[clamp(13px,1.3vw,14px)]">
                  The APL Owner Console is a high-performance environment optimized exclusively for mobile bidding. Please scan the code or access this link on your smartphone to join the auction.
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCopy}
                  className="relative flex items-center justify-center gap-2.5 w-full px-5 py-[13px] rounded text-background font-archivo font-semibold cursor-pointer border-none text-[clamp(16px,1.8vw,20px)] bg-theme-orange hover:brightness-90 active:scale-95 transition-[filter,transform] duration-150 shadow-[0_4px_20px_rgba(201,151,31,0.3)]"
                >
                  <span className={`${ICON_BASE} text-[20px]`}>content_copy</span>
                  <span>COPY SECURE LINK</span>
                  <span
                    id="apl-copy-success"
                    className="absolute inset-0 flex items-center justify-center rounded bg-green-600 text-white font-archivo font-semibold text-[clamp(16px,1.8vw,20px)] opacity-0 pointer-events-none transition-opacity duration-300"
                  >
                    <span className={`${ICON_BASE} mr-2`}>check_circle</span>
                    LINK COPIED
                  </span>
                </button>

                {/* OR VISIT divider */}
                <div className="flex items-center gap-3 text-on-surface-variant/40">
                  <hr className="flex-1 m-0 border-0 border-t border-white/10" />
                  <span className="whitespace-nowrap font-['Geist',sans-serif] text-xs font-medium tracking-[0.05em]">OR VISIT</span>
                  <hr className="flex-1 m-0 border-0 border-t border-white/10" />
                </div>

                <div className="text-center text-theme-orange font-['Geist',sans-serif] text-[13px] font-medium tracking-[0.05em] cursor-pointer hover:underline hover:underline-offset-4">
                  console.apl.pro/live-auction-node-4
                </div>
              </div>
            </div>
          </div>

          {/* ── Bento cards ── */}
          <div className="grid grid-cols-3 w-full max-w-[clamp(560px,90vw,920px)] flex-shrink-0 gap-[clamp(10px,1.5vw,14px)] mt-[clamp(12px,2vw,16px)]">
            {[
              { icon: "timer",                title: "Real-time Latency",  desc: "Experience sub-50ms bid execution on our dedicated mobile rail." },
              { icon: "phonelink_setup",      title: "Secure Identity",    desc: "Leverage FaceID or Biometrics for instant, multi-factor bid authorization." },
              { icon: "notifications_active", title: "Push Overrides",     desc: "Never miss a closing window with critical haptic auction feedback." },
            ].map((c) => (
              <div key={c.icon} className="flex items-start gap-3.5 rounded-lg border border-white/10 bg-surface-container/60 backdrop-blur-[20px] p-[clamp(14px,2vw,18px)_clamp(16px,2.2vw,20px)]">
                <span className={`${ICON_FILLED} flex-shrink-0 text-theme-orange text-[20px]`}>{c.icon}</span>
                <div>
                  <h4 className="m-0 mb-1 font-archivo font-semibold uppercase text-white text-xs tracking-[0.06em]">{c.title}</h4>
                  <p className="m-0 font-sans text-xs leading-[18px] text-on-surface-variant">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* ── Footer ── */}
        <footer className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between h-[52px] px-[clamp(20px,4vw,40px)] border-t border-white/5 bg-surface-container/80 backdrop-blur-md">
          <div className="flex items-center gap-[7px] font-['Geist',sans-serif] text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant/60">
            <span className="inline-block w-[7px] h-[7px] rounded-full bg-status-live" />
            Auction Node Status: Operational
          </div>
          <div className="font-['Geist',sans-serif] text-[10px] font-medium uppercase tracking-[0.1em] text-on-surface-variant/40">
            © 2024 APL INTERNATIONAL • WAR ROOM TERMINAL V4.2
          </div>
        </footer>
      </div>
    </>
  );
}

export default function MobileOnlyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Desktop (sm+): show full-screen blocker */}
      <div className="hidden sm:block">
        <DesktopBlocker />
      </div>

      {/* Mobile: show the actual page */}
      <div className="sm:hidden block w-full min-h-screen">
        {children}
      </div>
    </>
  );
}