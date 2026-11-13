import * as THREE from 'three';
import { INTERSECTION_GEOMETRY } from '../simulation/constants';
import { PedestrianData, PedestrianState } from '../simulation/types';
import { createTrackingLabelTexture } from './proceduralTextures';

export interface PedestrianRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftHip: THREE.Group;
  leftKnee: THREE.Group;
  rightHip: THREE.Group;
  rightKnee: THREE.Group;
  leftShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightShoulder: THREE.Group;
  rightElbow: THREE.Group;
  wheelchairRearWheels?: THREE.Mesh[];
  trackingGroup: THREE.Group;
  ringMesh: THREE.Mesh;
  boxLine: THREE.LineSegments;
  labelSprite: THREE.Sprite;
  lastBadgeKey: string;
}

const STATE_HEX: Record<PedestrianState, string> = {
  APPROACHING: '#64748b',
  WAITING: '#2563eb',
  CROSSING: '#16a34a',
  CROSSED: '#059669',
};

const sharedShadowGeo = new THREE.CircleGeometry(0.32, 16);
const sharedShadowMat = new THREE.MeshBasicMaterial({
  color: 0x0f172a,
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
});

export function buildPedestrianRig(p: PedestrianData): PedestrianRig {
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Ground contact shadow
  const shadowDisc = new THREE.Mesh(sharedShadowGeo, sharedShadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.015;
  root.add(shadowDisc);

  const skinMat = new THREE.MeshStandardMaterial({
    color: p.skinColor,
    roughness: 0.68,
    metalness: 0.02,
  });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: p.outfitColor,
    roughness: 0.82,
    metalness: 0.04,
  });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: p.trouserColor,
    roughness: 0.86,
    metalness: 0.03,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.12,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: p.hairColor,
    roughness: 0.78,
    metalness: 0.05,
  });

  if (p.category === 'wheelchair') {
    const rig = buildWheelchairPerson(p, root, bodyPivot, skinMat, shirtMat, trouserMat, shoeMat, hairMat);
    return rig;
  }

  // Pelvis / hips
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.17), trouserMat);
  pelvis.position.y = 0.89;
  pelvis.castShadow = true;
  bodyPivot.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.29, 0.035, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.45, metalness: 0.25 })
  );
  belt.position.y = 0.95;
  bodyPivot.add(belt);

  // Torso group
  const torso = new THREE.Group();
  torso.position.set(0, 0.96, 0);
  bodyPivot.add(torso);

  // Lower & upper torso taper
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.138, 0.22, 12), shirtMat);
  waist.scale.set(1.05, 1, 0.68);
  waist.position.y = 0.11;
  waist.castShadow = true;
  torso.add(waist);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.178, 0.155, 0.26, 12), shirtMat);
  chest.scale.set(1.12, 1, 0.68);
  chest.position.y = 0.34;
  chest.castShadow = true;
  torso.add(chest);

  // Shoulders cap for natural silhouette
  const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.29, 6, 10), shirtMat);
  shoulders.rotation.z = Math.PI / 2;
  shoulders.position.y = 0.44;
  shoulders.castShadow = true;
  torso.add(shoulders);

  // Office commuter collar + tie
  if (p.category === 'office_worker') {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.24, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 })
    );
    tie.position.set(0, 0.31, 0.125);
    torso.add(tie);
  }

  // Backpack for students and children
  if ((p.category === 'student' || p.category === 'child') && p.hasBag) {
    const packMat = new THREE.MeshStandardMaterial({
      color: p.category === 'child' ? 0xf59e0b : 0x334155,
      roughness: 0.85,
    });
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.13), packMat);
    pack.position.set(0, 0.28, -0.15);
    pack.castShadow = true;
    torso.add(pack);
  }

  // Neck & Head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.09, 10), skinMat);
  neck.position.y = 0.51;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.63, 0);
  torso.add(head);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), skinMat);
  cranium.scale.set(0.88, 1.06, 0.94);
  cranium.castShadow = true;
  head.add(cranium);

  // Subtle nose bridge & eyes so close-up street camera feels lifelike
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.036, 0.026), skinMat);
  nose.position.set(0, -0.008, 0.098);
  head.add(nose);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
  const eyeGeo = new THREE.SphereGeometry(0.011, 8, 8);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.032, 0.015, 0.089);
  head.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.032, 0.015, 0.089);
  head.add(rightEye);

  // Hairstyle variations
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hairCap.scale.set(0.9, 1.04, 0.96);
  hairCap.position.set(0, 0.012, -0.008);
  hairCap.rotation.x = -0.18;
  head.add(hairCap);

  if (p.category === 'adult_female' || p.category === 'student') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), hairMat);
    bun.position.set(0, 0.01, -0.11);
    head.add(bun);
  }

  // Arms (left & right)
  const buildArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.21, 0.43, 0);
    torso.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.04, 0.27, 10), shirtMat);
    upperArm.position.y = -0.135;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.27;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.03, 0.25, 10), skinMat);
    forearm.position.y = -0.125;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034, 10, 8), skinMat);
    hand.scale.set(0.85, 1.2, 0.7);
    hand.position.y = -0.26;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // Briefcase / Tote bag for office commuters
  if (p.category === 'office_worker' && p.hasBag) {
    const briefcase = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.28, 0.36),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.5, metalness: 0.15 })
    );
    briefcase.position.set(0.04, -0.36, 0.02);
    briefcase.castShadow = true;
    rightArm.elbow.add(briefcase);
  }

  // Walking cane for elderly pedestrian
  if (p.hasCane) {
    const caneMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.55 });
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.86, 8), caneMat);
    cane.position.set(0.02, -0.58, 0.06);
    cane.rotation.x = 0.08;
    rightArm.elbow.add(cane);
  }

  // Legs (left & right)
  const buildLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.085, 0.84, 0);
    bodyPivot.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.056, 0.42, 10), trouserMat);
    thigh.position.y = -0.21;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.04, 0.39, 10), trouserMat);
    shin.position.y = -0.195;
    shin.castShadow = true;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.065, 0.21), shoeMat);
    shoe.position.set(0, -0.39, 0.045);
    shoe.castShadow = true;
    knee.add(shoe);

    return { hip, knee };
  };

  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  // Subtle forward stoop for elderly pedestrians
  if (p.category === 'elderly') {
    torso.rotation.x = 0.1;
  }

  bodyPivot.scale.setScalar(p.heightScale);

  const { trackingGroup, ringMesh, boxLine, labelSprite } = buildTrackingOverlay(p);
  root.add(trackingGroup);

  return {
    root,
    bodyPivot,
    torso,
    head,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    trackingGroup,
    ringMesh,
    boxLine,
    labelSprite,
    lastBadgeKey: '',
  };
}

