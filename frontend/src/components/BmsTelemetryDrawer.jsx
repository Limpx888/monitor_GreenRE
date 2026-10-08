import React from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function BmsTelemetryDrawer({ isOpen, data, onClose }) {
    if (!isOpen || !data) return null;

    const exportLedger = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `greenre-${data.floor}-audit-ledger.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed right-0 top-0 w-96 h-screen bg-white shadow-2xl p-6 z-50 overflow-y-auto" style={{ borderLeft: '1px solid #e5e7eb' }}>
            {/* Top Bar: GreenRE Audit Packaging */}
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h2 className="text-lg font-bold text-gray-800">BMS Local Gateway</h2>
                <div className="flex gap-2">
                    <button onClick={exportLedger} className="bg-green-600 text-white text-[10px] px-2 py-1 rounded shadow cursor-pointer">
                        📥 Export GreenRE Ledger
                    </button>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 cursor-pointer">
                        ✕
                    </button>
                </div>
            </div>
            
            {/* Badges: Demonstrating data authenticity and a high-tech feel */}
            <div className="flex space-x-2 mb-4">
                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded">
                    Source: LBNL Fault Dataset
                </span>
                <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-1 rounded">
                    Mapped via RAG LLM
                </span>
            </div>
            <div className="mb-4 text-[10px] text-gray-500">
                Schema: {data.schema_mapping?.damper_position} · {data.schema_mapping?.fan_speed}
            </div>

            {/* Status Information */}
            <div className="mb-4 bg-red-50 p-3 rounded border border-red-100">
                <div className="text-xs font-bold text-red-800 mb-1">Status: {data.status}</div>
                <div className="text-xs text-red-600">Floor: {data.floor}</div>
                <div className="text-xs text-gray-600 mt-1">Audit Time: {data.audit_timestamp}</div>
            </div>

            {/* Chart Area: Render the 24-hour real series sent by the backend */}
            <h3 className="font-bold text-sm text-red-600 mb-2">Diagnostic: {data.ai_diagnosis}</h3>
            <div className="h-48 w-full mt-4 bg-gray-50 rounded p-2 border border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.telemetry_series}>
                        <XAxis dataKey="time" hide />
                        <Tooltip />
                        <Line type="monotone" dataKey="damper_pct" stroke="#ef4444" strokeWidth={2} name="Damper Position (%)" dot={false} />
                        <Line type="monotone" dataKey="fan_rpm" stroke="#3b82f6" strokeWidth={2} name="Supply Fan RPM" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            {/* Equipment Breakdown */}
            <div className="mt-6">
                <h3 className="font-bold text-sm text-gray-700 mb-2">Equipment Breakdown</h3>
                <div className="space-y-2">
                    {data.equipment_breakdown?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-xs font-medium text-gray-600">{item.name}</span>
                            <span className="text-xs font-bold text-gray-800">{item.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
