import * as THREE from 'three';
import { VehicleData } from '../simulation/types';

export interface VehicleRig {
  root: THREE.Group;
  wheels: THREE.Mesh[];
  brakeLights: THREE.MeshStandardMaterial;
}

const tireMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.85,
  metalness: 0.08,
});
const rimMat = new THREE.MeshStandardMaterial({
  color: 0xd1d5db,
  roughness: 0.25,
  metalness: 0.85,
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x1e293b,
  roughness: 0.12,
  metalness: 0.15,
  clearcoat: 1.0,
  clearcoatRoughness: 0.08,
});
const headlightMat = new THREE.MeshStandardMaterial({
  color: 0xfef9c3,
  emissive: 0xfef08a,
  emissiveIntensity: 0.7,
  roughness: 0.2,
});
const bumperMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.65,
  metalness: 0.15,
});

export function buildVehicleRig(v: VehicleData): VehicleRig {
  const root = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const brakeLights = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.2,
    roughness: 0.3,
  });

  const bodyPaint = new THREE.MeshPhysicalMaterial({
    color: v.color,
    roughness: 0.3,
    metalness: 0.35,
    clearcoat: 0.85,
    clearcoatRoughness: 0.15,
  });

  if (v.type === 'car') {
    // Lower chassis
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.56, 4.1), bodyPaint);
    lower.position.y = 0.52;
    lower.castShadow = true;
    lower.receiveShadow = true;
    root.add(lower);

    // Upper cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.52, 2.2), bodyPaint);
    cabin.position.set(0, 1.02, -0.15);
    cabin.castShadow = true;
    root.add(cabin);

    // Windshields & side glass
    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.42, 0.08), glassMat);
    frontGlass.position.set(0, 1.0, 0.96);
    frontGlass.rotation.x = -0.22;
    root.add(frontGlass);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.38, 0.08), glassMat);
    rearGlass.position.set(0, 1.0, -1.25);
    rearGlass.rotation.x = 0.22;
    root.add(rearGlass);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.36, 1.85), glassMat);
    sideGlass.position.set(0, 1.02, -0.15);
    root.add(sideGlass);

    // Bumpers
    const fBump = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.18, 0.16), bumperMat);
    fBump.position.set(0, 0.32, 2.04);
    root.add(fBump);
    const rBump = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.18, 0.16), bumperMat);
    rBump.position.set(0, 0.32, -2.04);
    root.add(rBump);

    // Headlights & Taillights
    for (const s of [-0.66, 0.66]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.08), headlightMat);
      hl.position.set(s, 0.56, 2.04);
      root.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.08), brakeLights);
      tl.position.set(s, 0.58, -2.04);
      root.add(tl);
    }

    // 4 Wheels
    for (const [wx, wz] of [
      [-0.86, 1.28],
      [0.86, 1.28],
      [-0.86, -1.28],
      [0.86, -1.28],
    ]) {
      wheels.push(addWheel(root, wx, 0.32, wz, 0.32, 0.2));
    }
  } else if (v.type === 'bus') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.3, 8.2), bodyPaint);
    body.position.y = 1.52;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    const roofBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.28, 8.22),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    roofBand.position.y = 2.55;
    root.add(roofBand);

    // AC units on roof
    for (const az of [-1.6, 1.4]) {
      const ac = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.24, 1.5),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 })
      );
      ac.position.set(0, 2.8, az);
      root.add(ac);
    }

    // Windshield & side window strip
    const frontWin = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.95, 0.08), glassMat);
    frontWin.position.set(0, 1.85, 4.1);
    root.add(frontWin);

    const sideWin = new THREE.Mesh(new THREE.BoxGeometry(2.41, 0.85, 7.1), glassMat);
    sideWin.position.set(0, 1.88, -0.1);
    root.add(sideWin);

    for (const s of [-0.85, 0.85]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headlightMat);
      hl.position.set(s, 0.65, 4.1);
      root.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.08), brakeLights);
      tl.position.set(s, 0.72, -4.1);
      root.add(tl);
    }

    for (const [wx, wz] of [
      [-1.12, 2.4],
      [1.12, 2.4],
      [-1.12, -2.4],
      [1.12, -2.4],
    ]) {
      wheels.push(addWheel(root, wx, 0.44, wz, 0.44, 0.26));
    }
  } else if (v.type === 'autorickshaw') {
    // Iconic Indian 3-wheeler auto-rickshaw
    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.26, 0.68, 2.35),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.45, metalness: 0.2 })
    );
    lowerBody.position.y = 0.56;
    lowerBody.castShadow = true;
    root.add(lowerBody);

    // Yellow canopy top
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, 0.88, 2.15),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 })
    );
    canopy.position.set(0, 1.32, -0.05);
    canopy.castShadow = true;
    root.add(canopy);

    // Front cowl & windshield
    const frontShield = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.55, 0.08), glassMat);
    frontShield.position.set(0, 1.24, 1.06);
    frontShield.rotation.x = -0.18;
    root.add(frontShield);

    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), headlightMat);
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.68, 1.18);
    root.add(hl);

    for (const s of [-0.46, 0.46]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), brakeLights);
      tl.position.set(s, 0.56, -1.18);
      root.add(tl);
    }

    // 3 Wheels (1 front, 2 rear)
    wheels.push(addWheel(root, 0, 0.24, 0.92, 0.24, 0.14));
    wheels.push(addWheel(root, -0.58, 0.24, -0.78, 0.24, 0.14));
    wheels.push(addWheel(root, 0.58, 0.24, -0.78, 0.24, 0.14));
  } else {
    // Two-wheeler scooter/motorcycle with helmeted rider
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 1.55), bodyPaint);
    chassis.position.set(0, 0.52, 0);
    chassis.castShadow = true;
    root.add(chassis);

    const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.66, 8), bumperMat);
    handlebars.rotation.z = Math.PI / 2;
    handlebars.position.set(0, 1.02, 0.52);
    root.add(handlebars);

    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), headlightMat);
    hl.position.set(0, 0.85, 0.72);
    root.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.06), brakeLights);
    tl.position.set(0, 0.68, -0.78);
    root.add(tl);

    // Rider seated naturally
    const riderTorso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.13, 0.46, 10),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    riderTorso.position.set(0, 1.08, -0.08);
    riderTorso.rotation.x = 0.18;
    riderTorso.castShadow = true;
    root.add(riderTorso);

    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 12, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.2, clearcoat: 0.9 })
    );
    helmet.position.set(0, 1.43, -0.02);
    helmet.castShadow = true;
    root.add(helmet);

    wheels.push(addWheel(root, 0, 0.26, 0.62, 0.26, 0.1));
    wheels.push(addWheel(root, 0, 0.26, -0.62, 0.26, 0.1));
  }

  return { root, wheels, brakeLights };
}

function addWheel(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  width: number
): THREE.Mesh {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, y, z);
  wheel.castShadow = true;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.02, 10), rimMat);
  wheel.add(hub);

  parent.add(wheel);
  return wheel;
}

export function updateVehicleRig(rig: VehicleRig, v: VehicleData): void {
  rig.root.position.set(v.x, 0, v.z);
  if (v.axis === 'NS') {
    rig.root.rotation.y = v.dir === 1 ? 0 : Math.PI;
  } else {
    rig.root.rotation.y = v.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  for (const w of rig.wheels) {
    w.rotation.x = v.wheelAngle;
  }

  // Illuminate brake lights when slowing or stopped
  const braking = v.speed < 0.8;
  rig.brakeLights.emissiveIntensity = braking ? 1.8 : 0.25;
}

export function disposeVehicleRig(rig: VehicleRig): void {
  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (obj.material !== tireMat && obj.material !== rimMat && obj.material !== glassMat && obj.material !== headlightMat && obj.material !== bumperMat) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    }
  });
}
