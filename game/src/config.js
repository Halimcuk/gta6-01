// SOLMAR HEAT — an original open-world crime game set in Solmar Bay.
// config.js: the shared namespace, world constants, palette, mission data
// and the mutable game state every other module reads and writes.
// Nothing here is copied from any commercial game: city, people and story
// are invented for this entry.

(function () {
  'use strict';

  // ---------------------------------------------------------------- city ---
  var PITCH = 72; // distance between road centrelines, in metres
  var ROAD = 16; // road width
  var GRID = 4; // roads run from -GRID to +GRID on each axis
  var BLOCK = PITCH - ROAD; // buildable block width
  var HALF = GRID * PITCH + ROAD / 2; // city edge, ~296
  var BEACH_Z = HALF + 8; // sand strip starts here (south edge)
  var WATER_Z = BEACH_Z + 44; // the bay begins here

  // -------------------------------------------------------------- palette ---
  var PALETTE = {
    sky: 0x7ec8f2,
    fog: 0xa8d8f0,
    sun: 0xfff2cf,
    ground: 0x9aa38f,
    sidewalk: 0xb9b3a4,
    asphalt: 0x3a3d42,
    roadLine: 0xf5d76e,
    sand: 0xe8d29a,
    water: 0x1e7fa8,
    waterDeep: 0x0e5a80,
    palmTrunk: 0x8a6a45,
    palmLeaf: 0x2f9e4f,
    lampPole: 0x2c2f33,
  };

  var CAR_COLORS = [
    0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22,
    0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400, 0x7f8c8d, 0xb03a5b,
  ];

  var SHIRT_COLORS = [
    0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c,
    0xfd79a8, 0x00cec9, 0x6c5ce7, 0xe17055, 0xffffff, 0x2d3436,
  ];

  // ------------------------------------------------------------- missions ---
  // The story: Rex Marlowe, a wheelman down on his luck, works for Mara Voss,
  // who runs a garage crew out of the old marina. Four jobs, one crew.
  var MISSIONS = [
    {
      id: 'wheels-up',
      title: 'Wheels Up',
      briefing: 'Mara needs wheels. Jack any parked car and bring it to the garage.',
      reward: 300,
      startText: 'New job: WHEELS UP — jack a car, bring it to Mara\'s garage.',
    },
    {
      id: 'sunset-courier',
      title: 'Sunset Courier',
      briefing: 'A package for the pier, and it cannot be late. Drive it there in 2 minutes.',
      reward: 500,
      timeLimit: 120,
      startText: 'New job: SUNSET COURIER — deliver the package to the pier. 2:00 on the clock.',
    },
    {
      id: 'heat-wave',
      title: 'Heat Wave',
      briefing: 'The Bay PD is on you. Lose the heat — get your wanted level back to zero.',
      reward: 700,
      startText: 'New job: HEAT WAVE — shake the cops. Get back to zero stars.',
    },
    {
      id: 'the-big-score',
      title: 'The Big Score',
      briefing: 'The Meridian Bank vault is soft tonight. Grab the cash and reach the hideout.',
      reward: 1500,
      startText: 'New job: THE BIG SCORE — hit the bank, grab the cash, reach the hideout.',
    },
  ];

  // ----------------------------------------------------------- shared state ---
  window.SOL = {
    // three.js handles, filled by main.js
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    // world
    colliders: [], // { minX, maxX, minZ, maxZ } building footprints
    buildings: [], // { x, z, w, d, h, color } for the minimap
    parkedCars: [],
    traffic: [],
    peds: [],
    police: [],
    palms: [],
    // player
    player: null, // { mesh, pos, vel, yaw, onFoot, health, speed }
    playerCar: null, // vehicle object the player currently drives
    // economy + crime
    money: 0,
    wanted: 0,
    heatTimer: 0, // seconds since last crime
    crimeFlash: 0,
    // missions
    missionIndex: 0,
    mission: null, // live mission state
    missionTarget: null, // { x, z } world position of the objective
    completedMissions: [],
    // flow
    phase: 'menu', // menu | playing | paused | busted | wasted | done
    paused: false,
    timeOfDay: 10.2, // hours, morning sun
    playTime: 0,
    elapsed: 0,
    // camera
    camYaw: 0,
    camPitch: 0.32,
    camDist: 9,
    shake: 0,
    // debug / screenshot staging
    demo: null, // { autoDrive: true } etc, set by shots.js
    seed: 1337,
    // constants
    CITY: { PITCH: PITCH, ROAD: ROAD, GRID: GRID, BLOCK: BLOCK, HALF: HALF, BEACH_Z: BEACH_Z, WATER_Z: WATER_Z },
    PALETTE: PALETTE,
    CAR_COLORS: CAR_COLORS,
    SHIRT_COLORS: SHIRT_COLORS,
    MISSIONS: MISSIONS,
    SAVE_KEY: 'solmar-heat-save-v1',
  };

  // --------------------------------------------------------------- helpers ---
  SOL.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  SOL.lerp = function (a, b, t) { return a + (b - a) * t; };
  SOL.dist2d = function (ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  };
  SOL.angleLerp = function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  SOL.formatMoney = function (n) {
    return '$' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  SOL.formatClock = function (seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };
})();
