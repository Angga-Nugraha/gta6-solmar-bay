// Story — 8 missions for Mara Voss, plus taxi / courier / rampage side jobs and golden shells.
import * as THREE from 'three';
import { G } from './state.js';
import { LOCATIONS } from './config.js';
import { spawnEnemy } from './combat.js';
import { spawnCar } from './vehicles.js';
import { dist2d } from './rng.js';
import { addHeat } from './police.js';

export const MISSIONS = [
  { id: 1, title: 'Homecoming', reward: 200,
    intro: 'Deke: "Mara. Your brother would want you here. Drive to Plaza del Sol — meet me there."',
    beats: [
      { type: 'drive', x: LOCATIONS.plazaDelSol.x, z: LOCATIONS.plazaDelSol.z, r: 11, text: 'Drive to Plaza del Sol' },
      { type: 'goto', x: LOCATIONS.plazaDelSol.x + 4, z: LOCATIONS.plazaDelSol.z + 4, r: 9, text: 'Meet Deke at the fountain' },
    ] },
  { id: 2, title: 'Dock 9 Pickup', reward: 400, unlock: 'bat',
    intro: 'Deke: "The Kings left a Hauler at Dock 9. Take it. Quietly, if you can."',
    beats: [
      { type: 'steal', text: 'Steal a Hauler at Dock 9', targetType: 'hauler' },
      { type: 'drive', x: LOCATIONS.oldTown.x, z: LOCATIONS.oldTown.z, r: 10, text: 'Deliver the Hauler to Old Town' },
      { type: 'escape', text: 'Lose the cops', seconds: 20 },
    ] },
  { id: 3, title: 'Neon Debt', reward: 500,
    intro: 'Vera Solano wants her money. Three debtors on the Strip. Collect — no killing needed.',
    beats: [
      { type: 'collect', spots: [[126, 60], [126, 100], [210, -10]], r: 4, text: 'Collect the debts on the Strip' },
      { type: 'fight', gang: 'court', count: 3, x: 126, z: 60, text: 'Neon Court goons showed up — deal with them' },
    ] },
  { id: 4, title: 'The Ledger, Part 1', reward: 700, unlock: 'smg',
    intro: 'Theo kept a ledger. It is in the Coral Crown garage. Photograph it — then run.',
    beats: [
      { type: 'goto', x: LOCATIONS.coralCrown.x - 30, z: LOCATIONS.coralCrown.z, r: 6, text: 'Slip into the Coral Crown garage' },
      { type: 'photo', x: LOCATIONS.coralCrown.x - 26, z: LOCATIONS.coralCrown.z, r: 5, hold: 3, text: 'Hold E — photograph the ledger' },
      { type: 'fight', gang: 'court', count: 4, x: LOCATIONS.coralCrown.x - 24, z: LOCATIONS.coralCrown.z + 10, text: 'Shootout — get out of the garage' },
    ] },
  { id: 5, title: "Finn's Favour", reward: 350, unlock: 'meridian',
    intro: 'Finn: "Drive my cab, three fares. Do it clean and the Meridian GT is yours."',
    beats: [
      { type: 'taxi', fares: 3, text: 'Drive 3 taxi fares for Finn' },
      { type: 'goto', x: LOCATIONS.garage.x, z: LOCATIONS.garage.z, r: 6, text: 'Return to Finn\'s Garage' },
    ] },
  { id: 6, title: "Kings' Gambit", reward: 900,
    intro: 'A Harbor Kings convoy is rolling through Downtown. Hit it. Take the cash truck.',
    beats: [
      { type: 'fight', gang: 'kings', count: 4, x: 42, z: -100, text: 'Ambush the Kings convoy' },
      { type: 'steal', text: 'Steal the convoy Hauler', targetType: 'hauler' },
      { type: 'drive', x: LOCATIONS.beach.x, z: LOCATIONS.beach.z, r: 12, text: 'Escape to Solmar Beach — 3 stars on you' },
    ] },
  { id: 7, title: 'The Ledger, Part 2', reward: 1200,
    intro: 'The penthouse. Meridian Tower. Rook is up there — and he knows who ordered the hit.',
    beats: [
      { type: 'fight', gang: 'kings', count: 4, x: 50, z: -130, text: 'Storm the penthouse — wave 1' },
      { type: 'fight', gang: 'court', count: 4, x: 50, z: -152, text: 'Wave 2 — Vera\'s people' },
      { type: 'goto', x: 42, z: LOCATIONS.meridianTower.z, r: 6, text: 'Confront Rook' },
    ] },
  { id: 8, title: "Solmar's Choice", reward: 0,
    intro: 'Vera is running. Chase her convoy down the Strip, take the ledger back — then choose.',
    beats: [
      { type: 'drive', x: LOCATIONS.pier.x - 40, z: LOCATIONS.pier.z, r: 12, text: 'Chase Vera\'s convoy to the Pier' },
      { type: 'fight', gang: 'court', count: 3, x: LOCATIONS.pier.x - 20, z: LOCATIONS.pier.z, text: 'Final shootout at the Pier' },
      { type: 'choice', text: 'The ledger is yours. Hand it to Inspector Marsh — or burn it and keep the cash?' },
    ] },
];

