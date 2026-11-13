import * as THREE from 'three';
import { INTERSECTION_GEOMETRY } from '../simulation/constants';
import { PedestrianSignalColor, TrafficLightColor } from '../simulation/types';
import {
  createAsphaltTexture,
  createBuildingFacadeTexture,
  createSidewalkTexture,
} from './proceduralTextures';

export interface SignalLightRefs {
  nsVehicles: Array<{ red: THREE.MeshStandardMaterial; yellow: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial }>;
  ewVehicles: Array<{ red: THREE.MeshStandardMaterial; yellow: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial }>;
  pedestrians: Array<{ red: THREE.MeshStandardMaterial; yellow: THREE.MeshStandardMaterial; green: THREE.MeshStandardMaterial }>;
  overlayGroup: THREE.Group;
}

export function buildIntersectionEnvironment(
  scene: THREE.Scene,
  maxAnisotropy: number
): SignalLightRefs {
  const g = INTERSECTION_GEOMETRY;
  const envGroup = new THREE.Group();
  const overlayGroup = new THREE.Group();

  const asphaltTex = createAsphaltTexture(maxAnisotropy);
  const sidewalkTex = createSidewalkTexture(maxAnisotropy);

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.88,
    metalness: 0.04,
  });

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.82,
    metalness: 0.02,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.78,
    metalness: 0.05,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x65a34e,
    roughness: 0.92,
    metalness: 0.0,
  });

  const whitePaintMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.55,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const yellowPaintMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.55,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const tactileYellowMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.75,
    metalness: 0.0,
  });

  // 1. Ground base & roads
  const groundBase = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), grassMat);
  groundBase.rotation.x = -Math.PI / 2;
  groundBase.position.y = -0.02;
  groundBase.receiveShadow = true;
  envGroup.add(groundBase);

  // North-South road (x in [-7, 7], z in [-75, 75])
  const nsRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(g.roadHalfWidth * 2, g.worldExtent * 2),
    asphaltMat
  );
  nsRoad.rotation.x = -Math.PI / 2;
  nsRoad.position.y = 0.0;
  nsRoad.receiveShadow = true;
  envGroup.add(nsRoad);

  // East-West road (z in [-7, 7], x in [-75, 75])
  const ewRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(g.worldExtent * 2, g.roadHalfWidth * 2),
    asphaltMat
  );
  ewRoad.rotation.x = -Math.PI / 2;
  ewRoad.position.y = 0.005;
  ewRoad.receiveShadow = true;
  envGroup.add(ewRoad);

  // 2. Four corner raised sidewalks / urban blocks
  const blockSize = g.worldExtent - g.roadHalfWidth;
  const blockCenter = g.roadHalfWidth + blockSize / 2;
  const cornerSigns: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];

  for (const [sx, sz] of cornerSigns) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(blockSize, g.sidewalkHeight, blockSize),
      sidewalkMat
    );
    sidewalk.position.set(sx * blockCenter, g.sidewalkHeight / 2, sz * blockCenter);
    sidewalk.receiveShadow = true;
    envGroup.add(sidewalk);

    // Curb edging along road borders
    const curbX = new THREE.Mesh(new THREE.BoxGeometry(0.28, g.sidewalkHeight + 0.02, blockSize), curbMat);
    curbX.position.set(sx * (g.roadHalfWidth + 0.14), (g.sidewalkHeight + 0.02) / 2, sz * blockCenter);
    curbX.receiveShadow = true;
    envGroup.add(curbX);

    const curbZ = new THREE.Mesh(new THREE.BoxGeometry(blockSize, g.sidewalkHeight + 0.02, 0.28), curbMat);
    curbZ.position.set(sx * blockCenter, (g.sidewalkHeight + 0.02) / 2, sz * (g.roadHalfWidth + 0.14));
    curbZ.receiveShadow = true;
    envGroup.add(curbZ);

    // Yellow tactile paving strips at zebra approaches
    const tactNS = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.015, 3.0), tactileYellowMat);
    tactNS.position.set(sx * 7.55, g.sidewalkHeight + 0.008, sz * g.crosswalkCenterOffset);
    envGroup.add(tactNS);

    const tactEW = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.015, 0.65), tactileYellowMat);
    tactEW.position.set(sx * g.crosswalkCenterOffset, g.sidewalkHeight + 0.008, sz * 7.55);
    envGroup.add(tactEW);

    // Landscaped corner lawn inset behind pedestrian plaza
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(blockSize - 6.5, 0.04, blockSize - 6.5), grassMat);
    lawn.position.set(sx * (g.roadHalfWidth + 6.5 + (blockSize - 6.5) / 2), g.sidewalkHeight + 0.01, sz * (g.roadHalfWidth + 6.5 + (blockSize - 6.5) / 2));
    lawn.receiveShadow = true;
    envGroup.add(lawn);
  }

  // 3. Zebra Crossings on all 4 arms
  const stripeCount = 9;
  const stripeWidth = 0.65;
  const stripeLen = 3.1;
  const stripeGeo = new THREE.PlaneGeometry(stripeWidth, stripeLen);

  // North & South zebra crossings (pedestrians walk along X, stripes oriented along Z)
  for (const zSign of [-1, 1]) {
    for (let i = 0; i < stripeCount; i++) {
      const x = -5.6 + i * 1.4;
      const stripe = new THREE.Mesh(stripeGeo, whitePaintMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(x, 0.02, zSign * g.crosswalkCenterOffset);
      stripe.receiveShadow = true;
      envGroup.add(stripe);
    }
    // Vehicle stop line before zebra crossing
    const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.35), whitePaintMat);
    stopLine.rotation.x = -Math.PI / 2;
    // Left-hand drive: Southbound stops at z = -11.7 on +X side; Northbound stops at z = +11.7 on -X side
    stopLine.position.set(zSign === -1 ? 3.5 : -3.5, 0.022, zSign * g.stopLineOffset);
    envGroup.add(stopLine);
  }

  // East & West zebra crossings (pedestrians walk along Z, stripes oriented along X)
  for (const xSign of [-1, 1]) {
    for (let i = 0; i < stripeCount; i++) {
      const z = -5.6 + i * 1.4;
      const stripe = new THREE.Mesh(stripeGeo, whitePaintMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = Math.PI / 2;
      stripe.position.set(xSign * g.crosswalkCenterOffset, 0.02, z);
      stripe.receiveShadow = true;
      envGroup.add(stripe);
    }
    const stopLine = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 6.4), whitePaintMat);
    stopLine.rotation.x = -Math.PI / 2;
    stopLine.position.set(xSign * g.stopLineOffset, 0.022, xSign === -1 ? -3.5 : 3.5);
    envGroup.add(stopLine);
  }

  // 4. Center double yellow dividers & dashed white lane dividers + directional arrows
  const dashGeoNS = new THREE.PlaneGeometry(0.18, 2.6);
  const centerLineGeoNS = new THREE.PlaneGeometry(0.14, 58);

  for (const zSign of [-1, 1]) {
    // Double yellow center line
    for (const offset of [-0.14, 0.14]) {
      const cLine = new THREE.Mesh(centerLineGeoNS, yellowPaintMat);
      cLine.rotation.x = -Math.PI / 2;
      cLine.position.set(offset, 0.018, zSign * 42);
      envGroup.add(cLine);
    }
    // Dashed white lane dividers at x = ±3.4
    for (let d = 15; d < 70; d += 5.5) {
      for (const xLane of [-3.4, 3.4]) {
        const dash = new THREE.Mesh(dashGeoNS, whitePaintMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(xLane, 0.018, zSign * d);
        envGroup.add(dash);
      }
    }
    // Directional straight arrows on road
    for (const xArr of [-2.1, -4.7, 2.1, 4.7]) {
      const arrow = buildRoadArrow(whitePaintMat);
      arrow.position.set(xArr, 0.022, zSign * 16.5);
      // Point toward intersection
      arrow.rotation.y = xArr > 0 ? 0 : Math.PI;
      if (zSign === 1) arrow.rotation.y = xArr < 0 ? Math.PI : 0;
      envGroup.add(arrow);
    }
  }

  for (const xSign of [-1, 1]) {
    for (const offset of [-0.14, 0.14]) {
      const cLine = new THREE.Mesh(centerLineGeoNS, yellowPaintMat);
      cLine.rotation.x = -Math.PI / 2;
      cLine.rotation.z = Math.PI / 2;
      cLine.position.set(xSign * 42, 0.018, offset);
      envGroup.add(cLine);
    }
    for (let d = 15; d < 70; d += 5.5) {
      for (const zLane of [-3.4, 3.4]) {
        const dash = new THREE.Mesh(dashGeoNS, whitePaintMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = Math.PI / 2;
        dash.position.set(xSign * d, 0.018, zLane);
        envGroup.add(dash);
      }
    }
    for (const zArr of [-2.1, -4.7, 2.1, 4.7]) {
      const arrow = buildRoadArrow(whitePaintMat);
      arrow.position.set(xSign * 16.5, 0.022, zArr);
      arrow.rotation.y = zArr < 0 ? Math.PI / 2 : -Math.PI / 2;
      envGroup.add(arrow);
    }
  }

  // 5. Tracking Overlay Boundaries (Waiting Zones & Crossing Zones)
  const waitZoneMat = new THREE.MeshBasicMaterial({
    color: 0x2563eb,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const waitBorderMat = new THREE.LineBasicMaterial({ color: 0x1d4ed8 });
  const crossBorderMat = new THREE.LineBasicMaterial({ color: 0x16a34a });

  const waitingRects: Array<[number, number, number, number]> = [
    [-9.0, -9.2, 3.4, 3.2],
    [9.0, -9.2, 3.4, 3.2],
    [-9.0, 9.2, 3.4, 3.2],
    [9.0, 9.2, 3.4, 3.2],
    [-9.2, -9.0, 3.2, 3.4],
    [-9.2, 9.0, 3.2, 3.4],
    [9.2, -9.0, 3.2, 3.4],
    [9.2, 9.0, 3.2, 3.4],
  ];

  for (const [cx, cz, w, d] of waitingRects) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), waitZoneMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(cx, g.sidewalkHeight + 0.025, cz);
    overlayGroup.add(plane);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.04, d));
    const line = new THREE.LineSegments(edges, waitBorderMat);
    line.position.set(cx, g.sidewalkHeight + 0.04, cz);
    overlayGroup.add(line);
  }

  const crossRects: Array<[number, number, number, number]> = [
    [0, -9.2, 13.6, 3.2],
    [0, 9.2, 13.6, 3.2],
    [-9.2, 0, 3.2, 13.6],
    [9.2, 0, 3.2, 13.6],
  ];
  for (const [cx, cz, w, d] of crossRects) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, 0.04, d));
    const line = new THREE.LineSegments(edges, crossBorderMat);
    line.position.set(cx, 0.05, cz);
    overlayGroup.add(line);
  }

  envGroup.add(overlayGroup);

  // 6. Traffic Signal Poles (Vehicle + Pedestrian + Smart Camera Sensors)
  const signalRefs: SignalLightRefs = {
    nsVehicles: [],
    ewVehicles: [],
    pedestrians: [],
    overlayGroup,
  };

  // 4 Vehicle Signal Cantilever Poles
  const polePositions: Array<{
    x: number;
    z: number;
    rotY: number;
    axis: 'NS' | 'EW';
  }> = [
    { x: 7.8, z: -11.4, rotY: 0, axis: 'NS' }, // Faces Southbound traffic approaching from North
    { x: -7.8, z: 11.4, rotY: Math.PI, axis: 'NS' }, // Faces Northbound traffic approaching from South
    { x: -11.4, z: -7.8, rotY: Math.PI / 2, axis: 'EW' }, // Faces Eastbound traffic approaching from West
    { x: 11.4, z: 7.8, rotY: -Math.PI / 2, axis: 'EW' }, // Faces Westbound traffic approaching from East
  ];

  for (const p of polePositions) {
    const { group, lightMats } = buildVehicleSignalPole();
    group.position.set(p.x, g.sidewalkHeight, p.z);
    group.rotation.y = p.rotY;
    envGroup.add(group);
    if (p.axis === 'NS') signalRefs.nsVehicles.push(lightMats);
    else signalRefs.ewVehicles.push(lightMats);
  }

  // 8 Pedestrian Signal Poles (2 per crosswalk corner)
  const pedPoleCoords: Array<{ x: number; z: number; rotY: number }> = [
    { x: -7.35, z: -7.45, rotY: Math.PI / 2 },
    { x: 7.35, z: -10.95, rotY: -Math.PI / 2 },
    { x: -7.35, z: 10.95, rotY: Math.PI / 2 },
    { x: 7.35, z: 7.45, rotY: -Math.PI / 2 },
    { x: -10.95, z: -7.35, rotY: 0 },
    { x: -7.45, z: 7.35, rotY: Math.PI },
    { x: 7.45, z: -7.35, rotY: 0 },
    { x: 10.95, z: 7.35, rotY: Math.PI },
  ];

  for (const pp of pedPoleCoords) {
    const { group, lightMats } = buildPedestrianSignalPole();
    group.position.set(pp.x, g.sidewalkHeight, pp.z);
    group.rotation.y = pp.rotY;
    envGroup.add(group);
    signalRefs.pedestrians.push(lightMats);
  }

  // 7. Roadside Streetlights & Pedestrian Guardrail Bollards
  const metalPoleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.8,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });

  const streetLightSpots: Array<[number, number, number]> = [
    [-8.2, -24, Math.PI / 2],
    [8.2, -24, -Math.PI / 2],
    [-8.2, 24, Math.PI / 2],
    [8.2, 24, -Math.PI / 2],
    [-24, -8.2, 0],
    [-24, 8.2, Math.PI],
    [24, -8.2, 0],
    [24, 8.2, Math.PI],
  ];

  for (const [lx, lz, lRot] of streetLightSpots) {
    const sl = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 6.2, 10), metalPoleMat);
    shaft.position.y = 3.1;
    shaft.castShadow = true;
    sl.add(shaft);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.8), metalPoleMat);
    arm.position.set(0, 6.15, 0.85);
    sl.add(arm);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.62), metalPoleMat);
    head.position.set(0, 6.1, 1.65);
    sl.add(head);

    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.48), lampGlowMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 6.04, 1.65);
    sl.add(lens);

    sl.position.set(lx, g.sidewalkHeight, lz);
    sl.rotation.y = lRot;
    envGroup.add(sl);
  }

  // Roadside bollards along sidewalk corners
  const bollardMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.4,
    metalness: 0.65,
  });
  const bollardStripeMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.4,
    metalness: 0.1,
  });

  const bollardPositions: Array<[number, number]> = [
    [-7.3, -12.5], [-7.3, -14.5], [-7.3, -16.5],
    [7.3, -12.5], [7.3, -14.5], [7.3, -16.5],
    [-7.3, 12.5], [-7.3, 14.5], [-7.3, 16.5],
    [7.3, 12.5], [7.3, 14.5], [7.3, 16.5],
    [-12.5, -7.3], [-14.5, -7.3], [-16.5, -7.3],
    [12.5, -7.3], [14.5, -7.3], [16.5, -7.3],
    [-12.5, 7.3], [-14.5, 7.3], [-16.5, 7.3],
    [12.5, 7.3], [14.5, 7.3], [16.5, 7.3],
  ];

  for (const [bx, bz] of bollardPositions) {
    const bol = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 8), bollardMat);
    post.position.y = 0.425;
    post.castShadow = true;
    bol.add(post);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.12, 8), bollardStripeMat);
    band.position.y = 0.7;
    bol.add(band);
    bol.position.set(bx, g.sidewalkHeight, bz);
    envGroup.add(bol);
  }

  // 8. Urban Trees (Composite multi-part trunk + 3 layered foliage clusters)
  const treeCoords: Array<[number, number, number]> = [
    [-13.5, -13.5, 1.0],
    [-14, -24, 1.15],
    [-24, -14, 0.95],
    [13.5, -13.5, 1.05],
    [14, -25, 1.1],
    [24, -14, 0.9],
    [-13.5, 13.5, 1.0],
    [-14, 24, 1.12],
    [-25, 14, 0.98],
    [13.5, 13.5, 1.08],
    [14, 24, 0.94],
    [25, 14, 1.15],
    [-34, -14, 1.05],
    [34, -14, 1.0],
    [-34, 14, 1.1],
    [34, 14, 0.95],
  ];

  for (const [tx, tz, scale] of treeCoords) {
    const tree = buildUrbanTree(scale);
    tree.position.set(tx, g.sidewalkHeight, tz);
    envGroup.add(tree);
  }

  // 9. Modern Indian Urban Buildings around the 4 blocks
  const buildings: Array<{
    x: number;
    z: number;
    w: number;
    h: number;
    d: number;
    base: string;
    accent: string;
  }> = [
    // NW block
    { x: -24, z: -26, w: 13, h: 18, d: 12, base: '#e2e8f0', accent: '#94a3b8' },
    { x: -42, z: -24, w: 14, h: 24, d: 13, base: '#f1f5f9', accent: '#cbd5e1' },
    { x: -25, z: -44, w: 12, h: 14, d: 14, base: '#fef3c7', accent: '#d97706' },
    // NE block
    { x: 25, z: -25, w: 14, h: 22, d: 13, base: '#dbeafe', accent: '#3b82f6' },
    { x: 43, z: -26, w: 12, h: 16, d: 12, base: '#f8fafc', accent: '#64748b' },
    { x: 24, z: -43, w: 13, h: 26, d: 12, base: '#e2e8f0', accent: '#475569' },
    // SW block
    { x: -25, z: 25, w: 13, h: 16, d: 13, base: '#f5ebe0', accent: '#d5bdaf' },
    { x: -43, z: 25, w: 13, h: 21, d: 12, base: '#e2e8f0', accent: '#64748b' },
    { x: -24, z: 43, w: 14, h: 25, d: 13, base: '#dbeafe', accent: '#2563eb' },
    // SE block
    { x: 25, z: 25, w: 14, h: 19, d: 13, base: '#f1f5f9', accent: '#94a3b8' },
    { x: 43, z: 24, w: 12, h: 27, d: 12, base: '#e0f2fe', accent: '#0284c7' },
    { x: 25, z: 44, w: 13, h: 15, d: 14, base: '#fef3c7', accent: '#b45309' },
  ];

  for (const b of buildings) {
    const facadeTex = createBuildingFacadeTexture(b.base, b.accent, maxAnisotropy);
    const wallMat = new THREE.MeshStandardMaterial({
      map: facadeTex,
      roughness: 0.72,
      metalness: 0.08,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.85,
      metalness: 0.05,
    });

    const bGroup = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), wallMat);
    tower.position.y = b.h / 2;
    tower.castShadow = true;
    tower.receiveShadow = true;
    bGroup.add(tower);

    // Rooftop parapet & HVAC detail
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.6, b.d + 0.4), roofMat);
    parapet.position.y = b.h + 0.3;
    bGroup.add(parapet);

    const hvac = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.35, 1.1, b.d * 0.35), roofMat);
    hvac.position.set(0, b.h + 0.85, 0);
    bGroup.add(hvac);

    bGroup.position.set(b.x, g.sidewalkHeight, b.z);
    envGroup.add(bGroup);
  }

  scene.add(envGroup);
  return signalRefs;
}

