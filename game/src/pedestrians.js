// Pedestrians — sidewalk walkers who flee gunfire, witness crimes, thin out at high wanted levels.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG } from './config.js';
import { AVENUES, STREETS, collideCircle, clampToMap } from './city.js';
import { makeRng, clamp, dist2d } from './rng.js';

const SKINS = [0xd9a37e, 0x8a5a3a, 0xe8c9a0, 0x6a3a22];
const SHIRTS = [0xd95a5a, 0x5a8ad9, 0x3ad97a, 0xf2c230, 0x9a5ad9, 0xdddddd, 0x2a2a2a, 0xff8a3a];
const PANTS = [0x2a2a3a, 0x5a4a3a, 0x3a3a3a, 0x4a5a6a];

function buildPedModel(rng) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: rng.pick(SHIRTS), roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: rng.pick(PANTS), roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: rng.pick(SKINS), roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), shirt);
  torso.position.y = 1.1; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
  head.position.y = 1.62; head.castShadow = true; group.add(head);
  if (rng.next() < 0.35) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: rng.pick(SHIRTS), roughness: 1 }));
    hat.position.y = 1.78; group.add(hat);
  }
  const legs = [];
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), pants);
    leg.position.set(sx, 0.36, 0); group.add(leg); legs.push(leg);
  }
  const h = rng.range(0.92, 1.08);
  group.scale.setScalar(h);
  group.userData.legs = legs;
  return group;
}

export function spawnPed(x, z, fleeing = false, rng = null) {
  const r = rng ?? makeRng((Math.random() * 1e9) | 0);
  const model = buildPedModel(r);
  model.position.set(x, 0, z);
  G.scene.add(model);
  const ped = {
    model, x, z, yaw: r.range(0, Math.PI * 2),
    speed: r.range(1.0, 1.8), fleeing, fleeTimer: fleeing ? 4 : 0,
    walkPhase: r.range(0, 6), target: pickSidewalkTarget(x, z, r),
    idleTimer: 0,
    flee(seconds) { this.fleeing = true; this.fleeTimer = seconds; },
  };
  G.peds.push(ped);
  return ped;
}

function pickSidewalkTarget(x, z, rng) {
  // Waypoint along a nearby block perimeter (sidewalk).
  const ax = AVENUES.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a);
  const sz = STREETS.reduce((a, b) => Math.abs(b - z) < Math.abs(a - z) ? b : a);
  if (rng.next() < 0.5) return { x: ax + (rng.next() < 0.5 ? 7 : -7), z: z + rng.range(-60, 60) };
  return { x: x + rng.range(-60, 60), z: sz + (rng.next() < 0.5 ? 7 : -7) };
}

export function updatePeds(dt, rng) {
  const p = G.player;
  const maxPeds = G.wanted >= 3 ? 10 : CFG.PED_MAX;
  while (G.peds.length < maxPeds) {
    const a = rng.range(0, Math.PI * 2), d = rng.range(20, 90);
    spawnPed(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, false, rng);
  }
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (dist2d(ped.x, ped.z, p.x, p.z) > 130) { G.scene.remove(ped.model); G.peds.splice(i, 1); continue; }
    // Flee gunfire / explosions / fast cars
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      const away = Math.atan2(ped.x - p.x, ped.z - p.z);
      ped.yaw = away;
      ped.x += Math.sin(away) * 4.2 * dt;
      ped.z += Math.cos(away) * 4.2 * dt;
      ped.walkPhase += dt * 9;
      if (ped.fleeTimer <= 0) ped.fleeing = false;
    } else if (ped.idleTimer > 0) {
      ped.idleTimer -= dt;
    } else {
      const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        if (rng.next() < 0.3) ped.idleTimer = rng.range(1, 4);
        ped.target = pickSidewalkTarget(ped.x, ped.z, rng);
      } else {
        const wantYaw = Math.atan2(dx, dz);
        let dy = wantYaw - ped.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        ped.yaw += clamp(dy, -2.4 * dt, 2.4 * dt);
        ped.x += Math.sin(ped.yaw) * ped.speed * dt;
        ped.z += Math.cos(ped.yaw) * ped.speed * dt;
        ped.walkPhase += dt * ped.speed * 3.2;
      }
    }
    const pushed = collideCircle(ped.x, ped.z, 0.4);
    ped.x = pushed.x; ped.z = pushed.z;
    const c = clampToMap(ped.x, ped.z);
    ped.x = c.x; ped.z = c.z;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    const legs = ped.model.userData.legs;
    legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
    ped.model.position.set(ped.x, 0, ped.z);
    ped.model.rotation.y = ped.yaw;
  }
}

// Called by combat / driving when something scary happens nearby.
export function scarePeds(x, z, radius) {
  for (const ped of G.peds) {
    if (dist2d(x, z, ped.x, ped.z) < radius) ped.flee(3);
  }
}
