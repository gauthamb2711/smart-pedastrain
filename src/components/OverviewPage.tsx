import React from 'react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { PageId, SimulationSnapshot } from '../simulation/types';
import { IntersectionViewport } from './IntersectionViewport';
import { SimulationControlsBar } from './SimulationControlsBar';

interface OverviewPageProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
  onNavigate: (page: PageId) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  engine,
  snapshot,
  onNavigate,
}) => {
  const { counts, ml, signal } = snapshot;

  const densityColor =
    ml.densityClass === 'HIGH'
      ? 'text-rose-700'
      : ml.densityClass === 'MEDIUM'
        ? 'text-amber-700'
        : 'text-emerald-700';

  const pedSignalLabel =
    signal.pedestrian === 'GREEN'
      ? 'Pedestrian GREEN (WALK)'
      : signal.pedestrian === 'YELLOW'
        ? 'Pedestrian YELLOW (CLEARANCE)'
        : signal.vehicleNS === 'GREEN'
          ? 'Vehicle N-S GREEN · Ped RED'
          : signal.vehicleEW === 'GREEN'
            ? 'Vehicle E-W GREEN · Ped RED'
            : signal.vehicleNS === 'YELLOW' || signal.vehicleEW === 'YELLOW'
              ? 'Vehicle YELLOW · Ped RED'
              : 'All-Red Safety Hold';

  return (
    <div className="space-y-5">
      {/* 6 Live KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Waiting Pedestrians</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {counts.waiting}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {counts.approaching} approaching curb
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Currently Crossing</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-700 tabular-nums">
            {counts.crossing}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inside zebra crossing zone
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Successfully Crossed</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {counts.crossed}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {counts.totalInScene} active in 3D scene
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Pedestrian Density</p>
          <p className={`mt-1.5 font-display text-2xl font-bold ${densityColor}`}>
            {ml.densityClass}
          </p>
          <p className="mt-1 text-xs text-slate-500">Decision Tree classifier</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Recommended Green Time</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {ml.recommendedGreenTime}s
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Random Forest ({ml.randomForestDuration}s raw)
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Current Signal Phase</p>
          <p className="mt-1.5 font-display text-sm font-semibold text-slate-900 leading-snug">
            {pedSignalLabel}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
            {signal.mode === 'AUTO'
              ? signal.extendedClearanceActive
                ? 'Extended safety hold'
                : `${Math.ceil(signal.remainingSeconds)}s remaining`
              : 'Manual testing mode'}
          </p>
        </div>
      </div>

      {/* Primary Visual Element: Large Live 3D Urban Intersection */}
      <IntersectionViewport
        engine={engine}
        snapshot={snapshot}
        heightClass="h-[460px] sm:h-[520px] xl:h-[560px]"
      />

      {/* Interactive Simulation Control Panel */}
      <SimulationControlsBar engine={engine} snapshot={snapshot} />

      {/* Bottom 2-Column Info: How It Works + Live ML Decision Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              How It Works
            </h2>
            <span className="text-xs text-slate-500">{ml.modeLabel}</span>
          </div>
          <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
            {[
              { step: '01', title: 'Detect & Count', desc: 'Tracks 3D pedestrians in waiting zones by ID.' },
              { step: '02', title: 'Classify Density', desc: 'Decision Tree assigns LOW, MEDIUM, or HIGH.' },
              { step: '03', title: 'Predict Duration', desc: 'Random Forest calculates green time from pace & count.' },
              { step: '04', title: 'Control Signals', desc: 'Coordinates vehicle & pedestrian signal poles safely.' },
              { step: '05', title: 'Verify Clearance', desc: 'Holds vehicles RED until crosswalk is 100% clear.' },
            ].map((item) => (
              <li
                key={item.step}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <span className="font-mono text-xs font-semibold text-blue-600">
                  {item.step}
                </span>
                <p className="mt-1 text-xs font-semibold text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {item.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Live ML Inference Summary
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('ml')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Open ML Analysis →
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-xs">
            <div>
              <span className="text-slate-500">Random Forest</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {ml.randomForestDuration}s
              </p>
            </div>
            <div>
              <span className="text-slate-500">Linear Reg.</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {ml.linearRegressionDuration}s
              </p>
            </div>
            <div>
              <span className="text-slate-500">Avg Pace</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900 tabular-nums">
                {ml.features.avgWalkingSpeed.toFixed(2)} m/s
              </p>
            </div>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
            {ml.explanation.slice(0, 3).map((line, i) => (
              <li key={i} className="leading-relaxed">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
