import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { actionsApi } from '../api/wasteApi';

const HIERARCHY_STYLES = {
  REDUCE: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: '⬇️', label: 'Reduce' },
  REUSE: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '🔄', label: 'Reuse' },
  RECYCLE: { bg: '#dcfce7', border: '#22c55e', text: '#15803d', icon: '♻️', label: 'Recycle' },
};

const STATUS_COLS = ['suggested', 'in_progress', 'done'];
const STATUS_LABELS = { suggested: '💡 Suggested', in_progress: '🔧 In Progress', done: '✅ Done' };

export default function WasteActionsPage() {
  const { activeSite } = useOutletContext();
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadActions = () => {
    if (!activeSite) return;
    setLoading(true);
    actionsApi.list(activeSite)
      .then(setActions)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadActions, [activeSite]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await actionsApi.generate(activeSite, 30);
      loadActions();
    } catch { }
    setGenerating(false);
  };

  const handleStatusChange = async (actionId, newStatus) => {
    await actionsApi.update(actionId, { status: newStatus });
    setActions(actions.map(a => a.id === actionId ? { ...a, status: newStatus } : a));
  };

  const grouped = STATUS_COLS.reduce((acc, s) => {
    acc[s] = actions.filter(a => a.status === s);
    return acc;
  }, {});

  return (
    <div className="waste-page">
      <div className="waste-page-header">
        <h1>♻️ 3R Actions Board</h1>
        <p>Reduce → Reuse → Recycle — Follow the waste hierarchy</p>
        <button
          className="waste-btn primary"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? '⏳ Analyzing...' : '🤖 Generate AI Recommendations'}
        </button>
      </div>

      {/* Hierarchy legend */}
      <div className="waste-hierarchy-legend">
        {Object.entries(HIERARCHY_STYLES).map(([key, style]) => (
          <div key={key} className="waste-hierarchy-item" style={{ background: style.bg, borderColor: style.border }}>
            {style.icon} {style.label} — {key === 'REDUCE' ? 'Prevent waste at the source' : key === 'REUSE' ? 'Find a second life for items' : 'Process materials into new products'}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="waste-loading"><div className="waste-spinner" /><p>Loading actions...</p></div>
      ) : (
        <div className="waste-kanban">
          {STATUS_COLS.map(status => (
            <div key={status} className="waste-kanban-column">
              <div className="waste-kanban-header">
                <span>{STATUS_LABELS[status]}</span>
                <span className="waste-badge">{grouped[status].length}</span>
              </div>
              <div className="waste-kanban-cards">
                {grouped[status].map(action => {
                  const hs = HIERARCHY_STYLES[action.hierarchy_level] || HIERARCHY_STYLES.RECYCLE;
                  return (
                    <div
                      key={action.id}
                      className="waste-kanban-card"
                      style={{ borderLeftColor: hs.border }}
                    >
                      <div className="waste-kanban-card-header">
                        <span className="waste-badge" style={{ background: hs.bg, color: hs.text }}>
                          {hs.icon} {action.hierarchy_level}
                        </span>
                        <span className="waste-badge effort">{action.effort_level}</span>
                      </div>
                      <h4>{action.title}</h4>
                      <p className="waste-kanban-desc">{action.description}</p>

                      <div className="waste-kanban-metrics">
                        <span>💰 ~{action.estimated_saving_kg?.toFixed(1)} kg/month</span>
                        <span>🌍 ~{action.estimated_saving_co2e?.toFixed(1)} kg CO₂e</span>
                      </div>

                      {action.before_metric != null && action.after_metric != null && action.status === 'done' && (
                        <div className="waste-before-after">
                          <span className="before">Before: {action.before_metric?.toFixed(1)}</span>
                          <span className="arrow">→</span>
                          <span className="after">After: {action.after_metric?.toFixed(1)}</span>
                        </div>
                      )}

                      {action.evidence_summary && (
                        <div className="waste-kanban-evidence">
                          📊 {action.evidence_summary}
                        </div>
                      )}

                      <div className="waste-kanban-actions">
                        {status === 'suggested' && (
                          <button
                            className="waste-btn-small primary"
                            onClick={() => handleStatusChange(action.id, 'in_progress')}
                          >
                            ▶️ Start
                          </button>
                        )}
                        {status === 'in_progress' && (
                          <button
                            className="waste-btn-small success"
                            onClick={() => handleStatusChange(action.id, 'done')}
                          >
                            ✅ Complete
                          </button>
                        )}
                        {status === 'done' && (
                          <span className="waste-completed-date">
                            Completed {action.completed_at ? new Date(action.completed_at).toLocaleDateString() : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {grouped[status].length === 0 && (
                  <div className="waste-kanban-empty">No actions</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
