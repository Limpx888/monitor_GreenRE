import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FLOORS } from '../data/floors';

/**
 * Sectional-style floor labels beside the 3D twin.
 * Click → blank floor page with back arrow.
 */
export default function FloorLabels({ selectedZone, onHoverZone, anomalyFloor }) {
  const navigate = useNavigate();

  return (
    <div className="floor-labels" aria-label="Building floor labels">
      <div className="floor-labels-title">Floor Directory</div>
      {FLOORS.map((floor) => {
        const active = selectedZone === floor.zoneId;
        const isAnomaly = anomalyFloor === 'L14' && floor.id === 'l14-28';
        return (
          <button
            key={floor.id}
            type="button"
            className={`floor-label-item ${active ? 'active' : ''} ${isAnomaly ? 'anomaly-pulse' : ''}`}
            onMouseEnter={() => onHoverZone?.(floor.zoneId)}
            onMouseLeave={() => onHoverZone?.(null)}
            onClick={() => navigate(`/floor/${floor.id}`)}
            style={isAnomaly ? { borderColor: '#f43f5e', background: 'rgba(254, 226, 226, 0.95)' } : undefined}
          >
            <span className="floor-label-dot" style={{ background: isAnomaly ? '#e11d48' : floor.color }} />
            <span className="floor-label-arrow" aria-hidden="true">←</span>
            <span className="floor-label-code" style={isAnomaly ? { color: '#be123c', fontWeight: 800 } : undefined}>
              {floor.label} {isAnomaly && '⚠️ GAP'}
            </span>
            <span className="floor-label-desc">{floor.description}</span>
          </button>
        );
      })}
    </div>
  );
}
