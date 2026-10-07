import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getFloorById } from '../data/floors';

/** Blank placeholder page for a floor label click */
export default function FloorDetailPage() {
  const { floorId } = useParams();
  const floor = getFloorById(floorId);

  return (
    <div className="floor-blank-page">
      <Link to="/" className="floor-back-btn" aria-label="Back to dashboard">
        <ArrowLeft size={22} strokeWidth={2.5} />
      </Link>
      {/* Intentionally blank — floor content to be added later */}
      {floor && (
        <div className="floor-blank-hint">
          {floor.label}
        </div>
      )}
    </div>
  );
}