function buildWheelchairPerson(
  p: PedestrianData,
  root: THREE.Group,
  bodyPivot: THREE.Group,
  skinMat: THREE.Material,
  shirtMat: THREE.Material,
  trouserMat: THREE.Material,
  shoeMat: THREE.Material,
  hairMat: THREE.Material
): PedestrianRig {
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.78,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.25,
    metalness: 0.85,
  });

  // Wheelchair chassis
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.44), cushionMat);
  seat.position.set(0, 0.5, 0);
  seat.castShadow = true;
  bodyPivot.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.06), cushionMat);
  backrest.position.set(0, 0.76, -0.2);
  backrest.castShadow = true;
  bodyPivot.add(backrest);

  // Side armrests
  for (const s of [-1, 1]) {
    const armRest = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.38), frameMat);
    armRest.position.set(s * 0.25, 0.68, -0.02);
    bodyPivot.add(armRest);
  }

  // Footrest
  const footRest = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.16), frameMat);
  footRest.position.set(0, 0.16, 0.3);
  bodyPivot.add(footRest);

  // Large Rear Wheels + Push Rims
  const rearWheels: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.032, 10, 24), tireMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(s * 0.3, 0.3, -0.06);
    wheel.castShadow = true;
    bodyPivot.add(wheel);

    const pushRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 8, 20), rimMat);
    pushRim.rotation.y = Math.PI / 2;
    pushRim.position.set(s * 0.33, 0.3, -0.06);
    bodyPivot.add(pushRim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 10), rimMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(s * 0.3, 0.3, -0.06);
    bodyPivot.add(hub);

    rearWheels.push(wheel);

    // Small front caster wheel
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.035, 12), tireMat);
    caster.rotation.z = Math.PI / 2;
    caster.position.set(s * 0.21, 0.08, 0.26);
    bodyPivot.add(caster);
  }

  // Seated articulated human
  const torso = new THREE.Group();
  torso.position.set(0, 0.54, -0.06);
  bodyPivot.add(torso);

  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.145, 0.44, 12), shirtMat);
  chest.scale.set(1.08, 1, 0.68);
  chest.position.y = 0.22;
  chest.castShadow = true;
  torso.add(chest);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.08, 10), skinMat);
  neck.position.y = 0.47;
  torso.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 0.58, 0.01);
  torso.add(head);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.102, 14, 12), skinMat);
  cranium.scale.set(0.88, 1.05, 0.94);
  cranium.castShadow = true;
  head.add(cranium);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.107, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hairCap.position.set(0, 0.01, -0.008);
  head.add(hairCap);

  // Seated legs (thighs forward, shins down to footrest)
  const buildSeatedLeg = (side: -1 | 1) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.095, 0.54, 0.02);
    hip.rotation.x = -Math.PI / 2 + 0.1;
    bodyPivot.add(hip);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.054, 0.36, 10), trouserMat);
    thigh.position.y = -0.18;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.36;
    knee.rotation.x = Math.PI / 2 - 0.15;
    hip.add(knee);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.04, 0.34, 10), trouserMat);
    shin.position.y = -0.17;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.06, 0.19), shoeMat);
    shoe.position.set(0, -0.34, 0.04);
    knee.add(shoe);

    return { hip, knee };
  };

  const leftLeg = buildSeatedLeg(-1);
  const rightLeg = buildSeatedLeg(1);

  const buildWheelArm = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.21, 0.4, 0);
    torso.add(shoulder);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.24, 8), shirtMat);
    upperArm.position.y = -0.12;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.24;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.22, 8), skinMat);
    forearm.position.y = -0.11;
    elbow.add(forearm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
    hand.position.y = -0.22;
    elbow.add(hand);

    return { shoulder, elbow };
  };

  const leftArm = buildWheelArm(-1);
  const rightArm = buildWheelArm(1);

  const { trackingGroup, ringMesh, boxLine, labelSprite } = buildTrackingOverlay(p);
  root.add(trackingGroup);

  return {
    root,
    bodyPivot,
    torso,
    head,
    leftHip: leftLeg.hip,
    leftKnee: leftLeg.knee,
    rightHip: rightLeg.hip,
    rightKnee: rightLeg.knee,
    leftShoulder: leftArm.shoulder,
    leftElbow: leftArm.elbow,
    rightShoulder: rightArm.shoulder,
    rightElbow: rightArm.elbow,
    wheelchairRearWheels: rearWheels,
    trackingGroup,
    ringMesh,
    boxLine,
    labelSprite,
    lastBadgeKey: '',
  };
}