function buildRoadArrow(mat: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 1.3), mat);
  shaft.rotation.x = -Math.PI / 2;
  group.add(shaft);

  const headShape = new THREE.Shape();
  headShape.moveTo(0, 0.55);
  headShape.lineTo(-0.42, -0.15);
  headShape.lineTo(0.42, -0.15);
  headShape.closePath();

  const head = new THREE.Mesh(new THREE.ShapeGeometry(headShape), mat);
  head.rotation.x = -Math.PI / 2;
  head.position.z = -0.8;
  group.add(head);
  return group;
}

function buildVehicleSignalPole() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.38,
    metalness: 0.78,
  });
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.3,
  });

  // Vertical mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 5.4, 10), poleMat);
  mast.position.y = 2.7;
  mast.castShadow = true;
  group.add(mast);

  // Horizontal cantilever arm extending over the lane
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.4, 8), poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(-2.0, 5.2, 0);
  arm.castShadow = true;
  group.add(arm);

  // Smart-city AI vision sensor housing mounted on pole
  const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.45), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.2 }));
  camBox.position.set(-0.35, 4.4, 0.25);
  group.add(camBox);
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), housingMat);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(-0.35, 4.38, 0.5);
  group.add(camLens);

  // Signal head box
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 0.42), housingMat);
  head.position.set(-3.2, 4.9, 0);
  head.castShadow = true;
  group.add(head);

  const redMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xef4444,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x22c55e,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });

  const lensGeo = new THREE.SphereGeometry(0.16, 14, 12);
  const redLens = new THREE.Mesh(lensGeo, redMat);
  redLens.position.set(-3.2, 5.33, -0.18);
  group.add(redLens);

  const yellowLens = new THREE.Mesh(lensGeo, yellowMat);
  yellowLens.position.set(-3.2, 4.9, -0.18);
  group.add(yellowLens);

  const greenLens = new THREE.Mesh(lensGeo, greenMat);
  greenLens.position.set(-3.2, 4.47, -0.18);
  group.add(greenLens);

  // Second set of lenses facing slightly outward for visibility from high orbit angle
  const redLensB = new THREE.Mesh(lensGeo, redMat);
  redLensB.position.set(-3.2, 5.33, 0.18);
  group.add(redLensB);
  const yellowLensB = new THREE.Mesh(lensGeo, yellowMat);
  yellowLensB.position.set(-3.2, 4.9, 0.18);
  group.add(yellowLensB);
  const greenLensB = new THREE.Mesh(lensGeo, greenMat);
  greenLensB.position.set(-3.2, 4.47, 0.18);
  group.add(greenLensB);

  return { group, lightMats: { red: redMat, yellow: yellowMat, green: greenMat } };
}

