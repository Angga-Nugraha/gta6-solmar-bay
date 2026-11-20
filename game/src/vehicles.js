// Car factory — six original low-poly box cars, no imported models.
import * as THREE from 'three';
import { G } from './state.js';
import { VEHICLE_DEFS } from './config.js';
import { makeRng } from './rng.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.15, metalness: 0.6 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

export function buildCarModel(type, colourHex) {
  const def = VEHICLE_DEFS[type];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colourHex ?? def.colour, roughness: 0.35, metalness: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.62; body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glassMat);
  cabin.position.set(0, 1.18, type === 'hauler' ? -0.9 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (type === 'hauler') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.6), paint);
    bed.position.set(0, 0.95, 1.2); group.add(bed);
  }
  if (type === 'breeze') cabin.scale.set(0.9, 0.6, 1);
  // wheels
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    group.add(w); wheels.push(w);
  }
  // headlights + taillights
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), lightMat);
    h.position.set(sx, 0.66, 2.22); group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.08), tailMat);
    t.position.set(sx, 0.66, -2.22); group.add(t);
  }
  if (type === 'interceptor') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    bar.position.set(0, 1.52, -0.2); group.add(bar);
    group.userData.sirenBar = bar;
  }
  if (type === 'solcab') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xffe95a }));
    sign.position.set(0, 1.55, -0.2); group.add(sign);
  }
  group.userData.wheels = wheels;
  return group;
}

export function spawnCar(type, x, z, yaw, opts = {}) {
  const def = VEHICLE_DEFS[type];
  const colour = opts.colour ?? def.colour;
  const model = buildCarModel(type, colour);
  model.position.set(x, 0, z);
  model.rotation.y = yaw;
  G.scene.add(model);
  const car = {
    type, def, model, colour,
    x, z, yaw, speed: 0, steer: 0,
    hp: 100, smoke: null, fire: null,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | null (parked)
    owned: opts.owned ?? false,
    ai: null, stuckTimer: 0, route: null, nodeIdx: 0,
    sirenPhase: 0, despawnTimer: 0,
    radius: 2.4,
  };
  G.cars.push(car);
  return car;
}

export function removeCar(car) {
  G.scene.remove(car.model);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
  const t = G.traffic.indexOf(car);
  if (t >= 0) G.traffic.splice(t, 1);
  const p = G.police.indexOf(car);
  if (p >= 0) G.police.splice(p, 1);
}

export function carDamage(car, amount) {
  car.hp -= amount;
  if (car.hp < 40 && !car.smoke) {
    car.smoke = makeSmoke(car);
  }
  if (car.hp <= 0) explodeCar(car);
}

function makeSmoke(car) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 });
  const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat);
  puff.position.set(0, 1.4, 1.2);
  car.model.add(puff);
  return puff;
}

export function explodeCar(car) {
  if (car.exploded) return;
  car.exploded = true;
  G.audio?.explosion();
  spawnExplosionFx(car.x, car.z);
  if (car.driver === 'player') {
    G.player.car = null; G.player.onFoot = true;
    G.player.x = car.x + 4; G.player.z = car.z;
    G.player.hp = Math.max(20, G.player.hp - 15);
    G.hud?.toast('Your car blew up!');
  }
  if (car.driver === 'police') { /* officer bails below via police.js */ }
  removeCar(car);
}

export function spawnExplosionFx(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat);
  ball.position.set(x, 1.2, z);
  G.scene.add(ball);
  G.particles.push({ mesh: ball, life: 0.6, max: 0.6, grow: 8 });
  G.hud?.shake(0.5);
}

export function updateCarFx(dt) {
  for (const car of G.cars) {
    if (car.smoke) {
      car.smoke.scale.setScalar(1 + Math.sin(G.time * 9) * 0.25);
      car.smoke.material.opacity = 0.35 + Math.sin(G.time * 6) * 0.15;
    }
    if (car.model.userData.sirenBar) {
      car.sirenPhase += dt * 6;
      car.model.userData.sirenBar.material.color.setHex(Math.sin(car.sirenPhase) > 0 ? 0xff2a2a : 0x2a6aff);
    }
    // wheel spin
    const spin = car.speed * dt * 2;
    for (const w of car.model.userData.wheels) w.rotation.x += spin;
  }
  // explosion particles
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    p.mesh.scale.setScalar(1 + (p.max - p.life) * p.grow);
    p.mesh.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) { G.scene.remove(p.mesh); G.particles.splice(i, 1); }
  }
}

export const PARKED_COLOURS = [0x4a90d9, 0xff7a59, 0x8a7a5a, 0x1f2a44, 0xf2c230, 0x7a4a9a, 0x3ad9a0, 0xd9d9d9];
export function spawnParkedCars(rng) {
  const spots = [
    ['comet', 126, 32, 0], ['breeze', 126, 100, Math.PI], ['comet', -126, 70, Math.PI / 2],
    ['hauler', -210, -140, 0], ['solcab', 126, -70, Math.PI / 2], ['meridian', 126, 20, 0],
    ['breeze', 210, 100, Math.PI], ['comet', 42, -70, 0], ['hauler', -210, -120, Math.PI / 2],
    ['solcab', -42, 90, 0], ['comet', 42, 140, Math.PI], ['breeze', 210, -120, Math.PI / 2],
  ];
  for (const [type, x, z, yaw] of spots) {
    spawnCar(type, x, z, yaw, { colour: rng.pick(PARKED_COLOURS) });
  }
}
