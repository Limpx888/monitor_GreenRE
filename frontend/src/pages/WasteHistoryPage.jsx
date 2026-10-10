import React, { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { scansApi } from '../api/wasteApi';

const STATUS_STYLES = {
  pending_review: { bg: '#fef9c3', text: '#854d0e', label: '⏳ Pending Review' },
  confirmed: { bg: '#dcfce7', text: '#15803d', label: '✅ Confirmed' },
  exported: { bg: '#dbeafe', text: '#1e40af', label: '📦 Exported' },
};

export default function WasteHistoryPage() {
  const { activeSite } = useOutletContext();
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedScan, setSelectedScan] = useState(null);

  useEffect(() => {
    if (!activeSite) return;
    setLoading(true);
    scansApi.list(activeSite, statusFilter || undefined, 100)
      .then(setScans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeSite, statusFilter]);

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-MY', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>📋 Scan History</h1>
        <div className="waste-controls-bar">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="waste-select"
          >
            <option value="">All Status</option>
            <option value="pending_review">Pending Review</option>
            <option value="confirmed">Confirmed</option>
            <option value="exported">Exported</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="waste-loading"><div className="waste-spinner" /><p>Loading scans...</p></div>
      ) : scans.length === 0 ? (
        <div className="waste-empty">
          <span className="waste-empty-icon">📸</span>
          <p>No scans yet. Go to the Scanner to capture your first waste scan!</p>
          <Link to="/waste" className="waste-btn primary">Start Scanning</Link>
        </div>
      ) : (
        <div className="waste-table-container">
          <table className="waste-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => {
                const st = STATUS_STYLES[scan.status] || STATUS_STYLES.pending_review;
                const activeCount = (scan.detections || []).filter(d => !d.is_deleted).length;
                const reviewCount = (scan.detections || []).filter(d => d.needs_review && !d.is_deleted).length;
                return (
                  <tr key={scan.id} className={selectedScan?.id === scan.id ? 'selected' : ''}>
                    <td>{formatDate(scan.created_at)}</td>
                    <td>
                      <span className="waste-badge mode">{scan.scan_mode}</span>
                    </td>
                    <td>
                      {activeCount} items
                      {reviewCount > 0 && <span className="waste-badge warning ml-1">⚠ {reviewCount}</span>}
                    </td>
                    <td>
                      <span className="waste-badge" style={{ background: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="waste-btn-small"
                        onClick={() => setSelectedScan(selectedScan?.id === scan.id ? null : scan)}
                      >
                        {selectedScan?.id === scan.id ? 'Close' : 'View'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Detail Modal */}
          {selectedScan && (
            <div className="waste-modal-overlay" onClick={() => setSelectedScan(null)}>
              <div className="waste-modal" style={{ width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                <div className="waste-modal-header">
                  <h2>Scan Details — {formatDate(selectedScan.created_at)}</h2>
                  <button className="waste-btn-small" onClick={() => setSelectedScan(null)}>✕</button>
                </div>
                <div className="waste-modal-body">
                  {selectedScan.annotated_image_path ? (
                    <img
                      src={`/api/v1/uploads/${selectedScan.annotated_image_path}`}
                      alt="Annotated"
                      className="waste-detail-img"
                      style={{ width: '100%', borderRadius: '12px', marginBottom: '16px', objectFit: 'cover', maxHeight: '400px' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '200px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', marginBottom: '16px', border: '1px dashed #cbd5e1' }}>
                      <p>📸 No image available for this demo scan.</p>
                    </div>
                  )}

                  <div className="waste-detection-list compact">
                    {(selectedScan.detections || []).map((det, i) => (
                      <div key={det.id || i} className={`waste-detection-card compact ${det.is_deleted ? 'deleted' : ''}`}>
                        <span className="waste-detection-name">
                          {det.corrected_class_name || det.class_name}
                          {det.corrected_class_name && det.corrected_class_name !== det.class_name && (
                            <span className="waste-corrected"> (was: {det.class_name})</span>
                          )}
                        </span>
                        <span className="waste-badge" style={{
                          background: det.category === 'RECYCLE' ? '#dcfce7' : det.category === 'ORGANIC' ? '#ecfccb' : '#f1f5f9',
                        }}>
                          {det.category}
                        </span>
                        <span>{Math.round(det.confidence * 100)}%</span>
                        <span>{det.weight_source === 'MEASURED' ? '⚖️' : '~'}{(det.measured_weight_kg || det.estimated_weight_kg)?.toFixed(3)} kg</span>
                        {det.is_deleted && <span className="waste-badge danger">Deleted</span>}
                      </div>
                    ))}
                  </div>

                  <div className="waste-detail-actions">
                    {selectedScan.status === 'pending_review' && (
                      <button
                        className="waste-btn primary"
                        onClick={async () => {
                          await scansApi.confirm(selectedScan.id);
                          setScans(scans.map(s => s.id === selectedScan.id ? { ...s, status: 'confirmed' } : s));
                          setSelectedScan({ ...selectedScan, status: 'confirmed' });
                        }}
                      >
                        ✅ Confirm All
                      </button>
                    )}
                    <button
                      className="waste-btn secondary"
                      onClick={async () => {
                        const labels = await scansApi.exportYolo(selectedScan.id);
                        const text = labels.label_text;
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${selectedScan.id}_labels.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      📥 Export YOLO Labels
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
