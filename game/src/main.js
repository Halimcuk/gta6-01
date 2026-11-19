// main.js — bootstrap and the game loop. Builds the renderer, the sun and
// sky, the city, the traffic, the people and the player; runs the phases
// (menu / playing / paused / busted / wasted) and the third-person camera.

(function () {
  'use strict';

  var CITY = SOL.CITY;
  var P = SOL.PALETTE;

  function makeRenderer() {
    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    renderer.domElement.id = 'game-canvas';
    document.getElementById('game').appendChild(renderer.domElement);
    return renderer;
  }

  function makeSky(scene) {
    scene.background = new THREE.Color(P.sky);
    scene.fog = new THREE.Fog(P.fog, 220, 700);
    var hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.9);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(P.sun, 1.6);
    sun.position.set(120, 180, 60);
    scene.add(sun);
    // a few flat cartoon clouds drifting slowly
    var cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    SOL.clouds = [];
    for (var i = 0; i < 10; i++) {
      var g = new THREE.Group();
      for (var j = 0; j < 3; j++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(SOL.randRange(6, 12), 8, 6), cloudMat);
        puff.position.set(j * SOL.randRange(8, 14) - 10, SOL.randRange(-1, 2), SOL.randRange(-4, 4));
        puff.scale.y = 0.45;
        g.add(puff);
      }
      g.position.set(SOL.randRange(-380, 380), SOL.randRange(90, 140), SOL.randRange(-380, 380));
      scene.add(g);
      SOL.clouds.push(g);
    }
  }

  // -------------------------------------------------------------- camera ---
  function updateCamera(dt) {
    var p = SOL.player;
    if (!p) return;
    var target = p.onFoot ? p.pos : (SOL.playerCar ? new THREE.Vector3(SOL.playerCar.x, 0, SOL.playerCar.z) : p.pos);
    // mouse orbit (pointer lock) or auto-follow behind the car
    var mouse = SOL.input.consumeMouse();
    if (SOL.input.locked) {
      SOL.camYaw -= mouse.dx * 0.0032;
      SOL.camPitch = SOL.clamp(SOL.camPitch + mouse.dy * 0.0025, 0.05, 1.1);
    } else if (SOL.playerCar && !SOL.demo) {
      // chase cam: ease behind the car's heading
      var behind = SOL.playerCar.heading + Math.PI;
      SOL.camYaw = SOL.angleLerp(SOL.camYaw, behind, SOL.clamp(dt * 1.6, 0, 1));
    }
    if (SOL.demo && SOL.demo.autoDrive && SOL.playerCar) {
      SOL.camYaw = SOL.angleLerp(SOL.camYaw, SOL.playerCar.heading + Math.PI, SOL.clamp(dt * 2, 0, 1));
    }
    var dist = p.onFoot ? 8.5 : 12;
    var height = p.onFoot ? 3.2 : 4.6;
    // pull the camera in when a building blocks the shot, instead of
    // jumping straight above the roofs
    var cx = 0, cz = 0, cy = 0, usedDist = dist;
    for (var d = dist; d >= dist * 0.3; d *= 0.75) {
      var tx = target.x + Math.sin(SOL.camYaw) * Math.cos(SOL.camPitch) * d;
      var tz = target.z + Math.cos(SOL.camYaw) * Math.cos(SOL.camPitch) * d;
      if (!SOL.pointInCollider(tx, tz)) { cx = tx; cz = tz; usedDist = d; break; }
      cx = tx; cz = tz; usedDist = d;
    }
    cy = target.y + height + Math.sin(SOL.camPitch) * usedDist;
    // last resort: lift above the roofs
    if (SOL.pointInCollider(cx, cz)) cy = Math.max(cy, 26);
    var shakeX = SOL.shake > 0 ? (Math.random() - 0.5) * SOL.shake * 0.7 : 0;
    var shakeY = SOL.shake > 0 ? (Math.random() - 0.5) * SOL.shake * 0.7 : 0;
    SOL.camera.position.set(cx + shakeX, cy + shakeY, cz);
    SOL.camera.lookAt(target.x, target.y + 1.6, target.z);
  }

  // ---------------------------------------------------------------- loop ---
  function tick() {
    requestAnimationFrame(tick);
    var dt = Math.min(SOL.clock.getDelta(), 0.05);
    SOL.elapsed += dt;
    if (SOL.phase === 'playing') SOL.playTime += dt;

    if (SOL.phase === 'playing') {
      // pause key
      if (SOL.pauseQueued) {
        SOL.pauseQueued = false;
        SOL.pauseGame();
      }
      // enter / exit car
      if (SOL.enterQueued) {
        SOL.enterQueued = false;
        SOL.tryEnterCar();
      }
      // demo auto-drive (screenshots): hold W, gentle steering
      var axes = SOL.input.moveAxes();
      if (SOL.demo && SOL.demo.autoDrive && SOL.playerCar) {
        axes = { x: Math.sin(SOL.elapsed * 0.25) * 0.25, y: 1 };
      }
      if (SOL.playerCar) SOL.drivePlayerCar(dt, axes);
      else SOL.updatePlayerOnFoot(dt);
      SOL.updateTraffic(dt, SOL.scene);
      SOL.updatePedestrians(dt);
      SOL.updatePolice(dt, SOL.scene);
      SOL.updateWanted(dt);
      SOL.audio.setSiren(SOL.wanted > 0);
      SOL.missions.update(dt);
      SOL.updateParticles(dt);
      SOL.updateBeacon(dt);
      SOL.updateShake(dt);
      SOL.bestWanted = Math.max(SOL.bestWanted || 0, SOL.wanted);
      // drifting dust behind a fast car
      if (SOL.playerCar && Math.abs(SOL.playerCar.speed) > 20 && Math.random() < dt * 8) {
        SOL.spawnDust(SOL.playerCar.x, 0.3, SOL.playerCar.z);
      }
      // clouds drift, water shimmers
      for (var i = 0; i < SOL.clouds.length; i++) {
        SOL.clouds[i].position.x += dt * 1.2;
        if (SOL.clouds[i].position.x > 420) SOL.clouds[i].position.x = -420;
      }
      if (SOL.bayWater) {
        var shimmer = 0.5 + Math.sin(SOL.elapsed * 0.7) * 0.06;
        SOL.bayWater.material.color.setRGB(0.12 * shimmer + 0.06, 0.5 * shimmer + 0.05, 0.66 * shimmer + 0.08);
      }
      SOL.updateHud();
      updateCamera(dt);
    } else if (SOL.phase === 'menu') {
      // slow cinematic orbit around the plaza behind the title screen
      var t = SOL.elapsed * 0.05;
      SOL.camera.position.set(Math.sin(t) * 90, 42, Math.cos(t) * 90);
      SOL.camera.lookAt(0, 8, 0);
      SOL.updateTraffic(dt * 0.5, SOL.scene);
      SOL.updatePedestrians(dt * 0.5);
      SOL.updateParticles(dt);
    }
    SOL.renderer.render(SOL.scene, SOL.camera);
  }

  // -------------------------------------------------------------- flow ---
  SOL.startGame = function (fresh) {
    SOL.audio.init();
    SOL.audio.click();
    if (fresh || !SOL.hasSave()) {
      SOL.money = 0;
      SOL.missionIndex = 0;
      SOL.completedMissions = [];
      SOL.bestWanted = 0;
      SOL.playTime = 0;
      if (SOL.player) {
        SOL.player.pos.set(0, 0, 120);
        SOL.player.health = 100;
        SOL.player.mesh.position.copy(SOL.player.pos);
      }
    } else {
      var save = SOL.loadSave();
      if (save) SOL.applySave(save);
    }
    SOL.wanted = 0;
    SOL.heatTimer = 0;
    SOL.phase = 'playing';
    SOL.showScreen(null);
    SOL.missions.startCurrent();
    SOL.requestLock();
    SOL.hudToast('Welcome back to Solmar Bay, Rex.');
  };

  SOL.pauseGame = function () {
    if (SOL.phase !== 'playing') return;
    SOL.phase = 'paused';
    SOL.showScreen('pause-screen');
    if (document.exitPointerLock) document.exitPointerLock();
    SOL.audio.setEngine(0, false);
    SOL.audio.setSiren(false);
  };

  SOL.resumeGame = function () {
    if (SOL.phase !== 'paused') return;
    SOL.phase = 'playing';
    SOL.showScreen(null);
    SOL.requestLock();
    SOL.audio.click();
  };

  SOL.quitToMenu = function () {
    SOL.saveGame();
    SOL.phase = 'menu';
    SOL.showScreen('start-screen');
    SOL.updateStartScreenStats();
    if (document.exitPointerLock) document.exitPointerLock();
    SOL.audio.setEngine(0, false);
    SOL.audio.setSiren(false);
  };

  function bindButtons() {
    var startBtn = document.getElementById('btn-start');
    if (startBtn) startBtn.addEventListener('click', function () { SOL.startGame(true); });
    var contBtn = document.getElementById('btn-continue');
    if (contBtn) contBtn.addEventListener('click', function () { SOL.startGame(false); });
    var resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', function () { SOL.resumeGame(); });
    var saveBtn = document.getElementById('btn-save');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      if (SOL.saveGame()) SOL.hudToast('Progress saved.');
    });
    var quitBtn = document.getElementById('btn-quit');
    if (quitBtn) quitBtn.addEventListener('click', function () { SOL.quitToMenu(); });
    var retryBtn = document.getElementById('btn-retry');
    if (retryBtn) retryBtn.addEventListener('click', function () {
      var p = SOL.player;
      if (p) {
        p.pos.set(0, 0, 120);
        p.health = 100;
        p.mesh.position.copy(p.pos);
        if (SOL.playerCar) { SOL.scene.remove(SOL.playerCar.mesh); SOL.playerCar = null; }
        p.onFoot = true;
        p.mesh.visible = true;
      }
      SOL.wanted = 0;
      SOL.phase = 'playing';
      SOL.showScreen(null);
      SOL.missions.startCurrent();
    });
    var menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.addEventListener('click', function () { SOL.quitToMenu(); });
    window.addEventListener('resize', function () {
      SOL.camera.aspect = window.innerWidth / window.innerHeight;
      SOL.camera.updateProjectionMatrix();
      SOL.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // --------------------------------------------------------------- boot ---
  SOL.boot = function () {
    var shot = SOL.parseShotParams();
    SOL.renderer = makeRenderer();
    SOL.scene = new THREE.Scene();
    SOL.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
    SOL.camera.position.set(0, 40, 120);
    SOL.clock = new THREE.Clock();
    makeSky(SOL.scene);
    SOL.buildCity(SOL.scene);
    SOL.spawnParkedCars(SOL.scene, 14);
    SOL.spawnTraffic(SOL.scene, 16);
    SOL.spawnPedestrians(SOL.scene, 22);
    SOL.createPlayer(SOL.scene, 0, 120);
    SOL.initHud();
    SOL.bindInput();
    SOL.bindAudioGesture();
    bindButtons();
    SOL.showScreen('start-screen');
    SOL.updateStartScreenStats();
    // continue button only makes sense with a save
    var contBtn = document.getElementById('btn-continue');
    if (contBtn && !SOL.hasSave()) contBtn.classList.add('hidden');
    // screenshot staging (also starts the game for in-game shots)
    var staged = SOL.stageShot(shot);
    if (!staged && shot) SOL.hudToast('Unknown shot: ' + shot);
    if (!staged) SOL.phase = 'menu';
    window.__SOLMAR__ = SOL; // test + screenshot hooks
    tick();
  };

  window.addEventListener('DOMContentLoaded', SOL.boot);
})();
