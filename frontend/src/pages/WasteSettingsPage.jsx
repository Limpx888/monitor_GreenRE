import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { configApi, collectionsApi, targetsApi } from '../api/wasteApi';

const CATEGORIES = ['RECYCLE', 'GENERAL', 'ORGANIC', 'HAZARDOUS', 'REVIEW'];

export default function WasteSettingsPage() {
  const { activeSite } = useOutletContext();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('classes'); // classes | collections | targets
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionForm, setCollectionForm] = useState({
    measured_weight_kg: '', waste_category: 'GENERAL', contractor: '', receipt_ref: '',
  });
  const [targetForm, setTargetForm] = useState({
    metric: 'recycling_rate', target_value: '', baseline_value: '',
  });
  const [collections, setCollections] = useState([]);
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    if (!activeSite) return;
    setLoading(true);
    Promise.all([
      configApi.list(activeSite),
      collectionsApi.list(activeSite),
      targetsApi.list(activeSite),
    ]).then(([c, col, t]) => {
      setConfigs(c);
      setCollections(col);
      setTargets(t);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [activeSite]);

  const startEdit = (config) => {
    setEditingId(config.id);
    setEditData({
      category: config.category,
      material: config.material,
      avg_weight_kg: config.avg_weight_kg,
      emission_factor_kgco2e: config.emission_factor_kgco2e,
      recyclable_locally: config.recyclable_locally,
    });
  };

  const saveEdit = async () => {
    await configApi.update(editingId, editData);
    setConfigs(configs.map(c => c.id === editingId ? { ...c, ...editData } : c));
    setEditingId(null);
  };

  const filteredConfigs = configs.filter(c =>
    c.class_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCollection = async () => {
    if (!collectionForm.measured_weight_kg) return;
    const created = await collectionsApi.create(activeSite, {
      ...collectionForm,
      measured_weight_kg: parseFloat(collectionForm.measured_weight_kg),
    });
    setCollections([created, ...collections]);
    setCollectionForm({ measured_weight_kg: '', waste_category: 'GENERAL', contractor: '', receipt_ref: '' });
  };

  const handleAddTarget = async () => {
    if (!targetForm.target_value) return;
    const created = await targetsApi.create(activeSite, {
      ...targetForm,
      target_value: parseFloat(targetForm.target_value),
      baseline_value: targetForm.baseline_value ? parseFloat(targetForm.baseline_value) : null,
    });
    setTargets([...targets, created]);
    setTargetForm({ metric: 'recycling_rate', target_value: '', baseline_value: '' });
  };

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>⚙️ Settings</h1>
      </div>

      {/* Tabs */}
      <div className="waste-tabs">
        {[
          { id: 'classes', label: '🏷️ Waste Classes', count: configs.length },
          { id: 'collections', label: '🚛 Collections', count: collections.length },
          { id: 'targets', label: '🎯 Targets', count: targets.length },
        ].map(t => (
          <button
            key={t.id}
            className={`waste-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label} <span className="waste-badge small">{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="waste-loading"><div className="waste-spinner" /><p>Loading...</p></div>
      ) : (
        <>
          {/* ── Waste Classes Tab ── */}
          {tab === 'classes' && (
            <div>
              <div className="waste-controls-bar">
                <input
                  type="text"
                  placeholder="🔍 Search classes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="waste-input"
                />
              </div>
              <p className="waste-form-note">
                Edit category mappings per site. No code change needed — changes apply immediately to future detections.
              </p>
              <div className="waste-table-container">
                <table className="waste-table">
                  <thead>
                    <tr>
                      <th>Class Name</th>
                      <th>Category</th>
                      <th>Material</th>
                      <th>Avg Weight (kg)</th>
                      <th>CO₂e Factor</th>
                      <th>Local?</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConfigs.map(config => (
                      <tr key={config.id}>
                        <td className="font-medium">{config.class_name}</td>
                        <td>
                          {editingId === config.id ? (
                            <select
                              value={editData.category}
                              onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                              className="waste-select small"
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className={`waste-badge cat-${config.category.toLowerCase()}`}>
                              {config.category}
                            </span>
                          )}
                        </td>
                        <td>
                          {editingId === config.id ? (
                            <input
                              value={editData.material}
                              onChange={(e) => setEditData({ ...editData, material: e.target.value })}
                              className="waste-input small"
                            />
                          ) : config.material}
                        </td>
                        <td>
                          {editingId === config.id ? (
                            <input
                              type="number"
                              step="0.001"
                              value={editData.avg_weight_kg}
                              onChange={(e) => setEditData({ ...editData, avg_weight_kg: parseFloat(e.target.value) })}
                              className="waste-input small"
                            />
                          ) : config.avg_weight_kg}
                        </td>
                        <td>
                          {editingId === config.id ? (
                            <input
                              type="number"
                              step="0.1"
                              value={editData.emission_factor_kgco2e}
                              onChange={(e) => setEditData({ ...editData, emission_factor_kgco2e: parseFloat(e.target.value) })}
                              className="waste-input small"
                            />
                          ) : config.emission_factor_kgco2e}
                        </td>
                        <td>{config.recyclable_locally ? '✅' : '❌'}</td>
                        <td>
                          {editingId === config.id ? (
                            <div className="waste-edit-actions">
                              <button className="waste-btn-small success" onClick={saveEdit}>Save</button>
                              <button className="waste-btn-small" onClick={() => setEditingId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="waste-btn-small" onClick={() => startEdit(config)}>Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Collections Tab ── */}
          {tab === 'collections' && (
            <div>
              <div className="waste-form-card">
                <h3>🚛 Record Waste Collection</h3>
                <p className="waste-form-note">
                  Enter measured weights from weighbridge tickets or contractor receipts.
                  Measured values always take precedence over AI estimates in reports.
                </p>
                <div className="waste-form-row">
                  <input
                    type="number"
                    placeholder="Weight (kg)"
                    value={collectionForm.measured_weight_kg}
                    onChange={(e) => setCollectionForm({ ...collectionForm, measured_weight_kg: e.target.value })}
                    className="waste-input"
                  />
                  <select
                    value={collectionForm.waste_category}
                    onChange={(e) => setCollectionForm({ ...collectionForm, waste_category: e.target.value })}
                    className="waste-select"
                  >
                    {CATEGORIES.filter(c => c !== 'REVIEW').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    placeholder="Contractor"
                    value={collectionForm.contractor}
                    onChange={(e) => setCollectionForm({ ...collectionForm, contractor: e.target.value })}
                    className="waste-input"
                  />
                  <input
                    placeholder="Receipt ref"
                    value={collectionForm.receipt_ref}
                    onChange={(e) => setCollectionForm({ ...collectionForm, receipt_ref: e.target.value })}
                    className="waste-input"
                  />
                  <button className="waste-btn primary" onClick={handleAddCollection}>Add</button>
                </div>
              </div>

              <table className="waste-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Weight (kg)</th>
                    <th>Contractor</th>
                    <th>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map(c => (
                    <tr key={c.id}>
                      <td>{new Date(c.collected_at).toLocaleDateString()}</td>
                      <td><span className={`waste-badge cat-${c.waste_category?.toLowerCase()}`}>{c.waste_category}</span></td>
                      <td><strong>⚖️ {c.measured_weight_kg} kg</strong></td>
                      <td>{c.contractor || '-'}</td>
                      <td>{c.receipt_ref || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Targets Tab ── */}
          {tab === 'targets' && (
            <div>
              <div className="waste-form-card">
                <h3>🎯 Set Reduction Target</h3>
                <div className="waste-form-row">
                  <select
                    value={targetForm.metric}
                    onChange={(e) => setTargetForm({ ...targetForm, metric: e.target.value })}
                    className="waste-select"
                  >
                    <option value="recycling_rate">Recycling Rate (%)</option>
                    <option value="diversion_rate">Diversion Rate (%)</option>
                    <option value="total_waste">Total Waste (kg/month)</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Target value"
                    value={targetForm.target_value}
                    onChange={(e) => setTargetForm({ ...targetForm, target_value: e.target.value })}
                    className="waste-input"
                  />
                  <input
                    type="number"
                    placeholder="Baseline (optional)"
                    value={targetForm.baseline_value}
                    onChange={(e) => setTargetForm({ ...targetForm, baseline_value: e.target.value })}
                    className="waste-input"
                  />
                  <button className="waste-btn primary" onClick={handleAddTarget}>Add</button>
                </div>
              </div>

              <div className="waste-targets-cards">
                {targets.map(t => (
                  <div key={t.id} className="waste-target-card">
                    <div className="waste-target-metric">{t.metric.replace(/_/g, ' ')}</div>
                    <div className="waste-target-value">🎯 {t.target_value}{t.metric.includes('rate') ? '%' : ' kg'}</div>
                    {t.baseline_value != null && (
                      <div className="waste-target-baseline">Baseline: {t.baseline_value}{t.metric.includes('rate') ? '%' : ' kg'}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
