// pedestrians.js — the people of Solmar Bay. They stroll the sidewalks,
// scatter when a car bears down on them, and remember a punch.

(function () {
  'use strict';

  var CITY = SOL.CITY;

  function makePedMesh(shirtColor) {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: SOL.pick([0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac]) });
    var shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    var pants = new THREE.MeshLambertMaterial({ color: SOL.pick([0x2c3e50, 0x34495e, 0x7f8c8d, 0x5d4037]) });
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.9, 8), shirt);
    body.position.y = 1.05;
    g.add(body);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
    head.position.y = 1.75;
    g.add(head);
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), pants);
    legL.position.set(-0.14, 0.3, 0);
    g.add(legL);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.18), pants);
    legR.position.set(0.14, 0.3, 0);
    g.add(legR);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
    armL.position.set(-0.4, 1.1, 0);
    g.add(armL);
    var armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), shirt);
    armR.position.set(0.4, 1.1, 0);
    g.add(armR);
    // blob shadow
    var shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
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

  SOL.spawnPedestrians = function (scene, count) {
    for (var i = 0; i < count; i++) {
      var p = SOL.randomSidewalkPoint();
      var mesh = makePedMesh(SOL.pick(SOL.SHIRT_COLORS));
      mesh.position.set(p.x, 0, p.z);
      scene.add(mesh);
      SOL.peds.push({
        mesh: mesh, x: p.x, z: p.z,
        heading: SOL.randRange(0, Math.PI * 2),
        speed: SOL.randRange(1.2, 2.2),
        state: 'walk', // walk | flee | down
        stateTimer: 0,
        walkPhase: SOL.randRange(0, 6),
        target: null,
      });
    }
  };

  function pickWalkTarget(ped) {
    var p = SOL.randomSidewalkPoint();
    ped.target = p;
    ped.heading = Math.atan2(p.x - ped.x, p.z - ped.z);
  }

  SOL.updatePedestrians = function (dt) {
    var player = SOL.player;
    for (var i = 0; i < SOL.peds.length; i++) {
      var ped = SOL.peds[i];
      ped.stateTimer -= dt;
      if (ped.state === 'down') {
        // lying down after being hit; get back up after a while
        ped.mesh.rotation.x = SOL.lerp(ped.mesh.rotation.x, -Math.PI / 2 * 0.9, SOL.clamp(dt * 4, 0, 1));
        if (ped.stateTimer <= 0) {
          ped.state = 'flee';
          ped.stateTimer = 4;
          ped.mesh.rotation.x = 0;
        }
        continue;
      }
      // fear: player car close and fast, or player punching nearby
      var threat = 0;
      if (player) {
        var d = SOL.dist2d(ped.x, ped.z, player.pos.x, player.pos.z);
        var carSpeed = SOL.playerCar ? Math.abs(SOL.playerCar.speed) : 0;
        if (d < 10 && carSpeed > 8) threat = 2;
        else if (d < 4) threat = 1;
      }
      if (threat > 0 && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.stateTimer = SOL.randRange(2, 4);
        // run away from the player
        ped.heading = Math.atan2(ped.x - player.pos.x, ped.z - player.pos.z);
      }
      if (ped.state === 'flee' && ped.stateTimer <= 0) {
        ped.state = 'walk';
        pickWalkTarget(ped);
      }
      if (ped.state === 'walk' && !ped.target) pickWalkTarget(ped);
      var speed = ped.state === 'flee' ? 5.2 : ped.speed;
      if (ped.state === 'walk' && ped.target) {
        var td = SOL.dist2d(ped.x, ped.z, ped.target.x, ped.target.z);
        if (td < 2) pickWalkTarget(ped);
        else ped.heading = SOL.angleLerp(ped.heading, Math.atan2(ped.target.x - ped.x, ped.target.z - ped.z), SOL.clamp(dt * 2, 0, 1));
      }
      var nx = ped.x + Math.sin(ped.heading) * speed * dt;
      var nz = ped.z + Math.cos(ped.heading) * speed * dt;
      var fixed = SOL.resolveCollisions(nx, nz, 0.5);
      ped.x = SOL.clamp(fixed.x, -CITY.HALF - 20, CITY.HALF + 20);
      ped.z = SOL.clamp(fixed.z, -CITY.HALF - 20, CITY.WATER_Z - 4);
      ped.walkPhase += dt * speed * 3.2;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // walk cycle: swing legs and arms
      var swing = Math.sin(ped.walkPhase) * 0.5;
      ped.mesh.userData.legL.rotation.x = swing;
      ped.mesh.userData.legR.rotation.x = -swing;
      ped.mesh.userData.armL.rotation.x = -swing * 0.7;
      ped.mesh.userData.armR.rotation.x = swing * 0.7;
      // hit by the player's car?
      if (SOL.playerCar && Math.abs(SOL.playerCar.speed) > 3) {
        var cd = SOL.dist2d(ped.x, ped.z, SOL.playerCar.x, SOL.playerCar.z);
        if (cd < 2.2) {
          SOL.knockDownPed(ped);
          SOL.audio.crash(false);
          SOL.addHeat(1);
          SOL.hudToast('Pedestrian down! The cops noticed.');
        }
      }
    }
  };

  SOL.knockDownPed = function (ped) {
    ped.state = 'down';
    ped.stateTimer = 5;
    ped.mesh.rotation.x = -Math.PI / 2 * 0.9;
    SOL.spawnSparks(ped.x, 0.5, ped.z, 6);
  };

  // The player's punch: nearest pedestrian within reach goes down.
  SOL.punchAt = function (x, z, heading) {
    var best = null, bestD = 2.6;
    for (var i = 0; i < SOL.peds.length; i++) {
      var ped = SOL.peds[i];
      if (ped.state === 'down') continue;
      var d = SOL.dist2d(x, z, ped.x, ped.z);
      if (d < bestD) {
        var fx = Math.sin(heading), fz = Math.cos(heading);
        var dot = ((ped.x - x) * fx + (ped.z - z) * fz) / Math.max(d, 0.01);
        if (dot > 0.1) { best = ped; bestD = d; }
      }
    }
    if (best) {
      SOL.knockDownPed(best);
      SOL.addHeat(1);
      SOL.hudToast('You decked a pedestrian! Wanted level up.');
      return true;
    }
    return false;
  };
})();
