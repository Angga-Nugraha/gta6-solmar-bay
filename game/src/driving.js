// Arcade driving — throttle/steer/handbrake, collisions, enter/exit/steal + witness rule.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG } from './config.js';
import { collideCircle, clampToMap, onRoad } from './city.js';
import { carDamage } from './vehicles.js';
import { clamp, dist2d } from './rng.js';

export function nearestCar(x, z, maxDist) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    if (car.exploded) continue;
    const d = dist2d(x, z, car.x, car.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

export function updateDriving(dt) {
  const p = G.player;
  const car = p.car;
  if (!car || p.onFoot) return;
  const input = G.input;
  const def = car.def;
  const throttle = input.down('KeyW') ? 1 : input.down('KeyS') ? -0.6 : 0;
  const handbrake = input.down('Space');
  const steerInput = (input.down('KeyA') ? 1 : 0) - (input.down('KeyD') ? 1 : 0);
  const speedFactor = clamp(Math.abs(car.speed) / def.top, 0, 1);
  const steerAngle = steerInput * def.turn * (1 - speedFactor * 0.55) * (handbrake ? 1.5 : 1);
  car.steer = THREE.MathUtils.lerp(car.steer, steerAngle, Math.min(1, dt * 8));
  if (throttle !== 0) {
    car.speed += throttle * def.accel * dt * (handbrake ? 0.4 : 1);
  } else {
    car.speed = THREE.MathUtils.damp(car.speed, 0, 1.2, dt);
  }
  if (handbrake) car.speed = THREE.MathUtils.damp(car.speed, 0, 3.5, dt);
  car.speed = clamp(car.speed, -def.top * 0.45, def.top);
  // Turning: yaw rate scales with speed, reverses when reversing
  const dir = car.speed >= 0 ? 1 : -1;
  car.yaw += car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * dir * dt * 1.4;
  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  car.x += fx * car.speed * dt;
  car.z += fz * car.speed * dt;
  // Building collision: slide + damage on hard hits
  const before = { x: car.x, z: car.z };
  const pushed = collideCircle(car.x, car.z, 2.2);
  car.x = pushed.x; car.z = pushed.z;
  if ((pushed.x !== before.x || pushed.z !== before.z) && Math.abs(car.speed) > 6) {
    const dmg = Math.round(Math.abs(car.speed) * 0.5);
    carDamage(car, Math.min(15, dmg));
    G.audio?.crash();
    G.hud?.shake(0.3);
    car.speed *= 0.45;
  }
  const clamped = clampToMap(car.x, car.z);
  if (clamped.x !== car.x || clamped.z !== car.z) { car.x = clamped.x; car.z = clamped.z; car.speed *= 0.3; }
  if (car.x > CFG.MAP_W / 2 + 30) { car.x = CFG.MAP_W / 2 + 18; car.speed = 0; G.hud?.toast('The tide is not your friend.'); }
  // Car vs car / car vs ped bumps
  for (const other of G.cars) {
    if (other === car || other.exploded) continue;
    const d = dist2d(car.x, car.z, other.x, other.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const nx = (car.x - other.x) / d, nz = (car.z - other.z) / d;
      car.x += nx * push; car.z += nz * push;
      if (other.driver === 'traffic' && Math.abs(car.speed) > 4) {
        carDamage(other, 4);
        if (Math.random() < 0.4) G.trafficApi?.bailDriver?.(other);
      }
      if (Math.abs(car.speed) > 8) { carDamage(car, 2); car.speed *= 0.8; G.audio?.crash(); }
    }
  }
  for (const ped of G.peds) {
    if (ped.fleeing) continue;
    const d = dist2d(car.x, car.z, ped.x, ped.z);
    if (d < 2.2 && Math.abs(car.speed) > 2) {
      ped.flee(4);
      if (Math.abs(car.speed) > 5) {
        G.policeApi?.addHeat?.(1, 'You hit a pedestrian!');
        G.audio?.thud();
      }
    }
  }
  // Sync player + model
  p.x = car.x; p.z = car.z; p.yaw = car.yaw;
  car.model.position.set(car.x, 0, car.z);
  car.model.rotation.y = car.yaw;
  car.model.rotation.z = -car.steer * 0.06 * clamp(Math.abs(car.speed) / 20, 0, 1);
  p.model.visible = false;
  G.audio?.engine(car.speed / def.top, handbrake);
  void onRoad;
}

export function tryEnterCar() {
  const p = G.player;
  if (!p.onFoot) {
    exitCar();
    return;
  }
  const car = nearestCar(p.x, p.z, 3.4);
  if (!car) return;
  if (car.driver === 'traffic') {
    // Yank the driver out — always witnessed by the driver.
    stealCar(car, true);
  } else if (car.driver === 'police') {
    G.hud?.toast('The cruiser is occupied. Knock the officer out first.');
  } else {
    stealCar(car, false);
  }
}

export function stealCar(car, yanked) {
  const p = G.player;
  const witnessed = witnessCheck(car.x, car.z);
  car.driver = 'player';
  car.owned = true;
  p.car = car; p.onFoot = false;
  p.model.visible = false;
  G.stats.carsStolen++;
  if (witnessed || yanked) {
    G.policeApi?.addHeat?.(1, yanked ? 'Carjacking! The driver called it in.' : 'Someone saw you steal that car!');
  } else {
    G.hud?.toast('CLEAN STEAL — nobody saw that.');
  }
  G.audio?.carDoor();
  G.hud?.toast(`You took the ${car.def.name}.`);
}

export function exitCar() {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  p.car = null; p.onFoot = true;
  p.x = car.x - Math.sin(car.yaw + Math.PI / 2) * 2;
  p.z = car.z - Math.cos(car.yaw + Math.PI / 2) * 2;
  p.model.visible = true;
  p.model.position.set(p.x, 0, p.z);
  G.audio?.carDoor();
}

function witnessCheck(x, z) {
  for (const ped of G.peds) {
    if (dist2d(x, z, ped.x, ped.z) < 20 && !ped.fleeing) return true;
  }
  for (const cop of G.police) if (dist2d(x, z, cop.x, cop.z) < 40) return true;
  for (const off of G.officers) if (dist2d(x, z, off.x, off.z) < 30) return true;
  return false;
}
