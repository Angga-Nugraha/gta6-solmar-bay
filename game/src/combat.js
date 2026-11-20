// Combat — hitscan shooting, melee, enemy gang AI (cover / strafe / burst / flee).
import * as THREE from 'three';
import { G } from './state.js';
import { WEAPON_DEFS } from './config.js';
import { clamp, dist2d } from './rng.js';
import { scarePeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

const raycaster = new THREE.Raycaster();

export function currentWeapon() { return WEAPON_DEFS[G.player.weapon]; }

export function switchWeapon(slot) {
  const p = G.player;
  const map = { 1: p.weapons.bat ? 'bat' : 'fists', 2: 'pistol', 3: 'smg' };
  const w = map[slot];
  if (w && p.weapons[w]) { p.weapon = w; G.hud?.toast(currentWeapon().name); }
}

export function fireWeapon() {
  const p = G.player;
  if (!p.onFoot) return;
  const def = currentWeapon();
  const w = p.weapons[p.weapon];
  if (def.slot === 1) { meleeAttack(def); return; }
  if (w.mag <= 0) { G.audio?.dryFire(); G.hud?.toast('Out of ammo — press R to reload, or visit Iron & Lead.'); return; }
  w.mag--;
  G.stats.shotsFired++;
  G.audio?.gunshot(1);
  // Hitscan from camera centre
  raycaster.setFromCamera({ x: 0, y: 0 }, G.camera);
  raycaster.far = def.range;
  const targets = [];
  for (const e of G.enemies) if (e.hp > 0) targets.push(e.model);
  for (const o of G.officers) targets.push(o.model);
  for (const ped of G.peds) targets.push(ped.model);
  const hits = raycaster.intersectObjects(targets, true);
  let hitEnemy = null;
  if (hits.length) {
    const obj = hits[0].object;
    let root = obj;
    while (root.parent && root.parent !== G.scene) root = root.parent;
    hitEnemy = G.enemies.find((e) => e.model === root)
      || G.officers.find((o) => o.model === root)
      || G.peds.find((pd) => pd.model === root);
    const headshot = hits[0].object.position.y > 1.5;
    if (hitEnemy) {
      const dmg = def.dmg * (headshot ? 2 : 1);
      damageEnemy(hitEnemy, dmg, hits[0].point);
      G.hud?.hitmarker(headshot);
    }
  }
  spawnTracer(hits.length ? hits[0].point : null);
  G.hud?.muzzleFlash();
  scarePeds(p.x, p.z, 30);
  // Firing in public raises heat
  const nearCop = G.police.some((c) => dist2d(c.x, c.z, p.x, p.z) < 40)
    || G.officers.some((o) => dist2d(o.x, o.z, p.x, p.z) < 40)
    || G.peds.some((pd) => dist2d(pd.x, pd.z, p.x, p.z) < 30);
  if (nearCop) G.policeApi?.addHeat?.(1, 'Gunfire reported!');
}

export function meleeAttack(def) {
  const p = G.player;
  G.audio?.punch();
  let hitAny = false;
  const all = [...G.enemies, ...G.officers, ...G.peds];
  for (const e of all) {
    if (e.hp !== undefined && e.hp <= 0) continue;
    const d = dist2d(p.x, p.z, e.x, e.z);
    if (d < def.range) {
      const ang = Math.atan2(e.x - p.x, e.z - p.z);
      let da = Math.abs(ang - p.yaw);
      if (da > Math.PI) da = Math.PI * 2 - da;
      if (da < 1.1) {
        damageEnemy(e, def.dmg, null);
        hitAny = true;
        e.x += Math.sin(ang) * 1.2; e.z += Math.cos(ang) * 1.2;
      }
    }
  }
  if (!hitAny) G.hud?.toast(def.name === 'Fists' ? 'You swing at the air.' : 'The bat whistles through empty air.');
}

export function reloadWeapon() {
  const p = G.player;
  const def = currentWeapon();
  const w = p.weapons[p.weapon];
  if (!w || def.slot === 1 || w.mag >= def.mag || w.reserve <= 0) return;
  const need = def.mag - w.mag;
  const take = Math.min(need, w.reserve);
  w.mag += take; w.reserve -= take;
  G.audio?.reload();
  G.hud?.toast(`Reloaded ${def.name}.`);
}

function damageEnemy(enemy, dmg, point) {
  enemy.hp -= dmg;
  G.hud?.hitmarker(false);
  if (point) spawnHitSpark(point);
  if (enemy.hp <= 0) {
    G.stats.kills++;
    enemy.model.rotation.x = -Math.PI / 2; // tip over, fade out
    enemy.model.position.y = 0.3;
    enemy.dead = true;
    enemy.fadeTimer = 2;
    G.missions?.onEnemyDown?.(enemy);
    if (enemy.gang) G.hud?.toast(`${enemy.gang} down.`);
  }
}

function spawnTracer(endPoint) {
  const p = G.player;
  const start = new THREE.Vector3(p.x, p.y + 1.4, p.z);
  const end = endPoint ?? new THREE.Vector3().copy(start).add(
    new THREE.Vector3().setFromMatrixColumn(G.camera.matrix, 2).multiplyScalar(-40));
  const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.tracers.push({ mesh: line, life: 0.08 });
}

function spawnHitSpark(point) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe95a }));
  s.position.copy(point);
  G.scene.add(s);
  G.tracers.push({ mesh: s, life: 0.15 });
}