function buildPedestrianSignalPole() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.75,
  });
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.5,
    metalness: 0.3,
  });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 8), poleMat);
  post.position.y = 1.4;
  post.castShadow = true;
  group.add(post);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.78, 0.28), boxMat);
  box.position.y = 2.65;
  box.castShadow = true;
  group.add(box);

  const redMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0xef4444,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });
  const greenMat = new THREE.MeshStandardMaterial({
    color: 0x052e16,
    emissive: 0x22c55e,
    emissiveIntensity: 0.1,
    roughness: 0.25,
  });

  const lensGeo = new THREE.BoxGeometry(0.18, 0.16, 0.32);
  const red = new THREE.Mesh(lensGeo, redMat);
  red.position.y = 2.88;
  group.add(red);

  const yellow = new THREE.Mesh(lensGeo, yellowMat);
  yellow.position.y = 2.65;
  group.add(yellow);

  const green = new THREE.Mesh(lensGeo, greenMat);
  green.position.y = 2.42;
  group.add(green);

  return { group, lightMats: { red: redMat, yellow: yellowMat, green: greenMat } };
}

function buildUrbanTree(scale: number): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x6b4f3a,
    roughness: 0.92,
    metalness: 0.0,
  });
  const leafColors = [0x3f8f45, 0x4ca653, 0x2f7a38];
  const leafMat1 = new THREE.MeshStandardMaterial({
    color: leafColors[Math.floor(Math.random() * leafColors.length)],
    roughness: 0.85,
  });
  const leafMat2 = new THREE.MeshStandardMaterial({
    color: 0x5ab85f,
    roughness: 0.85,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2.2, 8), trunkMat);
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  tree.add(trunk);

  const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 1), leafMat1);
  crown1.position.set(0, 3.1, 0);
  crown1.castShadow = true;
  tree.add(crown1);

  const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.05, 1), leafMat2);
  crown2.position.set(0.65, 2.65, 0.45);
  crown2.castShadow = true;
  tree.add(crown2);

  const crown3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 1), leafMat1);
  crown3.position.set(-0.6, 2.75, -0.4);
  crown3.castShadow = true;
  tree.add(crown3);

  tree.scale.setScalar(scale);
  return tree;
}

