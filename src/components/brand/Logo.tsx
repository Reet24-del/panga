// The wordmark. The last "a" winds up, turns into a punching fist, lands a
// hit, and snaps back into an "a". Animation lives in globals.css (.logo).

function Fist() {
  return (
    <svg className="fist" viewBox="0 0 170 100" aria-hidden="true">
      <g className="speed" stroke="var(--lime)" strokeWidth="7" strokeLinecap="round">
        <path d="M-52 30 H-14" />
        <path d="M-70 50 H-8" />
        <path d="M-52 70 H-14" />
      </g>
      <g stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round">
        <rect x="30" y="18" width="80" height="64" rx="16" fill="var(--paper)" />
        <rect x="92" y="14" width="44" height="20" rx="10" fill="var(--paper)" />
        <rect x="96" y="32" width="46" height="20" rx="10" fill="var(--paper)" />
        <rect x="96" y="50" width="46" height="20" rx="10" fill="var(--paper)" />
        <rect x="92" y="68" width="40" height="18" rx="9" fill="var(--paper)" />
        <path d="M58 56 H112 Q122 56 122 64 Q122 72 112 72 H62 Q50 72 50 62 Z" fill="var(--paper)" />
        <rect x="0" y="26" width="40" height="48" rx="3" fill="var(--red)" />
      </g>
      <polygon
        className="burst"
        points="158,18 163,36 178,26 172,43 190,50 172,57 178,74 163,64 158,82 153,64 138,74 144,57 126,50 144,43 138,26 153,36"
        fill="var(--lime)"
        stroke="var(--ink)"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ animate = false, className = '' }: { animate?: boolean; className?: string }) {
  return (
    <span className={`logo ${animate ? 'animate' : 'hover-play'} ${className}`} role="img" aria-label="Panga">
      <span aria-hidden="true">pang</span>
      <span className="punch-a" aria-hidden="true">
        <span className="glyph">a</span>
        <Fist />
      </span>
    </span>
  );
}
