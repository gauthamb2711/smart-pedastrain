import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Camera,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { CameraPreset, SimulationSnapshot } from '../simulation/types';
import { buildIntersectionEnvironment, updateSignalVisuals } from '../three/intersectionBuilder';
import {
  buildPedestrianRig,
  disposePedestrianRig,
  PedestrianRig,
  updatePedestrianRig,
} from '../three/pedestrianBuilder';
import {
  buildVehicleRig,
  disposeVehicleRig,
  updateVehicleRig,
  VehicleRig,
} from '../three/vehicleBuilder';

interface IntersectionViewportProps {
  engine: SimulationEngine;
  snapshot: SimulationSnapshot;
  heightClass?: string;
  showFullHud?: boolean;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  default: { pos: [24, 19, 25], target: [0, 0.5, 0] },
  top: { pos: [0.1, 38, 0.1], target: [0, 0, 0] },
  street: { pos: [-14.5, 2.5, -14.5], target: [2, 1.2, 2] },
};

export const IntersectionViewport: React.FC<IntersectionViewportProps> = ({
  engine,
  snapshot,
  heightClass = 'h-[520px] lg:h-[600px]',
  showFullHud = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Camera transition target refs
  const camTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: new THREE.Vector3(...CAMERA_PRESETS[snapshot.cameraPreset].pos),
    target: new THREE.Vector3(...CAMERA_PRESETS[snapshot.cameraPreset].target),
  });

  // React to camera preset changes from engine/UI
  useEffect(() => {
    const preset = CAMERA_PRESETS[snapshot.cameraPreset];
    camTransitionRef.current.pos.set(...preset.pos);
    camTransitionRef.current.target.set(...preset.target);
    camTransitionRef.current.active = true;
  }, [snapshot.cameraPreset]);

  const handleResetCamera = () => {
    const preset = CAMERA_PRESETS.default;
    engine.setCameraPreset('default');
    camTransitionRef.current.pos.set(...preset.pos);
    camTransitionRef.current.target.set(...preset.target);
    camTransitionRef.current.active = true;
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL rendering context could not be initialized in this browser.');
      return;
    }

    const width = host.clientWidth || 960;
    const height = host.clientHeight || 540;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    host.innerHTML = '';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xdceaf7);
    scene.background = skyColor;
    scene.fog = new THREE.Fog(0xdceaf7, 58, 145);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.5, 220);
    const initPreset = CAMERA_PRESETS[engine.getCameraPreset()];
    camera.position.set(...initPreset.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 8;
    controls.maxDistance = 72;
    controls.update();

    controls.addEventListener('start', () => {
      camTransitionRef.current.active = false;
    });

    // Warm Daylight Key + Cool Sky Fill + Rim Light
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x94a3b8, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.95);
    sunLight.position.set(28, 42, 22);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 110;
    const d = 34;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.45);
    fillLight.position.set(-22, 18, -20);
    scene.add(fillLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const signalRefs = buildIntersectionEnvironment(scene, maxAnisotropy);

    const pedRigs = new Map<string, PedestrianRig>();
    const vehRigs = new Map<string, VehicleRig>();
    const pedGroup = new THREE.Group();
    const vehGroup = new THREE.Group();
    scene.add(pedGroup);
    scene.add(vehGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleResize = () => {
      if (!host) return;
      const w = host.clientWidth || 960;
      const h = host.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(host);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL context lost. Attempting recovery...');
    };
    const onContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let totalElapsed = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const syncSceneEntities = () => {
      const peds = engine.getPedestrians();
      const activePedIds = new Set<string>();
      const showOverlay = engine.getShowTrackingOverlay();

      for (const p of peds) {
        activePedIds.add(p.id);
        let rig = pedRigs.get(p.id);
        if (!rig) {
          rig = buildPedestrianRig(p);
          pedRigs.set(p.id, rig);
          pedGroup.add(rig.root);
        }
        updatePedestrianRig(rig, p, showOverlay, totalElapsed);
      }

      for (const [id, rig] of pedRigs.entries()) {
        if (!activePedIds.has(id)) {
          pedGroup.remove(rig.root);
          disposePedestrianRig(rig);
          pedRigs.delete(id);
        }
      }

      const vehs = engine.getVehicles();
      const activeVehIds = new Set<string>();
      for (const v of vehs) {
        activeVehIds.add(v.id);
        let rig = vehRigs.get(v.id);
        if (!rig) {
          rig = buildVehicleRig(v);
          vehRigs.set(v.id, rig);
          vehGroup.add(rig.root);
        }
        updateVehicleRig(rig, v);
      }

      for (const [id, rig] of vehRigs.entries()) {
        if (!activeVehIds.has(id)) {
          vehGroup.remove(rig.root);
          disposeVehicleRig(rig);
          vehRigs.delete(id);
        }
      }

      const sig = engine.getSignalState();
      updateSignalVisuals(signalRefs, sig.vehicleNS, sig.vehicleEW, sig.pedestrian, showOverlay);
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      totalElapsed += delta;

      // Advance simulation engine
      engine.step(delta);

      // Smooth damped camera preset transitions
      if (camTransitionRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          camTransitionRef.current.pos.x,
          5.5,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          camTransitionRef.current.pos.y,
          5.5,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          camTransitionRef.current.pos.z,
          5.5,
          delta
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          camTransitionRef.current.target.x,
          5.5,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          camTransitionRef.current.target.y,
          5.5,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          camTransitionRef.current.target.z,
          5.5,
          delta
        );

        if (
          camera.position.distanceTo(camTransitionRef.current.pos) < 0.08 &&
          controls.target.distanceTo(camTransitionRef.current.target) < 0.08
        ) {
          camTransitionRef.current.active = false;
        }
      }

      controls.update();
      syncSceneEntities();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    syncSceneEntities();
    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      pedRigs.forEach((rig) => disposePedestrianRig(rig));
      vehRigs.forEach((rig) => disposeVehicleRig(rig));
      scene.environment?.dispose();
      renderer.dispose();
    };
  }, [engine]);

  const pedColorClass =
    snapshot.signal.pedestrian === 'GREEN'
      ? 'bg-emerald-600 text-white'
      : snapshot.signal.pedestrian === 'YELLOW'
        ? 'bg-amber-500 text-white'
        : 'bg-rose-600 text-white';

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-sky-50 shadow-sm ${
        isFullscreen ? 'h-screen rounded-none border-0' : heightClass
      }`}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasHostRef} className="h-full w-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-display text-base font-semibold text-slate-900">
              3D Viewport Unavailable
            </p>
            <p className="mt-2 text-sm text-slate-600">{webglError}</p>
          </div>
        </div>
      )}

      {/* Top-Left Live Signal & Mode HUD */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Pedestrian</span>
            <span
              className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${pedColorClass}`}
            >
              {snapshot.signal.pedestrian === 'GREEN'
                ? 'WALK'
                : snapshot.signal.pedestrian === 'YELLOW'
                  ? 'CLEAR'
                  : 'STOP'}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="text-slate-500">Veh N-S:</span>
            <span
              className={`font-mono font-semibold ${
                snapshot.signal.vehicleNS === 'GREEN'
                  ? 'text-emerald-700'
                  : snapshot.signal.vehicleNS === 'YELLOW'
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}
            >
              {snapshot.signal.vehicleNS}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="text-slate-500">E-W:</span>
            <span
              className={`font-mono font-semibold ${
                snapshot.signal.vehicleEW === 'GREEN'
                  ? 'text-emerald-700'
                  : snapshot.signal.vehicleEW === 'YELLOW'
                    ? 'text-amber-600'
                    : 'text-rose-600'
              }`}
            >
              {snapshot.signal.vehicleEW}
            </span>
          </div>
          {snapshot.signal.mode === 'AUTO' && (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                {snapshot.signal.extendedClearanceActive
                  ? 'HOLD CLEARANCE'
                  : `${Math.ceil(snapshot.signal.remainingSeconds)}s`}
              </span>
            </>
          )}
        </div>

        {showFullHud && (
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-200/90 bg-white/95 px-3 py-2 text-xs shadow-sm">
            <span className="text-slate-500">Waiting:</span>
            <span className="font-mono font-semibold text-blue-700 tabular-nums">
              {snapshot.counts.waiting}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">Crossing:</span>
            <span className="font-mono font-semibold text-emerald-700 tabular-nums">
              {snapshot.counts.crossing}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">ML Green:</span>
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              {snapshot.ml.recommendedGreenTime}s
            </span>
          </div>
        )}
      </div>

      {/* Bottom Camera & Overlay Controls */}
      <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white/95 p-1 shadow-sm">
          <span className="hidden items-center gap-1 px-2 text-xs font-medium text-slate-500 sm:flex">
            <Camera className="h-3.5 w-3.5" />
            Camera
          </span>
          {(
            [
              { id: 'default', label: '3D Orbit' },
              { id: 'top', label: 'Top View' },
              { id: 'street', label: 'Street Level' },
            ] as const
          ).map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => engine.setCameraPreset(cam.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                snapshot.cameraPreset === cam.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleResetCamera}
            title="Reset Camera"
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => engine.setTrackingOverlay(!snapshot.showTrackingOverlay)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
              snapshot.showTrackingOverlay
                ? 'bg-emerald-50 text-emerald-800'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {snapshot.showTrackingOverlay ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            <span>{snapshot.showTrackingOverlay ? 'Overlay On' : 'Overlay Off'}</span>
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen 3D'}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
          >
            {isFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
