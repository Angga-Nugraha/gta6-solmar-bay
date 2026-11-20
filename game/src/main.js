// Solmar Bay — boot, renderer, fixed-step loop, camera, game-state machine.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG, LOCATIONS } from './config.js';
import { makeRng, clamp, angleLerp } from './rng.js';
import { Input } from './input.js';
import { makeAllTextures } from './textures.js';
import { buildCity } from './city.js';
import { spawnParkedCars, updateCarFx } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { updateDriving, tryEnterCar } from './driving.js';
import { updateTraffic, bailDriver, spawnTrafficCar } from './traffic.js';
import { updatePeds, spawnPed } from './pedestrians.js';
import { updatePolice, addHeat, clearWanted, busted, wasted } from './police.js';
import { fireWeapon, reloadWeapon, switchWeapon, updateTracers, updateEnemies, meleeAttack, currentWeapon } from './combat.js';
import * as Missions from './missions.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { SaveSystem } from './save.js';
import { stageShot, updateShot } from './shots.js';

const FIXED = 1 / 60;
let renderer, clock;
let rng;
let camDist = CFG.CAMERA.footDist;
let orbitYaw = Math.PI;
let fovTarget = 60;

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas: document.getElementById('game-canvas') });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  G.renderer = renderer;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
  });
}

