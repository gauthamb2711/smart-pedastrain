import { DEFAULT_SETTINGS } from './constants';
import { SavedSessionRecord, SimulationSettings } from './types';

const SETTINGS_KEY = 'sptsc_settings_v1';
const SESSIONS_KEY = 'sptsc_sessions_v1';

export function loadSettings(): SimulationSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<SimulationSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: SimulationSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSessionHistory(): SavedSessionRecord[] {
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedSessionRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveSessionRecord(record: SavedSessionRecord): SavedSessionRecord[] {
  const existing = loadSessionHistory();
  const updated = [record, ...existing].slice(0, 25);
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function clearAllStoredData(): void {
  try {
    window.localStorage.removeItem(SETTINGS_KEY);
    window.localStorage.removeItem(SESSIONS_KEY);
  } catch {
    // Ignore
  }
}
