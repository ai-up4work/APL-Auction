"use client";

import { Shield, User, Lock, Download, Table2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { FlowCanvas } from '@/components/FlowCanvas';
import { ShuffleOverlay } from '@/components/ShuffleOverlay';
import { AUCTION_CONFIG } from './data';
import { Player, Team } from '@/types/sankeytype';

export default function Page() {
  const playerListRef = useRef<HTMLDivElement>(null);
  const teamListRef = useRef<HTMLDivElement>(null);

  const [players, setPlayers] = useState<Player[]>(AUCTION_CONFIG.players);
  const [activePlayer, setActivePlayer] = useState<string | null>(null);
  const [activeTeam, setActiveTeam] = useState<string | null>(null);

  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleTarget, setShuffleTarget] = useState<Player | null>(null);
  const [shuffleIndex, setShuffleIndex] = useState(0);

  const [viewMode, setViewMode] = useState<'flow' | 'table'>('flow');

  const togglePlayer = (p: Player) => {
    if (activePlayer === p.id) {
      setActivePlayer(null);
      setActiveTeam(null);
    } else {
      setActivePlayer(p.id);
      setActiveTeam(p.teamShortCode);
    }
  };

  const toggleTeam = (t: Team) => {
    if (activeTeam === t.shortCode && !activePlayer) {
      setActiveTeam(null);
    } else {
      setActiveTeam(t.shortCode);
      setActivePlayer(null);
    }
  };

  const hasSelection = activePlayer !== null || activeTeam !== null;

  const handleShuffle = () => {
    const lockedPlayers = players.filter(p => p.status === 'locked');
    if (lockedPlayers.length === 0) return;

    setIsShuffling(true);
    setShuffleTarget(null);
    setActivePlayer(null);
    setActiveTeam(null);
    
    const randomIndex = Math.floor(Math.random() * lockedPlayers.length);
    const winner = lockedPlayers[randomIndex];
    
    let currentDelay = 30; // Start very fast
    const maxDelay = 400; // Slow down to this delay
    const slowdownFactor = 1.1; // Multiplier per tick
    let currentIndex = Math.floor(Math.random() * lockedPlayers.length);
    
    const spin = () => {
      currentIndex = (currentIndex + 1) % lockedPlayers.length;
      setShuffleIndex(currentIndex);
      
      if (currentDelay < maxDelay) {
        currentDelay *= slowdownFactor;
        setTimeout(spin, currentDelay);
      } else {
        // Final selection
        setShuffleTarget(winner);
        
        setTimeout(() => {
          setPlayers(current => current.map(p => p.id === winner.id ? { ...p, status: 'pending' } : p));
          setIsShuffling(false);
          setShuffleTarget(null);
          setActivePlayer(winner.id);
          setActiveTeam(null);
          
          setTimeout(() => {
             const el = document.getElementById(`player-${winner.id}`);
             if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }, 2500); 
      }
    };
    
    spin();
  };

  const downloadReport = () => {
    const headers = ['Name', 'Status', 'Base Price', 'Team'];
    const rows = players.map(p => [
      p.name,
      p.status.toUpperCase(),
      p.price,
      p.teamShortCode || 'UNSOLD'
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "auction_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col font-body bg-[#0b0f10] text-[#e0e3e4]">
      {/* Shuffle Overlay */}
      <ShuffleOverlay 
        isShuffling={isShuffling}
        shuffleTarget={shuffleTarget}
        players={players}
        shuffleIndex={shuffleIndex}
      />

      {viewMode === 'table' ? (
        <main className="px-10 flex-1 flex flex-col relative overflow-hidden py-10">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <h2 className="text-2xl font-headline font-bold uppercase tracking-widest text-[#e45d35]">Auction Report</h2>
            <div className="flex gap-3">
              <button 
                onClick={downloadReport}
                className="text-xs font-mono px-4 py-2 bg-[#e45d35]/20 text-[#e45d35] hover:bg-[#e45d35]/40 rounded border border-[#e45d35]/50 transition-colors flex items-center gap-2"
              >
                <Download size={14} />
                DOWNLOAD CSV
              </button>
              <button 
                onClick={() => setViewMode('flow')}
                className="text-xs font-mono px-4 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
              >
                BACK TO FLOW
              </button>
            </div>
          </div>
          
          <div className="glass-panel rounded-xl overflow-hidden flex-1 flex flex-col">
            <div className="overflow-y-auto no-scrollbar flex-1">
              <table className="w-full text-left border-collapse relative">
                <thead className="sticky top-0 bg-[#181c1d] z-10 shadow-md">
                  <tr className="border-b border-white/10">
                    <th className="p-4 font-mono text-xs text-[#c6c6cd] uppercase font-medium">Player</th>
                    <th className="p-4 font-mono text-xs text-[#c6c6cd] uppercase font-medium">Status</th>
                    <th className="p-4 font-mono text-xs text-[#c6c6cd] uppercase font-medium">Base Price</th>
                    <th className="p-4 font-mono text-xs text-[#c6c6cd] uppercase font-medium">Team</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        {p.img ? (
                          <img src={p.img} alt={p.name} className="w-8 h-8 rounded-full object-cover bg-[#313536]" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#313536] flex items-center justify-center">
                            <User size={16} className="text-white/30" />
                          </div>
                        )}
                        <span className="font-medium text-sm">{p.name}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-mono px-2 py-1 rounded ${
                          p.status === 'sold' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                          p.status === 'locked' ? 'bg-white/5 text-white/40 border border-white/10' :
                          'bg-[#e45d35]/10 text-[#e45d35] border border-[#e45d35]/20'
                        }`}>
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-sm text-[#c6c6cd]">{p.price}</td>
                      <td className="p-4">
                        {p.teamShortCode ? (
                          <span className="font-bold text-xs tracking-wider">{p.teamShortCode}</span>
                        ) : (
                          <span className="text-white/20 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      ) : (
        <main className="px-10 flex-1 grid grid-cols-12 gap-0 relative overflow-hidden">
          
          <FlowCanvas 
            players={players} 
            playerListRef={playerListRef}
            teamListRef={teamListRef}
            activePlayer={activePlayer}
            activeTeam={activeTeam}
          />

          {/* Left Column: Player Pool */}
          <aside 
            ref={playerListRef}
            className="col-span-3 h-full overflow-y-auto no-scrollbar pr-8 z-10 border-r border-white/5 relative"
          >
            <div className="min-h-full flex flex-col justify-center gap-4 py-10">
              <div className="flex items-center justify-between shrink-0 mb-2">
                <h3 className="font-headline font-semibold text-lg tracking-tight uppercase">Player Pool</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleShuffle}
                    disabled={isShuffling || players.filter(p => p.status === 'locked').length === 0}
                    className="text-xs font-mono px-3 py-1 bg-[#e45d35]/20 text-[#e45d35] hover:bg-[#e45d35]/40 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-[#e45d35]/50 transition-colors"
                  >
                    SHUFFLE
                  </button>
                  <span className="text-xs font-mono px-2 py-1 bg-white/5 rounded border border-white/5">
                    Q: {players.length}
                  </span>
                </div>
              </div>
              <div className="flex flex-col space-y-3 relative">
                {players.map(p => {
                  const isLocked = p.status === 'locked';
                  const isHighlighted = hasSelection && !isLocked ? (activePlayer ? activePlayer === p.id : activeTeam === p.teamShortCode) : false;
                  const isDimmed = hasSelection && !isHighlighted && !isLocked;
                  
                  return (
                    <div 
                      key={p.id}
                      id={`player-${p.id}`}
                      onClick={() => !isLocked && togglePlayer(p)}
                      className={`glass-panel p-3 rounded-xl flex items-center gap-4 transition-all duration-300
                        ${!isLocked ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed grayscale'}
                        ${isHighlighted ? 'ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10' : ''}
                        ${isDimmed ? 'opacity-30' : ''}
                        ${p.status === 'sold' && !isHighlighted ? 'border-r-2 border-r-green-500/50' : ''}
                      `}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#313536] flex-shrink-0 flex items-center justify-center">
                        {p.img && !isLocked ? (
                          <img src={p.img} className="w-full h-full object-cover" alt={p.name} />
                        ) : (
                          isLocked ? <Lock size={20} className="text-white/20" /> : <User size={24} className="text-white/10" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.name}</p>
                        <p className={`text-[10px] font-mono font-medium mt-0.5 ${p.status === 'sold' ? 'text-green-400' : 'text-[#c6c6cd]'} uppercase`}>
                          {p.status === 'sold' ? `SOLD: ${p.price} • ${p.teamShortCode}` : `BASE: ${p.price}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Middle Column: Flow Visualization */}
          <section className="col-span-6 flex flex-col relative z-0">
            {/* Empty spacer for the grid */}
          </section>

          {/* Right Column: Franchises */}
          <aside 
            ref={teamListRef}
            className="col-span-3 h-full overflow-y-auto no-scrollbar pl-8 z-10 border-l border-white/5 relative"
          >
            <div className="min-h-full flex flex-col justify-center gap-4 py-10">
              <div className="flex items-center justify-between shrink-0 mb-2">
                <h3 className="font-headline font-semibold text-lg tracking-tight uppercase">Franchises</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setViewMode('table')}
                    className="text-xs font-mono px-3 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors flex items-center gap-1"
                  >
                    <Table2 size={12} />
                    TABLE
                  </button>
                  <span className="text-xs font-mono px-2 py-1 bg-white/5 rounded border border-white/5">
                    {AUCTION_CONFIG.teams.length} TEAMS
                  </span>
                </div>
              </div>
              <div className="flex flex-col space-y-3 relative">
                {AUCTION_CONFIG.teams.map(t => {
                  const isHighlighted = hasSelection ? activeTeam === t.shortCode : false;
                  const isDimmed = hasSelection && !isHighlighted;
                  
                  return (
                    <div 
                      key={t.id}
                      id={`team-${t.shortCode}`}
                      onClick={() => toggleTeam(t)}
                      className={`glass-panel p-3 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-300
                        ${isHighlighted ? 'ring-1 ring-[#e45d35] shadow-[0_0_15px_rgba(228,93,53,0.3)] bg-white/10' : 'border-l-2 border-l-transparent hover:border-[#e45d35]'}
                        ${isDimmed ? 'opacity-30' : 'opacity-100'}
                      `}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-[#1c2021] flex-shrink-0 flex items-center justify-center">
                        {t.logoUrl ? (
                          <img src={t.logoUrl} className="w-full h-full object-cover" alt={t.name} />
                        ) : (
                          <Shield size={24} className="text-white/10" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate uppercase tracking-tight">{t.name}</p>
                        <p className="text-[10px] font-mono text-[#e45d35] mt-0.5 tracking-wider">{t.purse}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

        </main>
      )}
    </div>
  );
}

