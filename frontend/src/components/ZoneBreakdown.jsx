import React from 'react';
import UtilityMainMeter from './UtilityMainMeter';

/**
 * ZoneBreakdown: Thin wrapper around UtilityMainMeter for seamless backward compatibility.
 * Employs the Single Source of Truth architecture (SWR -> /api/v1/dashboard/nilm-live).
 */
export default function ZoneBreakdown(props) {
  return <UtilityMainMeter {...props} />;
}
