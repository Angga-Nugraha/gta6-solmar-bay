// SBPD wanted level — heat, police pursuit cars, foot officers, roadblocks, busted/wasted.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG, LOCATIONS } from './config.js';
import { spawnCar, removeCar } from './vehicles.js';
import { nearestRoadNode, nextRoadNode } from './city.js';
import { makeRng, clamp, dist2d } from './rng.js';
import { damagePlayer } from './player.js';

export function addHeat(stars, reason) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + stars, 0, CFG.WANTED_MAX);
  G.heatTimer = 0;
  if (reason) G.hud?.toast(reason);
  if (G.wanted > before) {
    G.audio?.wantedSting();
    G.hud?.toast(`${'★'.repeat(G.wanted)} WANTED LEVEL ${G.wanted}`);
  }
}

export function clearWanted() { G.wanted = 0; G.heatTimer = 0; }

function spawnPoliceCar(rng) {
  const p = G.player;
  const node = nearestRoadNode(p.x + rng.range(-60, 60), p.z + rng.range(-60, 60));
  const n = G.roadNodes[node];
  const car = spawnCar('interceptor', n.x, n.z, rng.range(0, Math.PI * 2), { driver: 'police' });
  car.nodeIdx = node;
  G.police.push(car);
  return car;
}

function spawnOfficer(x, z) {
  const group = new THREE.Group();
  const uni = new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a37e, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), uni);
  torso.position.y = 1.15; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.68; group.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.1, 10),
    new THREE.MeshStandardMaterial({ color: 0x0a1a3a }));
  cap.position.y = 1.84; group.add(cap);
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24), uni);
    leg.position.set(sx, 0.4, 0); group.add(leg);
  }
  group.position.set(x, 0, z);
  G.scene.add(group);
  const off = { model: group, x, z, yaw: 0, hp: 60, shootTimer: 1, walkPhase: 0 };
  G.officers.push(off);
  return off;
}

