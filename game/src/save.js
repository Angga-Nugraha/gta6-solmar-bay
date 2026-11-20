// Save / load — localStorage, versioned, never crashes on corrupt data.
import { G } from './state.js';

const KEY = 'solmarbay.save.v1';

export class SaveSystem {
  constructor() {
    this.data = this.load();
  }
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (d.version !== 1) return null;
      return d;
    } catch { return null; }
  }
  snapshot() {
    const p = G.player;
    return {
      version: 1,
      cash: p.cash, hp: p.hp, armour: p.armour,
      weapons: p.weapons, weapon: p.weapon,
      missionIndex: this.data?.missionIndex ?? 0,
      shellsFound: G.shells.filter((s) => s.found).map((s) => `${s.x},${s.z}`),
      playerPos: { x: p.x, z: p.z },
      stats: G.stats,
      savedAt: Date.now(),
    };
  }
  autosave() {
    try {
      this.data = this.snapshot();
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch { /* storage full or blocked — game continues */ }
  }
  setMissionIndex(i) {
    if (!this.data) this.data = { version: 1, cash: G.player.cash, missionIndex: 0, shellsFound: [] };
    this.data.missionIndex = i;
  }
  applyToPlayer() {
    const d = this.data;
    if (!d) return;
    const p = G.player;
    p.cash = d.cash ?? 150;
    p.hp = d.hp ?? 100;
    p.armour = d.armour ?? 0;
    if (d.weapons) p.weapons = d.weapons;
    if (d.weapon && p.weapons[d.weapon]) p.weapon = d.weapon;
    if (d.playerPos) { p.x = d.playerPos.x; p.z = d.playerPos.z; p.model.position.set(p.x, 0, p.z); }
    if (d.stats) G.stats = d.stats;
    if (d.missionIndex >= 4 && !p.weapons.smg) p.weapons.smg = { mag: 30, reserve: 120 };
    if (d.missionIndex >= 2 && !p.weapons.bat) p.weapons.bat = { mag: Infinity, reserve: Infinity };
    for (const s of G.shells) {
      if (d.shellsFound?.includes(`${s.x},${s.z}`)) { s.found = true; G.scene.remove(s.mesh); }
    }
  }
}
