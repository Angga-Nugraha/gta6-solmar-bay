// Procedural canvas textures — zero image files, everything painted at boot.
import * as THREE from 'three';
import { makeRng } from './rng.js';

function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function makeAsphaltTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3a40'; g.fillRect(0, 0, w, h);
    const rng = makeRng(11);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rng.pick(['#43434a', '#333338', '#3f3f46']);
      g.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
    }
    // centre dashes (two lanes each way)
    g.fillStyle = '#e8d44d';
    for (let y = 0; y < h; y += 32) g.fillRect(w / 2 - 2, y, 4, 18);
    g.fillStyle = '#d8d8d8';
    g.fillRect(6, 0, 3, h); g.fillRect(w - 9, 0, 3, h);
  }, 1, 8);
}

export function makeSidewalkTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a938a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7d766c'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const rng = makeRng(23);
    for (let i = 0; i < 300; i++) { g.fillStyle = '#8a8378'; g.fillRect(rng.range(0, w), rng.range(0, h), 2, 2); }
  }, 6, 6);
}

export function makeFacadeTex(style, base, rng) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    if (style === 'deco') {
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
      g.fillStyle = '#ff5a8a';
      g.fillRect(0, 20, w, 6);
    } else if (style === 'glass') {
      g.fillStyle = 'rgba(255,255,255,0.10)';
      for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 14, h);
    } else {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, h - 20, w, 20);
    }
    // windows, lit warm at golden hour
    const cols = style === 'glass' ? 6 : 5, rows = 7;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng.next() < 0.45;
        g.fillStyle = lit ? '#ffd98a' : (style === 'glass' ? '#5a7a8a' : '#2e2a33');
        const x = 14 + c * ((w - 28) / cols), y = 30 + r * ((h - 50) / rows);
        g.fillRect(x, y, (w - 28) / cols - 10, (h - 50) / rows - 8);
      }
    }
  });
}

export function makeNeonTex(text, colour) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#1a1020'; g.fillRect(0, 0, w, h);
    g.strokeStyle = colour; g.lineWidth = 5;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.font = 'bold 56px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = colour; g.shadowBlur = 22;
    g.fillStyle = colour;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

export function makeSandTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e8c98f'; g.fillRect(0, 0, w, h);
    const rng = makeRng(41);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = rng.pick(['#d9b878', '#f2dcae', '#cbb07e']);
      g.fillRect(rng.range(0, w), rng.range(0, h), 2, 2);
    }
  }, 8, 8);
}

export function makeWaterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2e8b9a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
    for (let y = 8; y < h; y += 26) {
      g.beginPath();
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x / 22) * 4);
      g.stroke();
    }
  }, 10, 10);
}

export function makeCrosswalkTex() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#3a3a40'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8e8e8';
    for (let x = 8; x < w; x += 22) g.fillRect(x, 6, 12, h - 12);
  });
}

export function makeAllTextures(rng) {
  return {
    asphalt: makeAsphaltTex(),
    sidewalk: makeSidewalkTex(),
    sand: makeSandTex(),
    water: makeWaterTex(),
    crosswalk: makeCrosswalkTex(),
    facadeDeco: makeFacadeTex('deco', '#e89a7a', rng),
    facadeGlass: makeFacadeTex('glass', '#5a7a94', rng),
    facadeStucco: makeFacadeTex('stucco', '#e8d3a0', rng),
    facadeBrick: makeFacadeTex('stucco', '#a8604a', rng),
    neonCoral: makeNeonTex('CORAL CROWN', '#ff5a8a'),
    neonMirage: makeNeonTex('CLUB MIRAGE', '#4ad8ff'),
    neonPaloma: makeNeonTex('PALOMA HOTEL', '#ffd24a'),
    neonMeridian: makeNeonTex('MERIDIAN', '#7affc9'),
  };
}
