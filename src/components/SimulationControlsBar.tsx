import React from 'react';
import {
  Accessibility,
  AlertTriangle,
  Baby,
  Car,
  Eye,
  EyeOff,
  Footprints,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SimSpeed, SimulationSnapshot, VehicleDensity } from '../simulation/types';

interface SimulationControlsBarProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
}

export const SimulationControlsBar: React.FC<SimulationControlsBarProps> = ({
  engine,
  snapshot,
}) => {
  const speeds: SimSpeed[] = [0.5, 1, 2, 4];
  const densities: VehicleDensity[] = ['low', 'medium', 'high'];
  const { signal } = snapshot;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* Row 1: Playback, Speed, Signal Mode, Overlay */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {snapshot.isRunning ? (
              <button
                type="button"
                onClick={() => engine.pause()}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
              >
                <Pause className="h-3.5 w-3.5" />
                Pause Simulation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => engine.resume()}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" />
                Resume Simulation
              </button>
            )}

            <button
              type="button"
              onClick={() => engine.reset()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Simulation
            </button>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <span className="px-2 text-xs font-medium text-slate-500">Speed</span>
              {speeds.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => engine.setSpeed(s)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-medium transition-colors whitespace-nowrap ${
                    snapshot.speed === s
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => engine.setSignalMode('AUTO')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  signal.mode === 'AUTO'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Automatic Signal
              </button>
              <button
                type="button"
                onClick={() => engine.setSignalMode('MANUAL')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  signal.mode === 'MANUAL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manual Signal
              </button>
            </div>

            <button
              type="button"
              onClick={() => engine.setTrackingOverlay(!snapshot.showTrackingOverlay)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                snapshot.showTrackingOverlay
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {snapshot.showTrackingOverlay ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              Tracking Overlay
            </button>
          </div>
        </div>

        {/* Inline Manual Signal Access Deck (shown directly below 3D scene when Manual Signal is active) */}
        {signal.mode === 'MANUAL' && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                <span className="font-display text-xs font-bold text-slate-900">
                  Manual Signal Controller (Direct 3D Intersection Access)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => engine.safeManualLetPedestriansCross()}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  <Footprints className="h-3.5 w-3.5" />
                  Safely Let Pedestrians Cross (Veh RED → Ped GREEN)
                </button>
                <button
                  type="button"
                  onClick={() => engine.setSignalMode('AUTO')}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Return to Auto
                </button>
              </div>
            </div>

            {signal.safetyWarning && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{signal.safetyWarning}</span>
              </div>
            )}

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Vehicle N-S */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Vehicle N–S</span>
                  <span className="font-mono font-bold text-slate-900">{signal.vehicleNS}</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_NS_GREEN')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleNS === 'GREEN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    GREEN
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_NS_YELLOW')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleNS === 'YELLOW'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    YELLOW
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_NS_RED')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleNS === 'RED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    RED
                  </button>
                </div>
              </div>

              {/* Vehicle E-W */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Vehicle E–W</span>
                  <span className="font-mono font-bold text-slate-900">{signal.vehicleEW}</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_EW_GREEN')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleEW === 'GREEN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    GREEN
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_EW_YELLOW')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleEW === 'YELLOW'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    YELLOW
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('VEH_EW_RED')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.vehicleEW === 'RED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    RED
                  </button>
                </div>
              </div>

              {/* Pedestrian Signal */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Pedestrian Signal</span>
                  <span className="font-mono font-bold text-slate-900">{signal.pedestrian}</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('PED_GREEN')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.pedestrian === 'GREEN'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    WALK
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('PED_YELLOW')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.pedestrian === 'YELLOW'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                    }`}
                  >
                    WARN
                  </button>
                  <button
                    type="button"
                    onClick={() => engine.setManualCommand('PED_RED')}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      signal.pedestrian === 'RED'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    STOP
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Row 2: Pedestrian & Accessibility Spawners + Vehicle Controls */}
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="flex flex-wrap items-center gap-2 xl:col-span-8">
            <span className="text-xs font-semibold text-slate-500 mr-1">Pedestrians</span>
            <button
              type="button"
              onClick={() => engine.addPedestrians(1)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add 1
            </button>
            <button
              type="button"
              onClick={() => engine.addPedestrians(5)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add 5
            </button>
            <button
              type="button"
              onClick={() => engine.addPedestrians(10)}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              Add 10
            </button>
            <button
              type="button"
              onClick={() => engine.addRandomPedestrians(6)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Add Random
            </button>
            <button
              type="button"
              onClick={() => engine.addElderlyPedestrian()}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <UserCheck className="h-3.5 w-3.5 text-amber-600" />
              Add Elderly
            </button>
            <button
              type="button"
              onClick={() => engine.addChildWithAdult()}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Baby className="h-3.5 w-3.5 text-emerald-600" />
              Add Child + Adult
            </button>
            <button
              type="button"
              onClick={() => engine.addWheelchairUser()}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Accessibility className="h-3.5 w-3.5 text-blue-600" />
              Add Wheelchair
            </button>
            <button
              type="button"
              onClick={() => engine.removeWaitingPedestrians(3)}
              className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Waiting
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:col-span-4 xl:justify-end">
            <span className="text-xs font-semibold text-slate-500">Vehicles</span>
            <button
              type="button"
              onClick={() => engine.addVehicles(2)}
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Car className="h-3.5 w-3.5" />
              Add Vehicles
            </button>
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              {densities.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => engine.setVehicleDensity(d)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors whitespace-nowrap ${
                    snapshot.vehicleDensity === d
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
