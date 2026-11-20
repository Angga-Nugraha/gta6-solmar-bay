// Solmar Bay city — hand-authored block table, seeded heights, road graph.
// Map: 560 x 420 m. 6 avenues (N-S) x 5 streets (E-W), roads 10 m wide.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG, LOCATIONS } from './config.js';
import { makeRng, clamp } from './rng.js';

// Avenue x positions and street z positions (road centrelines).
export const AVENUES = [-210, -126, -42, 42, 126, 210];
export const STREETS = [-160, -80, 0, 80, 160];
export const ROAD_W = 10;

function districtAt(x, z) {
  if (x > 170) return 'marina';
  if (z < -110 && x < -140) return 'portside';
  if (z < -90) return 'downtown';
  if (x > 90 && z > -60) return 'strip';
  if (x < -90 && z > 60) return 'oldtown';
  if (x > 90) return 'strip';
  return 'downtown';
}

// One entry per block: grid cell between roads, plus landmark flags.
function buildBlockTable(rng) {
  const blocks = [];
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + 3, x1 = AVENUES[ai + 1] - ROAD_W / 2 - 3;
      const z0 = STREETS[si] + ROAD_W / 2 + 3, z1 = STREETS[si + 1] - ROAD_W / 2 - 3;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const d = districtAt(cx, cz);
      blocks.push({ x: cx, z: cz, w: x1 - x0, d: z1 - z0, district: d, seed: rng.int(1, 99999) });
    }
  }
  return blocks;
}

const HERO = [
  { key: 'coralCrown', x: 150, z: 30, w: 46, d: 30, h: 58, district: 'strip', tex: 'neonCoral', name: 'THE CORAL CROWN' },
  { key: 'meridianTower', x: 20, z: -140, w: 34, d: 30, h: 78, district: 'downtown', tex: 'neonMeridian', name: 'MERIDIAN TOWER' },
  { key: 'paloma', x: 150, z: 110, w: 40, d: 26, h: 30, district: 'strip', tex: 'neonPaloma', name: 'PALOMA HOTEL' },
  { key: 'mirage', x: 150, z: -30, w: 36, d: 24, h: 22, district: 'strip', tex: 'neonMirage', name: 'CLUB MIRAGE' },
  { key: 'dock9', x: -210, z: -160, w: 44, d: 30, h: 14, district: 'portside', tex: null, name: 'DOCK 9' },
  { key: 'chapel', x: -170, z: 155, w: 26, d: 20, h: 12, district: 'oldtown', tex: null, name: 'ST. ANSELM CHAPEL' },
];

export function buildRoadGraph() {
  G.roadNodes = [];
  G.roadEdges = [];
  const idx = {};
  for (const z of STREETS) for (const x of AVENUES) {
    idx[`${x},${z}`] = G.roadNodes.length;
    G.roadNodes.push({ x, z });
  }
  for (const z of STREETS) for (let i = 0; i < AVENUES.length - 1; i++) {
    G.roadEdges.push([idx[`${AVENUES[i]},${z}`], idx[`${AVENUES[i + 1]},${z}`]]);
  }
  for (const x of AVENUES) for (let i = 0; i < STREETS.length - 1; i++) {
    G.roadEdges.push([idx[`${x},${STREETS[i]}`], idx[`${x},${STREETS[i + 1]}`]]);
  }
}

