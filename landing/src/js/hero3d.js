/* ==========================================================================
   hero3d.js — Escena 3D del hero (Three.js, WebGL)
   Desde el asiento trasero: el chofer de TeLlevo maneja tu auto de noche por
   una avenida de Santiago. Acabado de animación 3D: luz cálida de faroles contra
   la noche azul, resplandor (bloom), niebla atmosférica y formas redondeadas.

   Mejora progresiva: la escena SVG del HTML queda como respaldo. Este módulo
   se carga después de la página, solo si hay WebGL y no se pidió reducir el
   movimiento; al dibujar el primer cuadro reemplaza al SVG con un fundido.
   ========================================================================== */

const BRAND = {
  navy: 0x0a1628,
  navyMid: 0x1b3a6b,
  gold: 0xc9a84c,
  goldBright: 0xf0c040,
  goldPale: 0xf5dfa0,
};
const SPEED = 15;          // m/s de avance de la ciudad
const LAMP_GAP = 14;       // distancia entre faroles
const ROAD_LENGTH = 168;   // tramo que se recicla (múltiplo de LAMP_GAP)

const stage = document.querySelector('.hero-stage');

const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
};

/**
 * Textura de canvas: se usa para el cielo, las ventanas, la pantalla del tablero
 * y el emblema del colgante, sin descargar imágenes.
 */
const canvasTexture = (THREE, width, height, draw) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

const drawWheelEmblem = (ctx, cx, cy, r, color) => {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.16;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = r * 0.14;
  [[-0.95, -0.3], [0.95, -0.3], [0, 1]].forEach(([dx, dy]) => {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * r * 0.82, cy + dy * r * 0.82); ctx.stroke();
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2); ctx.fill();
};

