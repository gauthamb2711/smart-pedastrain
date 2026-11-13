import {
  DensityLevel,
  MLFeatureVector,
  MLPredictionResult,
  SimulationSettings,
} from '../simulation/types';

interface TrainingSample {
  features: number[]; // [waitingCount, densityNumeric, crossingWidth, avgWalkingSpeed, elderlyCount, childCount, wheelchairCount, historicalAvgDuration]
  targetGreenDuration: number;
}

interface RegressionNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionNode;
  right?: RegressionNode;
}

const FEATURE_NAMES = [
  'Waiting Pedestrians',
  'Pedestrian Density Tier',
  'Crossing Width (m)',
  'Avg Walking Speed (m/s)',
  'Elderly Pedestrians',
  'Accompanied Children',
  'Wheelchair Users',
  'Historical Crossing (s)',
];

// Deterministic PRNG (Mulberry32) so ML training is reproducible across page loads
function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a synthetic urban pedestrian crossing dataset for training.
 * Ground-truth simulation formula reflects pedestrian queue discharge + physical crossing time.
 */
function generateSyntheticDataset(size = 320): TrainingSample[] {
  const rng = createRng(20261113);
  const samples: TrainingSample[] = [];

  for (let i = 0; i < size; i++) {
    const waitingCount = Math.floor(rng() * 34); // 0 to 33
    const densityNumeric = waitingCount <= 5 ? 0 : waitingCount <= 15 ? 1 : 2;
    const crossingWidth = 10 + Math.round(rng() * 10); // 10m to 20m
    const elderlyCount = Math.min(waitingCount, Math.floor(rng() * (waitingCount * 0.35 + 1)));
    const childCount = Math.min(
      Math.max(0, waitingCount - elderlyCount),
      Math.floor(rng() * (waitingCount * 0.25 + 1))
    );
    const wheelchairCount =
      waitingCount > 0 && rng() < 0.28 ? Math.min(2, Math.max(1, Math.floor(rng() * 2.3))) : 0;

    // Physical average speed drops with elderly, children, wheelchair, and crowd friction
    let avgSpeed = 1.32 - rng() * 0.14;
    if (waitingCount > 0) {
      const vulnerableRatio = (elderlyCount * 0.4 + childCount * 0.2 + wheelchairCount * 0.35) / waitingCount;
      avgSpeed = Math.max(0.68, avgSpeed - vulnerableRatio * 0.42 - Math.min(0.18, waitingCount * 0.004));
    }

    const baseCrossTime = crossingWidth / Math.max(0.6, avgSpeed);
    const queueDischarge = waitingCount * 0.62;
    const safetyBuffer = 2.5 + elderlyCount * 1.1 + wheelchairCount * 2.4 + childCount * 0.6;
    const historicalAvgDuration = Number((baseCrossTime + Math.min(6, waitingCount * 0.25) + (rng() - 0.5) * 1.4).toFixed(2));

    const noise = (rng() - 0.5) * 1.8;
    const rawTarget = 7.5 + queueDischarge + (baseCrossTime - 10) * 0.85 + safetyBuffer + noise;
    const targetGreenDuration = Math.max(10, Math.min(45, Math.round(rawTarget * 10) / 10));

    samples.push({
      features: [
        waitingCount,
        densityNumeric,
        crossingWidth,
        Number(avgSpeed.toFixed(2)),
        elderlyCount,
        childCount,
        wheelchairCount,
        historicalAvgDuration,
      ],
      targetGreenDuration,
    });
  }

  return samples;
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  const mean = sum / values.length;
  let sq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - mean;
    sq += d * d;
  }
  return sq / values.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 12;
  let sum = 0;
  for (let i = 0; i < values.length; i++) sum += values[i];
  return sum / values.length;
}