let current = null; // {def, beatIdx, beatState, timeout, startedAt}
let sideJob = null; // {kind, ...}
let beacon = null;
let photoProgress = 0;

export function missionIndex() { return G.save?.data?.missionIndex ?? 0; }

export function startMission(idx) {
  const def = MISSIONS[idx];
  if (!def) return false;
  current = { def, beatIdx: 0, beatState: {}, timeout: 90, startedAt: G.time, faresDone: 0 };
  G.mission = current;
  G.hud?.showIntroCard(def.title, def.intro);
  G.audio?.phoneRing();
  setupBeat();
  G.hud?.toast(`MISSION ${def.id} — ${def.title}`);
  return true;
}

function setupBeat() {
  const beat = current.def.beats[current.beatIdx];
  current.beatState = { count: 0, stolenBefore: G.stats.carsStolen, fares: 0 };
  current.timeout = 90;
  photoProgress = 0;
  if (beacon) { G.scene.remove(beacon); beacon = null; }
  if (beat.x !== undefined) setBeacon(beat.x, beat.z);
  if (beat.spots) setBeacon(beat.spots[0][0], beat.spots[0][1]);
  if (beat.type === 'fight') {
    const bx = beat.x, bz = beat.z;
    for (let i = 0; i < beat.count; i++) {
      spawnEnemy(bx + (i % 2 ? 6 : -6) + i, bz + (i < 2 ? 4 : -4), beat.gang, 60, beat.gang === 'court' ? 'smg' : 'pistol');
    }
    current.beatState.total = beat.count;
  }
  if (beat.type === 'drive' && current.def.id === 6) addHeat(3, '3 stars — the SBPD is all over you!');
  if (beat.type === 'steal' && current.def.id === 2) addHeat(1, 'Dock security is watching.');
  G.hud?.setObjective(current.def.title, beat.text, beat);
}

function setBeacon(x, z) {
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  beacon = new THREE.Mesh(geo, mat);
  beacon.position.set(x, 30, z);
  G.scene.add(beacon);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.1, z);
  G.scene.add(ring);
  beacon.userData.ring = ring;
}

function clearBeacon() {
  if (!beacon) return;
  G.scene.remove(beacon.userData.ring);
  G.scene.remove(beacon);
  beacon = null;
}

export function overrideObjective(text) {
  if (current) current.beatState.overrideText = text;
}

export function onEnemyDown(enemy) {
  if (!current) return;
  const beat = current.def.beats[current.beatIdx];
  if (beat.type === 'fight') {
    current.beatState.count++;
    if (current.beatState.count >= beat.count) advanceBeat();
  }
}

function advanceBeat() {
  current.beatIdx++;
  if (current.beatIdx >= current.def.beats.length) completeMission();
  else setupBeat();
}

