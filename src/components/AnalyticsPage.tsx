import React, { useState } from 'react';
import { Save } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { loadSessionHistory, saveSessionRecord } from '../simulation/storage';
import { SavedSessionRecord, SimulationSnapshot } from '../simulation/types';

interface AnalyticsPageProps {
  snapshot: SimulationSnapshot;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ snapshot }) => {
  const { analytics } = snapshot;
  const [sessions, setSessions] = useState<SavedSessionRecord[]>(() =>
    loadSessionHistory()
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleSaveSession = () => {
    const record: SavedSessionRecord = {
      id: `SIM-${Date.now().toString().slice(-6)}`,
      savedAt: new Date().toLocaleString(),
      totalDetected: analytics.totalDetected,
      totalCrossed: analytics.totalCrossed,
      avgWaitingTime: analytics.avgWaitingTime,
      avgCrossingDuration: analytics.avgCrossingDuration,
      maxWaitingCount: analytics.maxWaitingCount,
      peakDensity: analytics.peakDensity,
      cycleCount: analytics.cycleCount,
      totalVehicleWaitTime: Math.round(analytics.totalVehicleWaitTime),
    };
    const next = saveSessionRecord(record);
    setSessions(next);
    setSavedNotice(`Saved session ${record.id} to LocalStorage.`);
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const densityDistData = [
    { tier: 'LOW', samples: analytics.densityCounts.LOW },
    { tier: 'MEDIUM', samples: analytics.densityCounts.MEDIUM },
    { tier: 'HIGH', samples: analytics.densityCounts.HIGH },
  ];

  const phaseDistData = [
    { name: 'Vehicle Green', value: Number(analytics.phaseSeconds.vehicleGreen.toFixed(1)), color: '#2563eb' },
    { name: 'Vehicle Yellow', value: Number(analytics.phaseSeconds.vehicleYellow.toFixed(1)), color: '#f59e0b' },
    { name: 'Pedestrian Green', value: Number(analytics.phaseSeconds.pedestrianGreen.toFixed(1)), color: '#16a34a' },
    { name: 'Pedestrian Clear', value: Number(analytics.phaseSeconds.pedestrianYellow.toFixed(1)), color: '#ea580c' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Simulation Analytics & Session History
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Simulation Results · Calculated live from active 3D pedestrian & vehicle tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="text-xs font-medium text-emerald-700">{savedNotice}</span>
          )}
          <button
            type="button"
            onClick={handleSaveSession}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            Save Session to LocalStorage
          </button>
        </div>
      </div>

      {/* 8 Live Simulation KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Pedestrians Detected', value: `${analytics.totalDetected}` },
          { label: 'Total Pedestrians Crossed', value: `${analytics.totalCrossed}` },
          { label: 'Average Waiting Time', value: `${analytics.avgWaitingTime.toFixed(1)}s` },
          { label: 'Average Crossing Duration', value: `${analytics.avgCrossingDuration.toFixed(1)}s` },
          { label: 'Max Waiting Count', value: `${analytics.maxWaitingCount}` },
          { label: 'Peak Pedestrian Density', value: analytics.peakDensity },
          { label: 'Signal Cycle Count', value: `${analytics.cycleCount}` },
          { label: 'Vehicle Waiting Duration', value: `${Math.round(analytics.totalVehicleWaitTime)}s` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-1.5 font-mono text-xl font-semibold text-slate-900 tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Grid (5 Charts) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 1. Pedestrian Count Over Time */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-8">
          <h3 className="font-display text-base font-semibold text-slate-900">
            1. Pedestrian Count Over Time (Simulation Results)
          </h3>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="timeLabel" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="waiting"
                  name="Waiting"
                  stroke="#2563eb"
                  fill="#dbeafe"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="crossing"
                  name="Crossing"
                  stroke="#16a34a"
                  fill="#dcfce7"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Pedestrian Density Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            2. Density Distribution
          </h3>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={densityDistData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                <Bar dataKey="samples" name="Sample Intervals" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Average Waiting Time */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            3. Average Waiting Time per Cycle
          </h3>
          <div className="mt-4 h-60 w-full">
            {analytics.cycleHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                Complete one full pedestrian signal cycle to plot per-cycle waiting times.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.cycleHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="s" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="avgWaitTime"
                    name="Avg Wait (s)"
                    stroke="#d97706"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 4. Crossing Duration Comparison */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            4. Crossing Duration Comparison
          </h3>
          <div className="mt-4 h-60 w-full">
            {analytics.cycleHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                ML predictions vs. actual crossing duration appear after the first completed crossing cycle.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.cycleHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="cycle" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="s" />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="rfPredicted" name="RF Predicted" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="linearEstimated" name="Linear Est." fill="#64748b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actualDuration" name="Actual Cross" fill="#16a34a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* 5. Signal Phase Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            5. Signal Phase Distribution (s)
          </h3>
          <div className="mt-4 h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={phaseDistData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {phaseDistData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`${v ?? 0}s`, 'Duration']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Saved Sessions History (LocalStorage) */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Saved Simulation Sessions (LocalStorage)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Session ID</th>
                <th className="px-4 py-3 font-semibold">Saved Timestamp</th>
                <th className="px-4 py-3 font-semibold text-right">Detected</th>
                <th className="px-4 py-3 font-semibold text-right">Crossed</th>
                <th className="px-4 py-3 font-semibold text-right">Avg Wait</th>
                <th className="px-4 py-3 font-semibold text-right">Avg Cross</th>
                <th className="px-4 py-3 font-semibold text-right">Peak Density</th>
                <th className="px-4 py-3 font-semibold text-right">Cycles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No saved sessions yet. Click “Save Session to LocalStorage” above to record the current run.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">{s.id}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.savedAt}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.totalDetected}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.totalCrossed}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.avgWaitingTime.toFixed(1)}s</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.avgCrossingDuration.toFixed(1)}s</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{s.peakDensity}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">{s.cycleCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