function buildCartTree(
  samples: TrainingSample[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  rng: () => number,
  importances: number[]
): RegressionNode {
  const targets = samples.map((s) => s.targetGreenDuration);
  const currentMean = mean(targets);

  if (depth >= maxDepth || samples.length < minSamplesSplit) {
    return { isLeaf: true, value: currentMean };
  }

  const parentVar = variance(targets);
  if (parentVar < 0.05) {
    return { isLeaf: true, value: currentMean };
  }

  // Random Forest feature subsampling (sqrt(8) ≈ 3-4 features per split)
  const numFeatures = samples[0].features.length;
  const featureIndices = Array.from({ length: numFeatures }, (_, i) => i);
  for (let i = featureIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = featureIndices[i];
    featureIndices[i] = featureIndices[j];
    featureIndices[j] = tmp;
  }
  const candidateFeatures = featureIndices.slice(0, 4);

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;
  let bestLeft: TrainingSample[] = [];
  let bestRight: TrainingSample[] = [];

  for (const fIdx of candidateFeatures) {
    const vals = Array.from(new Set(samples.map((s) => s.features[fIdx]))).sort((a, b) => a - b);
    if (vals.length < 2) continue;

    // Sample up to 10 split points for fast initialization
    const step = Math.max(1, Math.floor(vals.length / 10));
    for (let i = 0; i < vals.length - 1; i += step) {
      const thresh = (vals[i] + vals[i + 1]) / 2;
      const left: TrainingSample[] = [];
      const right: TrainingSample[] = [];
      for (const s of samples) {
        if (s.features[fIdx] <= thresh) left.push(s);
        else right.push(s);
      }
      if (left.length < 2 || right.length < 2) continue;

      const leftVar = variance(left.map((s) => s.targetGreenDuration));
      const rightVar = variance(right.map((s) => s.targetGreenDuration));
      const weightedVar =
        (left.length / samples.length) * leftVar + (right.length / samples.length) * rightVar;
      const gain = parentVar - weightedVar;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = fIdx;
        bestThreshold = thresh;
        bestLeft = left;
        bestRight = right;
      }
    }
  }

  if (bestFeature === -1 || bestGain <= 0.01) {
    return { isLeaf: true, value: currentMean };
  }

  importances[bestFeature] += bestGain * samples.length;

  return {
    isLeaf: false,
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildCartTree(bestLeft, depth + 1, maxDepth, minSamplesSplit, rng, importances),
    right: buildCartTree(bestRight, depth + 1, maxDepth, minSamplesSplit, rng, importances),
  };
}

function predictTree(node: RegressionNode, features: number[]): number {
  if (node.isLeaf) return node.value ?? 12;
  const val = features[node.featureIndex ?? 0];
  if (val <= (node.threshold ?? 0)) {
    return node.left ? predictTree(node.left, features) : 12;
  }
  return node.right ? predictTree(node.right, features) : 12;
}

/**
 * Solves Ordinary Least Squares w = (X^T X + lambda*I)^(-1) X^T y via Gauss-Jordan elimination
 */
function trainLinearRegression(samples: TrainingSample[]): number[] {
  const numCols = samples[0].features.length + 1; // +1 for intercept
  const xtx: number[][] = Array.from({ length: numCols }, () => Array(numCols).fill(0));
  const xty: number[] = Array(numCols).fill(0);

  for (const s of samples) {
    const row = [1, ...s.features];
    for (let i = 0; i < numCols; i++) {
      xty[i] += row[i] * s.targetGreenDuration;
      for (let j = 0; j < numCols; j++) {
        xtx[i][j] += row[i] * row[j];
      }
    }
  }

  // Ridge regularization for numerical stability
  for (let i = 0; i < numCols; i++) {
    xtx[i][i] += 0.5;
  }

  // Gauss-Jordan solver on augmented matrix [xtx | xty]
  const aug = xtx.map((row, idx) => [...row, xty[idx]]);
  for (let col = 0; col < numCols; col++) {
    let pivot = col;
    for (let r = col + 1; r < numCols; r++) {
      if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) {
        pivot = r;
      }
    }
    const tmp = aug[col];
    aug[col] = aug[pivot];
    aug[pivot] = tmp;

    const div = aug[col][col] || 1e-6;
    for (let c = col; c <= numCols; c++) aug[col][c] /= div;

    for (let r = 0; r < numCols; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let c = col; c <= numCols; c++) {
        aug[r][c] -= factor * aug[col][c];
      }
    }
  }

  return aug.map((row) => row[numCols]);
}

class TrafficMLPipeline {
  private dataset: TrainingSample[];
  private forest: RegressionNode[] = [];
  private linearWeights: number[] = [];
  private normalizedImportances: Array<{ name: string; importance: number }> = [];

  constructor() {
    this.dataset = generateSyntheticDataset(320);
    const rng = createRng(987654);
    const rawImportances = Array(FEATURE_NAMES.length).fill(0);
    const numTrees = 18;

    for (let t = 0; t < numTrees; t++) {
      // Bootstrap resample
      const boot: TrainingSample[] = [];
      for (let i = 0; i < this.dataset.length; i++) {
        const idx = Math.floor(rng() * this.dataset.length);
        boot.push(this.dataset[idx]);
      }
      this.forest.push(buildCartTree(boot, 0, 6, 5, rng, rawImportances));
    }

    const totalImp = rawImportances.reduce((a, b) => a + b, 0) || 1;
    this.normalizedImportances = FEATURE_NAMES.map((name, idx) => ({
      name,
      importance: Number(((rawImportances[idx] / totalImp) * 100).toFixed(1)),
    })).sort((a, b) => b.importance - a.importance);

    this.linearWeights = trainLinearRegression(this.dataset);
  }