function completeMission() {
  const def = current.def;
  let payout = def.reward;
  if (def.id === 8) payout = 0; // choice beat pays separately
  G.player.cash += payout;
  G.stats.earned += payout;
  G.stats.missionsDone++;
  if (def.unlock === 'bat') {
    G.player.weapons.bat = { mag: Infinity, reserve: Infinity };
    G.hud?.toast('Unlocked: Street Sweeper bat (slot 1).');
  }
  if (def.unlock === 'smg') {
    G.player.weapons.smg = { mag: 30, reserve: 120 };
    G.hud?.toast('Unlocked: Bay Repeater SMG (slot 3).');
  }
  if (def.unlock === 'meridian') {
    const car = spawnCar('meridian', LOCATIONS.garage.x + 8, LOCATIONS.garage.z, 0, { owned: true });
    G.player.ownedCars.push(car);
    G.hud?.toast('Finn gave you the Meridian GT. It waits at his garage.');
  }
  clearBeacon();
  G.save?.setMissionIndex?.(Math.min(current.def.id, MISSIONS.length));
  G.save?.autosave?.();
  G.hud?.showMissionPassed(def.title, payout);
  G.audio?.missionPassed();
  G.mode = 'missionpass';
  current = null; G.mission = null;
}

export function failCurrent(reason) {
  if (!current) return;
  G.hud?.showMissionFailed(current.def.title, reason);
  G.mode = 'missionfail';
  clearBeacon();
  current = null; G.mission = null;
}

export function retryMission() {
  const idx = missionIndex();
  G.mode = 'play';
  startMission(Math.min(idx, MISSIONS.length - 1));
}

export function updateMissions(dt) {
  if (beacon) beacon.rotation.y += dt;
  if (!current) { updateSideJob(dt); return; }
  const beat = current.def.beats[current.beatIdx];
  const p = G.player;
  current.timeout -= dt;
  if (current.timeout <= 0) {
    G.hud?.toast('SKIPPED — the city moves on. Half payout.');
    G.player.cash += Math.round(current.def.reward / 2);
    advanceBeat();
    return;
  }
  const d = beat.x !== undefined ? dist2d(p.x, p.z, beat.x, beat.z) : Infinity;
  switch (beat.type) {
    case 'goto':
      if (d < beat.r) advanceBeat();
      break;
    case 'drive':
      if (d < beat.r && !p.onFoot) advanceBeat();
      else if (d < beat.r && p.onFoot) G.hud?.toast('Get in a car to finish this.');
      break;
    case 'steal':
      if (G.stats.carsStolen > current.beatState.stolenBefore) {
        if (!beat.targetType || (p.car && p.car.type === beat.targetType)) advanceBeat();
        else G.hud?.toast(`Wrong car — steal a ${beat.targetType}.`);
      }
      break;
    case 'collect': {
      const spot = beat.spots[current.beatState.count];
      if (spot && dist2d(p.x, p.z, spot[0], spot[1]) < beat.r) {
        current.beatState.count++;
        G.player.cash += 60;
        G.hud?.toast('Debt collected +$60.');
        if (current.beatState.count >= beat.spots.length) advanceBeat();
        else setBeacon(beat.spots[current.beatState.count][0], beat.spots[current.beatState.count][1]);
      }
      break;
    }
    case 'photo':
      if (d < beat.r && G.input.down('KeyE')) {
        photoProgress += dt;
        G.hud?.setProgress(photoProgress / beat.hold, 'PHOTOGRAPHING LEDGER…');
        if (photoProgress >= beat.hold) { G.hud?.setProgress(0, ''); advanceBeat(); }
      } else { photoProgress = Math.max(0, photoProgress - dt); G.hud?.setProgress(0, ''); }
      break;
    case 'taxi':
      if (current.beatState.fares >= beat.fares) advanceBeat();
      break;
    case 'escape':
      current.beatState.t = (current.beatState.t ?? 0) + dt;
      if (G.wanted === 0 && current.beatState.t > 3) advanceBeat();
      break;
    case 'fight':
      break; // advanced by onEnemyDown
    case 'choice':
      G.hud?.showChoice();
      break;
  }
  updateSideJob(dt);
}

export function resolveChoice(clean) {
  const p = G.player;
  if (clean) {
    p.cash += 500; G.stats.earned += 500;
    G.hud?.toast('CLEAN ENDING — Inspector Marsh takes the ledger. +$500. Wanted cleared.');
    G.policeApi?.clearWanted?.();
  } else {
    p.cash += 2000; G.stats.earned += 2000;
    addHeat(5, 'You burned the ledger. +$2,000 — and every cop in Solmar Bay is coming.');
  }
  G.stats.missionsDone++;
  G.save?.setMissionIndex?.(MISSIONS.length);
  G.save?.autosave?.();
  G.mode = 'credits';
  G.hud?.showCredits(clean);
  current = null; G.mission = null;
  clearBeacon();
}

