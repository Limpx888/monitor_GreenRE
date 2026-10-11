import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { greenreApi } from '../api/wasteApi';

const STATUS_STYLES = {
  not_started: { bg: '#f1f5f9', text: '#64748b', icon: '⬜', label: 'Not Started' },
  in_progress: { bg: '#fef9c3', text: '#854d0e', icon: '🟡', label: 'In Progress' },
  evidence_attached: { bg: '#dcfce7', text: '#15803d', icon: '✅', label: 'Evidence Attached' },
};

export default function WasteGreenREPage() {
  const { activeSite } = useOutletContext();
  const [requirements, setRequirements] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '' });
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!activeSite) return;
    setLoading(true);
    greenreApi.list(activeSite)
      .then(setRequirements)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeSite]);

  const handleStatusChange = async (reqId, newStatus) => {
    await greenreApi.update(reqId, { status: newStatus });
    setRequirements(requirements.map(r =>
      r.id === reqId ? { ...r, status: newStatus } : r
    ));
  };

  const handleEvidenceNotes = async (reqId, notes) => {
    await greenreApi.update(reqId, { evidence_notes: notes });
    setRequirements(requirements.map(r =>
      r.id === reqId ? { ...r, evidence_notes: notes } : r
    ));
  };

  const handleAddRequirement = async () => {
    if (!addForm.code) return;
    const created = await greenreApi.create(activeSite, {
      requirement_code: addForm.code,
      requirement_description: addForm.description,
    });
    setRequirements([...requirements, created]);
    setAddForm({ code: '', description: '' });
    setShowAdd(false);
  };

  const handleGenerateReport = async () => {
    const r = await greenreApi.report(activeSite, 'monthly');
    setReport(r);
    setShowReport(true);
  };

  const summary = {
    total: requirements.length,
    not_started: requirements.filter(r => r.status === 'not_started').length,
    in_progress: requirements.filter(r => r.status === 'in_progress').length,
    evidence_attached: requirements.filter(r => r.status === 'evidence_attached').length,
  };

  const progressPct = summary.total > 0
    ? Math.round((summary.evidence_attached / summary.total) * 100)
    : 0;

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>🏢 GreenRE Compliance</h1>
        <p>Track waste-related requirements and build your evidence pack</p>
        <div className="waste-controls-bar">
          <button className="waste-btn primary" onClick={handleGenerateReport}>
            📊 Generate Report
          </button>
          <button className="waste-btn secondary" onClick={() => setShowAdd(!showAdd)}>
            ➕ Add Requirement
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <div className="waste-greenre-progress">
        <div className="waste-greenre-progress-bar">
          <div className="waste-progress-fill" style={{ width: `${progressPct}%`, background: '#22c55e' }} />
        </div>
        <div className="waste-greenre-stats">
          <span>{progressPct}% complete</span>
          <span>⬜ {summary.not_started} Not Started</span>
          <span>🟡 {summary.in_progress} In Progress</span>
          <span>✅ {summary.evidence_attached} Evidence Attached</span>
        </div>
      </div>

      {/* Add requirement form */}
      {showAdd && (
        <div className="waste-form-card">
          <h3>Add GreenRE Requirement</h3>
          <p className="waste-form-note">
            GreenRE requirement codes are configurable. Fill in from GreenRE assessor guidance.
          </p>
          <div className="waste-form-row">
            <input
              placeholder="Code (e.g., WM-8)"
              value={addForm.code}
              onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
              className="waste-input"
            />
            <input
              placeholder="Description"
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              className="waste-input flex-grow"
            />
            <button className="waste-btn primary" onClick={handleAddRequirement}>Add</button>
          </div>
        </div>
      )}

      {/* Requirements list */}
      {loading ? (
        <div className="waste-loading"><div className="waste-spinner" /><p>Loading requirements...</p></div>
      ) : (
        <div className="waste-greenre-list">
          {requirements.map(req => {
            const st = STATUS_STYLES[req.status] || STATUS_STYLES.not_started;
            return (
              <div key={req.id} className="waste-greenre-card">
                <div className="waste-greenre-card-header">
                  <span className="waste-greenre-code">{req.requirement_code}</span>
                  <select
                    value={req.status}
                    onChange={(e) => handleStatusChange(req.id, e.target.value)}
                    className="waste-select small"
                    style={{ background: st.bg, color: st.text }}
                  >
                    <option value="not_started">⬜ Not Started</option>
                    <option value="in_progress">🟡 In Progress</option>
                    <option value="evidence_attached">✅ Evidence Attached</option>
                  </select>
                </div>
                <p className="waste-greenre-desc">{req.requirement_description}</p>
                <textarea
                  className="waste-textarea"
                  placeholder="Evidence notes..."
                  value={req.evidence_notes || ''}
                  onChange={(e) => handleEvidenceNotes(req.id, e.target.value)}
                  rows={2}
                />
                <div className="waste-greenre-meta">
                  Last updated: {req.updated_at ? new Date(req.updated_at).toLocaleString() : '-'}
                </div>
              </div>
            );
          })}
          {requirements.length === 0 && (
            <div className="waste-empty">
              <span className="waste-empty-icon">🏢</span>
              <p>No requirements tracked yet. Add GreenRE requirements to get started.</p>
            </div>
          )}
        </div>
      )}

      {/* Report modal */}
      {showReport && report && (
        <div className="waste-modal-overlay" onClick={() => setShowReport(false)}>
          <div className="waste-modal" onClick={e => e.stopPropagation()}>
            <div className="waste-modal-header">
              <h2>📊 GreenRE Compliance Report</h2>
              <button onClick={() => setShowReport(false)} className="waste-btn-small">✕</button>
            </div>
            <div className="waste-modal-body">
              <div className="waste-report-section">
                <h3>{report.site_name} — {report.period} Report</h3>
                <p><strong>Generated:</strong> {new Date(report.generated_at).toLocaleString()}</p>
              </div>

              <div className="waste-report-section">
                <h4>Waste Metrics</h4>
                <table className="waste-table compact">
                  <tbody>
                    <tr><td>Total Waste</td><td>{report.analytics.total_waste_kg.toFixed(1)} kg</td></tr>
                    <tr><td>Recycling Rate</td><td>{report.analytics.recycling_rate.toFixed(1)}%</td></tr>
                    <tr><td>Diversion Rate</td><td>{report.analytics.diversion_rate.toFixed(1)}%</td></tr>
                    <tr><td>CO₂e Avoided</td><td>{report.analytics.co2e_avoided_kg.toFixed(1)} kg</td></tr>
                    <tr><td>Items Scanned</td><td>{report.analytics.total_items}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="waste-report-section">
                <h4>Requirements Progress</h4>
                <p>{report.requirements_summary.evidence_attached}/{report.requirements_summary.total} requirements with evidence attached</p>
              </div>

              <div className="waste-report-section methodology">
                <h4>📝 Methodology</h4>
                <p>{report.methodology}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
