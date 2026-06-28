import { Player } from '@/types/sankeytype';
import { User } from 'lucide-react';
import { useEffect, useRef, useState, useMemo } from 'react';

interface ShuffleOverlayProps {
  isShuffling: boolean;
  shuffleTarget: Player | null;
  players: Player[];
  shuffleIndex: number;
}

export function ShuffleOverlay({ isShuffling, shuffleTarget, players, shuffleIndex }: ShuffleOverlayProps) {
  const lockedPlayers = useMemo(() => players.filter(p => p.status === 'locked'), [players]);

  const [absoluteIndex, setAbsoluteIndex] = useState(() => {
    return isShuffling && lockedPlayers.length > 0 ? 3 * lockedPlayers.length + shuffleIndex : 0;
  });
  
  const prevIndex = useRef(shuffleIndex);
  
  const trackPlayers = useMemo(() => {
    if (lockedPlayers.length === 0) return [];
    // 6 copies of lockedPlayers gives us plenty of track to scroll through
    // without ever having to jump the track backwards visually
    return [
      ...lockedPlayers,
      ...lockedPlayers,
      ...lockedPlayers,
      ...lockedPlayers,
      ...lockedPlayers,
      ...lockedPlayers, 
      ...lockedPlayers,
    ];
  }, [lockedPlayers]);

  const isInitialJumpRef = useRef(false);

  useEffect(() => {
    if (isShuffling) {
      if (absoluteIndex === 0 && lockedPlayers.length > 0) {
        isInitialJumpRef.current = true;
        setAbsoluteIndex(3 * lockedPlayers.length + shuffleIndex);
        prevIndex.current = shuffleIndex;
      } else if (shuffleIndex !== prevIndex.current) {
        isInitialJumpRef.current = false;
        let diff = shuffleIndex - prevIndex.current;
        if (diff < 0) diff += lockedPlayers.length; // Moving forward across the modulo boundary
        setAbsoluteIndex(prev => prev + diff);
        prevIndex.current = shuffleIndex;
      }
    } else if (!shuffleTarget) {
      // Reset logic when closed
      isInitialJumpRef.current = false;
      setAbsoluteIndex(0);
      prevIndex.current = shuffleIndex;
    }
  }, [shuffleIndex, isShuffling, lockedPlayers.length, shuffleTarget, absoluteIndex]);

  if (!isShuffling && !shuffleTarget) return null;
  if (lockedPlayers.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b0f10]/95 backdrop-blur-md">
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
        
        {/* The Card - Fixed window for the slot machine */}
        <div className={`relative transition-all duration-700 ease-out
          ${shuffleTarget ? 'scale-110 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-90'}
        `}>
          {/* Card Border Glow */}
          <div className={`absolute -inset-1 bg-gradient-to-b from-[#e45d35] to-transparent rounded-[32px] blur-md transition-opacity duration-500 ${shuffleTarget ? 'opacity-60' : 'opacity-20'}`} />
          
          <div className="relative bg-[#101415] border border-[#e45d35]/40 p-4 rounded-[28px] flex flex-col items-center w-72 sm:w-80 h-[460px] shadow-2xl overflow-hidden">
            
            {/* The slot machine track */}
            <div 
              className="w-full flex flex-col transition-transform ease-linear"
              style={{
                // 460px outer - 32px padding = 428px exactly
                transform: `translateY(-${absoluteIndex * 428}px)`,
                transitionDuration: isInitialJumpRef.current ? '0ms' : shuffleTarget ? '500ms' : '150ms', // smooth out the discrete steps
                transitionTimingFunction: shuffleTarget ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'linear'
              }}
            >
              {trackPlayers.map((displayPlayer, idx) => (
                <div key={`${displayPlayer.id}-${idx}`} className="w-full h-[428px] shrink-0 flex flex-col items-center justify-start pb-[28px]">
                  <div className="w-full flex-1 rounded-2xl overflow-hidden bg-[#181c1d] flex items-center justify-center relative border border-white/10 z-10 mt-0">
                    {displayPlayer.img ? (
                      <img 
                        src={displayPlayer.img} 
                        className={`w-full h-full object-cover transition-all duration-500 
                          ${!shuffleTarget ? 'scale-110 opacity-70' : 'scale-100 opacity-100'}
                        `} 
                        alt={displayPlayer.name} 
                      />
                    ) : (
                      <User size={100} className={`text-white/10 transition-all duration-500 ${!shuffleTarget ? 'scale-110' : 'scale-100'}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#101415] via-transparent to-transparent opacity-80" />
                  </div>
                  
                  <div className="w-full text-center mt-6 relative z-10 flex flex-col items-center">
                    <p className={`font-headline font-bold text-3xl tracking-tight text-white transition-all duration-500 
                      ${!shuffleTarget ? 'opacity-70 translate-y-1' : 'opacity-100 translate-y-0'}
                    `}>
                      {displayPlayer.name}
                    </p>
                    <div className={`mt-4 inline-block px-5 py-2 rounded-full border transition-all duration-500
                      ${shuffleTarget && absoluteIndex === idx ? 'bg-[#e45d35]/10 border-[#e45d35]/30 shadow-[0_0_15px_rgba(228,93,53,0.2)]' : 'bg-white/5 border-white/10'}
                    `}>
                      <p className={`text-sm font-mono font-medium tracking-widest uppercase transition-colors duration-500
                        ${shuffleTarget && absoluteIndex === idx ? 'text-[#e45d35]' : 'text-[#c6c6cd]'}
                      `}>
                        Base: {displayPlayer.price}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Overlay shadow to give slot machine depth */}
            <div className="absolute inset-0 pointer-events-none rounded-[28px] shadow-[inset_0_20px_20px_rgba(16,20,21,1),inset_0_-20px_20px_rgba(16,20,21,1)] z-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
