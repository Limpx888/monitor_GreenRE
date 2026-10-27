import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ZONES } from '../data/zones';

/** Management module routing — matches TowerModel.jsx */
const ZONE_TO_MODULE = {
  'zone-b': { path: '/waste', label: 'Waste Management', icon: '🗑️', color: '#f59e0b' },
  'zone-c': { path: '/water', label: 'Water Management', icon: '💧', color: '#0ea5e9' },
  'zone-d': { path: '/reservations', label: 'Reserve Management', icon: '🏨', color: '#8b5cf6' },
};

/**
 * Always-visible layered tower (no WebGL). Guarantees the center is never blank.
 */
export default function CssTower({ selectedZone, onSelect, zonesData = ZONES }) {
  const navigate = useNavigate();
  const [hoveredZoneId, setHoveredZoneId] = useState(null);

  return (
    <div className="css-tower-wrap" aria-label="Light Exchange building zones">
      <div className="css-tower">
        {[...zonesData].reverse().map((zone) => {
          const selected = selectedZone === zone.id;
          const height = Math.max(36, zone.h * 42);
          const width = 70 + zone.w * 18;
          const mod = ZONE_TO_MODULE[zone.id];
          const isHovered = hoveredZoneId === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              className={`css-tower-layer ${selected ? 'selected' : ''} ${zone.status === 'warn' ? 'warn' : ''}`}
              style={{
                height,
                width,
                background: selected ? '#0f766e' : zone.color,
                position: 'relative',
              }}
              onClick={() => {
                onSelect(zone.id);
                if (mod) {
                  navigate(mod.path);
                }
              }}
              onMouseEnter={() => setHoveredZoneId(zone.id)}
              onMouseLeave={() => setHoveredZoneId(null)}
              title={mod ? `${mod.icon} ${mod.label} — ${zone.name} (${zone.floors})` : `${zone.name} (${zone.floors})`}
            >
              <span className="css-tower-label">
                <strong>{zone.name}</strong>
                <em>{zone.floors}</em>
                <b>{zone.energy}</b>
              </span>
              {/* Management module hover badge */}
              {mod && isHovered && (
                <span style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: 'rgba(0,0,0,0.82)',
                  color: mod.color,
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: `0 2px 8px ${mod.color}40`,
                }}>
                  {mod.icon} {mod.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="css-tower-base">The Light Exchange · Digital Twin</div>
    </div>
  );
}
