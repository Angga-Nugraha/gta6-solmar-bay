// Traffic AI — cars follow the road graph, stop at red lights, brake for the car ahead.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG } from './config.js';
import { nearestRoadNode, nextRoadNode } from './city.js';
import { spawnCar, removeCar, PARKED_COLOURS } from './vehicles.js';
import { makeRng, clamp, dist2d } from './rng.js';

const TRAFFIC_TYPES = ['comet', 'breeze', 'hauler', 'solcab', 'comet', 'breeze'];

export function spawnTrafficCar(rng, nearX, nearZ) {
  const type = rng.pick(TRAFFIC_TYPES);
  const node = nearestRoadNode(nearX + rng.range(-80, 80), nearZ + rng.range(-80, 80));
  const n = G.roadNodes[node];
  const car = spawnCar(type, n.x + rng.range(-2, 2), n.z + rng.range(-2, 2), rng.range(0, Math.PI * 2),
    { driver: 'traffic', colour: rng.pick(PARKED_COLOURS) });
  car.nodeIdx = node;
  car.targetNode = nextRoadNode(node, rng);
  car.cruise = rng.range(8, 12);
  car.waitTimer = 0;
  G.traffic.push(car);
  return car;
}

export function bailDriver(car) {
  // Driver flees on foot and becomes a pedestrian.
  car.driver = null;
  G.pedestrians?.spawnPed?.(car.x + 2, car.z, true);
  G.hud?.toast('The driver bailed out!');
}

export function updateTraffic(dt, rng) {
  const p = G.player;
  // Maintain population near the player
  while (G.traffic.length < CFG.TRAFFIC_MAX) {
    spawnTrafficCar(rng, p.x, p.z);
  }
  for (let i = G.traffic.length - 1; i >= 0; i--) {
    const car = G.traffic[i];
    const dPlayer = dist2d(car.x, car.z, p.x, p.z);
    if (dPlayer > 160) {
      removeCar(car);
      spawnTrafficCar(rng, p.x, p.z);
      continue;
    }
    if (car.stuckTimer > 3) { // stuck fallback: pick a new route
      car.targetNode = nextRoadNode(car.nodeIdx, rng);
      car.stuckTimer = 0;
    }
    const target = G.roadNodes[car.targetNode];
    const dx = target.x - car.x, dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.nodeIdx = car.targetNode;
      car.targetNode = nextRoadNode(car.nodeIdx, rng);
    }
    const wantYaw = Math.atan2(dx, dz);
    let dyaw = wantYaw - car.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    car.yaw += clamp(dyaw, -1.6 * dt, 1.6 * dt);
    // Gap check: brake for the car ahead
    let gapClear = true;
    for (const other of G.cars) {
      if (other === car) continue;
      const od = dist2d(car.x, car.z, other.x, other.z);
      if (od < 7) {
        const ahead = (other.x - car.x) * Math.sin(car.yaw) + (other.z - car.z) * Math.cos(car.yaw);
        if (ahead > 0) gapClear = false;
      }
    }
    // Traffic lights: loosely obeyed (70%)
    const lightRed = Math.floor(G.time / 6) % 2 === 0;
    const atIntersection = Math.abs(car.x - Math.round(car.x / 84) * 84) < 6;
    const stopForLight = lightRed && atIntersection && car.obeys !== false;
    if (car.obeys === undefined) car.obeys = rng.next() < 0.7;
    const targetSpeed = gapClear && !stopForLight ? car.cruise : 0;
    car.speed = THREE.MathUtils.damp(car.speed, targetSpeed, 2, dt);
    if (Math.abs(car.speed) < 0.3 && targetSpeed > 0) car.stuckTimer += dt;
    else car.stuckTimer = 0;
    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;
    car.model.position.set(car.x, 0, car.z);
    car.model.rotation.y = car.yaw;
  }
}