export function updateSignalVisuals(
  refs: SignalLightRefs,
  vehicleNS: TrafficLightColor,
  vehicleEW: TrafficLightColor,
  pedestrian: PedestrianSignalColor,
  showOverlay: boolean
): void {
  refs.overlayGroup.visible = showOverlay;

  for (const m of refs.nsVehicles) {
    m.red.emissiveIntensity = vehicleNS === 'RED' ? 2.4 : 0.08;
    m.red.color.setHex(vehicleNS === 'RED' ? 0xef4444 : 0x450a0a);
    m.yellow.emissiveIntensity = vehicleNS === 'YELLOW' ? 2.4 : 0.08;
    m.yellow.color.setHex(vehicleNS === 'YELLOW' ? 0xf59e0b : 0x451a03);
    m.green.emissiveIntensity = vehicleNS === 'GREEN' ? 2.4 : 0.08;
    m.green.color.setHex(vehicleNS === 'GREEN' ? 0x22c55e : 0x052e16);
  }

  for (const m of refs.ewVehicles) {
    m.red.emissiveIntensity = vehicleEW === 'RED' ? 2.4 : 0.08;
    m.red.color.setHex(vehicleEW === 'RED' ? 0xef4444 : 0x450a0a);
    m.yellow.emissiveIntensity = vehicleEW === 'YELLOW' ? 2.4 : 0.08;
    m.yellow.color.setHex(vehicleEW === 'YELLOW' ? 0xf59e0b : 0x451a03);
    m.green.emissiveIntensity = vehicleEW === 'GREEN' ? 2.4 : 0.08;
    m.green.color.setHex(vehicleEW === 'GREEN' ? 0x22c55e : 0x052e16);
  }

  for (const m of refs.pedestrians) {
    m.red.emissiveIntensity = pedestrian === 'RED' ? 2.4 : 0.08;
    m.red.color.setHex(pedestrian === 'RED' ? 0xef4444 : 0x450a0a);
    m.yellow.emissiveIntensity = pedestrian === 'YELLOW' ? 2.4 : 0.08;
    m.yellow.color.setHex(pedestrian === 'YELLOW' ? 0xf59e0b : 0x451a03);
    m.green.emissiveIntensity = pedestrian === 'GREEN' ? 2.4 : 0.08;
    m.green.color.setHex(pedestrian === 'GREEN' ? 0x22c55e : 0x052e16);
  }
}
