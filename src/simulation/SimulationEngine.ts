import { trafficMLPipeline } from '../ml/mlModels';
import {
  CATEGORY_LABELS,
  CROSSING_ARMS,
  INTERSECTION_GEOMETRY,
  OUTFIT_PALETTES,
  VEHICLE_COLORS,
} from './constants';
import {
  CameraPreset,
  CrossingArm,
  DensityLevel,
  MLPredictionResult,
  NotificationItem,
  PedestrianCategory,
  PedestrianData,
  PedestrianState,
  SignalPhaseId,
  SignalState,
  SimSpeed,
  SimulationAnalytics,
  SimulationSettings,
  SimulationSnapshot,
  TrafficLightColor,
  VehicleData,
  VehicleDensity,
  VehicleType,
} from './types';

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formatTimeLabel(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export class SimulationEngine {
  private settings: SimulationSettings;
  private isRunning = true;
  private speed: SimSpeed = 1;
  private vehicleDensity: VehicleDensity;
  private showTrackingOverlay: boolean;
  private cameraPreset: CameraPreset;

  private simTime = 0;
  private nextPedSeq = 1;
  private nextVehSeq = 1;
  private nextNotifSeq = 1;

  private pedestrians: PedestrianData[] = [];
  private vehicles: VehicleData[] = [];
  private notifications: NotificationItem[] = [];

  private signal: SignalState;
  private mlResult: MLPredictionResult;
  private analytics: SimulationAnalytics;

  private lastTimeSeriesSample = -10;
  private lastDensityNotified: DensityLevel = 'LOW';
  private lastElderlyNotified = false;
  private lastWheelchairNotified = false;
  private currentCycleWaitTimes: number[] = [];
  private currentCycleCrossDurations: number[] = [];
  private currentCycleCrossedCount = 0;
  private currentCyclePredictedRf = 14;
  private currentCyclePredictedLr = 14;
  private lastActualCrossDuration: number | null = null;
  private nextAutoArrivalTime = 2.8;

  private listeners = new Set<(snap: SimulationSnapshot) => void>();
  private lastReactEmit = 0;

  constructor(initialSettings: SimulationSettings) {
    this.settings = { ...initialSettings };
    this.vehicleDensity = initialSettings.defaultVehicleDensity;
    this.showTrackingOverlay = initialSettings.showTrackingOverlayByDefault;
    this.cameraPreset = initialSettings.defaultCameraPreset;

    this.signal = this.createInitialSignalState();
    this.analytics = this.createInitialAnalytics();
    this.mlResult = trafficMLPipeline.predict(
      {
        waitingCount: 0,
        densityNumeric: 0,
        crossingWidth: this.settings.crossingWidthMeters,
        avgWalkingSpeed: 1.25,
        elderlyCount: 0,
        childCount: 0,
        wheelchairCount: 0,
        historicalAvgDuration: 12,
      },
      this.settings,
      null
    );

    this.seedInitialScene();
  }

  private createInitialSignalState(): SignalState {
    return {
      mode: 'AUTO',
      phase: 'VEH_NS_GREEN',
      phaseLabel: 'Phase 1 · Vehicle N-S Green / Pedestrian Red',
      vehicleNS: 'GREEN',
      vehicleEW: 'RED',
      pedestrian: 'RED',
      phaseElapsed: 6,
      phaseDuration: this.settings.vehicleGreenDuration,
      remainingSeconds: Math.max(1, this.settings.vehicleGreenDuration - 6),
      cycleCount: 0,
      extendedClearanceActive: false,
      safetyWarning: null,
    };
  }

  private createInitialAnalytics(): SimulationAnalytics {
    return {
      totalDetected: 0,
      totalCrossed: 0,
      avgWaitingTime: 0,
      avgCrossingDuration: 0,
      maxWaitingCount: 0,
      peakDensity: 'LOW',
      cycleCount: 0,
      totalVehicleWaitTime: 0,
      densityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0 },
      phaseSeconds: {
        vehicleGreen: 0,
        vehicleYellow: 0,
        pedestrianGreen: 0,
        pedestrianYellow: 0,
      },
      timeSeries: [],
      cycleHistory: [],
    };
  }

  private seedInitialScene(): void {
    // Seed diverse human pedestrians already waiting/approaching at the zebra crossings
    this.spawnPedestrian('office_worker', 'NORTH', true);
    this.spawnPedestrian('adult_female', 'NORTH', true);
    this.spawnPedestrian('elderly', 'NORTH', true);
    this.spawnPedestrian('student', 'SOUTH', true);
    this.spawnPedestrian('adult_male', 'SOUTH', true);
    this.spawnChildWithAdult('EAST', true);
    this.spawnPedestrian('office_worker', 'WEST', true);
    this.spawnPedestrian('wheelchair', 'WEST', true);
    this.spawnPedestrian('adult_female', 'EAST', false);
    this.spawnPedestrian('student', 'NORTH', false);

    this.syncVehiclesToDensity();
    this.updateMLPrediction();
    this.sampleTimeSeries();
  }

  public subscribe(fn: (snap: SimulationSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.getSnapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastReactEmit < 120) return;
    this.lastReactEmit = now;
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  public getPedestrians(): readonly PedestrianData[] {
    return this.pedestrians;
  }

  public getVehicles(): readonly VehicleData[] {
    return this.vehicles;
  }

  public getSignalState(): SignalState {
    return this.signal;
  }

  public getShowTrackingOverlay(): boolean {
    return this.showTrackingOverlay;
  }

  public getCameraPreset(): CameraPreset {
    return this.cameraPreset;
  }

  public getSnapshot(): SimulationSnapshot {
    const counts = this.computeCounts();
    return {
      isRunning: this.isRunning,
      speed: this.speed,
      vehicleDensity: this.vehicleDensity,
      showTrackingOverlay: this.showTrackingOverlay,
      cameraPreset: this.cameraPreset,
      pedestrians: this.pedestrians.map((p) => ({ ...p })),
      vehicles: this.vehicles.map((v) => ({ ...v })),
      counts,
      signal: { ...this.signal },
      ml: {
        ...this.mlResult,
        features: { ...this.mlResult.features },
        explanation: [...this.mlResult.explanation],
        featureImportances: [...this.mlResult.featureImportances],
      },
      analytics: {
        ...this.analytics,
        densityCounts: { ...this.analytics.densityCounts },
        phaseSeconds: { ...this.analytics.phaseSeconds },
        timeSeries: [...this.analytics.timeSeries],
        cycleHistory: [...this.analytics.cycleHistory],
      },
      notifications: [...this.notifications],
    };
  }

  private computeCounts() {
    let approaching = 0;
    let waiting = 0;
    let crossing = 0;
    let crossedVisible = 0;
    let elderlyWaiting = 0;
    let childrenWaiting = 0;
    let wheelchairWaiting = 0;

    for (const p of this.pedestrians) {
      if (p.state === 'APPROACHING') approaching++;
      else if (p.state === 'WAITING') {
        waiting++;
        if (p.category === 'elderly') elderlyWaiting++;
        if (p.category === 'child') childrenWaiting++;
        if (p.category === 'wheelchair') wheelchairWaiting++;
      } else if (p.state === 'CROSSING') crossing++;
      else if (p.state === 'CROSSED') crossedVisible++;
    }

    return {
      totalInScene: this.pedestrians.length,
      approaching,
      waiting,
      crossing,
      crossed: this.analytics.totalCrossed,
      elderlyWaiting,
      childrenWaiting,
      wheelchairWaiting,
    };
  }

  public pushNotification(
    type: NotificationItem['type'],
    title: string,
    message: string
  ): void {
    const id = `N-${this.nextNotifSeq++}`;
    this.notifications = [
      { id, type, title, message, timestamp: Date.now() },
      ...this.notifications,
    ].slice(0, 18);
  }

  public dismissNotification(id: string): void {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.emit(true);
  }

  // =========================================================================
  // PUBLIC CONTROLS
  // =========================================================================

  public start(): void {
    this.isRunning = true;
    this.emit(true);
  }

  public pause(): void {
    this.isRunning = false;
    this.pushNotification('info', 'Simulation Paused', '3D traffic and pedestrian movement paused.');
    this.emit(true);
  }

  public resume(): void {
    this.isRunning = true;
    this.pushNotification('info', 'Simulation Resumed', '3D traffic and pedestrian simulation active.');
    this.emit(true);
  }

  public reset(): void {
    this.simTime = 0;
    this.nextPedSeq = 1;
    this.nextVehSeq = 1;
    this.pedestrians = [];
    this.vehicles = [];
    this.notifications = [];
    this.currentCycleWaitTimes = [];
    this.currentCycleCrossDurations = [];
    this.currentCycleCrossedCount = 0;
    this.lastActualCrossDuration = null;
    this.lastTimeSeriesSample = -10;
    this.lastDensityNotified = 'LOW';
    this.lastElderlyNotified = false;
    this.lastWheelchairNotified = false;

    this.signal = this.createInitialSignalState();
    this.analytics = this.createInitialAnalytics();
    this.seedInitialScene();
    this.pushNotification('info', 'Simulation Reset', 'Intersection reset to initial smart-city state.');
    this.emit(true);
  }

  public setSpeed(speed: SimSpeed): void {
    this.speed = speed;
    this.emit(true);
  }

  public setTrackingOverlay(show: boolean): void {
    this.showTrackingOverlay = show;
    this.emit(true);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    this.emit(true);
  }

  public updateSettings(newSettings: SimulationSettings): void {
    this.settings = { ...newSettings };
    this.updateMLPrediction();
    this.emit(true);
  }

  public setVehicleDensity(density: VehicleDensity): void {
    this.vehicleDensity = density;
    this.syncVehiclesToDensity();
    this.emit(true);
  }

  public addVehicles(count = 2): void {
    for (let i = 0; i < count; i++) {
      this.spawnVehicle();
    }
    this.emit(true);
  }

  public addPedestrians(count: number, category?: PedestrianCategory): void {
    for (let i = 0; i < count; i++) {
      const cat =
        category ??
        pick<PedestrianCategory>([
          'adult_male',
          'adult_female',
          'office_worker',
          'student',
          'adult_male',
          'adult_female',
          'elderly',
        ]);
      this.spawnPedestrian(cat, pick(CROSSING_ARMS), false);
    }
    this.updateMLPrediction();
    this.emit(true);
  }

  public addRandomPedestrians(count = 6): void {
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      if (roll < 0.14) {
        this.spawnChildWithAdult(pick(CROSSING_ARMS), false);
      } else if (roll < 0.24) {
        this.spawnPedestrian('elderly', pick(CROSSING_ARMS), false);
      } else if (roll < 0.31) {
        this.spawnPedestrian('wheelchair', pick(CROSSING_ARMS), false);
      } else {
        this.spawnPedestrian(
          pick(['adult_male', 'adult_female', 'office_worker', 'student']),
          pick(CROSSING_ARMS),
          false
        );
      }
    }
    this.updateMLPrediction();
    this.emit(true);
  }

  public addElderlyPedestrian(): void {
    this.spawnPedestrian('elderly', pick(CROSSING_ARMS), false);
    this.updateMLPrediction();
    this.emit(true);
  }

  public addChildWithAdult(): void {
    this.spawnChildWithAdult(pick(CROSSING_ARMS), false);
    this.updateMLPrediction();
    this.emit(true);
  }

  public addWheelchairUser(): void {
    this.spawnPedestrian('wheelchair', pick(CROSSING_ARMS), false);
    this.updateMLPrediction();
    this.emit(true);
  }

  public removeWaitingPedestrians(count = 3): void {
    let removed = 0;
    const removedIds = new Set<string>();
    this.pedestrians = this.pedestrians.filter((p) => {
      if (removed < count && (p.state === 'WAITING' || p.state === 'APPROACHING')) {
        removed++;
        removedIds.add(p.id);
        return false;
      }
      return true;
    });
    // Also remove orphaned accompanied children if their leader was removed
    this.pedestrians = this.pedestrians.filter(
      (p) => !p.companionId || !removedIds.has(p.companionId)
    );
    this.updateMLPrediction();
    this.emit(true);
  }

  public setSignalMode(mode: 'AUTO' | 'MANUAL'): void {
    this.signal.mode = mode;
    this.signal.safetyWarning = null;
    if (mode === 'AUTO') {
      // Safely resume auto from current state
      if (this.signal.pedestrian === 'GREEN') {
        this.signal.phase = 'PED_GREEN';
        this.signal.phaseLabel = 'Phase 3 · Pedestrian Green / Vehicle Red';
      } else if (this.signal.pedestrian === 'YELLOW') {
        this.signal.phase = 'PED_YELLOW';
        this.signal.phaseLabel = 'Phase 4 · Pedestrian Clearance Warning';
      } else if (this.signal.vehicleNS === 'GREEN') {
        this.signal.phase = 'VEH_NS_GREEN';
        this.signal.phaseLabel = 'Phase 1 · Vehicle N-S Green / Pedestrian Red';
      } else if (this.signal.vehicleEW === 'GREEN') {
        this.signal.phase = 'VEH_EW_GREEN';
        this.signal.phaseLabel = 'Phase 1 · Vehicle E-W Green / Pedestrian Red';
      } else {
        this.transitionPhase('VEH_NS_GREEN', this.settings.vehicleGreenDuration);
      }
      this.pushNotification('info', 'Automatic Mode Active', 'ML signal controller resumed automatic phase cycling.');
    } else {
      this.signal.phase = 'MANUAL_HOLD';
      this.signal.phaseLabel = 'Manual Testing Mode · Safety Interlocks Active';
      this.pushNotification('info', 'Manual Signal Mode', 'Manual signal testing enabled with conflict interlocks.');
    }
    this.emit(true);
  }

  public setManualCommand(
    cmd:
      | 'VEH_NS_GREEN'
      | 'VEH_NS_YELLOW'
      | 'VEH_NS_RED'
      | 'VEH_EW_GREEN'
      | 'VEH_EW_YELLOW'
      | 'VEH_EW_RED'
      | 'VEH_ALL_RED'
      | 'PED_GREEN'
      | 'PED_YELLOW'
      | 'PED_RED'
  ): void {
    if (this.signal.mode !== 'MANUAL') {
      this.setSignalMode('MANUAL');
    }

    const crossingCount = this.pedestrians.filter((p) => p.state === 'CROSSING').length;
    this.signal.safetyWarning = null;

    if (cmd === 'VEH_NS_GREEN') {
      if (this.signal.pedestrian !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: Cannot set Vehicle N-S GREEN while Pedestrian signal is GREEN or YELLOW.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      if (crossingCount > 0) {
        this.signal.safetyWarning = `Safety Interlock Blocked: ${crossingCount} pedestrian(s) still inside the crossing zone.`;
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      if (this.signal.vehicleEW !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: Set East-West Vehicle signal to RED before enabling North-South GREEN.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      this.signal.vehicleNS = 'GREEN';
    } else if (cmd === 'VEH_EW_GREEN') {
      if (this.signal.pedestrian !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: Cannot set Vehicle E-W GREEN while Pedestrian signal is GREEN or YELLOW.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      if (crossingCount > 0) {
        this.signal.safetyWarning = `Safety Interlock Blocked: ${crossingCount} pedestrian(s) still inside the crossing zone.`;
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      if (this.signal.vehicleNS !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: Set North-South Vehicle signal to RED before enabling East-West GREEN.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      this.signal.vehicleEW = 'GREEN';
    } else if (cmd === 'VEH_NS_YELLOW') {
      this.signal.vehicleNS = 'YELLOW';
    } else if (cmd === 'VEH_NS_RED') {
      this.signal.vehicleNS = 'RED';
    } else if (cmd === 'VEH_EW_YELLOW') {
      this.signal.vehicleEW = 'YELLOW';
    } else if (cmd === 'VEH_EW_RED') {
      this.signal.vehicleEW = 'RED';
    } else if (cmd === 'VEH_ALL_RED') {
      this.signal.vehicleNS = 'RED';
      this.signal.vehicleEW = 'RED';
    } else if (cmd === 'PED_GREEN') {
      if (this.signal.vehicleNS !== 'RED' || this.signal.vehicleEW !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: All Vehicle signals (N-S and E-W) must be RED before setting Pedestrian GREEN.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      this.signal.pedestrian = 'GREEN';
      this.pushNotification('success', 'Pedestrian Crossing Started', 'Manual Pedestrian GREEN activated.');
    } else if (cmd === 'PED_YELLOW') {
      if (this.signal.vehicleNS !== 'RED' || this.signal.vehicleEW !== 'RED') {
        this.signal.safetyWarning =
          'Safety Interlock Blocked: Vehicles must remain RED during Pedestrian Clearance Warning.';
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      this.signal.pedestrian = 'YELLOW';
    } else if (cmd === 'PED_RED') {
      if (crossingCount > 0) {
        this.signal.safetyWarning = `Safety Interlock Blocked: ${crossingCount} pedestrian(s) still crossing. Hold Clearance Warning until clear.`;
        this.pushNotification('alert', 'Safety Interlock Triggered', this.signal.safetyWarning);
        this.emit(true);
        return;
      }
      this.signal.pedestrian = 'RED';
      if (this.currentCycleCrossedCount > 0) {
        this.finalizePedestrianCycle();
        this.currentCycleCrossedCount = 0;
      }
    }

    this.emit(true);
  }

  public safeManualLetPedestriansCross(): void {
    if (this.signal.mode !== 'MANUAL') {
      this.setSignalMode('MANUAL');
    }
    this.signal.safetyWarning = null;
    this.signal.vehicleNS = 'RED';
    this.signal.vehicleEW = 'RED';
    this.signal.pedestrian = 'GREEN';
    this.currentCycleWaitTimes = [];
    this.currentCycleCrossDurations = [];
    this.currentCycleCrossedCount = 0;
    this.pushNotification(
      'success',
      'Pedestrian Crossing Started',
      'All vehicles held RED · Manual Pedestrian GREEN activated.'
    );
    this.emit(true);
  }

  // =========================================================================
  // ENTITY SPAWNING
  // =========================================================================

  private getWaitingSlotPosition(
    arm: CrossingArm,
    direction: 1 | -1,
    jitter = 1.0
  ): { waitX: number; waitZ: number; destX: number; destZ: number; startX: number; startZ: number } {
    const g = INTERSECTION_GEOMETRY;
    const laneSpread = (Math.random() - 0.5) * 2.1 * jitter; // spread across zebra width
    const depthSpread = (Math.random() - 0.5) * 1.8 * jitter;

    if (arm === 'NORTH' || arm === 'SOUTH') {
      const zCenter = arm === 'NORTH' ? -g.crosswalkCenterOffset : g.crosswalkCenterOffset;
      const waitZ = zCenter + laneSpread;
      const destZ = waitZ + (Math.random() - 0.5) * 0.6;
      // direction = 1 means West (-X) -> East (+X); -1 means East (+X) -> West (-X)
      const waitX = direction === 1 ? -8.6 + depthSpread * 0.7 : 8.6 + depthSpread * 0.7;
      const destX = direction === 1 ? 8.8 + Math.random() * 1.4 : -8.8 - Math.random() * 1.4;
      const startX = direction === 1 ? -15 - Math.random() * 6 : 15 + Math.random() * 6;
      const startZ = waitZ + (Math.random() - 0.5) * 2.5;
      return { waitX, waitZ, destX, destZ, startX, startZ };
    } else {
      const xCenter = arm === 'WEST' ? -g.crosswalkCenterOffset : g.crosswalkCenterOffset;
      const waitX = xCenter + laneSpread;
      const destX = waitX + (Math.random() - 0.5) * 0.6;
      // direction = 1 means North (-Z) -> South (+Z); -1 means South (+Z) -> North (-Z)
      const waitZ = direction === 1 ? -8.6 + depthSpread * 0.7 : 8.6 + depthSpread * 0.7;
      const destZ = direction === 1 ? 8.8 + Math.random() * 1.4 : -8.8 - Math.random() * 1.4;
      const startZ = direction === 1 ? -15 - Math.random() * 6 : 15 + Math.random() * 6;
      const startX = waitX + (Math.random() - 0.5) * 2.5;
      return { waitX, waitZ, destX, destZ, startX, startZ };
    }
  }

  private createPedestrianRecord(
    category: PedestrianCategory,
    arm: CrossingArm,
    direction: 1 | -1,
    placeInWaitZone: boolean,
    companionId?: string,
    isCompanionLeader?: boolean,
    customPos?: { waitX: number; waitZ: number; destX: number; destZ: number; startX: number; startZ: number }
  ): PedestrianData {
    const id = `P${String(this.nextPedSeq++).padStart(3, '0')}`;
    const pos = customPos ?? this.getWaitingSlotPosition(arm, direction);

    let baseSpeed = 1.25 + Math.random() * 0.25;
    let heightScale = 0.96 + Math.random() * 0.1;
    let outfitPalette = OUTFIT_PALETTES.shirts;
    let hasBag = Math.random() < 0.35;
    let hasCane = false;

    if (category === 'elderly') {
      baseSpeed = 1.25 * this.settings.elderlySpeedFactor;
      heightScale = 0.92 + Math.random() * 0.05;
      outfitPalette = OUTFIT_PALETTES.elderlyShirts;
      hasCane = Math.random() < 0.75;
      hasBag = false;
    } else if (category === 'wheelchair') {
      baseSpeed = 1.25 * this.settings.wheelchairSpeedFactor;
      heightScale = 0.96;
      hasBag = false;
    } else if (category === 'child') {
      baseSpeed = 1.15;
      heightScale = 0.68 + Math.random() * 0.06;
      hasBag = Math.random() < 0.5;
    } else if (category === 'office_worker') {
      baseSpeed = 1.32 + Math.random() * 0.2;
      outfitPalette = OUTFIT_PALETTES.officeShirts;
      hasBag = true;
    } else if (category === 'student') {
      baseSpeed = 1.3 + Math.random() * 0.22;
      outfitPalette = OUTFIT_PALETTES.studentShirts;
      hasBag = true;
    }

    const x = placeInWaitZone ? pos.waitX : pos.startX;
    const z = placeInWaitZone ? pos.waitZ : pos.startZ;
    const initialState: PedestrianState = placeInWaitZone ? 'WAITING' : 'APPROACHING';

    const dx = pos.destX - x;
    const dz = pos.destZ - z;
    const heading = Math.atan2(dx, dz);

    this.analytics.totalDetected++;

    return {
      id,
      category,
      label: CATEGORY_LABELS[category],
      state: initialState,
      arm,
      direction,
      x,
      z,
      targetX: placeInWaitZone ? pos.destX : pos.waitX,
      targetZ: placeInWaitZone ? pos.destZ : pos.waitZ,
      baseSpeed,
      currentSpeed: initialState === 'WAITING' ? 0 : baseSpeed,
      waitTime: 0,
      crossStartTime: null,
      crossDuration: null,
      companionId,
      isCompanionLeader,
      outfitColor: pick(outfitPalette),
      trouserColor: pick(OUTFIT_PALETTES.trousers),
      skinColor: pick(OUTFIT_PALETTES.skinTones),
      hairColor: category === 'elderly' ? '#cbd5e1' : pick(OUTFIT_PALETTES.hairColors),
      heightScale,
      hasBag,
      hasCane,
      walkPhase: Math.random() * Math.PI * 2,
      heading,
    };
  }

  private spawnPedestrian(
    category: PedestrianCategory,
    arm: CrossingArm,
    placeInWaitZone: boolean
  ): void {
    const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const ped = this.createPedestrianRecord(category, arm, direction, placeInWaitZone);
    this.pedestrians.push(ped);
  }

  private spawnChildWithAdult(arm: CrossingArm, placeInWaitZone: boolean): void {
    const direction: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const leaderPos = this.getWaitingSlotPosition(arm, direction);
    const adultCategory: PedestrianCategory = Math.random() < 0.5 ? 'adult_female' : 'adult_male';
    const adult = this.createPedestrianRecord(
      adultCategory,
      arm,
      direction,
      placeInWaitZone,
      undefined,
      true,
      leaderPos
    );

    const offsetSide = arm === 'NORTH' || arm === 'SOUTH' ? { ox: 0, oz: 0.65 } : { ox: 0.65, oz: 0 };
    const childPos = {
      waitX: leaderPos.waitX + offsetSide.ox,
      waitZ: leaderPos.waitZ + offsetSide.oz,
      destX: leaderPos.destX + offsetSide.ox,
      destZ: leaderPos.destZ + offsetSide.oz,
      startX: leaderPos.startX + offsetSide.ox,
      startZ: leaderPos.startZ + offsetSide.oz,
    };
    const child = this.createPedestrianRecord(
      'child',
      arm,
      direction,
      placeInWaitZone,
      adult.id,
      false,
      childPos
    );
    child.baseSpeed = adult.baseSpeed; // Accompanied child walks in sync with guardian!

    this.pedestrians.push(adult, child);
  }

  private syncVehiclesToDensity(): void {
    const targetCount =
      this.vehicleDensity === 'low' ? 6 : this.vehicleDensity === 'medium' ? 12 : 20;

    while (this.vehicles.length < targetCount) {
      this.spawnVehicle();
    }
    if (this.vehicles.length > targetCount) {
      // Remove farthest vehicles first so visible intersection stays populated cleanly
      this.vehicles = this.vehicles.slice(0, targetCount);
    }
  }

  private spawnVehicle(forcedType?: VehicleType): void {
    const type: VehicleType =
      forcedType ??
      pick<VehicleType>(['car', 'car', 'car', 'autorickshaw', 'twowheeler', 'bus']);
    const axis: 'NS' | 'EW' = Math.random() < 0.5 ? 'NS' : 'EW';
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const laneIndex: 0 | 1 = Math.random() < 0.5 ? 0 : 1;

    // Indian left-hand drive lane centers:
    // NS: dir=+1 (Southbound) -> x = +2.1 or +4.7; dir=-1 (Northbound) -> x = -2.1 or -4.7
    // EW: dir=+1 (Eastbound) -> z = -2.1 or -4.7; dir=-1 (Westbound) -> z = +2.1 or +4.7
    const laneOffset = laneIndex === 0 ? 2.1 : 4.7;

    let length = 4.2;
    let maxSpeed = 10.5;
    if (type === 'bus') {
      length = 8.4;
      maxSpeed = 8.2;
    } else if (type === 'autorickshaw') {
      length = 2.6;
      maxSpeed = 8.8;
    } else if (type === 'twowheeler') {
      length = 1.9;
      maxSpeed = 11.5;
    }

    // Place along road away from immediate collisions
    const spawnDist = 20 + Math.random() * 44;
    let x = 0;
    let z = 0;
    if (axis === 'NS') {
      x = dir === 1 ? laneOffset : -laneOffset;
      z = dir === 1 ? -spawnDist : spawnDist;
    } else {
      z = dir === 1 ? -laneOffset : laneOffset;
      x = dir === 1 ? -spawnDist : spawnDist;
    }

    // Check overlap with existing vehicles in same lane; push further back if needed
    for (let tries = 0; tries < 6; tries++) {
      const clash = this.vehicles.some((v) => {
        if (v.axis !== axis || v.dir !== dir || v.laneIndex !== laneIndex) return false;
        const dist = axis === 'NS' ? Math.abs(v.z - z) : Math.abs(v.x - x);
        return dist < (v.length + length) * 0.7 + 3;
      });
      if (!clash) break;
      if (axis === 'NS') z += dir === 1 ? -9 : 9;
      else x += dir === 1 ? -9 : 9;
    }

    this.vehicles.push({
      id: `V${String(this.nextVehSeq++).padStart(3, '0')}`,
      type,
      axis,
      dir,
      laneIndex,
      x,
      z,
      speed: maxSpeed * 0.6,
      maxSpeed,
      length,
      color: pick(VEHICLE_COLORS[type]),
      waitTime: 0,
      wheelAngle: 0,
    });
  }

  // =========================================================================
  // MAIN SIMULATION STEP
  // =========================================================================

  public step(rawDelta: number): void {
    if (!this.isRunning) return;
    const dt = Math.min(rawDelta, 0.05) * this.speed;
    if (dt <= 0) return;

    this.simTime += dt;

    // Continuous urban pedestrian arrivals so crossing cycles repeat naturally
    if (this.simTime >= this.nextAutoArrivalTime) {
      const activeWaitingOrApproaching = this.pedestrians.filter(
        (p) => p.state === 'WAITING' || p.state === 'APPROACHING'
      ).length;
      if (activeWaitingOrApproaching < 16) {
        const roll = Math.random();
        if (roll < 0.12) {
          this.spawnChildWithAdult(pick(CROSSING_ARMS), false);
        } else if (roll < 0.22) {
          this.spawnPedestrian('elderly', pick(CROSSING_ARMS), false);
        } else if (roll < 0.28) {
          this.spawnPedestrian('wheelchair', pick(CROSSING_ARMS), false);
        } else {
          this.spawnPedestrian(
            pick(['adult_male', 'adult_female', 'office_worker', 'student']),
            pick(CROSSING_ARMS),
            false
          );
        }
      }
      this.nextAutoArrivalTime = this.simTime + 2.4 + Math.random() * 2.0;
    }

    this.updateSignals(dt);
    this.updatePedestrians(dt);
    this.updateVehicles(dt);
    this.updateMLPrediction();

    if (this.simTime - this.lastTimeSeriesSample >= 2.0) {
      this.sampleTimeSeries();
    }

    this.emit(false);
  }

  private transitionPhase(nextPhase: SignalPhaseId, duration: number): void {
    this.signal.phase = nextPhase;
    this.signal.phaseElapsed = 0;
    this.signal.phaseDuration = duration;
    this.signal.remainingSeconds = duration;
    this.signal.extendedClearanceActive = false;

    switch (nextPhase) {
      case 'VEH_NS_GREEN':
        this.signal.vehicleNS = 'GREEN';
        this.signal.vehicleEW = 'RED';
        this.signal.pedestrian = 'RED';
        this.signal.phaseLabel = 'Phase 1 · Vehicle N-S Green / Pedestrian Red';
        this.pushNotification('info', 'Signal Transition Completed', 'North-South vehicles cleared to move; pedestrians hold.');
        break;
      case 'VEH_NS_YELLOW':
        this.signal.vehicleNS = 'YELLOW';
        this.signal.vehicleEW = 'RED';
        this.signal.pedestrian = 'RED';
        this.signal.phaseLabel = 'Phase 2 · Vehicle N-S Yellow Warning';
        break;
      case 'VEH_EW_GREEN':
        this.signal.vehicleNS = 'RED';
        this.signal.vehicleEW = 'GREEN';
        this.signal.pedestrian = 'RED';
        this.signal.phaseLabel = 'Phase 1 · Vehicle E-W Green / Pedestrian Red';
        this.pushNotification('info', 'Signal Transition Completed', 'East-West vehicles cleared to move; pedestrians hold.');
        break;
      case 'VEH_EW_YELLOW':
        this.signal.vehicleNS = 'RED';
        this.signal.vehicleEW = 'YELLOW';
        this.signal.pedestrian = 'RED';
        this.signal.phaseLabel = 'Phase 2 · Vehicle E-W Yellow Warning';
        break;
      case 'PED_GREEN':
        this.signal.vehicleNS = 'RED';
        this.signal.vehicleEW = 'RED';
        this.signal.pedestrian = 'GREEN';
        this.signal.phaseLabel = 'Phase 3 · Vehicle Red / Pedestrian Green';
        this.currentCycleWaitTimes = [];
        this.currentCycleCrossDurations = [];
        this.currentCycleCrossedCount = 0;
        this.currentCyclePredictedRf = this.mlResult.randomForestDuration;
        this.currentCyclePredictedLr = this.mlResult.linearRegressionDuration;
        this.pushNotification(
          'success',
          'Pedestrian Crossing Started',
          `ML allocated ${duration}s green for ${this.mlResult.features.waitingCount} waiting pedestrian(s).`
        );
        break;
      case 'PED_YELLOW':
        this.signal.vehicleNS = 'RED';
        this.signal.vehicleEW = 'RED';
        this.signal.pedestrian = 'YELLOW';
        this.signal.phaseLabel = 'Phase 4 · Pedestrian Clearance Warning';
        break;
    }
  }

  private updateSignals(dt: number): void {
    // Accumulate phase analytics
    if (this.signal.pedestrian === 'GREEN') {
      this.analytics.phaseSeconds.pedestrianGreen += dt;
    } else if (this.signal.pedestrian === 'YELLOW') {
      this.analytics.phaseSeconds.pedestrianYellow += dt;
    } else if (this.signal.vehicleNS === 'YELLOW' || this.signal.vehicleEW === 'YELLOW') {
      this.analytics.phaseSeconds.vehicleYellow += dt;
    } else {
      this.analytics.phaseSeconds.vehicleGreen += dt;
    }

    if (this.signal.mode === 'MANUAL') return;

    this.signal.phaseElapsed += dt;
    this.signal.remainingSeconds = Math.max(0, this.signal.phaseDuration - this.signal.phaseElapsed);

    const crossingNow = this.pedestrians.filter((p) => p.state === 'CROSSING').length;
    const waitingNow = this.pedestrians.filter((p) => p.state === 'WAITING').length;

    if (this.signal.phase === 'VEH_NS_GREEN') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        this.transitionPhase('VEH_NS_YELLOW', this.settings.vehicleYellowDuration);
      }
    } else if (this.signal.phase === 'VEH_NS_YELLOW') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        // If many pedestrians waiting, go straight to Pedestrian Green or alternate EW first
        if (waitingNow >= 8 && this.signal.cycleCount % 2 === 1) {
          this.updateMLPrediction();
          this.transitionPhase('PED_GREEN', this.mlResult.recommendedGreenTime);
        } else {
          this.transitionPhase('VEH_EW_GREEN', this.settings.vehicleGreenDuration);
        }
      }
    } else if (this.signal.phase === 'VEH_EW_GREEN') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        this.transitionPhase('VEH_EW_YELLOW', this.settings.vehicleYellowDuration);
      }
    } else if (this.signal.phase === 'VEH_EW_YELLOW') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        this.updateMLPrediction();
        this.transitionPhase('PED_GREEN', this.mlResult.recommendedGreenTime);
      }
    } else if (this.signal.phase === 'PED_GREEN') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        this.transitionPhase('PED_YELLOW', this.settings.pedestrianYellowDuration);
      }
    } else if (this.signal.phase === 'PED_YELLOW') {
      if (this.signal.phaseElapsed >= this.signal.phaseDuration) {
        if (crossingNow > 0) {
          // Critical Safety Interlock: extend clearance until all pedestrians clear the road
          if (!this.signal.extendedClearanceActive) {
            this.signal.extendedClearanceActive = true;
            this.signal.phaseLabel = 'Phase 4 · Extended Clearance (Waiting for Pedestrians)';
            this.pushNotification(
              'warning',
              'Extended Crossing Time Activated',
              `Holding vehicles RED until ${crossingNow} pedestrian(s) clear the zebra crossing.`
            );
          }
        } else {
          this.finalizePedestrianCycle();
          this.transitionPhase('VEH_NS_GREEN', this.settings.vehicleGreenDuration);
        }
      }
    }
  }

  private finalizePedestrianCycle(): void {
    this.signal.cycleCount++;
    this.analytics.cycleCount = this.signal.cycleCount;

    const avgWait =
      this.currentCycleWaitTimes.length > 0
        ? this.currentCycleWaitTimes.reduce((a, b) => a + b, 0) / this.currentCycleWaitTimes.length
        : 0;
    const avgCross =
      this.currentCycleCrossDurations.length > 0
        ? this.currentCycleCrossDurations.reduce((a, b) => a + b, 0) /
          this.currentCycleCrossDurations.length
        : 0;

    if (this.currentCycleCrossedCount > 0) {
      this.pushNotification(
        'success',
        'Pedestrian Crossing Completed',
        `${this.currentCycleCrossedCount} pedestrian(s) safely reached the opposite sidewalk.`
      );
    }

    this.analytics.cycleHistory = [
      ...this.analytics.cycleHistory,
      {
        cycle: `C${this.signal.cycleCount}`,
        avgWaitTime: Number(avgWait.toFixed(1)),
        rfPredicted: Number(this.currentCyclePredictedRf.toFixed(1)),
        linearEstimated: Number(this.currentCyclePredictedLr.toFixed(1)),
        actualDuration: Number(avgCross.toFixed(1)),
        pedestriansCrossed: this.currentCycleCrossedCount,
      },
    ].slice(-15);
  }

  private isInsideWaitingZone(x: number, z: number, arm: CrossingArm, direction: 1 | -1): boolean {
    const g = INTERSECTION_GEOMETRY;
    if (arm === 'NORTH') {
      const inBandZ = z >= -g.waitingZoneOuter && z <= -g.waitingZoneInner;
      const inSideX = direction === 1 ? x >= -10.8 && x <= -7.1 : x >= 7.1 && x <= 10.8;
      return inBandZ && inSideX;
    }
    if (arm === 'SOUTH') {
      const inBandZ = z >= g.waitingZoneInner && z <= g.waitingZoneOuter;
      const inSideX = direction === 1 ? x >= -10.8 && x <= -7.1 : x >= 7.1 && x <= 10.8;
      return inBandZ && inSideX;
    }
    if (arm === 'WEST') {
      const inBandX = x >= -g.waitingZoneOuter && x <= -g.waitingZoneInner;
      const inSideZ = direction === 1 ? z >= -10.8 && z <= -7.1 : z >= 7.1 && z <= 10.8;
      return inBandX && inSideZ;
    }
    // EAST
    const inBandX = x >= g.waitingZoneInner && x <= g.waitingZoneOuter;
    const inSideZ = direction === 1 ? z >= -10.8 && z <= -7.1 : z >= 7.1 && z <= 10.8;
    return inBandX && inSideZ;
  }

  private hasReachedOppositeSidewalk(p: PedestrianData): boolean {
    const limit = 7.45;
    if (p.arm === 'NORTH' || p.arm === 'SOUTH') {
      return p.direction === 1 ? p.x >= limit : p.x <= -limit;
    }
    return p.direction === 1 ? p.z >= limit : p.z <= -limit;
  }

  private updatePedestrians(dt: number): void {
    const pedSignal = this.signal.pedestrian;
    const byId = new Map(this.pedestrians.map((p) => [p.id, p]));

    for (const p of this.pedestrians) {
      if (p.state === 'APPROACHING') {
        const dx = p.targetX - p.x;
        const dz = p.targetZ - p.z;
        const dist = Math.hypot(dx, dz);

        if (dist < 0.25 || this.isInsideWaitingZone(p.x, p.z, p.arm, p.direction)) {
          p.state = 'WAITING';
          p.currentSpeed = 0;
          // Face across the road
          const crossAxis = p.arm === 'NORTH' || p.arm === 'SOUTH';
          p.heading = crossAxis ? (p.direction === 1 ? Math.PI / 2 : -Math.PI / 2) : p.direction === 1 ? 0 : Math.PI;
          // Set final destination across the road
          const slot = this.getWaitingSlotPosition(p.arm, p.direction, 0.4);
          if (crossAxis) {
            p.targetX = p.direction === 1 ? 8.6 + Math.random() * 1.4 : -8.6 - Math.random() * 1.4;
            p.targetZ = p.z;
          } else {
            p.targetZ = p.direction === 1 ? 8.6 + Math.random() * 1.4 : -8.6 - Math.random() * 1.4;
            p.targetX = p.x;
          }
          void slot;
        } else {
          const stepDist = Math.min(dist, p.baseSpeed * dt);
          p.x += (dx / dist) * stepDist;
          p.z += (dz / dist) * stepDist;
          p.currentSpeed = p.baseSpeed;
          p.heading = Math.atan2(dx, dz);
          p.walkPhase += dt * p.baseSpeed * 4.8;
        }
      } else if (p.state === 'WAITING') {
        p.waitTime += dt;
        p.currentSpeed = 0;

        // Child accompanied by adult never enters crossing independently
        if (p.category === 'child' && p.companionId) {
          const leader = byId.get(p.companionId);
          if (leader && leader.state === 'CROSSING' && pedSignal === 'GREEN') {
            p.state = 'CROSSING';
            p.crossStartTime = this.simTime;
            this.currentCycleWaitTimes.push(p.waitTime);
          }
          continue;
        }

        // Start crossing ONLY when pedestrian signal is GREEN
        if (pedSignal === 'GREEN') {
          p.state = 'CROSSING';
          p.crossStartTime = this.simTime;
          this.currentCycleWaitTimes.push(p.waitTime);
        }
      } else if (p.state === 'CROSSING') {
        // Only yield to a vehicle that is actually moving into the pedestrian's path
        const vehicleTooClose = this.vehicles.some((v) => {
          if (v.speed < 0.45) return false;
          const d = Math.hypot(v.x - p.x, v.z - p.z);
          return d < 2.4;
        });

        if (vehicleTooClose) {
          p.currentSpeed = 0;
        } else {
          const dx = p.targetX - p.x;
          const dz = p.targetZ - p.z;
          const dist = Math.hypot(dx, dz);

          // Keep in sync with companion if child
          let speed = p.baseSpeed;
          if (p.category === 'child' && p.companionId) {
            const leader = byId.get(p.companionId);
            if (leader) speed = leader.baseSpeed;
          }

          if (dist < 0.25 || this.hasReachedOppositeSidewalk(p)) {
            p.state = 'CROSSED';
            p.currentSpeed = p.baseSpeed * 0.85;
            const crossDur = p.crossStartTime !== null ? this.simTime - p.crossStartTime : 10;
            p.crossDuration = Number(crossDur.toFixed(1));
            this.lastActualCrossDuration = p.crossDuration;
            this.currentCycleCrossDurations.push(p.crossDuration);
            this.currentCycleCrossedCount++;
            this.analytics.totalCrossed++;

            // Recompute global averages
            const prevTotal = this.analytics.totalCrossed - 1;
            this.analytics.avgWaitingTime = Number(
              ((this.analytics.avgWaitingTime * prevTotal + p.waitTime) / this.analytics.totalCrossed).toFixed(1)
            );
            this.analytics.avgCrossingDuration = Number(
              ((this.analytics.avgCrossingDuration * prevTotal + p.crossDuration) / this.analytics.totalCrossed).toFixed(1)
            );

            // Walk down the opposite sidewalk naturally instead of vanishing
            if (p.arm === 'NORTH' || p.arm === 'SOUTH') {
              p.targetX = p.x + p.direction * 9;
              p.targetZ = p.z + (p.arm === 'NORTH' ? -4 : 4);
            } else {
              p.targetZ = p.z + p.direction * 9;
              p.targetX = p.x + (p.arm === 'WEST' ? -4 : 4);
            }
          } else {
            const stepDist = Math.min(dist, speed * dt);
            p.x += (dx / dist) * stepDist;
            p.z += (dz / dist) * stepDist;
            p.currentSpeed = speed;
            p.heading = Math.atan2(dx, dz);
            p.walkPhase += dt * speed * 5.0;
          }
        }
      } else if (p.state === 'CROSSED') {
        const dx = p.targetX - p.x;
        const dz = p.targetZ - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.3) {
          const walkSpd = p.baseSpeed * 0.75;
          const stepDist = Math.min(dist, walkSpd * dt);
          p.x += (dx / dist) * stepDist;
          p.z += (dz / dist) * stepDist;
          p.currentSpeed = walkSpd;
          p.heading = Math.atan2(dx, dz);
          p.walkPhase += dt * walkSpd * 4.5;
        } else {
          p.currentSpeed = 0;
        }
      }
    }

    // Keep total scene pedestrians bounded cleanly at 36 by retiring oldest stationary CROSSED characters
    if (this.pedestrians.length > 36) {
      const idx = this.pedestrians.findIndex(
        (p) => p.state === 'CROSSED' && p.currentSpeed === 0 && !p.isCompanionLeader
      );
      if (idx !== -1) {
        this.pedestrians.splice(idx, 1);
      }
    }
  }

  private updateVehicles(dt: number): void {
    const stopOffset = INTERSECTION_GEOMETRY.stopLineOffset;
    const worldLimit = 68;

    for (const v of this.vehicles) {
      const axisLight: TrafficLightColor =
        v.axis === 'NS' ? this.signal.vehicleNS : this.signal.vehicleEW;

      const posAlongAxis = v.axis === 'NS' ? v.z : v.x;
      const frontBumperPos = posAlongAxis + v.dir * (v.length * 0.5);
      const distToStopLine = (-stopOffset * v.dir - frontBumperPos) * v.dir;
      // Positive distToStopLine means vehicle's front bumper has not yet crossed its stop line (±11.7m)

      let targetSpeed = v.maxSpeed;

      // 1. Check signal if approaching stop line
      if (axisLight === 'RED' && distToStopLine > -0.4 && distToStopLine < 18) {
        if (distToStopLine <= 1.2) {
          targetSpeed = 0;
        } else {
          targetSpeed = Math.min(targetSpeed, (distToStopLine - 0.8) * 1.4);
        }
      } else if (axisLight === 'YELLOW' && distToStopLine > 2.0 && distToStopLine < 20) {
        targetSpeed = Math.min(targetSpeed, (distToStopLine - 1.2) * 1.3);
      }

      // 2. Check vehicle ahead in same lane (car-following safety)
      for (const other of this.vehicles) {
        if (other.id === v.id || other.axis !== v.axis || other.dir !== v.dir || other.laneIndex !== v.laneIndex) {
          continue;
        }
        const otherPos = v.axis === 'NS' ? other.z : other.x;
        const gap = (otherPos - posAlongAxis) * v.dir - (other.length * 0.5 + v.length * 0.5);
        if (gap > 0 && gap < 11) {
          if (gap < 2.2) {
            targetSpeed = 0;
          } else {
            targetSpeed = Math.min(targetSpeed, (gap - 1.8) * 1.5);
          }
        }
      }

      // 3. Check if ANY crossing pedestrian is in front of vehicle inside intersection/crosswalk
      const pedAhead = this.pedestrians.some((p) => {
        if (p.state !== 'CROSSING') return false;
        const dx = p.x - v.x;
        const dz = p.z - v.z;
        const forward = v.axis === 'NS' ? dz * v.dir : dx * v.dir;
        const lateral = v.axis === 'NS' ? Math.abs(dx) : Math.abs(dz);
        return forward > 0 && forward < v.length * 0.5 + 4.5 && lateral < 3.0;
      });

      if (pedAhead) {
        targetSpeed = 0;
      }

      // Smooth acceleration / braking
      const accel = targetSpeed > v.speed ? 5.5 : 10.0;
      if (v.speed < targetSpeed) {
        v.speed = Math.min(targetSpeed, v.speed + accel * dt);
      } else {
        v.speed = Math.max(targetSpeed, v.speed - accel * dt);
      }

      if (v.speed < 0.25 && axisLight !== 'GREEN') {
        v.waitTime += dt;
        this.analytics.totalVehicleWaitTime += dt;
      }

      const move = v.speed * dt * v.dir;
      if (v.axis === 'NS') v.z += move;
      else v.x += move;
      v.wheelAngle += (v.speed * dt) / 0.35;

      // Wrap vehicle seamlessly around road corridor beyond city skyline
      if (Math.abs(v.x) > worldLimit || Math.abs(v.z) > worldLimit) {
        if (v.axis === 'NS') v.z = -v.dir * (worldLimit - 2);
        else v.x = -v.dir * (worldLimit - 2);
      }
    }
  }

  private updateMLPrediction(): void {
    const waiting = this.pedestrians.filter((p) => p.state === 'WAITING');
    const waitingCount = waiting.length;
    const elderlyCount = waiting.filter((p) => p.category === 'elderly').length;
    const childCount = waiting.filter((p) => p.category === 'child').length;
    const wheelchairCount = waiting.filter((p) => p.category === 'wheelchair').length;

    let avgSpeed = 1.28;
    if (waitingCount > 0) {
      avgSpeed = waiting.reduce((sum, p) => sum + p.baseSpeed, 0) / waitingCount;
    }

    const historicalAvg =
      this.analytics.avgCrossingDuration > 0
        ? this.analytics.avgCrossingDuration
        : this.settings.crossingWidthMeters / Math.max(0.7, avgSpeed);

    const prevDensity = this.mlResult?.densityClass ?? 'LOW';
    this.mlResult = trafficMLPipeline.predict(
      {
        waitingCount,
        densityNumeric: 0,
        crossingWidth: this.settings.crossingWidthMeters,
        avgWalkingSpeed: Number(avgSpeed.toFixed(2)),
        elderlyCount,
        childCount,
        wheelchairCount,
        historicalAvgDuration: Number(historicalAvg.toFixed(1)),
      },
      this.settings,
      this.lastActualCrossDuration
    );

    if (waitingCount > this.analytics.maxWaitingCount) {
      this.analytics.maxWaitingCount = waitingCount;
    }

    const densityRank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
    if (densityRank[this.mlResult.densityClass] > densityRank[this.analytics.peakDensity]) {
      this.analytics.peakDensity = this.mlResult.densityClass;
    }

    // Trigger meaningful contextual notifications once per transition
    if (this.mlResult.densityClass === 'HIGH' && prevDensity !== 'HIGH' && this.lastDensityNotified !== 'HIGH') {
      this.lastDensityNotified = 'HIGH';
      this.pushNotification(
        'warning',
        'High Pedestrian Density Detected',
        `${waitingCount} pedestrians waiting. Random Forest scaled crossing time to ${this.mlResult.recommendedGreenTime}s.`
      );
    } else if (this.mlResult.densityClass !== 'HIGH') {
      this.lastDensityNotified = this.mlResult.densityClass;
    }

    if (elderlyCount > 0 && !this.lastElderlyNotified) {
      this.lastElderlyNotified = true;
      this.pushNotification(
        'info',
        'Elderly Pedestrian Detected',
        `Adjusted walking speed factor (${this.settings.elderlySpeedFactor}x) applied to ML crossing prediction.`
      );
    } else if (elderlyCount === 0) {
      this.lastElderlyNotified = false;
    }

    if (wheelchairCount > 0 && !this.lastWheelchairNotified) {
      this.lastWheelchairNotified = true;
      this.pushNotification(
        'info',
        'Wheelchair User Detected',
        `Accessibility crossing time buffer applied for wheelchair mobility.`
      );
    } else if (wheelchairCount === 0) {
      this.lastWheelchairNotified = false;
    }
  }

  private sampleTimeSeries(): void {
    this.lastTimeSeriesSample = this.simTime;
    const counts = this.computeCounts();
    const density = this.mlResult.densityClass;
    this.analytics.densityCounts[density]++;

    this.analytics.timeSeries = [
      ...this.analytics.timeSeries,
      {
        timeLabel: formatTimeLabel(this.simTime),
        timestamp: this.simTime,
        waiting: counts.waiting,
        crossing: counts.crossing,
        crossed: counts.crossed,
        density,
        recommendedGreen: this.mlResult.recommendedGreenTime,
      },
    ].slice(-36);
  }
}