export function updatePolice(dt, rng) {
  const p = G.player;
  const wantCars = G.wanted === 0 ? 0 : Math.min(G.wanted, CFG.POLICE_MAX);
  // Spawn pursuit cars up to the wanted level
  while (G.police.length < wantCars) spawnPoliceCar(rng);
  // Heat decay when no police can see the player
  if (G.wanted > 0) {
    const nearest = G.police.reduce((m, c) => Math.min(m, dist2d(c.x, c.z, p.x, p.z)), Infinity);
    const seen = nearest < 80 || G.officers.some((o) => dist2d(o.x, o.z, p.x, p.z) < 40);
    if (!seen) {
      G.hiddenTimer += dt;
      if (G.hiddenTimer > 10) { G.hud?.toastOnce?.('lost', 'YOU LOST THEM'); G.wanted = Math.max(0, G.wanted - 1); G.hiddenTimer = 0; }
    } else G.hiddenTimer = 0;
    G.heatTimer += dt;
    if (G.heatTimer > CFG.WANTED_DECAY_S && !seen && G.wanted < 5) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.heatTimer = 0;
    }
  }
  // Police cars: chase the player's predicted position, ram to stop
  for (let i = G.police.length - 1; i >= 0; i--) {
    const car = G.police[i];
    if (G.wanted === 0) { removeCar(car); continue; }
    const dPlayer = dist2d(car.x, car.z, p.x, p.z);
    if (dPlayer > 200) { removeCar(car); continue; }
    const px = p.x + Math.sin(p.yaw) * (p.car ? p.car.speed * 0.5 : 0);
    const pz = p.z + Math.cos(p.yaw) * (p.car ? p.car.speed * 0.5 : 0);
    const dx = px - car.x, dz = pz - car.z;
    const wantYaw = Math.atan2(dx, dz);
    let dy = wantYaw - car.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    car.yaw += clamp(dy, -2.2 * dt, 2.2 * dt);
    const targetSpeed = dPlayer > 6 ? car.def.top * 0.95 : 0;
    car.speed = THREE.MathUtils.damp(car.speed, targetSpeed, 1.6, dt);
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    car.model.position.set(car.x, 0, car.z);
    car.model.rotation.y = car.yaw;
    // Ram: contact slows the player's car and damages it
    if (dPlayer < 4.6) {
      if (p.car) {
        p.car.speed *= 0.7;
        p.car.hp -= 3 * dt * 10;
        if (p.car.hp <= 0) { /* explodeCar handles respawn */ }
      } else if (Math.abs(car.speed) > 3) {
        damagePlayer(6 * dt, 'police');
      }
      car.speed *= 0.5;
    }
    // Officer gets out and chases on foot when close and player is on foot
    if (p.onFoot && dPlayer < 14 && G.officers.length < G.wanted + 1 && car.speed < 2) {
      spawnOfficer(car.x + 3, car.z);
      car.speed = 0;
    }
  }
  // Foot officers: run at the player, shoot at range, punch up close
  for (let i = G.officers.length - 1; i >= 0; i--) {
    const off = G.officers[i];
    if (G.wanted === 0 || off.hp <= 0) { G.scene.remove(off.model); G.officers.splice(i, 1); continue; }
    const d = dist2d(off.x, off.z, p.x, p.z);
    if (d > 120) { G.scene.remove(off.model); G.officers.splice(i, 1); continue; }
    const wantYaw = Math.atan2(p.x - off.x, p.z - off.z);
    off.yaw = wantYaw;
    if (d > 1.6) {
      off.x += Math.sin(wantYaw) * 5 * dt;
      off.z += Math.cos(wantYaw) * 5 * dt;
      off.walkPhase += dt * 9;
    }
    off.shootTimer -= dt;
    if (d < 25 && d > 4 && off.shootTimer <= 0) {
      off.shootTimer = G.wanted >= 3 ? 0.9 : 1.6;
      const spread = G.wanted >= 4 ? 0.06 : 0.12;
      if (Math.random() > 0.45 + spread) {
        damagePlayer(G.wanted >= 3 ? 8 : 5, 'police');
        G.audio?.gunshot(0.4);
        G.hud?.toast('SBPD is shooting at you!');
      } else {
        G.audio?.gunshot(0.2);
      }
    }
    if (d <= 1.6 && p.onFoot) {
      // Arrest: stand still near an officer at 1 star for 3 s and you're busted
      off.arrestTimer = (off.arrestTimer ?? 0) + dt;
      if (G.wanted === 1 && off.arrestTimer > 3) busted();
      else if (off.arrestTimer > 1.2) { damagePlayer(6, 'police'); off.arrestTimer = 0; }
    } else off.arrestTimer = 0;
    off.model.position.set(off.x, 0, off.z);
    off.model.rotation.y = off.yaw;
  }
  // Roadblocks at 3+ stars: a parked cruiser across the road ahead (visual + collider)
  if (G.wanted >= 3 && !G.roadblock && G.roadblockTimer === undefined) G.roadblockTimer = 0;
}

export function busted() {
  const p = G.player;
  const fine = Math.round(p.cash * 0.1);
  p.cash -= fine;
  clearWanted();
  G.mode = 'busted';
  G.hud?.showBusted(fine);
  G.audio?.bustedSting();
  // Respawn at SBPD Central
  p.x = LOCATIONS.policeHQ.x; p.z = LOCATIONS.policeHQ.z; p.hp = CFG.START_HP;
  if (p.car) { p.car.driver = null; p.car = null; p.onFoot = true; p.model.visible = true; }
  p.model.position.set(p.x, 0, p.z);
  G.missions?.failCurrent?.('BUSTED — the SBPD took you in.');
}

export function wasted() {
  const p = G.player;
  const fine = Math.round(p.cash * 0.1);
  p.cash -= fine;
  clearWanted();
  if (p.weapon === 'smg' || p.weapon === 'pistol') {
    const w = p.weapons[p.weapon];
    if (w) w.mag = 0;
  }
  G.mode = 'wasted';
  G.hud?.showWasted(fine);
  G.audio?.wastedSting();
  p.x = LOCATIONS.hospital.x; p.z = LOCATIONS.hospital.z; p.hp = CFG.START_HP;
  if (p.car) { p.car.driver = null; p.car = null; p.onFoot = true; p.model.visible = true; }
  p.model.position.set(p.x, 0, p.z);
  G.missions?.failCurrent?.('WASTED — you woke up at Solmar General.');
}
