"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";

const NAV_ITEMS = [
  { segment: "bid",     icon: "gavel",    label: "Auction" },
  { segment: "squad",   icon: "groups",   label: "Squad"   },
  { segment: "budget",  icon: "payments", label: "Budget"  },
  { segment: "history", icon: "reorder",  label: "History" },
];

const NAV_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0');
  .nav-ms {
    font-family: 'Material Symbols Outlined';
    font-style: normal;
    line-height: 1;
    display: inline-block;
    user-select: none;
    font-size: 24px;
  }
`;

export default function BottomNavBar() {
  const pathname = usePathname();
  const params   = useParams();

  const auctionId = (params?.auctionId as string) ?? "";
  const teamCode  = (params?.teamCode  as string) ?? "";

  if (!auctionId || !teamCode) return null;

  const base = `/owner/${auctionId}/${teamCode}`;

  return (
    <>
      <style>{NAV_STYLES}</style>
      <nav
        className="fixed bottom-0 left-0 right-0 z-[100] flex justify-around items-center h-[68px]
          bg-[rgba(11,15,16,0.92)] backdrop-blur-2xl border-t border-white/[0.07]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {NAV_ITEMS.map((item) => {
          const href   = `${base}/${item.segment}`;
          // startsWith so nested sub-routes stay highlighted
          const active = pathname?.startsWith(href) ?? false;

          return (
            <Link
              key={href}
              href={href}
              className={[
                "flex flex-col items-center justify-center gap-0.5 px-3.5 py-1.5 rounded-xl no-underline min-w-[56px] transition-all duration-200",
                active
                  ? "text-theme-orange bg-theme-orange/[0.08] border border-theme-orange/[0.15]"
                  : "text-[#5a6a74] bg-transparent border border-transparent",
              ].join(" ")}
            >
              <span
                className={[
                  "nav-ms transition-all duration-200",
                  active ? "text-theme-orange" : "text-[#5a6a74]",
                ].join(" ")}
                style={{
                  fontVariationSettings: active
                    ? "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {item.icon}
              </span>
              <span
                className={[
                  "font-mono-geist text-[8px] uppercase tracking-[0.14em] transition-all duration-200",
                  active ? "font-semibold text-theme-orange" : "font-normal text-[#3a4a54]",
                ].join(" ")}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}