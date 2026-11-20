// DOM HUD + Canvas 2D minimap + menus (start / pause / overlays).
import { G } from './state.js';
import { CFG, LOCATIONS } from './config.js';
import { AVENUES, STREETS, districtNameAt } from './city.js';
import { currentWeapon } from './combat.js';
import { shellsFound } from './missions.js';

export class Hud {
  constructor() {
    this.el = {};
    for (const id of ['objective', 'objective-title', 'objective-text', 'objective-dist',
      'stars', 'cash', 'clock', 'district', 'health-fill', 'armour-fill', 'stamina-fill',
      'weapon-name', 'weapon-ammo', 'speedo', 'speed-num', 'crosshair', 'hitmarker',
      'prompt', 'progress', 'progress-fill', 'progress-label', 'toasts', 'minimap',
      'menu', 'menu-title', 'menu-sub', 'menu-buttons', 'overlay', 'overlay-title',
      'overlay-text', 'overlay-buttons', 'intro-card', 'intro-title', 'intro-text',
      'damage-flash', 'vignette']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimers = new Map();
    this.shakeAmt = 0;
    this.lastToast = {};
  }
  toast(msg) {
    const now = performance.now();
    if (this.lastToast[msg] && now - this.lastToast[msg] < 2500) return;
    this.lastToast[msg] = now;
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = msg;
    this.el.toasts.appendChild(div);
    setTimeout(() => div.remove(), 4200);
    while (this.el.toasts.children.length > 5) this.el.toasts.firstChild.remove();
  }
  toastOnce(key, msg) {
    if (this.toastTimers.has(key)) return;
    this.toastTimers.set(key, true);
    this.toast(msg);
    setTimeout(() => this.toastTimers.delete(key), 15000);
  }
  setObjective(title, text) {
    this.el['objective-title'].textContent = title || '';
    this.el['objective-text'].textContent = text || '';
    this.el.objective.style.display = title ? 'block' : 'none';
  }
  setProgress(frac, label) {
    if (!label) { this.el.progress.style.display = 'none'; return; }
    this.el.progress.style.display = 'block';
    this.el['progress-fill'].style.width = `${Math.round(frac * 100)}%`;
    this.el['progress-label'].textContent = label;
  }
  flashDamage() {
    this.el['damage-flash'].style.opacity = '0.45';
    setTimeout(() => { this.el['damage-flash'].style.opacity = '0'; }, 180);
  }
  shake(amt) { this.shakeAmt = Math.max(this.shakeAmt, amt); }
  hitmarker(headshot) {
    const h = this.el.hitmarker;
    h.style.display = 'block';
    h.style.color = headshot ? '#ff3a3a' : '#ffffff';
    setTimeout(() => { h.style.display = 'none'; }, 120);
  }
  muzzleFlash() {
    this.el.crosshair.style.transform = 'translate(-50%,-50%) scale(1.5)';
    setTimeout(() => { this.el.crosshair.style.transform = 'translate(-50%,-50%) scale(1)'; }, 60);
  }
  showIntroCard(title, text) {
    this.el['intro-title'].textContent = title;
    this.el['intro-text'].textContent = text;
    this.el['intro-card'].style.display = 'block';
    setTimeout(() => { this.el['intro-card'].style.display = 'none'; }, 6000);
  }
  showMissionPassed(title, payout) {
    this.showOverlay('MISSION PASSED', `${title} — you earned $${payout}.`, [
      { label: 'CONTINUE', fn: () => { G.mode = 'play'; this.hideOverlay(); } },
    ]);
  }
  showMissionFailed(title, reason) {
    this.showOverlay('MISSION FAILED', `${title} — ${reason}`, [
      { label: 'RETRY MISSION', fn: () => { this.hideOverlay(); G.missions?.retryMission?.(); } },
      { label: 'FREE ROAM', fn: () => { G.mode = 'play'; this.hideOverlay(); } },
    ]);
  }
  showBusted(fine) {
    this.showOverlay('BUSTED', `The SBPD took you in. You lost $${fine}.`, [
      { label: 'CONTINUE', fn: () => { G.mode = 'play'; this.hideOverlay(); } },
    ]);
  }
  showWasted(fine) {
    this.showOverlay('WASTED', `You woke up at Solmar General Hospital. You lost $${fine} and your ammo.`, [
      { label: 'CONTINUE', fn: () => { G.mode = 'play'; this.hideOverlay(); } },
    ]);
  }
  showChoice() {
    this.showOverlay("SOLMAR'S CHOICE", 'The ledger is yours. What does Mara do with it?', [
      { label: 'HAND IT TO INSPECTOR MARSH (+$500, clean)', fn: () => { this.hideOverlay(); G.missions?.resolveChoice?.(true); } },
      { label: 'BURN IT AND KEEP THE CASH (+$2,000, 5 stars)', fn: () => { this.hideOverlay(); G.missions?.resolveChoice?.(false); } },
    ]);
  }
  showCredits(clean) {
    this.showOverlay('SOLMAR BAY — THE END',
      clean
        ? 'Mara handed the ledger to Inspector Marsh. Vera Solano was arrested at dawn. Theo can rest now. Thanks for playing — free roam continues.'
        : 'Mara burned the ledger and took the money. Solmar Bay never forgets — and neither does the SBPD. Thanks for playing — free roam continues.',
      [{ label: 'FREE ROAM', fn: () => { G.mode = 'play'; this.hideOverlay(); } }]);
  }
  showOverlay(title, text, buttons) {
    this.el['overlay-title'].textContent = title;
    this.el['overlay-text'].textContent = text;
    const box = this.el['overlay-buttons'];
    box.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn'; btn.textContent = b.label;
      btn.onclick = b.fn;
      box.appendChild(btn);
    }
    this.el.overlay.style.display = 'flex';
  }
  hideOverlay() { this.el.overlay.style.display = 'none'; }
  showMenu() {
    this.el.menu.style.display = 'flex';
    this.el['menu-title'].textContent = 'SOLMAR BAY';
    this.el['menu-sub'].textContent = 'An open-world crime story — an original game. 100% original: no Rockstar content.';
    const save = G.save?.data;
    const box = this.el['menu-buttons'];
    box.innerHTML = '';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label; b.onclick = fn; box.appendChild(b);
    };
    mk('PLAY', () => { this.el.menu.style.display = 'none'; G.startNewGame?.(); });
    if (save && save.missionIndex > 0) mk('CONTINUE', () => { this.el.menu.style.display = 'none'; G.continueGame?.(); });
    mk('HOW TO PLAY', () => {
      this.el['menu-sub'].textContent = 'WASD move · Shift sprint · Space jump · Mouse look (click to lock) · E enter/steal car · F punch · Click shoot · R reload · 1/2/3 weapons · Q radio · M phone · Esc pause';
    });
    mk(G.audio?.muted ? 'SOUND: OFF' : 'SOUND: ON', () => { G.audio?.toggleMute?.(); this.showMenu(); });
    if (save) {
      const stats = document.createElement('div');
      stats.className = 'menu-stats';
      stats.textContent = `Best so far — cash $${save.cash} · missions ${save.missionIndex}/8 · shells ${save.shellsFound.length}/20`;
      box.appendChild(stats);
    }
  }
  showPause() {
    this.el.menu.style.display = 'flex';
    this.el['menu-title'].textContent = 'PAUSED';
    this.el['menu-sub'].textContent = 'Solmar Bay waits for no one. Well — right now it does.';
    const box = this.el['menu-buttons'];
    box.innerHTML = '';
    const mk = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = label; b.onclick = fn; box.appendChild(b);
    };
    mk('RESUME', () => { this.el.menu.style.display = 'none'; G.mode = 'play'; });
    mk('SAVE GAME', () => { G.save?.autosave?.(); this.toast('Game saved.'); });
    mk('RESTART MISSION', () => { this.el.menu.style.display = 'none'; G.missions?.retryMission?.(); });
    mk('TAXI JOB', () => { this.el.menu.style.display = 'none'; G.mode = 'play'; G.missions?.startTaxiJob?.(); });
    mk('COURIER RUN', () => { this.el.menu.style.display = 'none'; G.mode = 'play'; G.missions?.startCourierJob?.(); });
    mk('RAMPAGE', () => { this.el.menu.style.display = 'none'; G.mode = 'play'; G.missions?.startRampage?.(); });
    mk('QUIT TO TITLE', () => { this.el.menu.style.display = 'none'; G.mode = 'title'; this.showMenu(); });
  }
  update(dt) {
    const p = G.player;
    if (!p) return;
    // Stars
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.classList.toggle('hot', G.wanted >= 3);
    this.el.cash.textContent = `$${p.cash.toLocaleString()}`;
    const mins = 17 * 60 + 40 + Math.floor(G.time / 60);
    this.el.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    this.el.district.textContent = districtNameAt(p.x, p.z);
    this.el['health-fill'].style.width = `${Math.max(0, p.hp)}%`;
    this.el['armour-fill'].style.width = `${p.armour}%`;
    this.el['stamina-fill'].style.width = `${Math.round(p.stamina)}%`;
    const w = currentWeapon();
    const ammo = p.weapons[p.weapon];
    this.el['weapon-name'].textContent = w.name;
    this.el['weapon-ammo'].textContent = w.slot === 1 ? '∞' : `${ammo.mag} / ${ammo.reserve}`;
    // Speedometer
    if (p.car) {
      this.el.speedo.style.display = 'block';
      this.el['speed-num'].textContent = `${Math.round(Math.abs(p.car.speed) * 3.6)}`;
    } else this.el.speedo.style.display = 'none';
    // Crosshair on foot only
    this.el.crosshair.style.display = p.onFoot && G.mode === 'play' ? 'block' : 'none';
    // Interaction prompt (play mode only)
    let prompt = '';
    if (p.onFoot && G.mode === 'play') {
      const car = G.driving?.nearestCar?.(p.x, p.z, 3.4);
      if (car) prompt = car.driver === 'traffic' ? 'E — JACK THE CAR' : car.driver === 'police' ? 'E — STEAL (POLICE)' : 'E — GET IN';
      const nearShell = G.shells.some((s) => !s.found && Math.hypot(s.x - p.x, s.z - p.z) < 3);
      if (nearShell) prompt = 'Golden shell nearby!';
      if (G.mission) {
        const beat = G.mission.def.beats[G.mission.beatIdx];
        if (beat?.type === 'photo' && Math.hypot(p.x - beat.x, p.z - beat.z) < beat.r) prompt = 'HOLD E — PHOTOGRAPH THE LEDGER';
      }
    }
    this.el.prompt.textContent = prompt;
    this.el.prompt.style.display = prompt ? 'block' : 'none';
    // Objective distance
    if (G.mission) {
      const beat = G.mission.def.beats[G.mission.beatIdx];
      let d = null;
      if (beat?.x !== undefined) d = Math.round(Math.hypot(p.x - beat.x, p.z - beat.z));
      else if (beat?.spots) {
        const s = beat.spots[G.mission.beatState.count];
        if (s) d = Math.round(Math.hypot(p.x - s[0], p.z - s[1]));
      }
      this.el['objective-dist'].textContent = d !== null ? `${d} m` : '';
      this.el['objective-text'].textContent = beat ? `${G.mission.beatState.overrideText ?? beat.text}${beat.type === 'fight' && !G.mission.beatState.overrideText ? ` — ${G.mission.beatState.count}/${beat.count}` : ''}` : '';
    }
    this.drawMinimap();
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
      const s = this.shakeAmt * 6;
      document.getElementById('game-canvas').style.transform = `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)`;
    }
  }
  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180, scale = S / 620;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    // Sea + land
    ctx.fillStyle = '#2e8b9a'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#6a6258'; ctx.fillRect(0, 0, S, S);
    const px = (x) => (x + 310) * scale, pz = (z) => (z + 240) * scale;
    // District tint blocks
    ctx.fillStyle = 'rgba(255,143,163,0.35)'; ctx.fillRect(px(90), pz(-60), (170 - 90) * scale, 220 * scale);
    ctx.fillStyle = 'rgba(159,196,216,0.35)'; ctx.fillRect(px(-90), pz(-210), 180 * scale, 120 * scale);
    // Roads
    ctx.strokeStyle = '#3a3a40'; ctx.lineWidth = 4;
    for (const ax of AVENUES) { ctx.beginPath(); ctx.moveTo(px(ax), 0); ctx.lineTo(px(ax), S); ctx.stroke(); }
    for (const sz of STREETS) { ctx.beginPath(); ctx.moveTo(0, pz(sz)); ctx.lineTo(S, pz(sz)); ctx.stroke(); }
    // Beach
    ctx.fillStyle = '#e8c98f'; ctx.fillRect(px(280), 0, S - px(280), S);
    const dot = (x, z, colour, r = 4) => {
      ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(px(x), pz(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // Blips
    for (const s of G.shells) if (!s.found) dot(s.x, s.z, '#ffd24a', 2.5);
    for (const c of G.police) dot(c.x, c.z, '#2a6aff', 5);
    for (const e of G.enemies) if (!e.dead) dot(e.x, e.z, '#ff3a3a', 4);
    if (G.mission) {
      const beat = G.mission.def.beats[G.mission.beatIdx];
      if (beat?.x !== undefined) dot(beat.x, beat.z, '#ffd24a', 6);
      else if (beat?.spots) {
        const s = beat.spots[G.mission.beatState.count];
        if (s) dot(s[0], s[1], '#ffd24a', 6);
      }
    }
    const p = G.player;
    if (p.car) dot(p.car.x, p.car.z, '#ffffff', 4);
    // Player arrow (north-up, arrow rotates with heading)
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.yaw), Math.cos(p.yaw)) * -1 + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();
    // Rim
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }
}
