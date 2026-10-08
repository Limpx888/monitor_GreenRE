import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getFloorById } from '../data/floors';
import CarparkSVG from '../components/CarparkSVG';

/** Blank placeholder page for a floor label click */
export default function FloorDetailPage() {
  const { floorId } = useParams();
  const floor = getFloorById(floorId);

  // The "lower part of the building" is typically LG, LM, B1, B2 (valet and carpark)
  const isLowerBuilding = floorId === 'lg-lm' || floorId === 'b1-b2';

  return (
    <div className="floor-blank-page">
      <Link to="/" className="floor-back-btn" aria-label="Back to dashboard">
        <ArrowLeft size={22} strokeWidth={2.5} />
      </Link>
      
      {isLowerBuilding ? (
        <CarparkSVG />
      ) : (
        floor && (
          <div className="floor-blank-hint">
            {floor.label}
          </div>
        )
      )}
    </div>
  );
}
