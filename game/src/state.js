// Shared mutable game state. main.js fills it; every system reads/writes it.
// One object keeps the wiring simple and avoids circular imports.
import * as THREE from 'three';
export const G = {
  seed: 7,
  mode: 'title', // title | play | pause | busted | wasted | missionpass | missionfail | credits
  time: 0, elapsed: 0,
  scene: null, camera: null, renderer: null,
  sun: null,
  colliders: [], // {x, z, hx, hz}
  roadNodes: [], // {x, z} intersections
  roadEdges: [], // [a, b] node indices
  player: null,
  cars: [],       // all drivable cars (parked + traffic + police)
  traffic: [],    // traffic cars (subset of cars, AI driven)
  peds: [],
  police: [],     // police cars in pursuit
  officers: [],
  enemies: [],
  shells: [],
  pickups: [],
  beacons: [],
  particles: [],
  tracers: [],
  mission: null,
  wanted: 0, heatTimer: 0, hiddenTimer: 0,
  stats: { earned: 0, carsStolen: 0, shotsFired: 0, kills: 0, missionsDone: 0 },
  input: null,
  hud: null,
  audio: null,
  save: null,
  shotMode: null,
  shotFrame: 0,
  shotReady: false,
  camYaw: 0, camPitch: -0.18,
  tmpV: new THREE.Vector3(),
};
export function resetRunState() {
  G.wanted = 0; G.heatTimer = 0; G.hiddenTimer = 0; G.time = 0;
  G.enemies.length = 0; G.police.length = 0; G.officers.length = 0;
  G.stats = { earned: 0, carsStolen: 0, shotsFired: 0, kills: 0, missionsDone: 0 };
}
