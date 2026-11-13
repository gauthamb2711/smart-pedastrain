import React from 'react';
import { AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SimulationSnapshot, TrafficLightColor } from '../simulation/types';

interface SignalManagementPageProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
}

const SignalLamp: React.FC<{
  color: TrafficLightColor;
  label: string;
}> = ({ color, label }) => {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">{color}</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-900 px-2.5 py-1.5">
        <span
          className={`h-3.5 w-3.5 rounded-full ${
            color === 'RED' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : 'bg-rose-950'
          }`}
        />
        <span
          className={`h-3.5 w-3.5 rounded-full ${
            color === 'YELLOW' ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-amber-950'
          }`}
        />
        <span
          className={`h-3.5 w-3.5 rounded-full ${
            color === 'GREEN' ? 'bg-emerald-400 shadow-[0_0_8px_#22c55e]' : 'bg-emerald-950'
          }`}
        />
      </div>
    </div>
  );
};

export const SignalManagementPage: React.FC<SignalManagementPageProps> = ({
  engine,
  snapshot,
}) => {
  const { signal, counts } = snapshot;

  const phases = [
    {
      id: 'VEH_NS_GREEN',
      step: 'Phase 1A',
      title: 'Vehicle N-S GREEN · Pedestrian RED',
      desc: 'North-South vehicles move; waiting pedestrians counted.',
    },
    {
      id: 'VEH_NS_YELLOW',
      step: 'Phase 2A',
      title: 'Vehicle N-S YELLOW',
      desc: 'N-S vehicles decelerate and stop behind stop lines.',
    },
    {
      id: 'VEH_EW_GREEN',
      step: 'Phase 1B',
      title: 'Vehicle E-W GREEN · Pedestrian RED',
      desc: 'East-West vehicles move; ML computes crossing duration.',
    },
    {
      id: 'VEH_EW_YELLOW',
      step: 'Phase 2B',
      title: 'Vehicle E-W YELLOW',
      desc: 'E-W vehicles decelerate before all-red pedestrian phase.',
    },
    {
      id: 'PED_GREEN',
      step: 'Phase 3',
      title: 'Vehicle RED · Pedestrian GREEN',
      desc: `All vehicles stopped; pedestrians cross (${snapshot.ml.recommendedGreenTime}s ML green).`,
    },
    {
      id: 'PED_YELLOW',
      step: 'Phase 4',
      title: 'Pedestrian YELLOW / Clearance Warning',
      desc: 'Holds vehicles RED until 0 pedestrians remain in crosswalk.',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Automatic & Manual Signal Management
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Synchronized directly with the 3D intersection traffic poles and safety interlocks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => engine.setSignalMode('AUTO')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                signal.mode === 'AUTO'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Automatic Signal Mode
            </button>
            <button
              type="button"
              onClick={() => engine.setSignalMode('MANUAL')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                signal.mode === 'MANUAL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              Manual Testing Mode
            </button>
          </div>

          {signal.mode === 'MANUAL' && (
            <button
              type="button"
              onClick={() => engine.setSignalMode('AUTO')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Return to Automatic Mode
            </button>
          )}
        </div>
      </div>

      {/* Live Signal State Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SignalLamp color={signal.vehicleNS} label="Vehicle Signal · North–South" />
        <SignalLamp color={signal.vehicleEW} label="Vehicle Signal · East–West" />
        <SignalLamp color={signal.pedestrian} label="Pedestrian Crossing Signal" />
      </div>

      {/* Safety Interlock Warning Banner */}
      {signal.safetyWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold">Unsafe Transition Blocked by Interlock</p>
            <p className="mt-0.5 text-xs">{signal.safetyWarning}</p>
          </div>
        </div>
      )}

      {/* Phase Workflow & Manual Controls */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Coordinated Signal Workflow
            </h3>
            <span className="font-mono text-xs text-slate-500">
              Cycle #{signal.cycleCount} ·{' '}
              {signal.mode === 'AUTO'
                ? `${Math.ceil(signal.remainingSeconds)}s left`
                : 'Manual Hold'}
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {phases.map((ph) => {
              const isActive = signal.phase === ph.id;
              return (
                <div
                  key={ph.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isActive
                      ? 'border-blue-300 bg-blue-50/70'
                      : 'border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-blue-700">
                      {ph.step}
                    </span>
                    {isActive && (
                      <span className="font-mono text-xs font-semibold text-emerald-700">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900">{ph.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{ph.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Manual Signal Control Console
            </h3>
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4" />
              Conflict Interlocks Active
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Test signal transitions manually. Conflicting Vehicle GREEN and Pedestrian GREEN phases or clearing while{' '}
            <span className="font-mono font-semibold">{counts.crossing}</span> pedestrian(s) are crossing are strictly prevented.
          </p>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => engine.safeManualLetPedestriansCross()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Safely Hold All Vehicles RED & Let Pedestrians Cross (Pedestrian GREEN)
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {/* N-S Vehicle */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold text-slate-700">
                North–South Vehicle Signal
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_NS_GREEN')}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Vehicle N-S GREEN
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_NS_YELLOW')}
                  className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 whitespace-nowrap"
                >
                  Vehicle N-S YELLOW
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_NS_RED')}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Vehicle N-S RED
                </button>
              </div>
            </div>

            {/* E-W Vehicle */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold text-slate-700">
                East–West Vehicle Signal
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_EW_GREEN')}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Vehicle E-W GREEN
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_EW_YELLOW')}
                  className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 whitespace-nowrap"
                >
                  Vehicle E-W YELLOW
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_EW_RED')}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Vehicle E-W RED
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('VEH_ALL_RED')}
                  className="rounded-lg border border-rose-300 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 whitespace-nowrap"
                >
                  Set All Vehicles RED
                </button>
              </div>
            </div>

            {/* Pedestrian */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold text-slate-700">
                Pedestrian Crossing Signal
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('PED_GREEN')}
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Pedestrian GREEN (WALK)
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('PED_YELLOW')}
                  className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 whitespace-nowrap"
                >
                  Pedestrian Warning Phase
                </button>
                <button
                  type="button"
                  onClick={() => engine.setManualCommand('PED_RED')}
                  className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Pedestrian RED (STOP)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
