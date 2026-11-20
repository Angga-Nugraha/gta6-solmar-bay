// Solmar Bay — tuning constants. One place to balance the whole game.
export const CFG = {
  MAP_W: 560, MAP_D: 420,
  SEED: 7,
  WALK_SPEED: 4.2, SPRINT_SPEED: 6.8, STAMINA_MAX: 100,
  JUMP_V: 5.2, GRAVITY: 14,
  CAR_HP: 100,
  WANTED_DECAY_S: 25, WANTED_MAX: 5,
  START_CASH: 150, START_HP: 100,
  TRAFFIC_MAX: 20, PED_MAX: 22, POLICE_MAX: 5,
  BULLET_PISTOL: 22, BULLET_SMG: 14,
  COLOURS: {
    sand: 0xe8c98f, sea: 0x2e8b9a, asphalt: 0x3a3a40, sidewalk: 0x9a938a,
    coral: 0xff5a5a, palm: 0x3f7d4e, skyTop: 0xffd9a0, skyBot: 0x7fb8c9,
    sun: 0xffd9a8, fog: 0xf2c48d,
  },
  DISTRICTS: {
    strip:    { tint: 0xff8fa3, hMin: 14, hMax: 42 },
    marina:   { tint: 0x7fd4c1, hMin: 4,  hMax: 12 },
    oldtown:  { tint: 0xf2d8a7, hMin: 5,  hMax: 11 },
    downtown: { tint: 0x9fc4d8, hMin: 24, hMax: 70 },
    portside: { tint: 0xb8a88f, hMin: 6,  hMax: 16 },
  },
  PRICES: { pistolAmmo: 150, smgAmmo: 300, repair: 50, respray: 25 },
  CAMERA: { footDist: 4.6, footHeight: 2.2, carDist: 8.5, carHeight: 3.2 },
};

// Named places — every mission, spawn and shop points at one of these.
export const LOCATIONS = {
  spawn:        { x: 126, z: 40,  label: 'NEON STRIP — THE CORAL CROWN' },
  coralCrown:   { x: 150, z: 30,  label: 'THE CORAL CROWN' },
  plazaDelSol:  { x: -140, z: 130, label: 'PLAZA DEL SOL' },
  dock9:        { x: -210, z: -160, label: 'DOCK 9 — KINGSPORT TERMINAL' },
  oldTown:      { x: -140, z: 130, label: 'OLD TOWN' },
  meridianTower:{ x: 20,  z: -140, label: 'MERIDIAN TOWER' },
  pier:         { x: 250, z: 60,  label: 'SOLMAR PIER' },
  beach:        { x: 240, z: -40, label: 'SOLMAR BEACH' },
  gunShop:      { x: 40,  z: -120, label: 'IRON & LEAD GUN SHOP' },
  garage:       { x: -160, z: 110, label: "FINN'S GARAGE" },
  hospital:     { x: -120, z: 150, label: 'SOLMAR GENERAL HOSPITAL' },
  policeHQ:     { x: 0,   z: -160, label: 'SBPD CENTRAL' },
  stripMid:     { x: 150, z: 90,  label: 'PALOMA DRIVE' },
  downtown:     { x: 20,  z: -100, label: 'DOWNTOWN' },
};

// Vehicle definitions — six original cars, distinct handling.
export const VEHICLE_DEFS = {
  comet:      { name: 'Alderra Comet',    top: 28, accel: 16, grip: 2.6, turn: 1.9, colour: 0x4a90d9, price: 0 },
  breeze:     { name: 'Solmar Breeze',    top: 30, accel: 15, grip: 2.2, turn: 1.8, colour: 0xff7a59, price: 0 },
  hauler:     { name: 'Kingsport Hauler', top: 26, accel: 11, grip: 2.0, turn: 1.3, colour: 0x8a7a5a, price: 0 },
  meridian:   { name: 'Meridian GT',      top: 38, accel: 22, grip: 2.4, turn: 2.1, colour: 0x35589e, price: 0 },
  solcab:     { name: 'SolCab Taxi',      top: 30, accel: 15, grip: 2.4, turn: 1.8, colour: 0xf2c230, price: 0 },
  interceptor:{ name: 'SBPD Interceptor', top: 36, accel: 20, grip: 2.5, turn: 2.0, colour: 0x1a4fa0, price: 0 },
};

// Weapon definitions — invented names only.
export const WEAPON_DEFS = {
  fists:  { name: 'Fists',            slot: 1, dmg: 12, range: 1.8, auto: false, mag: Infinity, reserve: Infinity },
  bat:    { name: 'Street Sweeper',   slot: 1, dmg: 25, range: 2.1, auto: false, mag: Infinity, reserve: Infinity },
  pistol: { name: 'P9 Palm Pistol',   slot: 2, dmg: 22, range: 42,  auto: false, mag: 12, reserve: 60 },
  smg:    { name: 'Bay Repeater SMG', slot: 3, dmg: 14, range: 32,  auto: true,  mag: 30, reserve: 120 },
};
