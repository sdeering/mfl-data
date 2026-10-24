"use client";

import React from 'react';
import { usePathname } from 'next/navigation';

const LINE = 'rgba(255,255,255,.3)';

/**
 * A football pitch seen in perspective behind the top of every page, fading into the page background.
 * The homepage gets a taller one behind its search.
 */
const PitchBackdrop: React.FC = () => {
  const isHome = usePathname() === '/';

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 overflow-hidden pointer-events-none"
      style={{ height: isHome ? 760 : 520 }}
    >
      <div
        className="absolute left-1/2"
        style={{
          top: isHome ? -40 : -80,
          width: isHome ? 1500 : 1600,
          height: isHome ? 900 : 760,
          marginLeft: isHome ? -750 : -800,
          transform: `perspective(${isHome ? 1100 : 1000}px) rotateX(${isHome ? 58 : 62}deg)`,
          transformOrigin: '50% 0',
          background: `repeating-linear-gradient(90deg,#0d3a22 0 ${isHome ? 94 : 100}px,#104429 ${isHome ? 94 : 100}px ${isHome ? 188 : 200}px)`,
          borderRadius: 6,
        }}
      >
        <div className="absolute" style={{ inset: 40, border: `3px solid ${LINE}` }} />
        <div className="absolute left-1/2" style={{ top: 40, bottom: 40, width: 3, marginLeft: -1.5, background: LINE }} />
        <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: 240, height: 240, margin: '-120px 0 0 -120px', border: `3px solid ${LINE}` }} />
        <div className="absolute left-1/2 top-1/2 rounded-full" style={{ width: 12, height: 12, margin: '-6px 0 0 -6px', background: 'rgba(255,255,255,.5)' }} />
        <div className="absolute top-1/2" style={{ left: 40, width: 200, height: 420, marginTop: -210, border: `3px solid ${LINE}`, borderLeft: 0 }} />
        <div className="absolute top-1/2" style={{ left: 40, width: 70, height: 190, marginTop: -95, border: `3px solid ${LINE}`, borderLeft: 0 }} />
        <div className="absolute top-1/2" style={{ right: 40, width: 200, height: 420, marginTop: -210, border: `3px solid ${LINE}`, borderRight: 0 }} />
        <div className="absolute top-1/2" style={{ right: 40, width: 70, height: 190, marginTop: -95, border: `3px solid ${LINE}`, borderRight: 0 }} />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: isHome
            ? 'radial-gradient(ellipse 70% 60% at 50% 30%,rgba(var(--bg-rgb),.15),rgba(var(--bg-rgb),.85) 75%),linear-gradient(180deg,rgba(var(--bg-rgb),.55) 0%,rgba(var(--bg-rgb),0) 30%,rgba(var(--bg-rgb),0) 60%,var(--bg) 100%)'
            : 'linear-gradient(180deg,rgba(var(--bg-rgb),.78) 0%,rgba(var(--bg-rgb),.55) 40%,var(--bg) 100%)',
        }}
      />
    </div>
  );
};

export default PitchBackdrop;
