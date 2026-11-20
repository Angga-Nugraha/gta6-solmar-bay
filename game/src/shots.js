// ?shot= staging — the autopilot plays the real game to a fixed frame per screenshot.
// Contract: render twice, freeze, set window.__shotReady when the frame is final.
import { G } from './state.js';
import { LOCATIONS } from './config.js';
import { spawnCar } from './vehicles.js';
import { spawnEnemy } from './combat.js';
import * as Missions from './missions.js';
import { addHeat } from './police.js';

function placePlayer(x, z, yaw) {
  const p = G.player;
  p.x = x; p.z = z; p.yaw = yaw; p.onFoot = true; p.car = null;
  p.model.visible = true;
  p.model.position.set(x, 0, z);
}

export function stageShot(name) {
  G.shotMode = name;
  const hud = G.hud;
  if (name === 'cover') {
    // Mara sprinting down the Neon Strip, Coral Crown behind, traffic + peds around.
    G.mode = 'play';
    hud.el.menu.style.display = 'none';
    placePlayer(126, 78, Math.PI);
    G.camYaw = Math.PI;
    Missions.startMission(0);
    // Park a stolen Breeze at the kerb with its door open (visual: car beside her).
    spawnCar('breeze', 132, 66, Math.PI / 2, { owned: true });
    G.player.cash = 1250;
  } else if (name === 'chase') {
    G.mode = 'play';
    hud.el.menu.style.display = 'none';
    const car = spawnCar('meridian', 126, 140, Math.PI, { driver: 'player', owned: true });
    const p = G.player;
    p.car = car; p.onFoot = false; p.model.visible = false;
    p.x = car.x; p.z = car.z;
    car.speed = 30;
    G.camYaw = Math.PI;
    addHeat(3, 'LOSE THE COPS');
    Missions.startMission(5);
    Missions.overrideObjective('Escape to Solmar Beach — lose the cops');
    G.player.cash = 2400;
    // Two interceptors right behind
    spawnCar('interceptor', 126, 168, Math.PI, { driver: 'police' });
    spawnCar('interceptor', 120, 176, Math.PI, { driver: 'police' });
  } else if (name === 'mission') {
    G.mode = 'play';
    hud.el.menu.style.display = 'none';
    placePlayer(40, -118, Math.PI * 0.9);
    G.camYaw = Math.PI * 0.9;
    G.player.weapon = 'smg';
    G.player.weapons.smg = { mag: 24, reserve: 120 };
    Missions.startMission(6);
    // Jump the mission straight to its first fight beat with enemies visible.
    spawnEnemy(46, -132, 'kings', 60, 'smg');
    spawnEnemy(52, -142, 'court', 60, 'pistol');
    G.player.cash = 3100;
  } else if (name === 'menu') {
    G.mode = 'title';
    placePlayer(126, 60, Math.PI);
    G.camYaw = Math.PI;
    hud.showMenu();
  }
  // Let the world settle for ~45 frames, then freeze.
  G.shotFrame = 0;
  G.shotTarget = 45;
}

export function updateShot(dt) {
  if (!G.shotMode) return;
  // Scripted motion per shot so the frame is alive, not static.
  if (G.shotMode === 'cover') {
    G.input.shotKeys = ['KeyW', 'ShiftLeft'];
    G.camYaw = Math.PI;
  } else if (G.shotMode === 'chase') {
    G.input.shotKeys = ['KeyW'];
    G.camYaw = Math.PI;
  } else if (G.shotMode === 'mission') {
    G.input.shotKeys = [];
  }
  G.shotFrame++;
  if (G.shotFrame >= (G.shotTarget ?? 90) && !G.shotReady) {
    G.shotReady = true;
    window.__shotReady = true;
    document.title = `shot-ready:${G.shotMode}`;
  }
}
