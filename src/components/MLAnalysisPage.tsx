import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SimulationSettings, SimulationSnapshot } from '../simulation/types';

interface MLAnalysisPageProps {
  snapshot: SimulationSnapshot;
  settings: SimulationSettings;
}

export const MLAnalysisPage: React.FC<MLAnalysisPageProps> = ({
  snapshot,
  settings,
}) => {
  const { ml, analytics } = snapshot;
  const f = ml.features;

  const comparisonData = [
    { name: 'Random Forest (Raw)', seconds: ml.randomForestDuration },
    { name: 'Recommended Green', seconds: ml.recommendedGreenTime },
    { name: 'Linear Regression', seconds: ml.linearRegressionDuration },
    {
      name: 'Last Actual Cross',
      seconds: ml.lastActualCrossingDuration ?? analytics.avgCrossingDuration,
    },
  ];

  const densityColor =
    ml.densityClass === 'HIGH'
      ? 'text-rose-700'
      : ml.densityClass === 'MEDIUM'
        ? 'text-amber-700'
        : 'text-emerald-700';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            AI / Machine Learning Crossing Prediction
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            In-browser Random Forest Regression, Decision Tree Classification & Linear Regression
          </p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-800">
          {ml.modeLabel} · Synthetic Dataset ({ml.datasetSize} Scenarios)
        </div>
      </div>

      {/* Explicit Synthetic Dataset Notice */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm">
        <span className="font-semibold text-slate-900">Transparency Note:</span> Models are trained in-browser on a deterministic{' '}
        <span className="font-semibold text-slate-800">
          synthetic urban crossing dataset ({ml.datasetSize} generated scenarios)
        </span>{' '}
        using actual virtual pedestrian coordinates, counts, and walking speeds from the 3D intersection. Safe minimum ({settings.minPedestrianGreen}s) and maximum ({settings.maxPedestrianGreen}s) bounds are always enforced; outputs are simulation predictions, not a certified field traffic-engineering standard.
      </div>

      {/* Model Outputs Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* A. Random Forest */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            A · Random Forest Regressor (18 CART Trees)
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-blue-700 tabular-nums">
              {ml.recommendedGreenTime}s
            </span>
            <span className="text-xs text-slate-500">
              raw {ml.randomForestDuration}s (±{ml.rfTreeSpread}s spread)
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Predicts adaptive pedestrian GREEN duration from waiting count, density tier, crossing width, average walking speed, and accessibility profiles.
          </p>
        </div>

        {/* B. Decision Tree */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            B · Decision Tree Density Classifier
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`font-display text-3xl font-bold ${densityColor}`}>
              {ml.densityClass}
            </span>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              ({f.waitingCount} waiting)
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Configured Decision Tree thresholds: 0–{settings.lowDensityMax} LOW ·{' '}
            {settings.lowDensityMax + 1}–{settings.mediumDensityMax} MEDIUM ·{' '}
            {settings.mediumDensityMax + 1}+ HIGH.
          </p>
        </div>

        {/* C. Linear Regression */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium text-slate-500">
            C · Linear Regression Baseline (OLS)
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
              {ml.linearRegressionDuration}s
            </span>
            <span className="text-xs text-slate-500">
              actual avg: {analytics.avgCrossingDuration > 0 ? `${analytics.avgCrossingDuration}s` : 'pending cycle'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Ordinary Least Squares regression estimates linear baseline crossing duration for side-by-side comparison with Random Forest & actual outcomes.
          </p>
        </div>
      </div>

      {/* Live Input Feature Vector & Explanation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-5">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Live Input Feature Vector
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Extracted continuously from waiting-zone pedestrians
          </p>

          <dl className="mt-4 divide-y divide-slate-100 text-xs">
            {[
              { label: 'Waiting Pedestrians', value: `${f.waitingCount}` },
              { label: 'Classified Density Tier', value: ml.densityClass },
              { label: 'Crossing Width', value: `${f.crossingWidth} m` },
              { label: 'Estimated Avg Walking Speed', value: `${f.avgWalkingSpeed.toFixed(2)} m/s` },
              { label: 'Elderly Pedestrians Waiting', value: `${f.elderlyCount}` },
              { label: 'Accompanied Children Waiting', value: `${f.childCount}` },
              { label: 'Wheelchair Users Waiting', value: `${f.wheelchairCount}` },
              { label: 'Historical Crossing Duration', value: `${f.historicalAvgDuration.toFixed(1)} s` },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2.5">
                <dt className="text-slate-600">{item.label}</dt>
                <dd className="font-mono font-semibold text-slate-900 tabular-nums">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-7">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Random Forest Feature Importance (%)
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Variance reduction contribution across the 18 trained regression trees
          </p>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ml.featureImportances}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 30, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={155}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip
                  formatter={(v) => [`${v ?? 0}%`, 'Importance']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="importance" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Model Comparison & Plain-English Explanation */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Prediction vs. Actual Crossing Duration (s)
          </h3>
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="s" />
                <Tooltip
                  formatter={(v) => [`${v ?? 0}s`, 'Duration']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="seconds" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-6">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Prediction Explanation
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Model reasoning for the current waiting cohort
          </p>
          <ul className="mt-4 space-y-2.5 text-xs text-slate-700">
            {ml.explanation.map((line, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 leading-relaxed"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