  /**
   * Decision Tree Density Classifier
   */
  public classifyDensity(waitingCount: number, settings: SimulationSettings): DensityLevel {
    if (waitingCount <= settings.lowDensityMax) {
      return 'LOW';
    }
    if (waitingCount <= settings.mediumDensityMax) {
      return 'MEDIUM';
    }
    return 'HIGH';
  }

  /**
   * Full ML inference pipeline (Decision Tree + Random Forest + Linear Regression)
   */
  public predict(
    features: MLFeatureVector,
    settings: SimulationSettings,
    lastActualDuration: number | null
  ): MLPredictionResult {
    const densityClass = this.classifyDensity(features.waitingCount, settings);
    const densityNumeric = densityClass === 'LOW' ? 0 : densityClass === 'MEDIUM' ? 1 : 2;

    const vec = [
      features.waitingCount,
      densityNumeric,
      features.crossingWidth,
      features.avgWalkingSpeed,
      features.elderlyCount,
      features.childCount,
      features.wheelchairCount,
      features.historicalAvgDuration,
    ];

    // 1. Random Forest predictions across all 18 trees
    const treePreds = this.forest.map((tree) => predictTree(tree, vec));
    const rfMean = mean(treePreds);
    const rfStd = Math.sqrt(variance(treePreds));

    // 2. Linear Regression estimate
    let lrPred = this.linearWeights[0];
    for (let i = 0; i < vec.length; i++) {
      lrPred += this.linearWeights[i + 1] * vec[i];
    }

    const rfRounded = Math.round(
      Math.max(settings.minPedestrianGreen, Math.min(settings.maxPedestrianGreen, rfMean))
    );
    const lrRounded = Math.round(
      Math.max(settings.minPedestrianGreen, Math.min(settings.maxPedestrianGreen, lrPred))
    );

    // Apply safety clamp for final recommended green time
    const recommendedGreenTime = Math.max(
      settings.minPedestrianGreen,
      Math.min(settings.maxPedestrianGreen, rfRounded)
    );

    const explanation: string[] = [];
    explanation.push(
      `Decision Tree classified ${features.waitingCount} waiting pedestrian${
        features.waitingCount === 1 ? '' : 's'
      } as ${densityClass} density (thresholds: 0–${settings.lowDensityMax} LOW, ${
        settings.lowDensityMax + 1
      }–${settings.mediumDensityMax} MEDIUM, ${settings.mediumDensityMax + 1}+ HIGH).`
    );
    explanation.push(
      `Random Forest (18 CART trees trained on ${this.dataset.length} synthetic scenarios) predicted ${rfMean.toFixed(
        1
      )}s ± ${rfStd.toFixed(1)}s for a ${features.crossingWidth}m crossing at ${features.avgWalkingSpeed.toFixed(
        2
      )} m/s.`
    );

    if (features.elderlyCount > 0 || features.wheelchairCount > 0 || features.childCount > 0) {
      const notes: string[] = [];
      if (features.elderlyCount > 0) notes.push(`${features.elderlyCount} elderly`);
      if (features.wheelchairCount > 0) notes.push(`${features.wheelchairCount} wheelchair user(s)`);
      if (features.childCount > 0) notes.push(`${features.childCount} accompanied child(ren)`);
      explanation.push(
        `Accessibility adjustment applied for ${notes.join(', ')}, lowering assumed pace and extending green allocation.`
      );
    }

    explanation.push(
      `Safe bounds enforced [${settings.minPedestrianGreen}s – ${settings.maxPedestrianGreen}s]; vehicle green remains locked until crosswalk clearance completes.`
    );

    return {
      densityClass,
      randomForestDuration: Number(rfMean.toFixed(1)),
      linearRegressionDuration: Number(lrRounded.toFixed(1)),
      recommendedGreenTime,
      rfTreeSpread: Number(rfStd.toFixed(1)),
      lastActualCrossingDuration: lastActualDuration,
      features: {
        ...features,
        densityNumeric,
      },
      featureImportances: this.normalizedImportances,
      explanation,
      datasetSize: this.dataset.length,
      isSyntheticDataset: true,
      modeLabel: '3D SIMULATION — VIRTUAL PEDESTRIAN TRACKING',
    };
  }
}

export const trafficMLPipeline = new TrafficMLPipeline();
