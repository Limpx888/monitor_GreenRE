import React from 'react';
import { ZONES } from '../data/zones';

/**
 * Always-visible layered tower (no WebGL). Guarantees the center is never blank.
 */
export default function CssTower({ selectedZone, onSelect, zonesData = ZONES }) {
  return (
    <div className="css-tower-wrap" aria-label="Light Exchange building zones">
      <div className="css-tower">
        {[...zonesData].reverse().map((zone) => {
          const selected = selectedZone === zone.id;
          const height = Math.max(36, zone.h * 42);
          const width = 70 + zone.w * 18;
          return (
            <button
              key={zone.id}
              type="button"
              className={`css-tower-layer ${selected ? 'selected' : ''} ${zone.status === 'warn' ? 'warn' : ''}`}
              style={{
                height,
                width,
                background: selected ? '#0f766e' : zone.color,
              }}
              onClick={() => onSelect(zone.id)}
              title={`${zone.name} (${zone.floors})`}
            >
              <span className="css-tower-label">
                <strong>{zone.name}</strong>
                <em>{zone.floors}</em>
                <b>{zone.energy}</b>
              </span>
            </button>
          );
        })}
      </div>
      <div className="css-tower-base">The Light Exchange · Digital Twin</div>
    </div>
  );
}
