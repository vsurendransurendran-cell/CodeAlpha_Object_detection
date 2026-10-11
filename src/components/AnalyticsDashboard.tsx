import React, { useState } from 'react';
import {
  Download,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import {
  TrackedObject,
  CountingLine,
  DetectionZone,
  IncidentEvent,
  FlowDataPoint,
} from '../types/vision';

interface AnalyticsDashboardProps {
  tracks: TrackedObject[];
  tripwires: CountingLine[];
  zones: DetectionZone[];
  incidents: IncidentEvent[];
  flowHistory: FlowDataPoint[];
  totalCrossings: number;
  totalUniqueTracks: number;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  tracks,
  tripwires,
  zones,
  incidents,
  flowHistory,
  totalCrossings,
  totalUniqueTracks,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Compute live aggregates
  const activeCount = tracks.length;
  const avgSpeed = tracks.length > 0
    ? Math.round(tracks.reduce((acc, t) => acc + t.speedKmh, 0) / tracks.length)
    : 0;

  const avgDwell = tracks.length > 0
    ? Math.round(tracks.reduce((acc, t) => acc + t.dwellTimeSec, 0) / tracks.length)
    : 0;

  // Class breakdown
  const classCounts: Record<string, number> = {};
  for (const t of tracks) {
    classCounts[t.className] = (classCounts[t.className] || 0) + 1;
  }
  const totalClasses = Object.values(classCounts).reduce((a, b) => a + b, 0) || 1;

  // Speed histogram
  const speedBuckets = {
    slow: tracks.filter((t) => t.speedKmh < 30).length,
    medium: tracks.filter((t) => t.speedKmh >= 30 && t.speedKmh < 60).length,
    fast: tracks.filter((t) => t.speedKmh >= 60 && t.speedKmh < 90).length,
    high: tracks.filter((t) => t.speedKmh >= 90).length,
  };

  // Filtered incidents
  const filteredIncidents = incidents.filter(
    (inc) => severityFilter === 'all' || inc.severity === severityFilter
  );

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = [
      'Track_ID',
      'Class_Name',
      'Category',
      'Speed_Kmh',
      'Dwell_Time_Sec',
      'Direction',
      'Center_X',
      'Center_Y',
    ];
    const rows = tracks.map((t) => [
      t.trackId,
      t.className,
      t.category,
      t.speedKmh,
      t.dwellTimeSec,
      t.direction,
      Math.round(t.center[0]),
      Math.round(t.center[1]),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `visiontrack_analytics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // JSON Exporter
  const handleExportJSON = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        active_tracks: activeCount,
        total_unique_tracks: totalUniqueTracks,
        total_crossings: totalCrossings,
        average_speed_kmh: avgSpeed,
        average_dwell_sec: avgDwell,
      },
      tripwires: tripwires.map((l) => ({
        id: l.id,
        name: l.name,
        inbound: l.inCount,
        outbound: l.outCount,
      })),
      zones: zones.map((z) => ({
        id: z.id,
        name: z.name,
        current_occupancy: z.currentOccupancy,
        peak_occupancy: z.peakOccupancy,
      })),
      active_tracks: tracks.map((t) => ({
        trackId: t.trackId,
        className: t.className,
        speedKmh: t.speedKmh,
        dwellSec: t.dwellTimeSec,
        direction: t.direction,
      })),
      incidents,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `visiontrack_telemetry_${Date.now()}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Telemetry & Flow Analytics
          </h2>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Spatial Density</span>
            <span aria-hidden="true">·</span>
            <span>Multi-Object Velocity</span>
            <span aria-hidden="true">·</span>
            <span>Real-time Tripwire Crossings</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
          >
            <FileCode className="h-3.5 w-3.5 text-indigo-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Active In-Frame</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-white">
              {activeCount}
            </span>
            <span className="text-xs text-slate-500">objects</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Total Unique Tracks</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-indigo-400">
              {totalUniqueTracks}
            </span>
            <span className="text-xs text-slate-500">seen</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Line Crossings</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
              {totalCrossings}
            </span>
            <span className="text-xs text-slate-500">total</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Average Velocity</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-sky-400">
              {avgSpeed}
            </span>
            <span className="text-xs text-slate-500">km/h</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Mean Dwell Time</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-amber-400">
              {avgDwell}
            </span>
            <span className="text-xs text-slate-500">sec</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <span className="text-xs font-medium text-slate-400">Safety Incidents</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold tabular-nums text-rose-400">
              {incidents.length}
            </span>
            <span className="text-xs text-slate-500">logged</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart 1: Flow Rate Timeline (SVG) */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Flow Rate & Tripwire Trajectory</h3>
              <p className="text-xs text-slate-500">Real-time crossings recorded across sampling windows</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Inbound
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Outbound
              </span>
            </div>
          </div>

          {/* SVG Line Chart */}
          <div className="h-56 w-full">
            <svg className="h-full w-full" viewBox="0 0 600 200" preserveAspectRatio="none">
              {/* Grid lines */}
              <line x1="0" y1="50" x2="600" y2="50" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#1e293b" strokeDasharray="4 4" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#1e293b" strokeDasharray="4 4" />

              {/* Inbound Line */}
              {flowHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2.5"
                  points={flowHistory
                    .map((d, i) => {
                      const x = (i / (flowHistory.length - 1)) * 580 + 10;
                      const y = 180 - Math.min(160, d.inbound * 14);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Outbound Line */}
              {flowHistory.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  points={flowHistory
                    .map((d, i) => {
                      const x = (i / (flowHistory.length - 1)) * 580 + 10;
                      const y = 180 - Math.min(160, d.outbound * 14);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                />
              )}

              {/* Data points */}
              {flowHistory.map((d, i) => {
                const x = (i / Math.max(1, flowHistory.length - 1)) * 580 + 10;
                const yIn = 180 - Math.min(160, d.inbound * 14);
                const yOut = 180 - Math.min(160, d.outbound * 14);
                return (
                  <g key={i}>
                    <circle cx={x} cy={yIn} r="3" fill="#6366f1" />
                    <circle cx={x} cy={yOut} r="3" fill="#10b981" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mt-2 flex justify-between text-xs font-mono text-slate-500">
            <span>T-60s</span>
            <span>T-45s</span>
            <span>T-30s</span>
            <span>T-15s</span>
            <span>Live</span>
          </div>
        </div>

        {/* Chart 2: Class Breakdown */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Detected Class Distribution</h3>
          <p className="text-xs text-slate-500 mb-4">Active tracking volume by COCO class</p>

          <div className="flex flex-col gap-3">
            {Object.keys(classCounts).length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No active objects detected in view.</p>
            ) : (
              Object.entries(classCounts).map(([className, count]) => {
                const pct = Math.round((count / totalClasses) * 100);
                return (
                  <div key={className} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-slate-300 font-medium">{className}</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Secondary Analytics Row: Speed Profile & Tripwire Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Speed Distribution Histogram */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Velocity Profile</h3>
          <p className="text-xs text-slate-500 mb-4">Distribution across speed ranges</p>

          <div className="grid grid-cols-4 gap-2 items-end h-32 pt-4">
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-full bg-cyan-500/80 rounded-t transition-all duration-300"
                style={{ height: `${Math.min(100, (speedBuckets.slow / (activeCount || 1)) * 100)}%`, minHeight: '4px' }}
              />
              <span className="text-[11px] font-mono text-slate-400">&lt;30</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-full bg-indigo-500/80 rounded-t transition-all duration-300"
                style={{ height: `${Math.min(100, (speedBuckets.medium / (activeCount || 1)) * 100)}%`, minHeight: '4px' }}
              />
              <span className="text-[11px] font-mono text-slate-400">30-60</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-full bg-amber-500/80 rounded-t transition-all duration-300"
                style={{ height: `${Math.min(100, (speedBuckets.fast / (activeCount || 1)) * 100)}%`, minHeight: '4px' }}
              />
              <span className="text-[11px] font-mono text-slate-400">60-90</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-full bg-rose-500/80 rounded-t transition-all duration-300"
                style={{ height: `${Math.min(100, (speedBuckets.high / (activeCount || 1)) * 100)}%`, minHeight: '4px' }}
              />
              <span className="text-[11px] font-mono text-slate-400">&gt;90</span>
            </div>
          </div>
          <div className="text-center text-xs text-slate-500 mt-2 font-mono">km/h</div>
        </div>

        {/* Tripwire & Zone Status Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white mb-1">Active Tripwires & ROI Zones</h3>
          <p className="text-xs text-slate-500 mb-3">Live counters and boundary occupancy</p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-2">Boundary Name</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2 text-right">Inbound / Current</th>
                  <th className="pb-2 text-right">Outbound / Peak</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {tripwires.map((wire) => (
                  <tr key={wire.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium text-white">{wire.name}</td>
                    <td className="py-2.5 text-slate-400 font-sans">Tripwire Line</td>
                    <td className="py-2.5 text-right tabular-nums text-indigo-400">{wire.inCount}</td>
                    <td className="py-2.5 text-right tabular-nums text-emerald-400">{wire.outCount}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-sans">Active</td>
                  </tr>
                ))}
                {zones.map((zone) => (
                  <tr key={zone.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-medium text-white">{zone.name}</td>
                    <td className="py-2.5 text-slate-400 font-sans">ROI Polygon</td>
                    <td className="py-2.5 text-right tabular-nums text-amber-400">{zone.currentOccupancy}</td>
                    <td className="py-2.5 text-right tabular-nums text-rose-400">{zone.peakOccupancy}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-sans">Active</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Incident & Safety Anomaly Log */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Safety & Protocol Incidents</h3>
            <p className="text-xs text-slate-500">Autonomous detections: loitering, speed limits, zone breaches</p>
          </div>

          {/* Interactive filter tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 p-1">
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  severityFilter === sev
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {filteredIncidents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
            No incidents matching filter. Corridor operating within nominal parameters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Severity</th>
                  <th className="pb-2">Anomaly Classification</th>
                  <th className="pb-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredIncidents.slice(0, 10).map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-mono tabular-nums text-slate-400">{inc.timestamp}</td>
                    <td className="py-2.5">
                      <span
                        className={`text-xs font-semibold uppercase ${
                          inc.severity === 'high'
                            ? 'text-rose-400'
                            : inc.severity === 'medium'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                        }`}
                      >
                        {inc.severity}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-slate-300 capitalize">{inc.type.replace('_', ' ')}</td>
                    <td className="py-2.5 text-slate-300">{inc.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
