import React, { useState, useEffect } from 'react';
import { waterApi } from '../api/waterApi';

export default function WaterRulesPage() {
  const [rules, setRules] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    waterApi.getGreenRERules()
      .then((res) => setRules(res.rules || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rules.filter((r) => {
    const q = search.toLowerCase();
    return (
      r.criteria_id.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.actionable_recommendation.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--gg-fg)', margin: 0 }}>
            📜 GreenRE Water Efficiency Knowledge Base
          </h1>
          <p style={{ color: 'var(--gg-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
            Vector & RAG-ready criteria for LangGraph compliance reasoning
          </p>
        </div>

        <input
          type="text"
          placeholder="🔍 Search criteria, category, or rules..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '8px 16px',
            borderRadius: '10px',
            border: '1px solid var(--gg-line-strong)',
            fontSize: '0.85rem',
            width: '280px',
          }}
        />
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--gg-muted)' }}>
          Loading rules database...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {filtered.map((rule) => (
            <div
              key={rule.criteria_id}
              style={{
                background: 'var(--gg-surface)',
                border: '1px solid var(--gg-line)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: 'var(--gg-shadow-xs)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span
                    style={{
                      background: 'var(--gg-info-bg)',
                      color: 'var(--gg-water)',
                      border: '1px solid var(--gg-line)',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                    }}
                  >
                    {rule.criteria_id}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gg-muted)', textTransform: 'uppercase' }}>
                    SPACE: {rule.applicable_space}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gg-fg)', margin: '0 0 8px 0' }}>
                  {rule.category}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--gg-muted)', lineHeight: '1.5', margin: '0 0 16px 0' }}>
                  {rule.description}
                </p>
              </div>

              <div style={{ background: 'var(--gg-surface-2)', padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid #0284c7' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gg-water)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Actionable MEP Recommendation
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--gg-fg)', fontWeight: 600 }}>
                  {rule.actionable_recommendation}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