export function updateTracers(dt) {
  for (let i = G.tracers.length - 1; i >= 0; i--) {
    const t = G.tracers[i];
    t.life -= dt;
    if (t.life <= 0) { G.scene.remove(t.mesh); G.tracers.splice(i, 1); }
  }
}

// --- Enemy gang members ---
const GANG_COLOURS = { kings: 0x1a3a6a, court: 0x6a1a6a };
export function spawnEnemy(x, z, gang, hp = 60, weapon = 'pistol') {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: GANG_COLOURS[gang] ?? 0x333333, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a37e, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.32), jacket);
  torso.position.y = 1.15; torso.castShadow = true; group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), skin);
  head.position.y = 1.68; group.add(head);
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    leg.position.set(sx, 0.4, 0); group.add(leg);
  }
  // visible weapon
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x111111 }));
  gun.position.set(0.35, 1.25, 0.2); group.add(gun);
  group.position.set(x, 0, z);
  G.scene.add(group);
  // HP bar above head
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x222222 }));
  barBg.position.y = 2.1; group.add(barBg);
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xff3a3a }));
  barFg.position.set(0, 2.1, 0.01); group.add(barFg);
  const enemy = {
    model: group, barFg, x, z, yaw: 0, hp, maxHp: hp, gang, weapon,
    shootTimer: 1.5, strafeDir: 1, strafeTimer: 2, dead: false, fadeTimer: 0,
  };
  G.enemies.push(enemy);
  return enemy;
}

export function updateEnemies(dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (e.dead) {
      e.fadeTimer -= dt;
      e.model.position.y = 0.3 - (2 - e.fadeTimer) * 0.1;
      if (e.fadeTimer <= 0) { G.scene.remove(e.model); G.enemies.splice(i, 1); }
      continue;
    }
    const d = dist2d(e.x, e.z, p.x, p.z);
    const wantYaw = Math.atan2(p.x - e.x, p.z - e.z);
    e.yaw = wantYaw;
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) { e.strafeDir *= -1; e.strafeTimer = 1.5 + Math.random(); }
    // Flee at low HP sometimes
    if (e.hp < 20 && Math.random() < 0.002) {
      e.x -= Math.sin(wantYaw) * 6 * dt; e.z -= Math.cos(wantYaw) * 6 * dt;
    } else if (d > 12) {
      e.x += Math.sin(wantYaw) * 3.4 * dt;
      e.z += Math.cos(wantYaw) * 3.4 * dt;
    } else if (d > 5) {
      e.x += Math.cos(wantYaw) * e.strafeDir * 2 * dt;
      e.z -= Math.sin(wantYaw) * e.strafeDir * 2 * dt;
    }
    e.shootTimer -= dt;
    if (d < 28 && e.shootTimer <= 0) {
      e.shootTimer = e.weapon === 'smg' ? 0.5 : 1.4;
      // Telegraph then burst
      if (Math.random() > 0.4) {
        damagePlayer(e.weapon === 'smg' ? 5 : 7, 'gang');
        G.audio?.gunshot(0.35);
      }
    }
    e.barFg.scale.x = clamp(e.hp / e.maxHp, 0, 1);
    e.barFg.position.x = -(1 - clamp(e.hp / e.maxHp, 0, 1)) * 0.48;
    e.model.position.set(e.x, 0, e.z);
    e.model.rotation.y = e.yaw;
    e.model.lookAt(p.x, 0, p.z);
  }
}
