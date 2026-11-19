// player.js — Rex Marlowe on foot: WASD movement relative to the camera,
// sprint, jump, punching, and getting in and out of cars. Driving itself
// lives in vehicles.js; this module owns the on-foot body and the swap.

(function () {
  'use strict';

  var CITY = SOL.CITY;

  function makePlayerMesh() {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });
    var jacket = new THREE.MeshLambertMaterial({ color: 0x1f6f4a }); // green bomber
    var jeans = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), jacket);
    body.position.y = 1.1;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.82;
    g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 10), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    cap.position.y = 2.02;
    g.add(cap);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.65, 0.19), jeans);
    legL.position.set(-0.15, 0.32, 0);
    g.add(legL);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.65, 0.19), jeans);
    legR.position.set(0.15, 0.32, 0);
    g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.15), jacket);
    armL.position.set(-0.44, 1.15, 0);
    g.add(armL);
    var armR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.65, 0.15), jacket);
    armR.position.set(0.44, 1.15, 0);
    g.add(armR);
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    g.add(shadow);
    g.userData.legL = legL;
    g.userData.legR = legR;
    g.userData.armL = armL;
    g.userData.armR = armR;
    return g;
  }

  SOL.createPlayer = function (scene, x, z) {
    var mesh = makePlayerMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    SOL.player = {
      mesh: mesh,
      pos: new THREE.Vector3(x, 0, z),
      vel: new THREE.Vector3(),
      yaw: Math.PI,
      onFoot: true,
      health: 100,
      vy: 0,
      grounded: true,
      walkPhase: 0,
      punchTimer: 0,
      punchAnim: 0,
    };
    SOL.bustedTimer = 0;
    return SOL.player;
  };

  SOL.updatePlayerOnFoot = function (dt) {
    var p = SOL.player;
    if (!p || !p.onFoot) return;
    var axes = SOL.input.moveAxes();
    var sprint = SOL.input.down('ShiftLeft') || SOL.input.down('ShiftRight');
    var speed = sprint ? 8.5 : 5;
    // camera-relative movement: forward is where the camera looks
    var camYaw = SOL.camYaw;
    var fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    var rx = -fz, rz = fx;
    var mx = fx * axes.y + rx * axes.x;
    var mz = fz * axes.y + rz * axes.x;
    var len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      p.yaw = SOL.angleLerp(p.yaw, Math.atan2(mx, mz), SOL.clamp(dt * 10, 0, 1));
    }
    var targetVx = mx * speed * (len > 0.01 ? 1 : 0);
    var targetVz = mz * speed * (len > 0.01 ? 1 : 0);
    p.vel.x = SOL.lerp(p.vel.x, targetVx, SOL.clamp(dt * 12, 0, 1));
    p.vel.z = SOL.lerp(p.vel.z, targetVz, SOL.clamp(dt * 12, 0, 1));
    var nx = p.pos.x + p.vel.x * dt;
    var nz = p.pos.z + p.vel.z * dt;
    var fixed = SOL.resolveCollisions(nx, nz, 0.5);
    p.pos.x = SOL.clamp(fixed.x, -CITY.HALF - 24, CITY.HALF + 24);
    p.pos.z = SOL.clamp(fixed.z, -CITY.HALF - 24, CITY.WATER_Z - 4);
    // jump + gravity
    if (SOL.input.down('Space') && p.grounded) {
      p.vy = 7;
      p.grounded = false;
    }
    p.vy -= 22 * dt;
    p.pos.y += p.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.grounded = true; }
    // walk cycle
    var moving = Math.sqrt(p.vel.x * p.vel.x + p.vel.z * p.vel.z);
    p.walkPhase += dt * moving * 2.2;
    var swing = Math.sin(p.walkPhase) * 0.55 * SOL.clamp(moving / 5, 0, 1);
    p.mesh.userData.legL.rotation.x = swing;
    p.mesh.userData.legR.rotation.x = -swing;
    p.mesh.userData.armL.rotation.x = -swing * 0.7;
    p.mesh.userData.armR.rotation.x = swing * 0.7;
    // punch
    p.punchTimer -= dt;
    if (SOL.punchQueued) {
      SOL.punchQueued = false;
      if (p.punchTimer <= 0) {
        p.punchTimer = 0.45;
        p.punchAnim = 0.25;
        SOL.audio.punch();
        SOL.punchAt(p.pos.x, p.pos.z, p.yaw);
      }
    }
    if (p.punchAnim > 0) {
      p.punchAnim -= dt;
      p.mesh.userData.armR.rotation.x = -1.6 * Math.sin((0.25 - p.punchAnim) / 0.25 * Math.PI);
    }
    p.mesh.position.copy(p.pos);
    p.mesh.rotation.y = p.yaw;
    // slow health regen on foot, out of trouble
    if (SOL.wanted === 0 && p.health < 100) p.health = Math.min(100, p.health + 2 * dt);
  };

  // Find the nearest drivable car (parked or traffic, slow enough).
  SOL.nearestCar = function (maxDist) {
    var p = SOL.player;
    if (!p) return null;
    var best = null, bestD = maxDist;
    function check(v) {
      var d = SOL.dist2d(p.pos.x, p.pos.z, v.x, v.z);
      if (d < bestD) { best = v; bestD = d; }
    }
    for (var i = 0; i < SOL.parkedCars.length; i++) check(SOL.parkedCars[i]);
    for (var j = 0; j < SOL.traffic.length; j++) {
      if (Math.abs(SOL.traffic[j].speed) < 3) check(SOL.traffic[j]);
    }
    return best;
  };

  SOL.tryEnterCar = function () {
    var p = SOL.player;
    if (!p) return;
    if (p.onFoot) {
      var car = SOL.nearestCar(4.5);
      if (!car) return;
      // stealing a parked car is a crime; a traffic car too
      if (car.type === 'parked' || car.type === 'traffic') {
        SOL.addHeat(1);
        SOL.hudToast('Car jacked! The owner will call it in.');
      }
      // remove from its old list
      var pi = SOL.parkedCars.indexOf(car);
      if (pi >= 0) SOL.parkedCars.splice(pi, 1);
      var ti = SOL.traffic.indexOf(car);
      if (ti >= 0) SOL.traffic.splice(ti, 1);
      SOL.playerCar = car;
      car.speed = 0;
      p.onFoot = false;
      p.mesh.visible = false;
      SOL.audio.pickup();
      SOL.missions.onEnterCar(car);
    } else {
      SOL.exitCar();
    }
  };

  SOL.exitCar = function () {
    var p = SOL.player;
    var car = SOL.playerCar;
    if (!p || !car) return;
    // step out on the driver's side
    var side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    var ex = car.x + side.x * 2.4, ez = car.z + side.z * 2.4;
    var fixed = SOL.resolveCollisions(ex, ez, 0.5);
    p.pos.set(fixed.x, 0, fixed.z);
    p.vel.set(0, 0, 0);
    p.onFoot = true;
    p.mesh.visible = true;
    p.mesh.position.copy(p.pos);
    // the car becomes parked again
    car.speed = 0;
    SOL.parkedCars.push(car);
    SOL.playerCar = null;
    SOL.audio.setEngine(0, false);
  };

  SOL.damagePlayer = function (amount) {
    var p = SOL.player;
    if (!p || SOL.phase !== 'playing') return;
    p.health -= amount;
    SOL.hudFlashDamage();
    if (p.health <= 0) {
      p.health = 0;
      SOL.wastePlayer('You got wasted.');
    }
  };
})();
