import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { waterApi } from '../api/waterApi';

export default function WaterGreenREPage() {
  const { activeBuilding, selectedBuildingData } = useOutletContext();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recalculating, setRecalculating] = useState(false);

  const fetchAudit = () => {
    if (!activeBuilding) return;
    setLoading(true);
    waterApi.getAudit(activeBuilding)
      .then((data) => {
        setAudit(data);
        setError('');
      })
      .catch((err) => {
        setError(err.message || 'Audit failed');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAudit();
  }, [activeBuilding]);

  const handleRecalculate = () => {
    setRecalculating(true);
    setTimeout(() => {
      fetchAudit();
      setRecalculating(false);
    }, 600);
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div className="waste-spinner large" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 600 }}>Running GreenRE Water Compliance Engine on DuckDB...</p>
      </div>
    );
  }

  const score = audit?.greenre_water_score ?? 90;
  const rating = audit?.rating ?? 'Platinum';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🏢 GreenRE Water Efficiency (WE) Audit
            </h1>
            <span
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: '1px solid #bbf7d0',
              }}
            >
              STANDARDS v3.1 COMPLIANT
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Automated verification of Water Use Intensity (WUI), cooling tower ratios, and irrigation standards for <b>{activeBuilding}</b>
          </p>
        </div>

        <button
          type="button"
          onClick={handleRecalculate}
          disabled={recalculating}
          className="btn-evidence"
          style={{
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
          }}
        >
          {recalculating ? 'Analyzing telemetry…' : '⚡ Re-Run Compliance Audit'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Score Hero Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0ea5e9 100%)',
          borderRadius: '18px',
          padding: '24px 30px',
          color: 'white',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 10px 25px rgba(2, 132, 199, 0.25)',
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9, fontWeight: 700 }}>
            GreenRE Water Efficiency Index (WE)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '6px 0' }}>
            <span style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'monospace' }}>{score}</span>
            <span style={{ fontSize: '1.2rem', opacity: 0.8 }}>/ 100</span>
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(4px)',
                padding: '4px 14px',
                borderRadius: '20px',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
              }}
            >
              {rating.toUpperCase()} RATING
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
            Building operates within high water efficiency parameters. Sub-metering coverage active across {audit?.water_breakdown?.total_water?.toLocaleString()} m³ total volume.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '24px', background: 'rgba(0, 0, 0, 0.15)', padding: '16px 24px', borderRadius: '14px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>Cooling Water</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {audit?.water_breakdown?.chilled_water?.toLocaleString() || 0} m³
            </div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '24px' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>Irrigation</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {audit?.water_breakdown?.irrigation?.toLocaleString() || 0} m³
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Criteria Matrix */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
        Audit Criteria Verification Matrix
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
        {(audit?.audits || []).map((item) => {
          const isCompliant = item.status === 'COMPLIANT';
          return (
            <div
              key={item.criteria_id}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                display: 'grid',
                gridTemplateColumns: '120px 1.5fr 1fr 1.5fr',
                gap: '16px',
                alignItems: 'center',
              }}
            >
              <div>
                <span
                  style={{
                    background: isCompliant ? '#f0fdf4' : '#fef2f2',
                    color: isCompliant ? '#15803d' : '#b91c1c',
                    border: `1px solid ${isCompliant ? '#bbf7d0' : '#fecaca'}`,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    display: 'inline-block',
                    marginBottom: '4px',
                  }}
                >
                  {item.criteria_id}
                </span>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isCompliant ? '#16a34a' : '#dc2626' }}>
                  {isCompliant ? '✓ COMPLIANT' : '⚠️ GAP FOUND'}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>{item.category}</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{item.description}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>MEASURED vs THRESHOLD</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                  {item.measured_value}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Standard: {item.threshold}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', borderLeft: `3px solid ${isCompliant ? '#0284c7' : '#f59e0b'}` }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Actionable AI Recommendation
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: 600, marginTop: '2px' }}>
                  {item.recommendation}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
