// Mara Voss on foot — movement, sprint/stamina, jump, collision, character model.
import * as THREE from 'three';
import { G } from './state.js';
import { CFG } from './config.js';
import { collideCircle, clampToMap, onRoad } from './city.js';
import { clamp, angleLerp } from './rng.js';

export function createPlayer(x, z) {
  const group = new THREE.Group();
  // Low-poly figure: teal jacket, dark jeans — Mara's distinct silhouette.
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f8a8a, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a37e, roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.18; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skin);
  head.position.y = 1.72; head.castShadow = true; group.add(head);
  const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairM.position.y = 1.76; group.add(hairM);
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), jeans);
    leg.position.set(sx, 0.42, 0); leg.castShadow = true; group.add(leg); legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), jacket);
    arm.position.set(sx, 1.2, 0); arm.castShadow = true; group.add(arm); arms.push(arm);
  }
  group.position.set(x, 0, z);
  G.scene.add(group);
  return {
    model: group, legs, arms,
    x, z, y: 0, vy: 0, yaw: Math.PI, onFoot: true, car: null,
    hp: CFG.START_HP, armour: 0, cash: CFG.START_CASH,
    stamina: CFG.STAMINA_MAX, speed: 0, walkPhase: 0,
    weapons: { fists: { mag: Infinity, reserve: Infinity }, pistol: { mag: 6, reserve: 48 } },
    weapon: 'pistol', ownedCars: [],
    grounded: true, inWater: false,
  };
}

export function updatePlayer(dt) {
  const p = G.player;
  const input = G.input;
  if (!p.onFoot) return;
  // Camera-relative movement
  let mx = 0, mz = 0;
  if (input.down('KeyW')) mz -= 1;
  if (input.down('KeyS')) mz += 1;
  if (input.down('KeyA')) mx -= 1;
  if (input.down('KeyD')) mx += 1;
  const len = Math.hypot(mx, mz) || 1;
  mx /= len; mz /= len;
  const sprinting = input.down('ShiftLeft') && p.stamina > 1 && mz < 0;
  const speed = sprinting ? CFG.SPRINT_SPEED : CFG.WALK_SPEED;
  const sin = Math.sin(G.camYaw), cos = Math.cos(G.camYaw);
  // Forward is (sin, cos); right is (-cos, sin). W = forward, D = right.
  const wx = (-mz * sin - mx * cos) * speed;
  const wz = (-mz * cos + mx * sin) * speed;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    p.x += wx * dt; p.z += wz * dt;
    p.yaw = angleLerp(p.yaw, Math.atan2(wx, wz), Math.min(1, dt * 12));
    p.speed = speed;
    p.walkPhase += dt * speed * 1.6;
    if (sprinting) p.stamina = Math.max(0, p.stamina - dt * 16);
    G.audio?.footstep(p.walkPhase);
  } else {
    p.speed = 0;
    p.stamina = Math.min(CFG.STAMINA_MAX, p.stamina + dt * 22);
  }
  // Jump
  if (input.hit('Space') && p.grounded) { p.vy = CFG.JUMP_V; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= CFG.GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
  }
  // Collisions + map bounds
  const pushed = collideCircle(p.x, p.z, 0.45);
  p.x = pushed.x; p.z = pushed.z;
  const clamped = clampToMap(p.x, p.z);
  p.x = clamped.x; p.z = clamped.z;
  // Beach water: deeper than the sand edge respawns the player
  if (p.x > CFG.MAP_W / 2 + 30) {
    p.x = CFG.MAP_W / 2 + 18; p.hp = Math.max(10, p.hp - 10);
    G.hud?.toast('The tide is not your friend. -10 HP');
  }
  // Walk animation: swing legs/arms
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  p.legs[0].rotation.x = swing; p.legs[1].rotation.x = -swing;
  p.arms[0].rotation.x = -swing * 0.8; p.arms[1].rotation.x = swing * 0.8;
  p.model.position.set(p.x, p.y, p.z);
  p.model.rotation.y = p.yaw;
  // Sand slows movement slightly
  if (p.x > CFG.MAP_W / 2 - 10) { /* visual only, speed already applied */ }
  void onRoad;
}

export function damagePlayer(amount, source) {
  const p = G.player;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, amount);
    p.armour -= absorbed; amount -= absorbed;
  }
  p.hp -= amount;
  G.hud?.flashDamage();
  if (p.hp <= 0) {
    if (source === 'police') G.policeApi?.busted?.();
    else G.policeApi?.wasted?.();
  }
}

export function healPlayer(amount) {
  G.player.hp = clamp(G.player.hp + amount, 0, CFG.START_HP);
}
