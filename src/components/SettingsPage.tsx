import React, { useState } from 'react';
import { RotateCcw, Save, Trash2 } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../simulation/constants';
import { clearAllStoredData, saveSettings } from '../simulation/storage';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { CameraPreset, SimulationSettings, VehicleDensity } from '../simulation/types';

interface SettingsPageProps {
  engine: SimulationEngine;
  settings: SimulationSettings;
  onUpdateSettings: (next: SimulationSettings) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  engine,
  settings,
  onUpdateSettings,
}) => {
  const [draft, setDraft] = useState<SimulationSettings>({ ...settings });
  const [savedBanner, setSavedBanner] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized: SimulationSettings = {
      ...draft,
      lowDensityMax: Math.max(1, Math.min(draft.lowDensityMax, 20)),
      mediumDensityMax: Math.max(draft.lowDensityMax + 2, Math.min(draft.mediumDensityMax, 40)),
      minPedestrianGreen: Math.max(8, Math.min(draft.minPedestrianGreen, 25)),
      maxPedestrianGreen: Math.max(draft.minPedestrianGreen + 5, Math.min(draft.maxPedestrianGreen, 60)),
    };
    setDraft(sanitized);
    saveSettings(sanitized);
    onUpdateSettings(sanitized);
    engine.updateSettings(sanitized);
    engine.setVehicleDensity(sanitized.defaultVehicleDensity);
    engine.setCameraPreset(sanitized.defaultCameraPreset);
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 3000);
  };

  const handleResetAllData = () => {
    clearAllStoredData();
    const defaults = { ...DEFAULT_SETTINGS };
    setDraft(defaults);
    onUpdateSettings(defaults);
    engine.updateSettings(defaults);
    engine.reset();
    setConfirmResetOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Simulation Settings & Calibration
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Persisted automatically in browser LocalStorage without requiring an account
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmResetOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Reset All Stored Data
        </button>
      </div>

      {savedBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          Settings saved to LocalStorage and applied to the active simulation and ML pipeline.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Density & Signal Bounds */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Decision Tree Thresholds & Signal Timing
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs">
                <span className="font-medium text-slate-700">LOW Density Max (people)</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={draft.lowDensityMax}
                  onChange={(e) =>
                    setDraft({ ...draft, lowDensityMax: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">MEDIUM Density Max (people)</span>
                <input
                  type="number"
                  min={3}
                  max={40}
                  value={draft.mediumDensityMax}
                  onChange={(e) =>
                    setDraft({ ...draft, mediumDensityMax: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Safe Min Pedestrian Green (s)</span>
                <input
                  type="number"
                  min={8}
                  max={25}
                  value={draft.minPedestrianGreen}
                  onChange={(e) =>
                    setDraft({ ...draft, minPedestrianGreen: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Safe Max Pedestrian Green (s)</span>
                <input
                  type="number"
                  min={15}
                  max={60}
                  value={draft.maxPedestrianGreen}
                  onChange={(e) =>
                    setDraft({ ...draft, maxPedestrianGreen: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Vehicle Green Phase (s)</span>
                <input
                  type="number"
                  min={6}
                  max={40}
                  value={draft.vehicleGreenDuration}
                  onChange={(e) =>
                    setDraft({ ...draft, vehicleGreenDuration: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Pedestrian Clearance Warning (s)</span>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={draft.pedestrianYellowDuration}
                  onChange={(e) =>
                    setDraft({ ...draft, pedestrianYellowDuration: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>
            </div>
          </div>

          {/* Accessibility & Scene Preferences */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-display text-base font-semibold text-slate-900">
              Accessibility Pace & Scene Preferences
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-xs">
                <span className="font-medium text-slate-700">Crossing Width Assumption (m)</span>
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={draft.crossingWidthMeters}
                  onChange={(e) =>
                    setDraft({ ...draft, crossingWidthMeters: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Default Vehicle Density</span>
                <select
                  value={draft.defaultVehicleDensity}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultVehicleDensity: e.target.value as VehicleDensity,
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="low">Low Traffic</option>
                  <option value="medium">Medium Traffic</option>
                  <option value="high">High Traffic</option>
                </select>
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Elderly Speed Factor</span>
                <input
                  type="number"
                  step="0.05"
                  min={0.4}
                  max={0.95}
                  value={draft.elderlySpeedFactor}
                  onChange={(e) =>
                    setDraft({ ...draft, elderlySpeedFactor: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Wheelchair Speed Factor</span>
                <input
                  type="number"
                  step="0.05"
                  min={0.4}
                  max={0.95}
                  value={draft.wheelchairSpeedFactor}
                  onChange={(e) =>
                    setDraft({ ...draft, wheelchairSpeedFactor: Number(e.target.value) })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
                />
              </label>

              <label className="block text-xs">
                <span className="font-medium text-slate-700">Default 3D Camera</span>
                <select
                  value={draft.defaultCameraPreset}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultCameraPreset: e.target.value as CameraPreset,
                    })
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="default">3D Orbit View</option>
                  <option value="top">Top-Down Aerial View</option>
                  <option value="street">Street-Level View</option>
                </select>
              </label>

              <label className="flex items-center gap-2.5 pt-6 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.showTrackingOverlayByDefault}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      showTrackingOverlayByDefault: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                Show 3D Tracking Overlay by Default
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Save & Apply Settings
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_SETTINGS })}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Load Defaults
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {confirmResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="font-display text-base font-bold text-slate-900">
              Reset All Stored Simulation Data?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              This clears saved preferences and completed session history from LocalStorage and resets the active 3D intersection to default values.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAllData}
                className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Confirm Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
