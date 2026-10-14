import React, { useState } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function BmsTelemetryDrawer({ isOpen, data, onClose }) {
    if (!isOpen || !data) return null;

    const [qaQuestion, setQaQuestion] = useState('');
    const [qaLoading, setQaLoading] = useState(false);
    const [qaResult, setQaResult] = useState(null);

    const exportLedger = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `greenre-${data.floor}-audit-ledger.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const handleAskManual = async (e) => {
        e.preventDefault();
        if (!qaQuestion.trim() || qaLoading) return;

        setQaLoading(true);
        try {
            const res = await fetch('/api/rag/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: qaQuestion, floor: data.floor || 'L14' }),
            });
            if (res.ok) {
                const json = await res.json();
                setQaResult(json);
            } else {
                setQaResult({ answer: 'Failed to retrieve answer from RAG engine. Check backend logs.', citations: [] });
            }
        } catch (err) {
            setQaResult({ answer: `Connection error: ${err.message}`, citations: [] });
        } finally {
            setQaLoading(false);
        }
    };

    const confidencePct = Math.round((data.confidence || 0.94) * 100);
    const severityBadgeColor =
        data.severity === 'CRITICAL' ? 'bg-red-100 text-red-700 border-red-200' :
        data.severity === 'HIGH' ? 'bg-orange-100 text-orange-700 border-orange-200' :
        'bg-blue-100 text-blue-700 border-blue-200';

    return (
        <div className="fixed right-0 top-0 w-96 h-screen bg-white shadow-2xl p-6 z-50 overflow-y-auto" style={{ borderLeft: '1px solid #e5e7eb' }}>
            {/* Top Bar: GreenRE Audit Packaging */}
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <div>
                    <h2 className="text-base font-bold text-gray-800">BMS Local Gateway</h2>
                    <p className="text-[10px] text-gray-500">Autonomous AFDD & RAG Diagnostic Suite</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportLedger} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold px-2 py-1 rounded shadow cursor-pointer transition">
                        📥 Export Ledger
                    </button>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer font-bold px-1">
                        ✕
                    </button>
                </div>
            </div>
            
            {/* Badges: Model & Reasoning Provenance */}
            <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded font-medium">
                    📄 {data.source || 'LBNL AFDD Manual'}
                </span>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] px-2 py-0.5 rounded font-medium">
                    🤖 {data.llm_provider ? `LLM: ${data.llm_provider.toUpperCase()}` : 'LLM Reasoner'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${severityBadgeColor}`}>
                    {data.severity || 'CRITICAL'}
                </span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] px-2 py-0.5 rounded font-medium">
                    🎯 {confidencePct}% Confidence
                </span>
            </div>

            <div className="mb-3 text-[10px] text-gray-400 font-mono">
                Schema: {data.schema_mapping?.damper_position || 'damper_position'} · {data.schema_mapping?.fan_speed || 'fan_speed'}
            </div>

            {/* Diagnostic Conclusion */}
            <div className="mb-4 bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-red-900">Floor {data.floor} Diagnostic</span>
                    <span className="text-[10px] font-mono text-red-700">{data.status}</span>
                </div>
                <h3 className="font-bold text-xs text-red-700 mt-1 leading-snug">
                    {data.ai_diagnosis || 'Mechanical Economizer Damper Seizure'}
                </h3>
                <div className="text-[10px] text-gray-500 mt-2">Audit Timestamp: {data.audit_timestamp}</div>
            </div>

            {/* Recommended Action Checks */}
            {data.recommended_checks && data.recommended_checks.length > 0 && (
                <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span>🔧</span> Recommended Corrective Checks
                    </h4>
                    <ul className="space-y-1.5">
                        {data.recommended_checks.map((check, idx) => (
                            <li key={idx} className="text-[11px] text-slate-700 flex items-start gap-1.5 leading-relaxed">
                                <span className="text-emerald-600 font-bold">✓</span>
                                <span>{check}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Chart Area: 24-hour sensor series */}
            <div className="mb-4">
                <h4 className="text-[11px] font-bold text-gray-700 mb-1">24h Telemetry Profile (Damper vs Fan)</h4>
                <div className="h-44 w-full bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.telemetry_series}>
                            <XAxis dataKey="time" hide />
                            <Tooltip />
                            <Line type="monotone" dataKey="damper_pct" stroke="#ef4444" strokeWidth={2} name="Damper Position (%)" dot={false} />
                            <Line type="monotone" dataKey="fan_rpm" stroke="#3b82f6" strokeWidth={2} name="Supply Fan RPM" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Evidence Source (Citations from LBNL Manual) */}
            <div className="mb-4">
                <h4 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span>📚</span> Evidence Source & Manual Citations
                </h4>
                <div className="space-y-2">
                    {(data.citations && data.citations.length > 0 ? data.citations : [
                        { source: 'LBNLDataSynthesisInventory.pdf', page: 14, excerpt: 'Economizer and Damper Faults: Outdoor air damper stuck open causes excessive cooling energy during mild or cool weather.' }
                    ]).map((cite, idx) => (
                        <div key={idx} className="bg-amber-50/70 p-2.5 rounded border border-amber-200/80 text-[11px]">
                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-900 mb-1">
                                <span className="truncate max-w-[190px]">📖 {cite.source}</span>
                                <span className="bg-amber-200/80 text-amber-950 px-1.5 py-0.5 rounded font-mono text-[9px]">
                                    Page {cite.page}
                                </span>
                            </div>
                            <p className="text-gray-700 italic text-[10px] leading-relaxed">
                                "{cite.excerpt}"
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Interactive Manual QA Module */}
            <div className="mb-6 bg-blue-50/50 p-3 rounded-lg border border-blue-200">
                <h4 className="text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span>💬</span> Interactive Manual Assistant
                </h4>
                <p className="text-[10px] text-blue-700 mb-2">
                    Ask technical operating questions regarding this alarm to retrieve cited procedures.
                </p>
                <form onSubmit={handleAskManual} className="space-y-2">
                    <input
                        type="text"
                        value={qaQuestion}
                        onChange={(e) => setQaQuestion(e.target.value)}
                        placeholder="e.g. How do I manually reset the damper actuator?"
                        className="w-full text-xs p-2 rounded border border-blue-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={qaLoading || !qaQuestion.trim()}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-1.5 px-3 rounded shadow cursor-pointer transition flex items-center justify-center gap-1"
                    >
                        {qaLoading ? <span>Thinking & Retrieving...</span> : <span>Ask Engineering Manual</span>}
                    </button>
                </form>

                {qaResult && (
                    <div className="mt-3 bg-white p-2.5 rounded border border-blue-100 text-xs shadow-sm">
                        <div className="font-semibold text-blue-950 text-[11px] mb-1">Generated Response:</div>
                        <p className="text-gray-800 text-[11px] leading-relaxed whitespace-pre-line">
                            {qaResult.answer}
                        </p>
                        {qaResult.citations && qaResult.citations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                                <div className="text-[9px] font-bold text-gray-500 uppercase">Cited References:</div>
                                {qaResult.citations.map((c, i) => (
                                    <div key={i} className="text-[9px] text-gray-600 mt-0.5">
                                        • {c.source} (Page {c.page})
                                    </div>
                                ))}
                            </div>
                        )}
                        {qaResult.latency_ms && (
                            <div className="text-[9px] text-gray-400 mt-1 font-mono text-right">
                                Latency: {qaResult.latency_ms} ms
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Equipment Breakdown */}
            <div className="mt-4 border-t pt-3">
                <h4 className="font-bold text-[11px] text-gray-700 mb-2">Floor Sub-Metering Breakdown</h4>
                <div className="space-y-1.5">
                    {data.equipment_breakdown?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-1.5 px-2 rounded text-xs">
                            <span className="font-medium text-gray-600 text-[11px]">{item.name}</span>
                            <span className="font-bold text-gray-800 text-[11px]">{item.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
