import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { PedestrianState, SimulationSnapshot } from '../simulation/types';

interface PedestrianMonitoringPageProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
}

export const PedestrianMonitoringPage: React.FC<PedestrianMonitoringPageProps> = ({
  engine,
  snapshot,
}) => {
  const [stateFilter, setStateFilter] = useState<'ALL' | PedestrianState>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snapshot.pedestrians.filter((p) => {
      if (stateFilter !== 'ALL' && p.state !== stateFilter) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q) ||
        p.arm.toLowerCase().includes(q)
      );
    });
  }, [snapshot.pedestrians, stateFilter, query]);

  const { counts } = snapshot;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Real-Time Pedestrian Counting & Tracking
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Live coordinate-based zone detection across all four intersection zebra crossings ·{' '}
            <span className="font-medium text-slate-700">{snapshot.ml.modeLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => engine.addPedestrians(5)}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
          >
            + Add 5 Pedestrians
          </button>
          <button
            type="button"
            onClick={() => engine.setTrackingOverlay(!snapshot.showTrackingOverlay)}
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {snapshot.showTrackingOverlay ? 'Hide 3D Bounding Boxes' : 'Show 3D Bounding Boxes'}
          </button>
        </div>
      </div>

      {/* Zone Count Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total in Scene', value: counts.totalInScene, tone: 'text-slate-900' },
          { label: 'Approaching Curb', value: counts.approaching, tone: 'text-slate-600' },
          { label: 'Waiting in Zone', value: counts.waiting, tone: 'text-blue-700' },
          { label: 'Currently Crossing', value: counts.crossing, tone: 'text-emerald-700' },
          { label: 'Successfully Crossed', value: counts.crossed, tone: 'text-slate-900' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Accessibility Breakdown */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Elderly Pedestrians Waiting</p>
          <p className="mt-1 font-mono text-xl font-semibold text-amber-700 tabular-nums">
            {counts.elderlyWaiting}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Slower walking speed modeled automatically
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Accompanied Children Waiting</p>
          <p className="mt-1 font-mono text-xl font-semibold text-emerald-700 tabular-nums">
            {counts.childrenWaiting}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Paired with adult guardian; never cross alone
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Wheelchair Users Waiting</p>
          <p className="mt-1 font-mono text-xl font-semibold text-blue-700 tabular-nums">
            {counts.wheelchairWaiting}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Additional clearance buffer included in ML time
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'APPROACHING', 'WAITING', 'CROSSING', 'CROSSED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStateFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  stateFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Pedestrians' : st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID (P001), role, arm..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Tracking Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Pedestrian ID</th>
                <th className="px-4 py-3 font-semibold">Profile</th>
                <th className="px-4 py-3 font-semibold">Crosswalk Arm</th>
                <th className="px-4 py-3 font-semibold">Current State</th>
                <th className="px-4 py-3 font-semibold text-right">Speed (m/s)</th>
                <th className="px-4 py-3 font-semibold text-right">Wait Time (s)</th>
                <th className="px-4 py-3 font-semibold text-right">Scene Coords (X, Z)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No pedestrians match the current filter. Try adding pedestrians or switching to All Pedestrians.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const stateStyle =
                    p.state === 'WAITING'
                      ? 'text-blue-700 font-semibold'
                      : p.state === 'CROSSING'
                        ? 'text-emerald-700 font-semibold'
                        : p.state === 'CROSSED'
                          ? 'text-slate-600 font-medium'
                          : 'text-amber-700 font-medium';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                        {p.id}
                        {p.companionId && (
                          <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                            (with {p.companionId})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{p.label}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-600">{p.arm}</td>
                      <td className={`px-4 py-2.5 font-mono ${stateStyle}`}>{p.state}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {p.currentSpeed.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        {p.waitTime.toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-500">
                        ({p.x.toFixed(1)}, {p.z.toFixed(1)})
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
