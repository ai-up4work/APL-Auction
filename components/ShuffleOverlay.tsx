import { Player } from '@/types/sankeytype';
import { User } from 'lucide-react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
  shuffleTarget: Player | null;
  players: Player[];
  shuffleIndex: number;
}

export function ShuffleOverlay({ isShuffling, shuffleTarget, players, shuffleIndex }: ShuffleOverlayProps) {
  if (!isShuffling && !shuffleTarget) return null;

  const lockedPlayers = players.filter(p => p.status === 'locked');
  const displayPlayer = shuffleTarget || lockedPlayers[shuffleIndex % lockedPlayers.length];
  
  if (!displayPlayer) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0b0f10]/95 backdrop-blur-md">
      {/* Decorative background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div 
          className={`w-[600px] h-[600px] rounded-full blur-[120px] transition-all duration-1000 ease-out
            ${shuffleTarget ? 'bg-[#e45d35]/30 scale-150' : 'bg-[#e45d35]/10 scale-100 animate-pulse'}
          `} 
        />
      </div>

      <div className="relative flex flex-col items-center justify-center z-10 w-full">
        <h2 className={`text-3xl md:text-4xl font-headline font-bold tracking-[0.2em] uppercase mb-12 transition-all duration-500 text-center
          ${shuffleTarget ? 'text-[#e45d35] drop-shadow-[0_0_15px_rgba(228,93,53,0.8)] scale-110' : 'text-white/70 animate-pulse'}
        `}>
          {shuffleTarget ? 'Player Revealed' : 'Selecting Player...'}
        </h2>
        
        {/* The Card */}
        <div className={`relative transition-all duration-700 ease-out
          ${shuffleTarget ? 'scale-110 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-90'}
        `}>
          {/* Card Border Glow */}
          <div className={`absolute -inset-1 bg-gradient-to-b from-[#e45d35] to-transparent rounded-[32px] blur-md transition-opacity duration-500 ${shuffleTarget ? 'opacity-60' : 'opacity-20'}`} />
          
          <div className="relative bg-[#101415] border border-[#e45d35]/40 p-4 rounded-[28px] flex flex-col items-center w-72 sm:w-80 h-[460px] shadow-2xl overflow-hidden">
            
            {/* Inner scanning line for shuffling effect */}
            {!shuffleTarget && (
              <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-[28px]">
                <div className="w-full h-[200%] bg-gradient-to-b from-transparent via-[#e45d35]/30 to-transparent animate-scan" />
              </div>
            )}

            <div className="w-full flex-1 rounded-2xl overflow-hidden bg-[#181c1d] flex items-center justify-center relative border border-white/10 z-10">
              {displayPlayer.img ? (
                <img 
                  src={displayPlayer.img} 
                  className={`w-full h-full object-cover transition-all duration-100 
                    ${!shuffleTarget ? 'scale-125 blur-[2px] opacity-80' : 'scale-100 blur-none opacity-100'}
                  `} 
                  alt={displayPlayer.name} 
                />
              ) : (
                <User size={100} className={`text-white/10 transition-all duration-100 ${!shuffleTarget ? 'blur-[2px] scale-110' : 'scale-100'}`} />
              )}
              {/* Overlay gradient on image */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#101415] via-transparent to-transparent opacity-80" />
            </div>
            
            <div className="w-full text-center mt-6 mb-4 relative z-10 flex flex-col items-center">
              <p className={`font-headline font-bold text-3xl tracking-tight text-white transition-all duration-100 
                ${!shuffleTarget ? 'blur-[1px] opacity-70 translate-y-1' : 'blur-none opacity-100 translate-y-0'}
              `}>
                {displayPlayer.name}
              </p>
              <div className={`mt-4 inline-block px-5 py-2 rounded-full border transition-all duration-300
                ${shuffleTarget ? 'bg-[#e45d35]/10 border-[#e45d35]/30 shadow-[0_0_15px_rgba(228,93,53,0.2)]' : 'bg-white/5 border-white/10'}
              `}>
                <p className={`text-sm font-mono font-medium tracking-widest uppercase transition-colors duration-300
                  ${shuffleTarget ? 'text-[#e45d35]' : 'text-[#c6c6cd]'}
                `}>
                  Base: {displayPlayer.price}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
