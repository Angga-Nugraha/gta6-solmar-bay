// Keyboard + mouse input with edge detection. Pointer lock on click while on foot.
import { G } from './state.js';

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, cleared each frame
    this.mouseDX = 0; this.mouseDY = 0;
    this.locked = false;
    this.shotKeys = []; // scripted keys for ?shot= autopilot
    this.shotMouse = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (this.locked) { this.mouseDX += e.movementX; this.mouseDY += e.movementY; }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.body;
    });
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.pressed.add('Mouse0');
      if (e.button === 2) this.pressed.add('Mouse2');
      // Click the canvas while playing on foot: grab pointer lock.
      if (G.mode === 'play' && G.player && G.player.onFoot && !this.locked) {
        document.body.requestPointerLock?.();
      }
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  down(code) { return this.keys.has(code) || this.shotKeys.includes(code); }
  hit(code) { return this.pressed.has(code); }
  consumeMouse() { const dx = this.mouseDX + this.shotMouse; this.mouseDX = 0; this.mouseDY = 0; this.shotMouse = 0; return dx; }
  endFrame() { this.pressed.clear(); }
}
