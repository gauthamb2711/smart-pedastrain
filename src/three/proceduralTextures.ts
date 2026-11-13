import * as THREE from 'three';

export function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#4b525c';
  ctx.fillRect(0, 0, 512, 512);

  // Fine mineral aggregate speckle
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 58 + Math.floor(Math.random() * 44);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSidewalkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#d6dbe0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle paving tile grid
  ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Subtle stone grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 195 + Math.floor(Math.random() * 35);
    ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},0.35)`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBuildingFacadeTexture(
  baseColor: string,
  accentColor: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle floor slab lines
  ctx.fillStyle = accentColor;
  for (let y = 32; y < 512; y += 48) {
    ctx.fillRect(0, y, 256, 4);
  }

  // Modern architectural windows
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = 18 + col * 58;
      const wy = 44 + row * 48;
      // Glass reflection gradient
      const grad = ctx.createLinearGradient(wx, wy, wx + 40, wy + 28);
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(0.5, '#38bdf8');
      grad.addColorStop(1, '#1e3a5f');
      ctx.fillStyle = grad;
      ctx.fillRect(wx, wy, 40, 28);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, 40, 28);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createTrackingLabelTexture(text: string, badgeColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 64);

  // Clean crisp pill background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 48, 12);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = badgeColor;
  ctx.stroke();

  // Status swatch
  ctx.fillStyle = badgeColor;
  ctx.beginPath();
  ctx.arc(30, 32, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 23px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 48, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