function initScene(seed) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CFG.COLOURS.fog, 120, 460);
  const skyGeo = new THREE.SphereGeometry(800, 16, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false,
    uniforms: { top: { value: new THREE.Color(0xffd9a0) }, bottom: { value: new THREE.Color(0x7fb8c9) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x8a6a4a, 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.COLOURS.sun, 2.3);
  sun.position.set(-180, 120, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(sun.target);
  G.scene = scene;
  G.sun = sun;
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
  G.camera = camera;
  const textures = makeAllTextures(makeRng(seed));
  buildCity(scene, textures, seed);
  return scene;
}

function initGame(seed) {
  rng = makeRng(seed);
  initRenderer();
  initScene(seed);
  G.input = new Input();
  G.hud = new Hud();
  G.audio = new AudioEngine();
  G.save = new SaveSystem();
  G.player = createPlayer(LOCATIONS.spawn.x, LOCATIONS.spawn.z);
  // Wire cross-system hooks (avoids circular imports).
  G.policeApi = { addHeat, clearWanted, busted, wasted };
  G.trafficApi = { bailDriver };
  G.pedestrians = { spawnPed };
  G.missions = Missions;
  G.driving = { nearestCar: (x, z, d) => {
    let best = null, bd = d;
    for (const c of G.cars) { const dd = Math.hypot(c.x - x, c.z - z); if (dd < bd) { bd = dd; best = c; } }
    return best;
  } };
  spawnParkedCars(rng);
  Missions.spawnShells(rng);
  G.hud.showMenu();
  G.camYaw = Math.PI;
  orbitYaw = Math.PI;
}

function startNewGame() {
  G.audio.ensure();
  resetWorld();
  G.mode = 'play';
  G.hud.el.menu.style.display = 'none';
  Missions.startMission(0);
  G.hud.toast('Welcome to Solmar Bay, Mara. Mission 1: Homecoming.');
}

function continueGame() {
  G.audio.ensure();
  resetWorld();
  G.save.applyToPlayer();
  G.mode = 'play';
  G.hud.el.menu.style.display = 'none';
  const idx = G.save.data?.missionIndex ?? 0;
  if (idx < Missions.MISSIONS.length) Missions.startMission(idx);
  G.hud.toast('Welcome back to Solmar Bay.');
}

function resetWorld() {
  // Fresh run: clear dynamic actors, respawn the player at the Strip.
  for (const c of [...G.cars]) { if (!c.owned) { const i = G.cars.indexOf(c); if (i >= 0) G.cars.splice(i, 1); G.scene.remove(c.model); } }
  for (const e of [...G.enemies]) G.scene.remove(e.model);
  G.enemies.length = 0;
  for (const o of [...G.officers]) G.scene.remove(o.model);
  G.officers.length = 0;
  for (const p of [...G.peds]) G.scene.remove(p.model);
  G.peds.length = 0;
  G.police.length = 0;
  G.traffic.length = 0;
  clearWanted();
  const p = G.player;
  p.x = LOCATIONS.spawn.x; p.z = LOCATIONS.spawn.z; p.hp = CFG.START_HP; p.armour = 0;
  p.onFoot = true; p.car = null; p.model.visible = true;
  p.model.position.set(p.x, 0, p.z);
  spawnParkedCars(rng);
}

G.startNewGame = startNewGame;
G.continueGame = continueGame;

function updateCamera(dt) {
  const p = G.player;
  const cam = G.camera;
  if (G.mode === 'title') {
    // Slow orbit around the Coral Crown behind the menu.
    const t = G.time * 0.05;
    const cx = LOCATIONS.coralCrown.x + Math.sin(t) * 90;
    const cz = LOCATIONS.coralCrown.z + Math.cos(t) * 90;
    cam.position.set(cx, 34, cz);
    cam.lookAt(LOCATIONS.coralCrown.x, 18, LOCATIONS.coralCrown.z);
    return;
  }
  // Mouse orbit on foot
  const mdx = G.input.consumeMouse();
  if (p.onFoot) {
    G.camYaw -= mdx * 0.0032;
    orbitYaw = G.camYaw;
  }
  const targetDist = p.onFoot ? CFG.CAMERA.footDist : CFG.CAMERA.carDist;
  const targetH = p.onFoot ? CFG.CAMERA.footHeight : CFG.CAMERA.carHeight;
  camDist = THREE.MathUtils.lerp(camDist, targetDist, Math.min(1, dt * 5));
  let yaw = p.onFoot ? G.camYaw : angleLerp(G.camYaw, p.yaw, Math.min(1, dt * 2.2));
  if (!p.onFoot) G.camYaw = yaw;
  const px = p.x - Math.sin(yaw) * camDist;
  const pz = p.z - Math.cos(yaw) * camDist;
  const py = (p.y ?? 0) + targetH;
  cam.position.set(px, py, pz);
  cam.lookAt(p.x, (p.y ?? 0) + 1.4, p.z);
  const speedRatio = p.car ? Math.abs(p.car.speed) / p.car.def.top : 0;
  fovTarget = 60 + speedRatio * 12;
  if (Math.abs(cam.fov - fovTarget) > 0.1) {
    cam.fov = THREE.MathUtils.lerp(cam.fov, fovTarget, Math.min(1, dt * 3));
    cam.updateProjectionMatrix();
  }
  // Sun shadow frustum follows the player
  if (G.sun) {
    G.sun.position.set(p.x - 180, 120, p.z + 60);
    G.sun.target.position.set(p.x, 0, p.z);
    G.sun.target.updateMatrixWorld();
  }
}

let acc = 0;
function step(dt) {
  G.time += dt;
  const input = G.input;
  if (G.mode === 'play') {
    // Global keys
    if (input.hit('Escape') || input.hit('KeyP')) {
      G.mode = 'pause';
      G.hud.showPause();
      document.exitPointerLock?.();
    }
    if (input.hit('KeyM')) {
      G.mode = 'pause';
      G.hud.showPause();
    }
    if (input.hit('KeyE')) tryEnterCar();
    if (input.hit('KeyF')) meleeAttack(currentWeapon());
    if (input.hit('KeyR')) reloadWeapon();
    if (input.hit('Digit1')) switchWeapon(1);
    if (input.hit('Digit2')) switchWeapon(2);
    if (input.hit('Digit3')) switchWeapon(3);
    if (input.hit('KeyQ')) G.audio.cycleRadio();
    if (input.hit('Digit0')) G.audio.toggleMute();
    // Shooting: hold for auto weapons
    const def = currentWeapon();
    if (def.auto ? input.down('Mouse0') : input.hit('Mouse0')) fireWeapon();
    if (G.player.onFoot) updatePlayer(dt); else updateDriving(dt);
    updateTraffic(dt, rng);
    updatePeds(dt, rng);
    updatePolice(dt, rng);
    updateEnemies(dt);
    Missions.updateMissions(dt);
    Missions.updateShells();
    updateTracers(dt);
    updateCarFx(dt);
    if (G.seaMat?.map) G.seaMat.map.offset.y = G.time * 0.02;
    // Siren when wanted
    G.audio.siren(G.wanted > 0);
    if (G.player.car) { /* engine sound driven in driving.js */ }
    else G.audio.engineOff();
    updateShot(dt);
  } else if (G.mode === 'title') {
    updateTraffic(dt, rng);
    updatePeds(dt, rng);
    updateShot(dt);
  }
  G.hud.update(dt);
  input.endFrame();
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.1);
  acc += dt;
  let n = 0;
  while (acc >= FIXED && n < 4) { step(FIXED); acc -= FIXED; n++; }
  updateCamera(dt);
  renderer.render(G.scene, G.camera);
  if (G.shotMode && G.shotReady) {
    // Freeze the frame for the screenshot.
    renderer.render(G.scene, G.camera);
  }
}

// --- Boot ---
window.__G = G;
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? CFG.SEED) || CFG.SEED;
G.seed = seed;
clock = new THREE.Clock();
initGame(seed);
const shot = params.get('shot');
if (shot) {
  // Shot mode: skip the menu, stage the scene immediately.
  G.audio.ensure = () => {};
  setTimeout(() => stageShot(shot), 300);
}
loop();
