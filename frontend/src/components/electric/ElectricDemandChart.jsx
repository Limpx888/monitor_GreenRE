import React, { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { Clock, Play, Pause, Zap } from 'lucide-react';
import { Badge, Button, chart } from '../../ui';
import { TARIFF_CONFIG } from '../../config/tariffs';

// 24-hour multi-dimensional subsystem baseline profile
export const INITIAL_24H_DATA = [
  { time: '00:00', hvac: 420, lighting: 95, elevators: 25, it: 195, plug: 85, baseline: 800, tariff: 'Off-Peak' },
  { time: '01:00', hvac: 390, lighting: 85, elevators: 20, it: 198, plug: 87, baseline: 760, tariff: 'Off-Peak' },
  { time: '02:00', hvac: 370, lighting: 80, elevators: 15, it: 197, plug: 88, baseline: 740, tariff: 'Off-Peak' },
  { time: '03:00', hvac: 360, lighting: 80, elevators: 15, it: 196, plug: 89, baseline: 730, tariff: 'Off-Peak' },
  { time: '04:00', hvac: 375, lighting: 85, elevators: 20, it: 195, plug: 85, baseline: 740, tariff: 'Off-Peak' },
  { time: '05:00', hvac: 430, lighting: 95, elevators: 30, it: 194, plug: 81, baseline: 810, tariff: 'Off-Peak' },
  { time: '06:00', hvac: 580, lighting: 150, elevators: 55, it: 195, plug: 70, baseline: 980, tariff: 'Off-Peak' },
  { time: '07:00', hvac: 760, lighting: 220, elevators: 110, it: 198, plug: 32, baseline: 1250, tariff: 'Off-Peak' },
  { time: '08:00', hvac: 980, lighting: 310, elevators: 165, it: 200, plug: 25, baseline: 1590, tariff: 'Peak' },
  { time: '09:00', hvac: 1060, lighting: 325, elevators: 195, it: 202, plug: 28, baseline: 1720, tariff: 'Peak' },
  { time: '10:00', hvac: 1110, lighting: 330, elevators: 215, it: 204, plug: 31, baseline: 1790, tariff: 'Peak' },
  { time: '11:00', hvac: 1140, lighting: 332, elevators: 225, it: 203, plug: 40, baseline: 1830, tariff: 'Peak' },
  { time: '12:00', hvac: 1090, lighting: 328, elevators: 210, it: 202, plug: 40, baseline: 1780, tariff: 'Peak' },
  { time: '13:00', hvac: 1070, lighting: 325, elevators: 200, it: 201, plug: 34, baseline: 1750, tariff: 'Peak' },
  { time: '14:00', hvac: 1160, lighting: 330, elevators: 228, it: 203, plug: 59, baseline: 1850, tariff: 'Peak' },
  { time: '15:00', hvac: 1180, lighting: 335, elevators: 230, it: 205, plug: 60, baseline: 1860, tariff: 'Peak' },
  { time: '16:00', hvac: 1120, lighting: 330, elevators: 220, it: 204, plug: 46, baseline: 1820, tariff: 'Peak' },
  { time: '17:00', hvac: 1060, lighting: 320, elevators: 210, it: 202, plug: 48, baseline: 1760, tariff: 'Peak' },
  { time: '18:00', hvac: 950, lighting: 300, elevators: 175, it: 200, plug: 25, baseline: 1600, tariff: 'Peak' },
  { time: '19:00', hvac: 840, lighting: 260, elevators: 145, it: 198, plug: 37, baseline: 1420, tariff: 'Peak' },
  { time: '20:00', hvac: 780, lighting: 230, elevators: 120, it: 197, plug: 63, baseline: 1330, tariff: 'Peak' },
  { time: '21:00', hvac: 710, lighting: 190, elevators: 95, it: 196, plug: 69, baseline: 1220, tariff: 'Peak' },
  { time: '22:00', hvac: 580, lighting: 130, elevators: 65, it: 195, plug: 70, baseline: 1010, tariff: 'Off-Peak' },
  { time: '23:00', hvac: 480, lighting: 105, elevators: 40, it: 195, plug: 70, baseline: 860, tariff: 'Off-Peak' },
];

export default function ElectricDemandChart({
  livePoints,
  latestData,
  isPollingActive = true,
  onTogglePolling,
}) {
  const [viewMode, setViewMode] = useState('live'); // Default to live 5s view to showcase dynamic telemetry

  // Current active data according to selected view mode
  const chartData = useMemo(() => {
    if (viewMode === 'live' && livePoints && livePoints.length > 0) {
      return livePoints;
    }
    return INITIAL_24H_DATA.map((d) => ({
      ...d,
      total: +(d.hvac + d.lighting + d.elevators + d.it + d.plug).toFixed(1),
    }));
  }, [viewMode, livePoints]);

  // Synchronized telemetry from props
  const latestPoint = latestData || (livePoints && livePoints[livePoints.length - 1]) || chartData[chartData.length - 1];
  const liveTotalDemand = latestPoint?.totalDemand || latestPoint?.total || 1840.0;
  const liveCostRate = latestPoint?.costPerHour != null
    ? latestPoint.costPerHour.toFixed(2)
    : (liveTotalDemand * TARIFF_CONFIG.ELECTRICITY_BASE_RATE_KWH).toFixed(2);

  const subsystems = latestPoint?.subsystems || latestPoint || {
    hvac: 950.0,
    lighting: 320.0,
    elevators: 210.0,
    it: 202.0,
    plug: 125.0,
  };

  return (
    <div className="space-y-4">
      {/* Chart Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'live'
                  ? 'bg-surface text-fg shadow-xs font-bold'
                  : 'text-muted hover:text-fg'
              }`}
            >
              <span className={`size-2 rounded-full ${isPollingActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
              Live 5s Polling (30-Point Window)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('24h')}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
                viewMode === '24h'
                  ? 'bg-surface text-fg shadow-xs font-bold'
                  : 'text-muted hover:text-fg'
              }`}
            >
              24-Hour Profile
            </button>
          </div>

          <Badge tone={isPollingActive ? 'success' : 'neutral'}>
            {isPollingActive ? '5s Industrial Stream Active' : 'Stream Paused'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePolling && (
            <Button
              size="sm"
              variant="ghost"
              icon={isPollingActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              onClick={onTogglePolling}
            >
              {isPollingActive ? 'Pause Stream' : 'Resume Stream'}
            </Button>
          )}
          <div className="flex items-center gap-1 text-xs text-muted font-mono bg-surface-2 px-2.5 py-1 rounded-md border border-line">
            <Zap className="size-3 text-amber-500" />
            <span>Demand: <strong className="text-fg">{Number(liveTotalDemand).toFixed(1)} kW</strong></span>
            <span className="text-line mx-1">|</span>
            <span className="text-emerald-500 font-semibold">RM {liveCostRate}/h</span>
          </div>
        </div>
      </div>

      {/* Stacked Area Chart Container */}
      <div className="h-[380px] w-full rounded-lg bg-surface border border-line p-3 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="plugGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="itGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="elevatorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="lightingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.65} />
              </linearGradient>
              <linearGradient id="hvacGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.65} />
              </linearGradient>
            </defs>

            <CartesianGrid {...chart.grid} />
            <XAxis
              dataKey="time"
              {...chart.axis}
            />
            <YAxis
              {...chart.axis}
              unit=" kW"
              domain={[0, 2300]}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  const totalKw = d.total || (d.hvac + d.lighting + d.elevators + d.it + d.plug);
                  const costPerHour = (totalKw * TARIFF_CONFIG.ELECTRICITY_BASE_RATE_KWH).toFixed(2);
                  const isOverBaseline = totalKw > d.baseline;

                  return (
                    <div className="rounded-lg border border-line bg-surface/95 p-3.5 shadow-xl backdrop-blur-md text-xs min-w-[220px]">
                      <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                        <span className="font-bold text-fg flex items-center gap-1.5">
                          <Clock className="size-3.5 text-primary" /> {label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          d.tariff === 'Peak' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {d.tariff || 'Live Telemetry'}
                        </span>
                      </div>

                      <div className="space-y-1.5 font-mono">
                        <div className="flex items-center justify-between text-teal-400">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-xs bg-[#14B8A6]" /> HVAC & Chillers:
                          </span>
                          <span className="font-bold">{Number(d.hvac).toFixed(1)} kW</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-xs bg-[#F59E0B]" /> Lighting:
                          </span>
                          <span className="font-bold">{Number(d.lighting).toFixed(1)} kW</span>
                        </div>
                        <div className="flex items-center justify-between text-sky-400">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-xs bg-[#0EA5E9]" /> Elevators:
                          </span>
                          <span className="font-bold">{Number(d.elevators).toFixed(1)} kW</span>
                        </div>
                        <div className="flex items-center justify-between text-violet-400">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-xs bg-[#8B5CF6]" /> IT & Edge:
                          </span>
                          <span className="font-bold">{Number(d.it).toFixed(1)} kW</span>
                        </div>
                        <div className="flex items-center justify-between text-emerald-400">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2 rounded-xs bg-[#10B981]" /> Plug Loads:
                          </span>
                          <span className="font-bold">{Number(d.plug).toFixed(1)} kW</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-line space-y-1">
                        <div className="flex items-center justify-between font-bold text-fg text-sm">
                          <span>Total Demand:</span>
                          <span className="text-primary font-mono">{Number(totalKw).toFixed(1)} kW</span>
                        </div>
                        <div className="flex items-center justify-between text-muted text-[11px]">
                          <span>Baseline:</span>
                          <span className="font-mono">{Number(d.baseline).toFixed(0)} kW ({isOverBaseline ? '+' : ''}{Math.round(((totalKw - d.baseline) / d.baseline) * 100)}%)</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-500 font-mono font-semibold pt-1">
                          <span>Cost Burn Rate:</span>
                          <span>RM {costPerHour}/hr</span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ paddingBottom: '8px', fontSize: '12px' }}
            />

            {/* Peak Tariff window highlight when in 24h view */}
            {viewMode === '24h' && (
              <ReferenceArea
                x1="08:00"
                x2="22:00"
                fill="#f59e0b"
                fillOpacity={0.05}
                stroke="#f59e0b"
                strokeOpacity={0.2}
                strokeDasharray="2 2"
              />
            )}

            {/* Contracted Max Demand Line */}
            <ReferenceLine
              y={2100}
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Contracted MD Ceiling (2,100 kW)',
                fill: '#ef4444',
                fontSize: 11,
                position: 'top',
              }}
            />

            {/* Stacked Areas with stackId="1". Order: Plug -> IT -> Elevators -> Lighting -> HVAC */}
            <Area
              type="monotone"
              dataKey="plug"
              stackId="1"
              stroke="#10B981"
              fill="url(#plugGrad)"
              name="Plug Loads"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="it"
              stackId="1"
              stroke="#8B5CF6"
              fill="url(#itGrad)"
              name="IT & Edge"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="elevators"
              stackId="1"
              stroke="#0EA5E9"
              fill="url(#elevatorGrad)"
              name="Elevators"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="lighting"
              stackId="1"
              stroke="#F59E0B"
              fill="url(#lightingGrad)"
              name="Lighting"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="hvac"
              stackId="1"
              stroke="#14B8A6"
              fill="url(#hvacGrad)"
              name="HVAC & Chillers"
              isAnimationActive={false}
            />

            {/* Historical Baseline is unstacked and dashed */}
            <Area
              type="monotone"
              dataKey="baseline"
              stroke="#9CA3AF"
              strokeDasharray="5 5"
              strokeWidth={2}
              fill="none"
              name="Historical Baseline"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Subsystem Quick Breakdown Badges */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-teal-500/20 bg-teal-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-xs bg-[#14B8A6]" /> HVAC
          </span>
          <span className="font-mono font-bold text-teal-400">{Number(subsystems.hvac).toFixed(1)} kW</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-xs bg-[#F59E0B]" /> Lighting
          </span>
          <span className="font-mono font-bold text-amber-400">{Number(subsystems.lighting).toFixed(1)} kW</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-xs bg-[#0EA5E9]" /> Elevators
          </span>
          <span className="font-mono font-bold text-sky-400">{Number(subsystems.elevators).toFixed(1)} kW</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-xs bg-[#8B5CF6]" /> IT & Edge
          </span>
          <span className="font-mono font-bold text-violet-400">{Number(subsystems.it).toFixed(1)} kW</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="size-2 rounded-xs bg-[#10B981]" /> Plug Loads
          </span>
          <span className="font-mono font-bold text-emerald-400">{Number(subsystems.plug).toFixed(1)} kW</span>
        </div>
      </div>
    </div>
  );
}
