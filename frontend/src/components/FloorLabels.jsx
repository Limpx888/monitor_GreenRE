import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FLOORS } from '../data/floors';

/**
 * Sectional-style floor labels beside the 3D twin.
 * Click → blank floor page with back arrow.
 */
export default function FloorLabels({ selectedZone, onHoverZone }) {
  const navigate = useNavigate();

  return (
    <div className="floor-labels" aria-label="Building floor labels">
      <div className="floor-labels-title">Floor Directory</div>
      {FLOORS.map((floor) => {
        const active = selectedZone === floor.zoneId;
        return (
          <button
            key={floor.id}
            type="button"
            className={`floor-label-item ${active ? 'active' : ''}`}
            onMouseEnter={() => onHoverZone?.(floor.zoneId)}
            onMouseLeave={() => onHoverZone?.(null)}
            onClick={() => navigate(`/floor/${floor.id}`)}
          >
            <span className="floor-label-dot" style={{ background: floor.color }} />
            <span className="floor-label-arrow" aria-hidden="true">←</span>
            <span className="floor-label-code">{floor.label}</span>
            <span className="floor-label-desc">{floor.description}</span>
          </button>
        );
      })}
    </div>
  );
}