export function nearestRoadNode(x, z) {
  let best = 0, bd = Infinity;
  G.roadNodes.forEach((n, i) => {
    const d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
export function nextRoadNode(fromIdx, rng) {
  const links = G.roadEdges.filter((e) => e[0] === fromIdx || e[1] === fromIdx)
    .map((e) => (e[0] === fromIdx ? e[1] : e[0]));
  if (!links.length) return fromIdx;
  return links[Math.floor(rng.next() * links.length)];
}
export function onRoad(x, z) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + 1) return true;
  for (const sz of STREETS) if (Math.abs(z - sz) < ROAD_W / 2 + 1) return true;
  return false;
}
export function collideCircle(x, z, r) {
  // Returns pushed-out position. AABB colliders only.
  let px = x, pz = z;
  for (const c of G.colliders) {
    const dx = px - c.x, dz = pz - c.z;
    const ox = c.hx + r - Math.abs(dx), oz = c.hz + r - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) px = c.x + Math.sign(dx || 1) * (c.hx + r);
      else pz = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
  return { x: px, z: pz };
}
export function districtNameAt(x, z) {
  const d = districtAt(x, z);
  return { strip: 'NEON STRIP', marina: 'MARINA & BEACH', oldtown: 'OLD TOWN', downtown: 'DOWNTOWN', portside: 'PORTSIDE' }[d];
}

export function buildCity(scene, textures, seed) {
  const rng = makeRng(seed);
  G.colliders.length = 0;
  buildRoadGraph();

  // Ground base
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.MAP_W + 400, CFG.MAP_D + 400),
    new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05;
  ground.receiveShadow = true; scene.add(ground);

  // Sidewalk slab (whole island), roads drawn on top
  const island = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.MAP_W, CFG.MAP_D),
    new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 1 }));
  island.rotation.x = -Math.PI / 2; island.position.y = 0.0;
  island.receiveShadow = true; scene.add(island);

  // Roads: dark planes along each avenue / street
  const roadMat = new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.95 });
  for (const ax of AVENUES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, CFG.MAP_D), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(ax, 0.02, 0); r.receiveShadow = true; scene.add(r);
  }
  for (const sz of STREETS) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CFG.MAP_W, ROAD_W), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, sz); r.receiveShadow = true; scene.add(r);
  }
  // Crosswalks at intersections
  const cwMat = new THREE.MeshStandardMaterial({ map: textures.crosswalk, roughness: 1 });
  for (const ax of AVENUES) for (const sz of STREETS) {
    const cw = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), cwMat);
    cw.rotation.x = -Math.PI / 2; cw.position.set(ax, 0.03, sz); scene.add(cw);
  }

  // Beach (east strip) + sea planes
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(46, CFG.MAP_D + 400),
    new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(CFG.MAP_W / 2 + 14, 0.04, 0);
  sand.receiveShadow = true; scene.add(sand);
  const seaMat = new THREE.MeshStandardMaterial({ map: textures.water, roughness: 0.4, metalness: 0.1, color: 0x9fd8e0 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, CFG.MAP_D + 600), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(CFG.MAP_W / 2 + 280, -0.2, 0); scene.add(sea);
  const seaS = new THREE.Mesh(new THREE.PlaneGeometry(CFG.MAP_W + 400, 300), seaMat);
  seaS.rotation.x = -Math.PI / 2; seaS.position.set(0, -0.2, CFG.MAP_D / 2 + 150); scene.add(seaS);
  G.seaMat = seaMat;

  // Buildings from the block table
  const blocks = buildBlockTable(rng);
  const facadeMats = {
    strip: new THREE.MeshStandardMaterial({ map: textures.facadeDeco, roughness: 0.85 }),
    downtown: new THREE.MeshStandardMaterial({ map: textures.facadeGlass, roughness: 0.35, metalness: 0.25 }),
    oldtown: new THREE.MeshStandardMaterial({ map: textures.facadeStucco, roughness: 0.95 }),
    marina: new THREE.MeshStandardMaterial({ map: textures.facadeStucco, roughness: 0.95 }),
    portside: new THREE.MeshStandardMaterial({ map: textures.facadeBrick, roughness: 0.95 }),
  };
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // Keep landmark / mission clear zones free of block buildings.
  const CLEAR = [
    { x: 150, z: 30, r: 36 }, { x: 20, z: -140, r: 32 }, { x: -140, z: 130, r: 24 },
    { x: -160, z: 110, r: 14 }, { x: 40, z: -120, r: 12 }, { x: -210, z: -160, r: 30 },
    { x: 150, z: 110, r: 26 }, { x: 150, z: -30, r: 24 }, { x: 126, z: 40, r: 12 },
    { x: -170, z: 155, r: 16 }, { x: -120, z: 150, r: 14 }, { x: 0, z: -160, r: 12 },
  ];
  const inClear = (x, z) => CLEAR.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
  for (const b of blocks) {
    const d = CFG.DISTRICTS[b.district];
    const brng = makeRng(b.seed);
    const n = b.district === 'marina' ? 1 : (brng.next() < 0.5 ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const w = b.w / (n === 2 ? 2.1 : 1.05), dd = b.d / (n === 2 && b.w > b.d ? 1 : 1.05);
      const h = brng.range(d.hMin, d.hMax);
      const bx = b.x + (n === 2 ? (i === 0 ? -b.w / 4 : b.w / 4) : 0);
      const bz = b.z;
      if (inClear(bx, bz)) continue;
      const mesh = new THREE.Mesh(boxGeo, facadeMats[b.district]);
      mesh.scale.set(w, h, dd);
      mesh.position.set(bx, h / 2, bz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      G.colliders.push({ x: bx, z: bz, hx: w / 2, hz: dd / 2 });
      // roof props
      if (brng.next() < 0.6) {
        const ac = new THREE.Mesh(boxGeo, roofMat);
        ac.scale.set(3, 1.2, 2); ac.position.set(bx + w * 0.2, h + 0.6, bz);
        scene.add(ac);
      }
      if (b.district === 'downtown' && brng.next() < 0.4) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 8, 6), roofMat);
        ant.position.set(bx, h + 4, bz); scene.add(ant);
      }
    }
  }

  // Hero landmark buildings with neon signs
  for (const hero of HERO) {
    const mat = hero.district === 'downtown'
      ? new THREE.MeshStandardMaterial({ map: textures.facadeGlass, roughness: 0.3, metalness: 0.3, color: 0xcfe8ff })
      : new THREE.MeshStandardMaterial({ map: textures.facadeDeco, roughness: 0.8, color: hero.key === 'coralCrown' ? 0xffc9d6 : 0xffffff });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(hero.w, hero.h, hero.d);
    mesh.position.set(hero.x, hero.h / 2, hero.z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    G.colliders.push({ x: hero.x, z: hero.z, hx: hero.w / 2, hz: hero.d / 2 });
    if (hero.tex) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(hero.w * 0.9, hero.w * 0.22),
        new THREE.MeshBasicMaterial({ map: textures[hero.tex] }));
      sign.position.set(hero.x, hero.h * 0.82, hero.z + hero.d / 2 + 0.3);
      scene.add(sign);
      const sign2 = sign.clone();
      sign2.rotation.y = Math.PI; sign2.position.z = hero.z - hero.d / 2 - 0.3;
      scene.add(sign2);
    }
    if (hero.key === 'coralCrown') {
      // neon crown ring on the roof
      const crown = new THREE.Mesh(new THREE.TorusGeometry(10, 0.7, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xff5a8a }));
      crown.rotation.x = Math.PI / 2; crown.position.set(hero.x, hero.h + 2, hero.z);
      scene.add(crown);
    }
    if (hero.key === 'dock9') {
      // container stacks around the terminal
      const contCols = [0xd95a3a, 0x3a7ad9, 0x3ad97a, 0xd9c23a];
      for (let i = 0; i < 14; i++) {
        const c = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: contCols[i % 4], roughness: 0.8 }));
        c.scale.set(6, 2.6, 2.6);
        c.position.set(hero.x - 40 + (i % 7) * 12, 1.3 + Math.floor(i / 7) * 2.7, hero.z - 26 + (i % 2) * 6);
        c.castShadow = true; scene.add(c);
        G.colliders.push({ x: c.position.x, z: c.position.z, hx: 3, hz: 1.3 });
      }
      // gantry crane silhouettes
      for (const cx of [-190, -230]) {
        const leg = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x2a2a30 }));
        leg.scale.set(2, 26, 2); leg.position.set(cx, 13, -185); scene.add(leg);
        const beam = new THREE.Mesh(boxGeo, leg.material);
        beam.scale.set(26, 2, 2); beam.position.set(cx, 26, -185); scene.add(beam);
      }
    }
  }

  // Palms along the beach + boardwalk
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: CFG.COLOURS.palm, roughness: 1 });
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
  for (let z = -180; z <= 190; z += 18) {
    const px = 252 + rng.range(-4, 4);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, z); trunk.castShadow = true; scene.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(px, 7.6, z); leaves.castShadow = true; scene.add(leaves);
    G.colliders.push({ x: px, z, hx: 0.5, hz: 0.5 });
  }
  // Plaza fountain + market stalls in Old Town
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 16),
    new THREE.MeshStandardMaterial({ color: 0x9fc4d8, roughness: 0.4 }));
  fountain.position.set(LOCATIONS.plazaDelSol.x, 0.6, LOCATIONS.plazaDelSol.z);
  scene.add(fountain);
  G.colliders.push({ x: LOCATIONS.plazaDelSol.x, z: LOCATIONS.plazaDelSol.z, hx: 6, hz: 6 });
  for (let i = 0; i < 5; i++) {
    const stall = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: [0xff8a3a, 0x3ad9a0, 0xd95a8a, 0x4a90d9, 0xf2c230][i], roughness: 0.9 }));
    stall.scale.set(4, 2.4, 3);
    stall.position.set(LOCATIONS.plazaDelSol.x - 16 + i * 8, 1.2, LOCATIONS.plazaDelSol.z + 14);
    stall.castShadow = true; scene.add(stall);
    G.colliders.push({ x: stall.position.x, z: stall.position.z, hx: 2, hz: 1.5 });
  }
  // Street lamps every 40 m along avenues
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const bulbGeo = new THREE.SphereGeometry(0.35, 8, 6);
  for (const ax of AVENUES) for (let z = -180; z <= 180; z += 40) {
    const pole = new THREE.Mesh(poleGeo, lampMat);
    pole.position.set(ax + 6, 3, z); scene.add(pole);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(ax + 6, 6.1, z); scene.add(bulb);
  }
  // Solmar Pier (east edge, wooden deck + ferris wheel silhouette)
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 8), pierMat);
  pier.position.set(300, 0.6, LOCATIONS.pier.z); pier.castShadow = true; scene.add(pier);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(14, 0.8, 8, 28),
    new THREE.MeshStandardMaterial({ color: 0xff5a8a, emissive: 0x881133 }));
  wheel.position.set(322, 18, LOCATIONS.pier.z); scene.add(wheel);
  const wheelLeg = new THREE.Mesh(boxGeo, pierMat);
  wheelLeg.scale.set(2, 18, 2); wheelLeg.position.set(322, 9, LOCATIONS.pier.z); scene.add(wheelLeg);
  // Causeway barrier (west edge, visual road-closed)
  const barrier = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0xff8a3a }));
  barrier.scale.set(2, 2, 30); barrier.position.set(-CFG.MAP_W / 2 - 4, 1, 0); scene.add(barrier);
  G.colliders.push({ x: -CFG.MAP_W / 2 - 4, z: 0, hx: 1, hz: 15 });

  return { blocks, heroes: HERO };
}

export function clampToMap(x, z) {
  return {
    x: clamp(x, -CFG.MAP_W / 2 + 2, CFG.MAP_W / 2 + 44),
    z: clamp(z, -CFG.MAP_D / 2 + 2, CFG.MAP_D / 2 + 2),
  };
}
