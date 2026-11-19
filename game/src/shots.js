// shots.js — screenshot staging. The game reads ?shot=<name>&seed=<n> and
// sets up a fixed, photogenic scene for the maker to capture: a chase,
// a drive, a walk through the beachfront, or the title screen. The same
// code path runs in normal play; staging only picks the starting state.

(function () {
  'use strict';

  SOL.parseShotParams = function () {
    var q = new URLSearchParams(window.location.search);
    var shot = q.get('shot');
    var seed = parseInt(q.get('seed') || '1337', 10);
    if (Number.isNaN(seed)) seed = 1337;
    SOL.seedRandom(seed);
    return shot;
  };

  // Drive the car forward on its own so a still camera still shows motion.
  function autoDrive() {
    SOL.demo = { autoDrive: true, steer: 0 };
  }

  SOL.stageShot = function (shot) {
    if (!shot) return false;
    var p = SOL.player;
    if (!p) return false;
    if (shot === 'menu') {
      SOL.phase = 'menu';
      SOL.showScreen('start-screen');
      SOL.updateStartScreenStats();
      return true;
    }
    // every in-game shot starts playing, HUD on, menus hidden
    SOL.phase = 'playing';
    SOL.showScreen(null);
    SOL.money = 1250;
    SOL.bestWanted = 3;
    SOL.missions.startCurrent();

    if (shot === 'cover' || shot === 'chase') {
      // Rex mid-chase on the east-west avenue: 3 stars, two PD cars closing
      // in, job running. The car sits ON a road (z = 0), not in a block.
      var car = SOL.parkedCars[0];
      if (car) {
        SOL.parkedCars.splice(0, 1);
        SOL.playerCar = car;
        car.x = -72; car.z = 0; car.heading = Math.PI / 2; car.speed = 24;
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        p.onFoot = false;
        p.mesh.visible = false;
        p.pos.set(car.x, 0, car.z);
      }
      SOL.wanted = 3;
      SOL.heatTimer = 0;
      SOL.missionIndex = 1; // sunset courier, pier marker visible
      SOL.mission = null;
      SOL.missions.startCurrent();
      if (SOL.mission) SOL.mission.step = 1;
      SOL.missionTarget = SOL.pierEnd;
      SOL.setBeacon(SOL.pierEnd.x, SOL.pierEnd.z, 0xf5d76e);
      SOL.spawnPoliceCar(SOL.scene);
      SOL.spawnPoliceCar(SOL.scene);
      SOL.police.forEach(function (v, i) {
        v.x = car.x + (i === 0 ? -14 : 16);
        v.z = car.z + (i === 0 ? -18 : 10);
        v.heading = car.heading;
      });
      SOL.camYaw = Math.PI * 0.78;
      SOL.camPitch = 0.24;
      autoDrive();
      return true;
    }

    if (shot === 'drive') {
      var car2 = SOL.parkedCars[0];
      if (car2) {
        SOL.parkedCars.splice(0, 1);
        SOL.playerCar = car2;
        car2.x = 0; car2.z = 180; car2.heading = Math.PI; car2.speed = 18;
        car2.mesh.position.set(car2.x, 0, car2.z);
        car2.mesh.rotation.y = car2.heading;
        p.onFoot = false;
        p.mesh.visible = false;
        p.pos.set(car2.x, 0, car2.z);
      }
      SOL.wanted = 0;
      SOL.missionIndex = 0;
      SOL.mission = null;
      SOL.missions.startCurrent();
      SOL.missions.onEnterCar(car2); // already behind the wheel: job step 1
      SOL.camYaw = Math.PI * 1.05;
      SOL.camPitch = 0.3;
      autoDrive();
      return true;
    }

    if (shot === 'foot') {
      // on foot at the plaza's south edge, fountain ahead, peds and traffic around
      p.pos.set(24, 0, 60);
      p.mesh.position.copy(p.pos);
      p.yaw = Math.PI * 0.95;
      SOL.camYaw = Math.PI * 0.12;
      SOL.camPitch = 0.28;
      SOL.wanted = 0;
      SOL.missionIndex = 0;
      SOL.mission = null;
      SOL.missions.startCurrent();
      return true;
    }

    if (shot === 'beach') {
      p.pos.set(40, 0, SOL.CITY.BEACH_Z + 12);
      p.mesh.position.copy(p.pos);
      p.yaw = Math.PI;
      SOL.camYaw = Math.PI * 0.05;
      SOL.camPitch = 0.22;
      SOL.wanted = 0;
      return true;
    }
    return false;
  };
})();