// --- Side jobs (free roam, repeatable) ---
export function startTaxiJob() {
  if (sideJob) return;
  const fares = [
    [LOCATIONS.pier.x, LOCATIONS.pier.z],
    [-126, LOCATIONS.plazaDelSol.z],
    [42, -100],
  ];
  sideJob = { kind: 'taxi', fares, idx: 0, timer: 120 };
  setBeacon(fares[0][0], fares[0][1]);
  G.hud?.setObjective('SolCab Taxi', 'Pick up the fare', null);
  G.hud?.toast('Taxi job — pick up the fare before the timer runs out.');
}
export function startCourierJob() {
  if (sideJob) return;
  sideJob = { kind: 'courier', x: -210, z: -130, timer: 90 };
  setBeacon(sideJob.x, sideJob.z);
  G.hud?.setObjective('Courier Run', 'Deliver the package to Dock 9 — 90 s', null);
}
export function startRampage() {
  if (sideJob) return;
  sideJob = { kind: 'rampage', damage: 0, timer: 120 };
  G.hud?.setObjective('Rampage', 'Cause $5,000 damage in 2 minutes', null);
  G.hud?.toast('RAMPAGE — cause chaos. $300 if you hit $5,000 damage.');
}

function updateSideJob(dt) {
  if (!sideJob) return;
  const p = G.player;
  sideJob.timer -= dt;
  if (sideJob.timer <= 0) { G.hud?.toast('Job failed — out of time.'); endSideJob(); return; }
  if (sideJob.kind === 'taxi') {
    const f = sideJob.fares[sideJob.idx];
    if (f && dist2d(p.x, p.z, f[0], f[1]) < 8) {
      const pay = 40 + Math.floor(Math.random() * 50);
      p.cash += pay; G.stats.earned += pay;
      G.hud?.toast(`Fare complete +$${pay}.`);
      sideJob.idx++;
      if (current) current.beatState.fares++;
      if (sideJob.idx >= sideJob.fares.length) { G.hud?.toast('Taxi job done!'); endSideJob(); }
      else setBeacon(sideJob.fares[sideJob.idx][0], sideJob.fares[sideJob.idx][1]);
    }
  } else if (sideJob.kind === 'courier') {
    if (dist2d(p.x, p.z, sideJob.x, sideJob.z) < 8) {
      p.cash += 60; G.stats.earned += 60;
      G.hud?.toast('Package delivered +$60.'); endSideJob();
    }
  } else if (sideJob.kind === 'rampage') {
    sideJob.damage += 0; // damage counted via carDamage hook below
    if (sideJob.damage >= 5000) {
      p.cash += 300; G.stats.earned += 300;
      G.hud?.toast('RAMPAGE COMPLETE +$300.'); endSideJob();
    }
  }
}
export function addRampageDamage(amount) {
  if (sideJob?.kind === 'rampage') sideJob.damage += amount * 40;
}
function endSideJob() { sideJob = null; clearBeacon(); G.hud?.setObjective('', '', null); }

// --- Golden shells (20 collectibles) ---
export function spawnShells(rng) {
  const spots = [];
  for (let i = 0; i < 20; i++) {
    spots.push({ x: 250 + rng.range(-14, 6), z: -180 + i * 19 });
  }
  spots.push({ x: 126, z: 60 }, { x: -140, z: 130 });
  const geo = new THREE.SphereGeometry(0.35, 8, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  for (const s of spots) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(s.x, 0.5, s.z);
    G.scene.add(mesh);
    G.shells.push({ mesh, x: s.x, z: s.z, found: false });
  }
}
export function updateShells() {
  const p = G.player;
  let found = 0;
  for (const s of G.shells) {
    if (s.found) { found++; continue; }
    s.mesh.rotation.y += 0.02;
    if (dist2d(p.x, p.z, s.x, s.z) < 2) {
      s.found = true; G.scene.remove(s.mesh);
      p.cash += 50; G.stats.earned += 50;
      G.hud?.toast(`Golden shell found! ${found + 1}/20 — +$50.`);
      G.audio?.pickup();
      if (found + 1 >= 20) { p.cash += 1000; G.hud?.toast('SHELL HUNTER — all 20 shells! +$1,000.'); }
    }
  }
  return found;
}
export function shellsFound() { return G.shells.filter((s) => s.found).length; }
