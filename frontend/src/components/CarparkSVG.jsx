import React from 'react';

export default function CarparkSVG() {
  return (
    <div className="carpark-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <svg viewBox="0 0 900 350" width="100%" height="100%" style={{ maxHeight: '70vh', background: 'url(#floorEpoxyGrad)' }}>
        <defs>
          <linearGradient id="wallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>

          <linearGradient id="floorEpoxyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1e2638"/>
            <stop offset="20%" stop-color="#111827"/>
            <stop offset="70%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#080c14"/>
          </linearGradient>

          <linearGradient id="pillarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="25%" stop-color="#334155"/>
            <stop offset="75%" stop-color="#2d3748"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>

          {/* Smart Lighting Gradients */}
          <linearGradient id="linearLedBeam" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
            <stop offset="20%" stop-color="#e0f2fe" stop-opacity="0.4"/>
            <stop offset="70%" stop-color="#38bdf8" stop-opacity="0.1"/>
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
          </linearGradient>

          <radialGradient id="greenSensorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#4ade80" stop-opacity="1"/>
            <stop offset="40%" stop-color="#22c55e" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#15803d" stop-opacity="0"/>
          </radialGradient>

          <radialGradient id="redSensorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#f87171" stop-opacity="1"/>
            <stop offset="40%" stop-color="#ef4444" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#991b1b" stop-opacity="0"/>
          </radialGradient>

          <radialGradient id="blueEvSensorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#38bdf8" stop-opacity="1"/>
            <stop offset="50%" stop-color="#0284c7" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="#0369a1" stop-opacity="0"/>
          </radialGradient>

          <linearGradient id="headlightBeam" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.85"/>
            <stop offset="35%" stop-color="#fef08a" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#fde047" stop-opacity="0"/>
          </linearGradient>

          <linearGradient id="reverseLightBeam" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/>
            <stop offset="50%" stop-color="#e2e8f0" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#cbd5e1" stop-opacity="0"/>
          </linearGradient>

          {/* Car Finish Gradients */}
          <linearGradient id="carRed" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#b91c1c"/>
            <stop offset="50%" stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
          </linearGradient>

          <linearGradient id="carBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0369a1"/>
            <stop offset="50%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0c4a6e"/>
          </linearGradient>

          <linearGradient id="carSilver" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#cbd5e1"/>
            <stop offset="50%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>

          <linearGradient id="carDark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1e293b"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#020617"/>
          </linearGradient>

          {/* Visual Effects Filters */}
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>

          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>

          {/* Hazard Stripes Pattern */}
          <pattern id="hazardStripes" width="20" height="20" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="10" height="20" fill="#f59e0b"/>
            <rect x="10" width="10" height="20" fill="#0f172a"/>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#floorEpoxyGrad)" />

        {/* Bay Wheel Stops (Concrete Bumper Bars) */}
        <rect x="35" y="272" width="100" height="8" rx="2" fill="#334155" stroke="#f59e0b" strokeWidth="1"/>
        <rect x="215" y="272" width="100" height="8" rx="2" fill="#334155" stroke="#f59e0b" strokeWidth="1"/>
        <rect x="395" y="272" width="100" height="8" rx="2" fill="#334155" stroke="#22c55e" strokeWidth="1.5"/>
        <rect x="575" y="272" width="100" height="8" rx="2" fill="#334155" stroke="#38bdf8" strokeWidth="1.5"/>
        <rect x="755" y="272" width="100" height="8" rx="2" fill="#334155" stroke="#f59e0b" strokeWidth="1"/>

        {/* Car Ground Shadow */}
        <ellipse cx="100" cy="85" rx="95" ry="12" fill="#000000" opacity="0.6" filter="url(#softGlow)"/>

        {/* Vehicle Body */}
        <path d="M 10,68 Q 0,50 15,45 L 60,40 Q 90,20 130,18 L 180,20 Q 210,30 230,48 L 250,55 Q 260,62 255,72 L 245,78 Q 235,82 220,82 L 25,82 Q 10,82 10,68 Z" 
              fill="url(#carRed)" stroke="#7f1d1d" strokeWidth="2"/>

        {/* Windows */}
        <path d="M 65,42 L 95,24 L 130,23 L 128,42 Z" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5"/>
        <path d="M 134,23 L 178,25 L 202,42 L 134,42 Z" fill="#0f172a" stroke="#ef4444" strokeWidth="0.5"/>

        {/* Glowing Reverse Light */}
        <circle cx="12" cy="56" r="5" fill="#ffffff" filter="url(#glow)"/>
        <circle cx="12" cy="56" r="2" fill="#e2e8f0"/>

        {/* Blinking Orange Turn Signal */}
        <circle cx="15" cy="48" r="4" fill="#f59e0b" className="blinking-turn-signal" filter="url(#glow)"/>

        {/* Turned Wheels for Reversing */}
        <g transform="translate(55, 80)">
          <rect x="-14" y="-6" width="28" height="12" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2"/>
        </g>
        <g transform="translate(195, 80) rotate(-18)">
          <rect x="-14" y="-6" width="28" height="12" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="2"/>
        </g>


        {/* Car Shadow */}
        <ellipse cx="140" cy="125" rx="140" ry="12" fill="#000000" opacity="0.75" filter="url(#softGlow)"/>

        {/* Car Body */}
        <path d="M 10,105 L 5,95 Q 0,80 15,75 L 65,70 Q 95,40 135,38 L 200,40 Q 235,50 260,76 L 280,86 Q 290,92 285,106 L 275,112 Q 265,116 250,116 L 25,116 Q 10,116 10,105 Z" 
              fill="url(#carBlue)" stroke="#0284c7" strokeWidth="1.5"/>

        {/* Glass & Roof */}
        <path d="M 68,68 L 98,43 L 135,42 L 133,68 Z" fill="#0c4a6e" opacity="0.9"/>
        <path d="M 139,42 L 195,44 L 222,68 L 139,68 Z" fill="#0c4a6e" opacity="0.9"/>
        <rect x="133" y="41" width="6" height="27" fill="#0f172a"/>

        {/* Headlight Assembly */}
        <path d="M 260,82 Q 280,84 283,92 L 265,94 Z" fill="#ffffff" filter="url(#glow)"/>

        {/* Taillight Assembly */}
        <path d="M 8,82 Q 2,84 4,96 L 16,94 Z" fill="#ef4444" filter="url(#glow)"/>

        {/* Wheels (Spinning) */}
        <g transform="translate(64, 114)">
          <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#334155" strokeWidth="2"/>
          <circle cx="0" cy="0" r="14" fill="#475569"/>
          <g className="wheel-spin">
            <circle cx="0" cy="0" r="12" fill="#cbd5e1"/>
            <path d="M 0,-12 L 0,12 M -12,0 L 12,0 M -8,-8 L 8,8 M -8,8 L 8,-8" stroke="#0f172a" strokeWidth="2"/>
          </g>
        </g>

        <g transform="translate(220, 114)">
          <circle cx="0" cy="0" r="22" fill="#0f172a" stroke="#334155" strokeWidth="2"/>
          <circle cx="0" cy="0" r="14" fill="#475569"/>
          <g className="wheel-spin">
            <circle cx="0" cy="0" r="12" fill="#cbd5e1"/>
            <path d="M 0,-12 L 0,12 M -12,0 L 12,0 M -8,-8 L 8,8 M -8,8 L 8,-8" stroke="#0f172a" strokeWidth="2"/>
          </g>
        </g>
      </svg>
    </div>
  );
}