async function start() {
  const THREE = await import('three');
  const { RoundedBoxGeometry } = await import('three/addons/geometries/RoundedBoxGeometry.js');
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
  const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');

  const isSmall = window.matchMedia('(max-width: 767px)').matches;

  // ── Renderizador ───────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: !isSmall, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isSmall ? 1.35 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 'hero-stage__canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1a2a52, 30, 330);

  const camera = new THREE.PerspectiveCamera(50, 2.4, 0.05, 400);
  const CAMERA_BASE = new THREE.Vector3(0.1, 1.36, 1.75);
  camera.position.copy(CAMERA_BASE);
  camera.lookAt(0.02, 1.16, -10);

  // ── Materiales ─────────────────────────────────────────────────────────────
  const mat = (color, roughness = 0.6, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const glow = (color, intensity = 3) =>
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity });

  const M = {
    leather: new THREE.MeshPhysicalMaterial({ color: 0x2a2232, roughness: 0.42, sheen: 0.6, sheenColor: 0x6a5a80, sheenRoughness: 0.5 }),
    stitch: glow(BRAND.gold, 0.6),
    dash: mat(0x1c1822, 0.55),
    suit: new THREE.MeshPhysicalMaterial({ color: 0x1d3466, roughness: 0.55, sheen: 0.8, sheenColor: 0x5a7ac0, sheenRoughness: 0.4 }),
    skin: new THREE.MeshPhysicalMaterial({ color: 0xc98d68, roughness: 0.55, sheen: 0.4, sheenColor: 0xff9c78 }),
    hair: new THREE.MeshPhysicalMaterial({ color: 0x2b1d15, roughness: 0.35, sheen: 1, sheenColor: 0x8a6a50, sheenRoughness: 0.3 }),
    cap: new THREE.MeshPhysicalMaterial({ color: 0x101a36, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.2 }),
    goldMetal: new THREE.MeshStandardMaterial({ color: 0xe0b44a, roughness: 0.28, metalness: 1 }),
    glove: new THREE.MeshPhysicalMaterial({ color: 0xf4f0e6, roughness: 0.7, sheen: 0.5, sheenColor: 0xffffff }),
    wheel: new THREE.MeshPhysicalMaterial({ color: 0x1a120e, roughness: 0.4, clearcoat: 0.6 }),
    trim: mat(0x1a1f2e, 0.85, { side: THREE.DoubleSide }),
    road: new THREE.MeshStandardMaterial({ color: 0x23273a, roughness: 0.38, metalness: 0.15 }),
    sidewalk: mat(0x1a2236, 0.8),
    pole: mat(0x2a3858, 0.4, { metalness: 0.6 }),
    lampBulb: glow(0xffd58a, 6),
    trunk: mat(0x2a1a12, 0.9),
    leaf: new THREE.MeshPhysicalMaterial({ color: 0x2a6e5e, roughness: 0.8, sheen: 0.6, sheenColor: 0x7fd6b0, emissive: 0x0e2e28, emissiveIntensity: 0.8 }),
    dashLine: glow(0xe8eaf0, 0.6),
    goldLine: glow(BRAND.goldBright, 0.9),
    tail: glow(0xff3b30, 5),
    head: glow(0xf4f8ff, 8),
    carBody: new THREE.MeshPhysicalMaterial({ color: 0x24345c, roughness: 0.3, metalness: 0.4, clearcoat: 1 }),
    ledStrip: glow(BRAND.goldBright, 2.4),
    doorLed: glow(BRAND.goldBright, 0.35),
    mountain: mat(0x2c3c70, 0.95),
    snow: mat(0xdfe8ff, 0.7, { emissive: 0x405080, emissiveIntensity: 0.25 }),
  };

  // ── Cielo, luna y cordillera ───────────────────────────────────────────────
  const skyTexture = canvasTexture(THREE, 16, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#081530');
    g.addColorStop(0.45, '#16306a');
    g.addColorStop(0.5, '#3a3f78');
    g.addColorStop(0.53, '#8a5a70');
    g.addColorStop(0.6, '#16244a');
    g.addColorStop(1, '#0a1226');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false }));
  scene.add(sky);

  const stars = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 260; i++) {
    const theta = Math.random() * Math.PI - Math.PI / 2;
    const phi = 0.12 + Math.random() * 0.5;
    starPositions.push(Math.sin(theta) * 280, Math.sin(phi) * 280, -Math.cos(theta) * 280 * Math.cos(phi));
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starField = new THREE.Points(stars, new THREE.PointsMaterial({ color: BRAND.goldPale, size: 1.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  scene.add(starField);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false }));
  moon.position.set(46, 40, -230);
  scene.add(moon);

  const mountains = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const height = 40 + Math.random() * 40;
    const radius = 50 + Math.random() * 30;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7, 1), M.mountain);
    peak.position.set(-200 + i * 50 + Math.random() * 20, height / 2 - 8, -215 - Math.random() * 25);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.3, height * 0.3, 7, 1), M.snow);
    snow.position.y = height * 0.35 + 0.2;
    peak.add(snow);
    mountains.add(peak);
  }
  scene.add(mountains);

  // ── Ciudad que pasa (se recicla cada ROAD_LENGTH metros) ───────────────────
  const city = new THREE.Group();
  scene.add(city);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(13, 400), M.road);
  road.rotation.x = -Math.PI / 2;
  road.position.set(-1.6, 0, -180);
  scene.add(road);
  [-9.6, 6.4].forEach((x) => {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.18, 400), M.sidewalk);
    walk.position.set(x, 0.09, -180);
    scene.add(walk);
  });
  [[-1.7, M.goldLine, 0.14], [4.7, M.dashLine, 0.1]].forEach(([x, material, width]) => {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(width, 400), material);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.012, -180);
    scene.add(line);
  });

  // Líneas segmentadas del carril
  const dashGeo = new THREE.PlaneGeometry(0.13, 3);
  for (let z = 0; z < ROAD_LENGTH; z += 7) {
    const dash = new THREE.Mesh(dashGeo, M.dashLine);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(1.5, 0.013, -z);
    city.add(dash);
  }

  // Faroles: poste curvo, pantalla redonda y foco que florece con el bloom
  const lampHeadGeo = new RoundedBoxGeometry(1.1, 0.22, 0.5, 3, 0.1);
  const bulbGeo = new THREE.SphereGeometry(0.22, 16, 8);
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 7, 10);
  const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8);
  const makeLamp = (x, dir) => {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, M.pole); pole.position.y = 3.5; lamp.add(pole);
    const arm = new THREE.Mesh(armGeo, M.pole); arm.rotation.z = Math.PI / 2; arm.position.set(dir * 0.9, 6.95, 0); lamp.add(arm);
    const head = new THREE.Mesh(lampHeadGeo, M.pole); head.position.set(dir * 1.8, 6.9, 0); lamp.add(head);
    const bulb = new THREE.Mesh(bulbGeo, M.lampBulb); bulb.scale.set(1.6, 0.5, 1); bulb.position.set(dir * 1.8, 6.76, 0); lamp.add(bulb);
    lamp.position.x = x;
    return lamp;
  };
  // Árboles de copa redonda entre faroles
  const leafGeo = new THREE.IcosahedronGeometry(1, 2);
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 2.4, 8);
  const makeTree = (x) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, M.trunk); trunk.position.y = 1.2; tree.add(trunk);
    [[0, 3.3, 0, 1.5], [-0.8, 2.8, 0.3, 1.1], [0.8, 2.9, -0.2, 1.15], [0.1, 2.5, 0.7, 1.0]].forEach(([lx, ly, lz, s]) => {
      const leaf = new THREE.Mesh(leafGeo, M.leaf);
      leaf.position.set(lx, ly, lz); leaf.scale.setScalar(s);
      tree.add(leaf);
    });
    tree.position.x = x;
    return tree;
  };
  const lampsForLight = [];
  for (let z = 0; z < ROAD_LENGTH; z += LAMP_GAP) {
    const right = makeLamp(6.2, -1); right.position.z = -z; city.add(right); lampsForLight.push(right);
    const median = makeLamp(-1.9, 1); median.position.z = -z - LAMP_GAP / 2; city.add(median);
    const treeR = makeTree(7.6); treeR.position.z = -z - LAMP_GAP / 2; city.add(treeR);
    const treeL = makeTree(-9.4); treeL.position.z = -z; city.add(treeL);
  }

  // Edificios con ventanas encendidas
  const windowTexture = canvasTexture(THREE, 64, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0e1834'; ctx.fillRect(0, 0, w, h);
    for (let y = 6; y < h; y += 10) {
      for (let x = 5; x < w; x += 10) {
        if (Math.random() < 0.45) {
          ctx.fillStyle = Math.random() < 0.8 ? '#ffcf7a' : '#9fc2ff';
          ctx.fillRect(x, y, 5, 5);
        }
      }
    }
  });
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2a50, emissiveMap: windowTexture, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.8 });
  for (let z = 0; z < ROAD_LENGTH; z += 12) {
    [-1, 1].forEach((side) => {
      const h = 6 + Math.random() * 14;
      const b = new THREE.Mesh(new RoundedBoxGeometry(8, h, 9, 2, 0.4), buildingMaterial);
      b.position.set(side * (30 + Math.random() * 8), h / 2, -z - Math.random() * 6);
      city.add(b);
    });
  }

  // Luces reales que viajan con los faroles: iluminan el camino y el interior al pasar
  const travelLights = [0, 1, 2].map(() => {
    const light = new THREE.PointLight(0xffc46b, 10, 16, 1.8);
    scene.add(light);
    return light;
  });

  // ── Sedán: perfil lateral real (capó, parabrisas inclinado, techo, luneta y maleta)
  // extruido a lo ancho con bisel, cabina de vidrio más angosta, ruedas y luces. ──
  const sedanProfile = () => {
    const p = new THREE.Shape();
    p.moveTo(-2.3, 0.32);                                   // parachoques trasero, abajo
    p.lineTo(-2.32, 0.72);
    p.quadraticCurveTo(-2.32, 0.94, -2.12, 0.96);           // maleta
    p.lineTo(-1.5, 0.98);
    p.lineTo(1.1, 0.95);                                    // línea de cintura hasta el capó
    p.quadraticCurveTo(2.0, 0.9, 2.22, 0.78);               // capó
    p.quadraticCurveTo(2.34, 0.7, 2.32, 0.5);               // trompa
    p.lineTo(2.28, 0.32);
    // pasos de rueda
    p.lineTo(1.78, 0.32); p.absarc(1.42, 0.32, 0.38, 0, Math.PI, false);
    p.lineTo(-1.06, 0.32); p.absarc(-1.42, 0.32, 0.38, 0, Math.PI, false);
    p.lineTo(-2.3, 0.32);
    return p;
  };
  const greenhouseProfile = () => {
    const g = new THREE.Shape();
    g.moveTo(-1.5, 0.96);
    g.quadraticCurveTo(-1.05, 1.4, -0.55, 1.44);             // luneta
    g.lineTo(0.35, 1.45);                                   // techo
    g.quadraticCurveTo(0.7, 1.42, 1.15, 0.96);              // parabrisas
    g.lineTo(-1.5, 0.96);
    return g;
  };
  const extrude = (shape, depth, bevel) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, steps: 1, curveSegments: 14,
      bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4,
    });
    geo.translate(0, 0, -depth / 2);
    return geo;
  };
  const bodyGeo = extrude(sedanProfile(), 1.56, 0.1);
  const glassGeo = extrude(greenhouseProfile(), 1.3, 0.08);
  const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 24);
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.27, 16);
  const stripGeo = new RoundedBoxGeometry(0.06, 0.1, 1.5, 2, 0.03);
  const lampGeo = new RoundedBoxGeometry(0.06, 0.12, 0.34, 2, 0.04);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0a1226, roughness: 0.08, metalness: 0.2, clearcoat: 1 });
  const tyreMat = mat(0x0a0a0e, 0.9);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa4bc, roughness: 0.3, metalness: 0.9 });

  /** Sedán con el frente hacia +x; `lightMaterial` va adelante (focos) o atrás (pilotos). */
  const makeSedan = (lightMaterial, lightsAtFront) => {
    const car = new THREE.Group();
    car.add(new THREE.Mesh(bodyGeo, M.carBody));
    car.add(new THREE.Mesh(glassGeo, glassMat));
    [[1.42, 0.86], [1.42, -0.86], [-1.42, 0.86], [-1.42, -0.86]].forEach(([x, z]) => {
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.rotation.x = Math.PI / 2; tyre.position.set(x, 0.34, z); car.add(tyre);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.34, z); car.add(rim);
    });
    if (lightsAtFront) {
      [-0.6, 0.6].forEach((z) => {
        const lamp = new THREE.Mesh(lampGeo, lightMaterial);
        lamp.position.set(2.44, 0.66, z); car.add(lamp);
      });
    } else {
      const strip = new THREE.Mesh(stripGeo, lightMaterial);   // piloto de lado a lado
      strip.position.set(-2.46, 0.8, 0); car.add(strip);
    }
    return car;
  };
  const leadCar = makeSedan(M.tail, false);
  leadCar.rotation.y = Math.PI / 2;            // el frente mira al horizonte: vemos su cola
  leadCar.position.set(0, 0, -26);
  scene.add(leadCar);
  const oncoming = makeSedan(M.head, true);
  oncoming.rotation.y = -Math.PI / 2;          // viene hacia nosotros por la pista contraria
  oncoming.position.set(-5, 0, -200);
  scene.add(oncoming);

  // ── Interior del auto (fijo respecto de la cámara) ─────────────────────────
  const cabin = new THREE.Group();
  scene.add(cabin);

  /** Rectángulo con esquinas redondeadas como trazado (para los huecos de las ventanas). */
  const roundedRect = (path, x0, y0, x1, y1, r) => {
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0); path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r); path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1); path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r); path.quadraticCurveTo(x0, y0, x0 + r, y0);
    return path;
  };

  // Marco del parabrisas: techo, pilares A y tablero forman un solo contorno con el vidrio
  // trapezoidal de esquinas redondeadas (más angosto arriba, como en un auto real).
  const frameShape = new THREE.Shape();
  frameShape.moveTo(-4, -1); frameShape.lineTo(4, -1); frameShape.lineTo(4, 3); frameShape.lineTo(-4, 3); frameShape.lineTo(-4, -1);
  const windshield = new THREE.Path();
  windshield.moveTo(-1.42, 0.96);
  windshield.lineTo(1.42, 0.96);
  windshield.quadraticCurveTo(1.6, 0.96, 1.58, 1.12);
  windshield.lineTo(1.34, 1.86);
  windshield.quadraticCurveTo(1.28, 1.98, 1.1, 1.99);
  windshield.quadraticCurveTo(0, 2.04, -1.1, 1.99);
  windshield.quadraticCurveTo(-1.28, 1.98, -1.34, 1.86);
  windshield.lineTo(-1.58, 1.12);
  windshield.quadraticCurveTo(-1.6, 0.96, -1.42, 0.96);
  frameShape.holes.push(windshield);
  const windshieldFrame = new THREE.Mesh(new THREE.ShapeGeometry(frameShape, 16), M.trim);
  windshieldFrame.position.z = -1.12;
  cabin.add(windshieldFrame);
  // Borde interior del parabrisas: un reflejo cálido muy tenue que dibuja el vidrio
  const edgePoints = windshield.getPoints(48).map((pt) => new THREE.Vector3(pt.x, pt.y, -1.11));
  const edge = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edgePoints),
    new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.22 }));
  cabin.add(edge);

  // Techo tapizado
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), M.trim);
  roof.rotation.x = Math.PI / 2; roof.position.set(0, 2.0, 0.5);
  cabin.add(roof);

  // Costados: puertas y ventanas laterales con pilar B, y su línea de luz ambiente dorada
  [-1, 1].forEach((side) => {
    const sideShape = new THREE.Shape();
    sideShape.moveTo(-1.12, -0.2); sideShape.lineTo(2.6, -0.2); sideShape.lineTo(2.6, 2.2); sideShape.lineTo(-1.12, 2.2); sideShape.lineTo(-1.12, -0.2);
    sideShape.holes.push(roundedRect(new THREE.Path(), -0.9, 1.02, 0.78, 1.7, 0.12));   // ventana delantera
    sideShape.holes.push(roundedRect(new THREE.Path(), 0.94, 1.02, 1.95, 1.66, 0.12));    // ventana trasera
    const panel = new THREE.Mesh(new THREE.ShapeGeometry(sideShape, 8), M.trim);
    panel.rotation.y = -Math.PI / 2;           // el eje x de la figura queda a lo largo del auto
    panel.position.x = side * 1.6;
    cabin.add(panel);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 1.6), M.doorLed);
    strip.position.set(side * 1.57, 0.98, 0.1);
    cabin.add(strip);
  });
  const dashboard = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.34, 0.8, 4, 0.14), M.dash);
  dashboard.position.set(0, 0.86, -0.62);
  cabin.add(dashboard);
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.012, 0.012), M.ledStrip);
  led.position.set(0, 1.03, -0.24);
  cabin.add(led);

  // Pantalla del tablero con la ruta "A tu casa"
  const screenTexture = canvasTexture(THREE, 256, 150, (ctx, w, h) => {
    ctx.fillStyle = '#071226'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#16305a'; ctx.lineWidth = 5;
    for (let y = 40; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    [60, 196].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, h); ctx.stroke(); });
    ctx.strokeStyle = '#f0c040'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(128, h - 18); ctx.lineTo(128, 52); ctx.lineTo(196, 52); ctx.stroke();
    ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, w, 30);
    ctx.font = '600 17px Inter, sans-serif';
    ctx.fillStyle = '#e8eaf0'; ctx.fillText('A tu casa', 12, 21);
    ctx.fillStyle = '#f0c040'; ctx.textAlign = 'right'; ctx.fillText('12 min', w - 12, 21);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.176), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.position.set(0.02, 1.08, -0.3);
  screen.rotation.x = -0.25;
  cabin.add(screen);

  // Espejo retrovisor y colgante dorado con el volante de TeLlevo
  const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.09, 0.04, 3, 0.03), M.trim);
  mirror.position.set(0.02, 1.56, -0.5);
  cabin.add(mirror);
  const emblemTexture = canvasTexture(THREE, 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(46, 40, 6, 64, 64, 64);
    g.addColorStop(0, '#fff1c8'); g.addColorStop(0.5, '#f0c040'); g.addColorStop(1, '#9a7430');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 63, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1628'; ctx.beginPath(); ctx.arc(64, 64, 46, 0, Math.PI * 2); ctx.fill();
    drawWheelEmblem(ctx, 64, 64, 36, '#f0c040');
  });
  const tagPivot = new THREE.Group();
  tagPivot.position.set(0.02, 1.51, -0.49);
  cabin.add(tagPivot);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.1, 4), M.goldMetal);
  cord.position.y = -0.05; tagPivot.add(cord);
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 32), [
    M.goldMetal,
    new THREE.MeshStandardMaterial({ map: emblemTexture, metalness: 0.6, roughness: 0.3, emissive: 0x3a2a08, emissiveIntensity: 0.6 }),
    new THREE.MeshStandardMaterial({ map: emblemTexture, metalness: 0.6, roughness: 0.3 }),
  ]);
  coin.rotation.x = Math.PI / 2;
  coin.position.y = -0.14;
  tagPivot.add(coin);

  // Asientos delanteros: cuero acolchado con costura dorada
  const seatBackGeo = new RoundedBoxGeometry(0.56, 0.8, 0.18, 5, 0.08);
  const headrestGeo = new RoundedBoxGeometry(0.26, 0.17, 0.11, 5, 0.06);
  const stitchGeo = new THREE.BoxGeometry(0.4, 0.006, 0.006);
  const makeSeat = (x) => {
    const seat = new THREE.Group();
    const back = new THREE.Mesh(seatBackGeo, M.leather); back.position.y = 0.62; seat.add(back);
    const rest = new THREE.Mesh(headrestGeo, M.leather); rest.position.y = 1.1; seat.add(rest);
    [0.4, 0.62].forEach((y) => {
      const s = new THREE.Mesh(stitchGeo, M.stitch); s.position.set(0, 0.62 + y - 0.3, 0.092); seat.add(s);
    });
    seat.position.set(x, 0, 0.62);
    return seat;
  };
  cabin.add(makeSeat(-0.4), makeSeat(0.42));

  // El chofer (de espaldas): proporciones de personaje animado
  const driver = new THREE.Group();
  driver.position.set(-0.4, 0, 0.36);
  cabin.add(driver);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.26, 32, 16), M.suit);
  shoulders.scale.set(1.15, 0.72, 0.62); shoulders.position.y = 1.02; driver.add(shoulders);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 8, 16), M.suit);
  torso.position.y = 0.78; driver.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.16, 16), M.skin);
  neck.position.y = 1.22; driver.add(neck);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.016, 8, 24), M.glove);
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.15; driver.add(collar);

  const head = new THREE.Group();
  head.position.y = 1.39;
  driver.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 32, 24), M.skin);
  skull.scale.set(1, 1.08, 1); head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), M.hair);
  hair.scale.set(1.02, 1.08, 1.04); hair.rotation.x = 0.5; hair.position.set(0, 0.012, 0.008); head.add(hair);
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), M.skin);
    ear.scale.set(0.5, 1, 0.8); ear.position.set(side * 0.125, -0.005, 0.01); head.add(ear);
  });
  const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.128, 0.075, 32), M.cap);
  capCrown.position.y = 0.112; head.add(capCrown);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.cap);
  capTop.scale.set(1, 0.32, 1); capTop.position.y = 0.149; head.add(capTop);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.131, 0.012, 10, 40), M.goldMetal);
  band.rotation.x = Math.PI / 2; band.position.y = 0.088; head.add(band);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), M.goldMetal);
  button.position.y = 0.198; head.add(button);

  // Volante y brazos (se mueven juntos al corregir la dirección)
  const steering = new THREE.Group();
  steering.position.set(0, 1.0, -0.22);
  steering.rotation.x = -0.35;
  driver.add(steering);
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 14, 48), M.wheel);
  steering.add(wheelRim);
  const hands = [-1, 1].map((side) => {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), M.glove);
    hand.scale.set(1, 0.85, 1.1);
    const angle = side < 0 ? Math.PI * 0.82 : Math.PI * 0.18;
    hand.position.set(Math.cos(angle) * 0.19, Math.sin(angle) * 0.19, 0.02);
    steering.add(hand);
    return hand;
  });
  hands.forEach((hand, i) => {
    const side = i === 0 ? -1 : 1;
    const shoulder = new THREE.Vector3(side * 0.24, 1.02, 0);
    const target = new THREE.Vector3();
    hand.getWorldPosition(target);
    driver.worldToLocal(target);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 1, 6, 12), M.suit);
    const mid = shoulder.clone().add(target).multiplyScalar(0.5);
    const dir = target.clone().sub(shoulder);
    arm.scale.y = Math.max(0.1, dir.length() - 0.08);
    arm.position.copy(mid);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    driver.add(arm);
  });

  // ── Luces de escena ─────────────────────────────────────────────────────────
  scene.add(new THREE.HemisphereLight(0x5a78c8, 0x1a1420, 0.75));
  const moonLight = new THREE.DirectionalLight(0x9fb8ff, 1.2);
  moonLight.position.set(30, 40, -60);
  scene.add(moonLight);
  // Relleno frío desde atrás: da volumen al cuero y al traje sin quitar la noche
  const fill = new THREE.PointLight(0x7a8ce0, 1.6, 3.5, 2);
  fill.position.set(0.2, 1.7, 1.6);
  cabin.add(fill);
  const dashGlow = new THREE.PointLight(BRAND.goldBright, 0.7, 1.6, 2);
  dashGlow.position.set(0, 1.12, -0.1);
  cabin.add(dashGlow);
  const rim = new THREE.PointLight(0xffc46b, 1.2, 1.6, 2);
  rim.position.set(-0.05, 1.25, -0.1);
  cabin.add(rim);

  // ── Posproceso: resplandor de las luces ────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    bloom.resolution.set(width / 2, height / 2);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);
  resize();

  // ── Animación ──────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let running = true;
  let firstFrame = true;
  let elapsed = 0;
  // Calidad adaptativa: si los primeros segundos van lentos, baja la resolución y luego quita el bloom.
  let quality = 2;
  let slowFrames = 0;
  let sampled = 0;
  let useComposer = true;

  const frame = () => {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;
    const t = elapsed;

    // La ciudad avanza hacia la cámara y se recicla sin cortes
    city.position.z = (t * SPEED) % ROAD_LENGTH;

    // Las luces viajeras siguen a los faroles más cercanos
    const offset = (t * SPEED) % LAMP_GAP;
    travelLights.forEach((light, i) => {
      light.position.set(4.4, 6.6, -i * LAMP_GAP + offset - LAMP_GAP * 0.4);
    });

    // Auto de adelante: leve vaivén; auto en contra cada 9 s
    leadCar.position.x = Math.sin(t * 0.4) * 0.35;
    leadCar.position.z = -17 + Math.sin(t * 0.27) * 2.5;
    const cycle = t % 9;
    oncoming.position.z = cycle < 3 ? -160 + cycle * 62 : -400;

    // Vaivén de la carrocería, el chofer corrige el volante y mira el espejo
    camera.position.set(CAMERA_BASE.x + Math.sin(t * 1.7) * 0.004, CAMERA_BASE.y + Math.sin(t * 2.3) * 0.005, CAMERA_BASE.z);
    cabin.rotation.z = Math.sin(t * 1.1) * 0.004;
    steering.rotation.z = Math.sin(t * 1.1) * 0.06;
    const glance = Math.max(0, Math.sin(t * 0.45 - 1.2)) ** 6;
    head.rotation.y = -glance * 0.35;
    head.rotation.z = Math.sin(t * 0.8) * 0.02;
    tagPivot.rotation.z = Math.sin(t * 1.9) * 0.18 + Math.sin(t * 1.1) * 0.06;
    tagPivot.rotation.x = Math.sin(t * 1.3) * 0.08;
    starField.material.opacity = 0.7 + Math.sin(t * 2) * 0.15;

    if (useComposer) composer.render();
    else renderer.render(scene, camera);

    if (quality > 0 && elapsed > 1.5) {
      sampled += 1;
      if (dt > 1 / 28) slowFrames += 1;
      if (sampled >= 90) {
        if (slowFrames > 45) {
          quality -= 1;
          if (quality === 1) { renderer.setPixelRatio(1); resize(); }
          else useComposer = false;
        }
        sampled = 0;
        slowFrames = 0;
      }
    }

    if (firstFrame) {
      firstFrame = false;
      stage.classList.add('hero-stage--3d');
    }
  };

  stage.appendChild(renderer.domElement);

  // Pausa fuera de pantalla o con la pestaña oculta
  const setRunning = (value) => {
    if (value === running) return;
    running = value;
    if (running) { clock.getDelta(); requestAnimationFrame(frame); }
  };
  let visible = true;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    setRunning(visible && !document.hidden);
  }, { threshold: 0.05 }).observe(stage);
  document.addEventListener('visibilitychange', () => setRunning(visible && !document.hidden));

  requestAnimationFrame(frame);
}

const boot = () => {
  if (!stage || !supportsWebGL()) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  start().catch(() => {
    /* Sin WebGL o sin conexión al CDN: se mantiene la escena SVG */
    stage.classList.remove('hero-stage--3d');
  });
};

if (document.readyState === 'complete') boot();
else window.addEventListener('load', boot, { once: true });
