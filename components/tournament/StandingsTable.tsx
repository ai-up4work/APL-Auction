// File: components/standings/StandingsTable.tsx
"use client";
import type { StandingsRow } from "@/lib/tournament/roundRobin";

export default function StandingsTable({ title, rows, qualifyCount = 2 }: { title?: string; rows: StandingsRow[]; qualifyCount?: number }) {
  return (
    <div className="rounded-xl border border-border-overlay bg-surface-container-low overflow-hidden">
      {title && (
        <div className="px-4 py-2.5 border-b border-border-overlay">
          <h3 className="font-label-mono text-[11px] font-black uppercase tracking-widest text-on-surface-variant">{title}</h3>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-outline font-label-mono text-[10px] uppercase tracking-wider border-b border-border-overlay">
            <th className="text-left px-4 py-2 font-bold">Team</th>
            <th className="px-2 py-2 font-bold">P</th>
            <th className="px-2 py-2 font-bold">W</th>
            <th className="px-2 py-2 font-bold">D</th>
            <th className="px-2 py-2 font-bold">L</th>
            <th className="px-2 py-2 font-bold">PF</th>
            <th className="px-2 py-2 font-bold">PA</th>
            <th className="px-3 py-2 font-bold text-theme-orange">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className={`border-b border-border-overlay/50 ${i < qualifyCount ? "bg-theme-orange/5" : ""}`}>
              <td className="px-4 py-2 font-label-mono font-bold text-on-surface">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  {r.name}
                </span>
              </td>
              <td className="px-2 py-2 text-center text-on-surface-variant">{r.played}</td>
              <td className="px-2 py-2 text-center text-on-surface-variant">{r.wins}</td>
              <td className="px-2 py-2 text-center text-on-surface-variant">{r.draws}</td>
              <td className="px-2 py-2 text-center text-on-surface-variant">{r.losses}</td>
              <td className="px-2 py-2 text-center text-outline">{r.pointsFor}</td>
              <td className="px-2 py-2 text-center text-outline">{r.pointsAgainst}</td>
              <td className="px-3 py-2 text-center font-black text-theme-orange">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}