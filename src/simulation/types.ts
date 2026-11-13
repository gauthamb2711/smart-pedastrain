export type PageId =
  | 'overview'
  | 'intersection'
  | 'monitoring'
  | 'ml'
  | 'signals'
  | 'analytics'
  | 'settings';

export type PedestrianCategory =
  | 'adult_male'
  | 'adult_female'
  | 'elderly'
  | 'child'
  | 'office_worker'
  | 'student'
  | 'wheelchair';

export type PedestrianState = 'APPROACHING' | 'WAITING' | 'CROSSING' | 'CROSSED';

export type CrossingArm = 'NORTH' | 'SOUTH' | 'EAST' | 'WEST';

export type DensityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type VehicleType = 'car' | 'bus' | 'autorickshaw' | 'twowheeler';

export type VehicleDensity = 'low' | 'medium' | 'high';

export type TrafficLightColor = 'RED' | 'YELLOW' | 'GREEN';

export type PedestrianSignalColor = 'RED' | 'GREEN' | 'YELLOW';

export type SignalPhaseId =
  | 'VEH_NS_GREEN'
  | 'VEH_NS_YELLOW'
  | 'VEH_EW_GREEN'
  | 'VEH_EW_YELLOW'
  | 'PED_GREEN'
  | 'PED_YELLOW'
  | 'MANUAL_HOLD';

export type CameraPreset = 'default' | 'top' | 'street';

export type SimSpeed = 0.5 | 1 | 2 | 4;

export interface PedestrianData {
  id: string;
  category: PedestrianCategory;
  label: string;
  state: PedestrianState;
  arm: CrossingArm;
  direction: 1 | -1; // +1 or -1 along the crossing axis
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  baseSpeed: number; // m/s
  currentSpeed: number;
  waitTime: number; // seconds spent waiting
  crossStartTime: number | null;
  crossDuration: number | null;
  companionId?: string; // for child accompanied by adult
  isCompanionLeader?: boolean;
  outfitColor: string;
  trouserColor: string;
  skinColor: string;
  hairColor: string;
  heightScale: number;
  hasBag: boolean;
  hasCane: boolean;
  walkPhase: number;
  heading: number;
}

export interface VehicleData {
  id: string;
  type: VehicleType;
  axis: 'NS' | 'EW';
  dir: 1 | -1; // +1 = South (+Z) or East (+X); -1 = North (-Z) or West (-X)
  laneIndex: 0 | 1;
  x: number;
  z: number;
  speed: number;
  maxSpeed: number;
  length: number;
  color: string;
  waitTime: number;
  wheelAngle: number;
}

export interface SignalState {
  mode: 'AUTO' | 'MANUAL';
  phase: SignalPhaseId;
  phaseLabel: string;
  vehicleNS: TrafficLightColor;
  vehicleEW: TrafficLightColor;
  pedestrian: PedestrianSignalColor;
  phaseElapsed: number;
  phaseDuration: number;
  remainingSeconds: number;
  cycleCount: number;
  extendedClearanceActive: boolean;
  safetyWarning: string | null;
}

export interface MLFeatureVector {
  waitingCount: number;
  densityNumeric: number; // 0=LOW, 1=MEDIUM, 2=HIGH
  crossingWidth: number;
  avgWalkingSpeed: number;
  elderlyCount: number;
  childCount: number;
  wheelchairCount: number;
  historicalAvgDuration: number;
}

export interface MLPredictionResult {
  densityClass: DensityLevel;
  randomForestDuration: number;
  linearRegressionDuration: number;
  recommendedGreenTime: number;
  rfTreeSpread: number;
  lastActualCrossingDuration: number | null;
  features: MLFeatureVector;
  featureImportances: Array<{ name: string; importance: number }>;
  explanation: string[];
  datasetSize: number;
  isSyntheticDataset: true;
  modeLabel: '3D SIMULATION — VIRTUAL PEDESTRIAN TRACKING';
}

export interface TimeSeriesPoint {
  timeLabel: string;
  timestamp: number;
  waiting: number;
  crossing: number;
  crossed: number;
  density: DensityLevel;
  recommendedGreen: number;
}

export interface CycleMetricPoint {
  cycle: string;
  avgWaitTime: number;
  rfPredicted: number;
  linearEstimated: number;
  actualDuration: number;
  pedestriansCrossed: number;
}

export interface SimulationAnalytics {
  totalDetected: number;
  totalCrossed: number;
  avgWaitingTime: number;
  avgCrossingDuration: number;
  maxWaitingCount: number;
  peakDensity: DensityLevel;
  cycleCount: number;
  totalVehicleWaitTime: number;
  densityCounts: Record<DensityLevel, number>;
  phaseSeconds: {
    vehicleGreen: number;
    vehicleYellow: number;
    pedestrianGreen: number;
    pedestrianYellow: number;
  };
  timeSeries: TimeSeriesPoint[];
  cycleHistory: CycleMetricPoint[];
}

export interface NotificationItem {
  id: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  message: string;
  timestamp: number;
}

export interface SimulationSettings {
  lowDensityMax: number;
  mediumDensityMax: number;
  minPedestrianGreen: number;
  maxPedestrianGreen: number;
  vehicleGreenDuration: number;
  vehicleYellowDuration: number;
  pedestrianYellowDuration: number;
  crossingWidthMeters: number;
  elderlySpeedFactor: number;
  wheelchairSpeedFactor: number;
  defaultVehicleDensity: VehicleDensity;
  defaultCameraPreset: CameraPreset;
  showTrackingOverlayByDefault: boolean;
}

export interface SavedSessionRecord {
  id: string;
  savedAt: string;
  totalDetected: number;
  totalCrossed: number;
  avgWaitingTime: number;
  avgCrossingDuration: number;
  maxWaitingCount: number;
  peakDensity: DensityLevel;
  cycleCount: number;
  totalVehicleWaitTime: number;
}

export interface SimulationSnapshot {
  isRunning: boolean;
  speed: SimSpeed;
  vehicleDensity: VehicleDensity;
  showTrackingOverlay: boolean;
  cameraPreset: CameraPreset;
  pedestrians: PedestrianData[];
  vehicles: VehicleData[];
  counts: {
    totalInScene: number;
    approaching: number;
    waiting: number;
    crossing: number;
    crossed: number;
    elderlyWaiting: number;
    childrenWaiting: number;
    wheelchairWaiting: number;
  };
  signal: SignalState;
  ml: MLPredictionResult;
  analytics: SimulationAnalytics;
  notifications: NotificationItem[];
}
