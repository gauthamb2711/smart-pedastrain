import { CrossingArm, PedestrianCategory, SimulationSettings } from './types';

export const INTERSECTION_GEOMETRY = {
  roadHalfWidth: 7.0, // 14m total road width
  sidewalkHeight: 0.16,
  crosswalkCenterOffset: 9.2, // zebra centers at ±9.2m
  crosswalkHalfDepth: 1.6, // ±1.6m -> [7.6, 10.8]
  crosswalkSpanHalf: 6.2, // crosswalk spans [-6.2, 6.2]
  waitingZoneInner: 7.3,
  waitingZoneOuter: 10.7,
  stopLineOffset: 11.7, // vehicles stop before ±11.7m
  worldExtent: 75,
} as const;

export const DEFAULT_SETTINGS: SimulationSettings = {
  lowDensityMax: 5,
  mediumDensityMax: 15,
  minPedestrianGreen: 10,
  maxPedestrianGreen: 45,
  vehicleGreenDuration: 14,
  vehicleYellowDuration: 3,
  pedestrianYellowDuration: 5,
  crossingWidthMeters: 14,
  elderlySpeedFactor: 0.65,
  wheelchairSpeedFactor: 0.72,
  defaultVehicleDensity: 'medium',
  defaultCameraPreset: 'default',
  showTrackingOverlayByDefault: true,
};

export const CATEGORY_LABELS: Record<PedestrianCategory, string> = {
  adult_male: 'Adult Pedestrian',
  adult_female: 'Adult Pedestrian',
  elderly: 'Elderly Pedestrian',
  child: 'Child (Accompanied)',
  office_worker: 'Office Commuter',
  student: 'Student',
  wheelchair: 'Wheelchair User',
};

export const OUTFIT_PALETTES = {
  shirts: [
    '#2563eb',
    '#0d9488',
    '#dc2626',
    '#d97706',
    '#4f46e5',
    '#059669',
    '#e11d48',
    '#0284c7',
    '#7c3aed',
    '#f59e0b',
    '#334155',
    '#ea580c',
  ],
  officeShirts: ['#f8fafc', '#dbeafe', '#e2e8f0', '#cbd5e1', '#bfdbfe'],
  studentShirts: ['#1d4ed8', '#0f766e', '#be123c', '#b45309', '#4338ca'],
  elderlyShirts: ['#cbd5e1', '#fef3c7', '#e0e7ff', '#d1fae5', '#f3e8ff'],
  trousers: ['#1e293b', '#334155', '#3f3f46', '#1e3a8a', '#44403c', '#27272a'],
  skinTones: ['#d49a6a', '#c68642', '#8d5524', '#e0ac69', '#a5694f', '#f1c27d'],
  hairColors: ['#18181b', '#27272a', '#3f2a1d', '#5c4033'],
};

export const VEHICLE_COLORS = {
  car: ['#f8fafc', '#94a3b8', '#1e3a8a', '#991b1b', '#334155', '#0f766e'],
  bus: ['#0284c7', '#0d9488', '#2563eb'],
  autorickshaw: ['#facc15', '#16a34a'],
  twowheeler: ['#dc2626', '#1e293b', '#2563eb', '#475569'],
};

export const CROSSING_ARMS: CrossingArm[] = ['NORTH', 'SOUTH', 'EAST', 'WEST'];