function buildTrackingOverlay(p: PedestrianData) {
  const trackingGroup = new THREE.Group();
  const colorHex = STATE_HEX[p.state];

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.38, 0.46, 24),
    new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.035;
  trackingGroup.add(ringMesh);

  const boxHeight = p.category === 'wheelchair' ? 1.32 : 1.78 * p.heightScale;
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.68, boxHeight, 0.68));
  const boxLine = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 })
  );
  boxLine.position.y = boxHeight / 2;
  trackingGroup.add(boxLine);

  const labelTex = createTrackingLabelTexture(`${p.id} · ${p.state.slice(0, 4)}`, colorHex);
  const spriteMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false });
  const labelSprite = new THREE.Sprite(spriteMat);
  labelSprite.position.set(0, boxHeight + 0.38, 0);
  labelSprite.scale.set(1.55, 0.39, 1);
  labelSprite.renderOrder = 20;
  trackingGroup.add(labelSprite);

  return { trackingGroup, ringMesh, boxLine, labelSprite };
}

export function updatePedestrianRig(
  rig: PedestrianRig,
  p: PedestrianData,
  showOverlay: boolean,
  elapsedTime: number
): void {
  // Smooth ground height transition between sidewalk (0.16m) and asphalt road (0.02m)
  const onRoadX = Math.abs(p.x) < INTERSECTION_GEOMETRY.roadHalfWidth;
  const onRoadZ = Math.abs(p.z) < INTERSECTION_GEOMETRY.roadHalfWidth;
  const groundY = onRoadX || onRoadZ ? 0.015 : INTERSECTION_GEOMETRY.sidewalkHeight;

  rig.root.position.set(p.x, groundY, p.z);
  rig.bodyPivot.rotation.y = p.heading;

  const isMoving = p.currentSpeed > 0.08;

  if (p.category === 'wheelchair') {
    const pushSwing = isMoving ? Math.sin(p.walkPhase * 0.9) * 0.35 : 0;
    rig.leftShoulder.rotation.x = -0.25 + pushSwing;
    rig.rightShoulder.rotation.x = -0.25 + pushSwing;
    rig.leftElbow.rotation.x = -0.55 - pushSwing * 0.4;
    rig.rightElbow.rotation.x = -0.55 - pushSwing * 0.4;
    if (rig.wheelchairRearWheels && isMoving) {
      for (const w of rig.wheelchairRearWheels) {
        w.rotation.x = p.walkPhase * 0.6;
      }
    }
  } else if (isMoving) {
    // Natural human bipedal walk cycle
    const phase = p.walkPhase;
    const stride = 0.56;
    const armSwing = 0.42;

    const leftLegAngle = Math.sin(phase) * stride;
    const rightLegAngle = Math.sin(phase + Math.PI) * stride;

    rig.leftHip.rotation.x = leftLegAngle;
    rig.rightHip.rotation.x = rightLegAngle;

    // Knee bends naturally during swing forward / pushoff
    rig.leftKnee.rotation.x = Math.max(0, -Math.cos(phase) * 0.62);
    rig.rightKnee.rotation.x = Math.max(0, -Math.cos(phase + Math.PI) * 0.62);

    // Opposite arm swings forward with leg
    rig.leftShoulder.rotation.x = rightLegAngle * armSwing;
    rig.rightShoulder.rotation.x = leftLegAngle * (p.hasCane ? 0.25 : armSwing);
    rig.leftElbow.rotation.x = -0.22 - Math.max(0, -rightLegAngle) * 0.28;
    rig.rightElbow.rotation.x = p.hasCane ? -0.35 : -0.22 - Math.max(0, -leftLegAngle) * 0.28;

    // Subtle vertical hip bob and torso twist
    rig.bodyPivot.position.y = Math.abs(Math.sin(phase)) * 0.028;
    rig.torso.rotation.y = Math.sin(phase) * 0.06;
  } else {
    // Natural standing idle pose with subtle breathing/head glance
    rig.leftHip.rotation.x *= 0.85;
    rig.rightHip.rotation.x *= 0.85;
    rig.leftKnee.rotation.x *= 0.85;
    rig.rightKnee.rotation.x *= 0.85;
    rig.leftShoulder.rotation.x *= 0.85;
    rig.rightShoulder.rotation.x *= 0.85;
    rig.leftElbow.rotation.x = -0.1;
    rig.rightElbow.rotation.x = p.hasCane ? -0.25 : -0.1;
    rig.bodyPivot.position.y = 0;
    rig.torso.rotation.y = 0;
    rig.head.rotation.y = Math.sin(elapsedTime * 1.1 + p.walkPhase) * 0.14;
  }

  // Update tracking overlay
  rig.trackingGroup.visible = showOverlay;
  if (showOverlay) {
    const key = `${p.id}_${p.state}`;
    if (rig.lastBadgeKey !== key) {
      rig.lastBadgeKey = key;
      const colorHex = STATE_HEX[p.state];
      (rig.ringMesh.material as THREE.MeshBasicMaterial).color.set(colorHex);
      (rig.boxLine.material as THREE.LineBasicMaterial).color.set(colorHex);
      const shortState =
        p.state === 'APPROACHING'
          ? 'APPR'
          : p.state === 'WAITING'
            ? 'WAIT'
            : p.state === 'CROSSING'
              ? 'CROS'
              : 'DONE';
      const oldMap = (rig.labelSprite.material as THREE.SpriteMaterial).map;
      (rig.labelSprite.material as THREE.SpriteMaterial).map = createTrackingLabelTexture(
        `${p.id} · ${shortState}`,
        colorHex
      );
      oldMap?.dispose();
    }
  }
}

export function disposePedestrianRig(rig: PedestrianRig): void {
  rig.root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
      if (obj.geometry !== sharedShadowGeo) {
        obj.geometry.dispose();
      }
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (m !== sharedShadowMat) m.dispose();
        });
      } else if (obj.material !== sharedShadowMat) {
        obj.material.dispose();
      }
    } else if (obj instanceof THREE.Sprite) {
      obj.material.map?.dispose();
      obj.material.dispose();
    }
  });
}
