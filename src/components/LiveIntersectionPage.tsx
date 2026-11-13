import React from 'react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { SimulationSnapshot } from '../simulation/types';
import { IntersectionViewport } from './IntersectionViewport';
import { SimulationControlsBar } from './SimulationControlsBar';

interface LiveIntersectionPageProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
}

export const LiveIntersectionPage: React.FC<LiveIntersectionPageProps> = ({
  engine,
  snapshot,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900">
            Live 3D Urban Intersection
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Drag to orbit · Scroll to zoom · Right-drag to pan · Toggle fullscreen for full viewport inspection
          </p>
        </div>
        <div className="text-xs font-medium text-slate-600">
          <span>Active Pedestrians: </span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {snapshot.counts.totalInScene}
          </span>
          <span className="mx-2 text-slate-300">·</span>
          <span>Active Vehicles: </span>
          <span className="font-mono font-semibold text-slate-900 tabular-nums">
            {snapshot.vehicles.length}
          </span>
        </div>
      </div>

      <IntersectionViewport
        engine={engine}
        snapshot={snapshot}
        heightClass="h-[580px] lg:h-[680px]"
        showFullHud={true}
      />

      <SimulationControlsBar engine={engine} snapshot={snapshot} />
    </div>
  );
};
