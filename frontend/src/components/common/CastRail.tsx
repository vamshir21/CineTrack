import React, { useRef, useState, useEffect } from 'react';
import { User, Film, Clapperboard, ChevronLeft, ChevronRight, Briefcase } from 'lucide-react';
import type { CastMember, CrewMember } from '../../types';
import { ImageWithFallback } from './ImageWithFallback';

interface CastRailProps {
  cast?: CastMember[];
  crew?: CrewMember[];
  onSelectPerson?: (personId: number, personName: string) => void;
}

export const CastRail: React.FC<CastRailProps> = ({ cast = [], crew = [], onSelectPerson }) => {
  const castScrollRef = useRef<HTMLDivElement>(null);
  const crewScrollRef = useRef<HTMLDivElement>(null);

  const [canScrollCastLeft, setCanScrollCastLeft] = useState(false);
  const [canScrollCastRight, setCanScrollCastRight] = useState(false);
  const [canScrollCrewLeft, setCanScrollCrewLeft] = useState(false);
  const [canScrollCrewRight, setCanScrollCrewRight] = useState(false);

  // Check scroll positions
  const updateCastScroll = () => {
    if (castScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = castScrollRef.current;
      setCanScrollCastLeft(scrollLeft > 10);
      setCanScrollCastRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const updateCrewScroll = () => {
    if (crewScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = crewScrollRef.current;
      setCanScrollCrewLeft(scrollLeft > 10);
      setCanScrollCrewRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    updateCastScroll();
    updateCrewScroll();
    window.addEventListener('resize', updateCastScroll);
    window.addEventListener('resize', updateCrewScroll);
    return () => {
      window.removeEventListener('resize', updateCastScroll);
      window.removeEventListener('resize', updateCrewScroll);
    };
  }, [cast, crew]);

  // Attach non-passive wheel listeners so vertical mouse scroll scrolls the rail horizontally
  useEffect(() => {
    const castEl = castScrollRef.current;
    const crewEl = crewScrollRef.current;

    const handleWheelOnEl = (el: HTMLDivElement | null, updateFn: () => void) => (e: WheelEvent) => {
      if (!el) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY * 2, behavior: 'auto' });
        updateFn();
      }
    };

    const castWheel = handleWheelOnEl(castEl, updateCastScroll);
    const crewWheel = handleWheelOnEl(crewEl, updateCrewScroll);

    if (castEl) castEl.addEventListener('wheel', castWheel, { passive: false });
    if (crewEl) crewEl.addEventListener('wheel', crewWheel, { passive: false });

    return () => {
      if (castEl) castEl.removeEventListener('wheel', castWheel);
      if (crewEl) crewEl.removeEventListener('wheel', crewWheel);
    };
  }, [cast, crew]);

  const scrollCast = (direction: 'left' | 'right') => {
    if (castScrollRef.current) {
      const { clientWidth } = castScrollRef.current;
      const amount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      castScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(updateCastScroll, 350);
    }
  };

  const scrollCrew = (direction: 'left' | 'right') => {
    if (crewScrollRef.current) {
      const { clientWidth } = crewScrollRef.current;
      const amount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      crewScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(updateCrewScroll, 350);
    }
  };

  if ((!cast || cast.length === 0) && (!crew || crew.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-8 pt-4">
      {/* ── 1. CAST SECTION ──────────────────────────────────────────────── */}
      {cast && cast.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <Film className="w-4 h-4 text-netflix" />
              <span>Cast</span>
              <span className="text-xs text-neutral-400 font-normal">({cast.length})</span>
            </h3>

            {/* Scroll navigation buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollCast('left')}
                disabled={!canScrollCastLeft}
                className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                aria-label="Scroll cast left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollCast('right')}
                disabled={!canScrollCastRight}
                className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                aria-label="Scroll cast right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cast Rail */}
          <div className="relative group/cast">
            <div
              ref={castScrollRef}
              onScroll={updateCastScroll}
              className="flex items-start gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent select-none"
            >
              {cast.map((actor, idx) => (
                <div
                  key={`${actor.id}-${actor.character || actor.name}-${idx}`}
                  onClick={() => onSelectPerson?.(actor.id, actor.name)}
                  className={`flex-shrink-0 w-24 sm:w-28 flex flex-col items-center text-center group ${
                    onSelectPerson ? 'cursor-pointer' : ''
                  }`}
                  title={onSelectPerson ? `View filmography for ${actor.name}` : actor.name}
                >
                  {/* Portrait Avatar */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700/80 group-hover:border-netflix transition-all duration-200 shadow-md relative">
                    {actor.profile_url ? (
                      <ImageWithFallback
                        src={actor.profile_url}
                        alt={actor.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900">
                        <User className="w-8 h-8" />
                      </div>
                    )}
                  </div>

                  {/* Actor details */}
                  <p className="text-xs sm:text-sm font-semibold text-white mt-2 group-hover:text-netflix transition-colors line-clamp-1 w-full" title={actor.name}>
                    {actor.name}
                  </p>
                  {actor.character && (
                    <p className="text-[11px] text-neutral-400 line-clamp-1 w-full mt-0.5" title={actor.character}>
                      {actor.character}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 2. CREW SECTION ──────────────────────────────────────────────── */}
      {crew && crew.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-netflix" />
              <span>Crew & Creative Team</span>
              <span className="text-xs text-neutral-400 font-normal">({crew.length})</span>
            </h3>

            {/* Scroll navigation buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => scrollCrew('left')}
                disabled={!canScrollCrewLeft}
                className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                aria-label="Scroll crew left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollCrew('right')}
                disabled={!canScrollCrewRight}
                className="p-1.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 disabled:opacity-30 disabled:pointer-events-none text-white transition-all"
                aria-label="Scroll crew right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Crew Rail */}
          <div className="relative group/crew">
            <div
              ref={crewScrollRef}
              onScroll={updateCrewScroll}
              className="flex items-start gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent select-none"
            >
              {crew.map((member, idx) => (
                <div
                  key={`${member.id}-${member.job}-${idx}`}
                  onClick={() => onSelectPerson?.(member.id, member.name)}
                  className={`flex-shrink-0 w-24 sm:w-28 flex flex-col items-center text-center group ${
                    onSelectPerson ? 'cursor-pointer' : ''
                  }`}
                  title={onSelectPerson ? `View filmography for ${member.name}` : member.name}
                >
                  {/* Portrait Avatar */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-neutral-800 border-2 border-neutral-700/80 group-hover:border-netflix transition-all duration-200 shadow-md relative">
                    {member.profile_url ? (
                      <ImageWithFallback
                        src={member.profile_url}
                        alt={member.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500 bg-neutral-900">
                        <Clapperboard className="w-7 h-7" />
                      </div>
                    )}
                  </div>

                  {/* Crew member details */}
                  <p className="text-xs sm:text-sm font-semibold text-white mt-2 group-hover:text-netflix transition-colors line-clamp-1 w-full" title={member.name}>
                    {member.name}
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-800/90 border border-neutral-700 rounded text-[10px] text-neutral-300 font-medium line-clamp-1 max-w-full" title={member.job}>
                    {member.job}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
