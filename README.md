# Solmar Bay — an open-world crime story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Angga-Nugraha/gta6-solmar-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/Angga-Nugraha/gta6-solmar-bay/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an original open-world crime game for the make.fun `gta6-01` bounty.
You are Mara Voss, 29, an ex-getaway driver back in her home city after her
brother's death — pulled into a turf war between the Harbor Kings and the Neon
Court while the Solmar Bay Police Department hunts her.

## Play

Serve `game/` with any static server and open `index.html` in desktop Chrome:

```sh
node serve.ts   # http://localhost:8080
```

No build step, no network requests — three.js is vendored under
`game/vendor/three/`, every texture is painted procedurally at boot, every
sound and radio groove is synthesised with WebAudio. Everything in the game
— city, characters, vehicles, names, story, art, sound, music — is original.

## The game

- **A city to explore on foot and by car** — Solmar Bay, a 560×420 m
  sun-soaked Gulf-coast island with 5 districts: the Neon Strip, Marina &
  Beach, Old Town, Downtown and Portside, with hero landmarks (the Coral
  Crown casino-hotel, Meridian Tower, Solmar Pier, Dock 9, Plaza del Sol).
- **6 original cars to steal and drive** — Comet, Breeze, Hauler, Meridian GT,
  SolCab taxi, SBPD Interceptor — with distinct handling, damage, smoke and
  explosions. Steal unseen and it's a clean steal; steal in front of a
  witness and the SBPD comes for you.
- **Traffic and pedestrians** — cars follow the road graph and stop at lights,
  pedestrians walk the sidewalks and flee gunfire. Streets empty out as your
  wanted level rises.
- **Wanted level 0–5 stars** — SBPD pursuit cars that ram you, foot officers
  who shoot and arrest, heat that decays when you lose them. Busted or wasted
  costs 10% of your cash and respawns you at SBPD Central or Solmar General.
- **8 story missions** — Homecoming, Dock 9 Pickup, Neon Debt, The Ledger
  Parts 1 & 2, Finn's Favour, Kings' Gambit, and the finale Solmar's Choice
  with two endings. Plus taxi fares, courier runs, rampages, and 20 golden
  shells hidden on the beach.
- **Combat** — fists, the Street Sweeper bat, the P9 Palm pistol and the Bay
  Repeater SMG. Hitscan shooting, headshots, melee, reloads, ammo to buy at
  Iron & Lead.
- **HUD + minimap** — mission objective card, wanted stars, cash, clock,
  health/armour/stamina, weapon + ammo, speedometer, and a circular Canvas
  minimap with mission, police, enemy and shell blips.
- **Start screen, pause menu, phone, save** — autosave to localStorage after
  every mission, plus manual save from pause.

## Controls

WASD move · Shift sprint · Space jump · Mouse look (click to lock) · E enter /
steal car · F punch · Click shoot · R reload · 1/2/3 weapons · Q radio ·
M phone · Esc pause. In a car: W/S accel & brake · A/D steer · Space handbrake
· E exit · H horn.

## Tech

three.js (vendored) + plain ES modules + DOM/CSS HUD + Canvas 2D minimap +
WebAudio synth. Source lives in `game/src/`, one file per system.
