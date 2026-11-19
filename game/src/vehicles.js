// vehicles.js — car meshes, arcade driving physics, traffic AI that follows
// the road grid, parked cars to steal, and the Bay PD pursuit cars.

(function () {
  'use strict';

  var CITY = SOL.CITY;

  var wheelGeo = null;
  var wheelMat = null;

  function initShared() {
    if (wheelGeo) return;
    wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  }

  // A low-poly car: body, cabin, wheels, lights, and a blob shadow.
  // type: 'sedan' | 'taxi' | 'truck' | 'sport' | 'police'
  SOL.makeCarMesh = function (color, type) {
    initShared();
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2b3a });
    var bodyLen = type === 'truck' ? 5.6 : 4.4;
    var bodyH = type === 'truck' ? 1.5 : 0.85;
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.0, bodyH, bodyLen), bodyMat);
    body.position.y = 0.75;
    g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, type === 'truck' ? 1.6 : 2.2), glassMat);
    cabin.position.set(0, 1.45, type === 'truck' ? 1.2 : -0.2);
    g.add(cabin);
    if (type === 'sport') {
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.5), bodyMat);
      spoiler.position.set(0, 1.35, -bodyLen / 2 + 0.2);
      g.add(spoiler);
    }
    if (type === 'taxi') {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xf5d76e }));
      sign.position.set(0, 1.95, -0.2);
      g.add(sign);
    }
    if (type === 'police') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      bar.position.set(0, 1.9, -0.2);
      g.add(bar);
      var red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      red.position.set(-0.32, 1.92, -0.2);
      red.name = 'lightRed';
      g.add(red);
      var blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
      blue.position.set(0.32, 1.92, -0.2);
      blue.name = 'lightBlue';
      g.add(blue);
    }
    // headlights / taillights
    var headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    [-0.65, 0.65].forEach(function (x) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), headMat);
      h.position.set(x, 0.8, bodyLen / 2 + 0.01);
      g.add(h);
      var t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tailMat);
      t.position.set(x, 0.8, -bodyLen / 2 - 0.01);
      g.add(t);
    });
    // wheels
    var wheelPos = [
      [-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45],
    ];
    wheelPos.forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
    });
    // blob shadow
    var shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, bodyLen + 0.8),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    g.add(shadow);
    g.userData.bodyLen = bodyLen;
    return g;
  };

  function newVehicle(mesh, x, z, heading, type) {
    return {
      mesh: mesh, x: x, z: z, heading: heading,
      speed: 0, steer: 0, type: type || 'sedan',
      radius: 1.6, crashed: 0, // crash cooldown timer
    };
  }

  // --------------------------------------------------------- traffic AI ---
  SOL.spawnTraffic = function (scene, count) {
    var types = ['sedan', 'sedan', 'taxi', 'truck', 'sport'];
    for (var i = 0; i < count; i++) {
      var p = SOL.randomRoadPoint();
      var horizontal = Math.abs(p.z % CITY.PITCH) < 1;
      // heading 0 drives +z, heading PI/2 drives +x: horizontal roads need +-PI/2
      var heading = horizontal ? (SOL.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (SOL.chance(0.5) ? 0 : Math.PI);
      var lane = SOL.pick([-1, 1]) * 4;
      var mesh = SOL.makeCarMesh(SOL.pick(SOL.CAR_COLORS), SOL.pick(types));
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = heading;
      scene.add(mesh);
      var v = newVehicle(mesh, p.x, p.z, heading, 'traffic');
      v.horizontal = horizontal;
      v.lane = lane;
      v.speed = SOL.randRange(8, 13);
      v.cruise = v.speed;
      SOL.traffic.push(v);
    }
  };

  function nearestIntersection(v) {
    // distance along current axis to the next road centreline crossing
    var along = v.horizontal ? v.x : v.z;
    var dir = v.horizontal ? Math.sin(v.heading) : Math.cos(v.heading);
    var next = Math.round(along / CITY.PITCH) * CITY.PITCH;
    if (Math.abs(along - next) < 2) next += dir * CITY.PITCH;
    return Math.abs(next - along);
  }

  SOL.updateTraffic = function (dt, scene) {
    var player = SOL.player;
    for (var i = 0; i < SOL.traffic.length; i++) {
      var v = SOL.traffic[i];
      // slow down if a car is right ahead
      var ahead = 99;
      for (var j = 0; j < SOL.traffic.length; j++) {
        if (j === i) continue;
        var o = SOL.traffic[j];
        var d = SOL.dist2d(v.x, v.z, o.x, o.z);
        if (d < ahead) {
          var fx = Math.sin(v.heading), fz = Math.cos(v.heading);
          var dot = (o.x - v.x) * fx + (o.z - v.z) * fz;
          if (dot > 0 && d < 12) ahead = d;
        }
      }
      var targetSpeed = v.cruise;
      if (ahead < 10) targetSpeed = 0;
      // stop for the player's car right in front
      if (SOL.playerCar) {
        var pd = SOL.dist2d(v.x, v.z, SOL.playerCar.x, SOL.playerCar.z);
        if (pd < 9) {
          var fx2 = Math.sin(v.heading), fz2 = Math.cos(v.heading);
          var dot2 = (SOL.playerCar.x - v.x) * fx2 + (SOL.playerCar.z - v.z) * fz2;
          if (dot2 > 0) targetSpeed = 0;
        }
      }
      v.speed = SOL.lerp(v.speed, targetSpeed, SOL.clamp(dt * 2, 0, 1));
      // random turn at intersections
      if (nearestIntersection(v) < 1.5 && SOL.chance(dt * 0.55)) {
        v.horizontal = !v.horizontal;
        var turn = SOL.pick([-1, 1]);
        v.heading += turn * Math.PI / 2;
        // snap to the lane of the new road
        if (v.horizontal) v.z = Math.round(v.z / CITY.PITCH) * CITY.PITCH + v.lane;
        else v.x = Math.round(v.x / CITY.PITCH) * CITY.PITCH + v.lane;
      }
      // U-turn at the city edge
      var along = v.horizontal ? v.x : v.z;
      if (Math.abs(along) > CITY.HALF + 4) v.heading += Math.PI;
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      // keep on the lane
      if (v.horizontal) v.z = SOL.lerp(v.z, Math.round(v.z / CITY.PITCH) * CITY.PITCH + v.lane, SOL.clamp(dt * 3, 0, 1));
      else v.x = SOL.lerp(v.x, Math.round(v.x / CITY.PITCH) * CITY.PITCH + v.lane, SOL.clamp(dt * 3, 0, 1));
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      // recycle far-away cars near the player
      if (player && SOL.dist2d(v.x, v.z, player.pos.x, player.pos.z) > 420) {
        var p = SOL.randomRoadPoint();
        v.x = p.x; v.z = p.z;
        v.horizontal = Math.abs(p.z % CITY.PITCH) < 1;
        v.heading = v.horizontal ? (SOL.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (SOL.chance(0.5) ? 0 : Math.PI);
      }
    }
  };

  // -------------------------------------------------------- parked cars ---
  SOL.spawnParkedCars = function (scene, count) {
    for (var i = 0; i < count; i++) {
      var p = SOL.randomRoadPoint();
      var horizontal = Math.abs(p.z % CITY.PITCH) < 1;
      var lane = SOL.pick([-1, 1]) * 6.2;
      var x = horizontal ? p.x : p.x + lane;
      var z = horizontal ? p.z + lane : p.z;
      // parked facing the direction of travel on its side of the road
      var heading = horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? Math.PI : 0);
      var mesh = SOL.makeCarMesh(SOL.pick(SOL.CAR_COLORS), SOL.pick(['sedan', 'sedan', 'sport', 'taxi']));
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      scene.add(mesh);
      var v = newVehicle(mesh, x, z, heading, 'parked');
      SOL.parkedCars.push(v);
    }
  };

  // ----------------------------------------------------- player driving ---
  SOL.drivePlayerCar = function (dt, axes) {
    var car = SOL.playerCar;
    if (!car) return;
    var maxSpeed = car.type === 'sport' ? 34 : car.type === 'truck' ? 24 : 29;
    var accel = 16, brake = 30;
    if (axes.y > 0) car.speed += accel * dt * (car.speed < 0 ? 2 : 1);
    else if (axes.y < 0) {
      if (car.speed > 0.5) car.speed -= brake * dt;
      else car.speed -= 8 * dt;
    } else {
      car.speed -= car.speed * 0.9 * dt;
      if (Math.abs(car.speed) < 0.1) car.speed = 0;
    }
    car.speed = SOL.clamp(car.speed, -10, maxSpeed);
    // steering only works while moving; sharper at low speed
    var steerTarget = axes.x * SOL.clamp(Math.abs(car.speed) / 8, 0, 1) * 0.55;
    car.steer = SOL.lerp(car.steer, steerTarget, SOL.clamp(dt * 6, 0, 1));
    var turnRate = car.steer * (car.speed >= 0 ? 1 : -1) * SOL.clamp(Math.abs(car.speed) / 10, 0.25, 1);
    car.heading -= turnRate * dt * 1.9;
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // buildings block the car
    var fixed = SOL.resolveCollisions(nx, nz, 1.7);
    if (fixed.x !== nx || fixed.z !== nz) {
      if (Math.abs(car.speed) > 6 && car.crashed <= 0) {
        SOL.audio.crash(true);
        SOL.addShake(Math.abs(car.speed) * 0.02);
        SOL.spawnSparks(fixed.x, 0.8, fixed.z, 10);
        car.speed *= -0.25;
        car.crashed = 0.6;
        if (SOL.wanted > 0) SOL.addHeat(0); // noise keeps heat alive
      } else {
        car.speed *= 0.4;
      }
    }
    car.x = fixed.x; car.z = fixed.z;
    // keep the player body glued to the car: missions, police, the
    // minimap and the exit point all read player.pos
    if (SOL.player) SOL.player.pos.set(car.x, 0, car.z);
    // soft city bounds
    car.x = SOL.clamp(car.x, -CITY.HALF - 30, CITY.HALF + 30);
    car.z = SOL.clamp(car.z, -CITY.HALF - 30, CITY.WATER_Z - 6);
    car.crashed = Math.max(0, car.crashed - dt);
    // bump into traffic cars
    SOL.carVsTraffic(car);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // wheels spin (visual)
    car.mesh.rotation.z = 0;
    // engine sound follows speed
    SOL.audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
    SOL.audio.setSiren(SOL.wanted > 0);
  };

  // Player car vs traffic + parked cars: push apart, spark, slow down.
  SOL.carVsTraffic = function (car) {
    function bump(o) {
      var d = SOL.dist2d(car.x, car.z, o.x, o.z);
      var min = 3.4;
      if (d < min && d > 0.01) {
        var push = (min - d) / 2;
        var nx = (car.x - o.x) / d, nz = (car.z - o.z) / d;
        car.x += nx * push; car.z += nz * push;
        if (o.type === 'traffic') { o.x -= nx * push; o.z -= nz * push; o.speed *= 0.4; }
        if (Math.abs(car.speed) > 5 && car.crashed <= 0) {
          SOL.audio.crash(false);
          SOL.addShake(0.25);
          SOL.spawnSparks(car.x + nx * 1.5, 0.8, car.z + nz * 1.5, 8);
          car.speed *= 0.5;
          car.crashed = 0.5;
          SOL.addHeat(0.2);
        }
      }
    }
    for (var i = 0; i < SOL.traffic.length; i++) bump(SOL.traffic[i]);
    for (var j = 0; j < SOL.parkedCars.length; j++) {
      if (SOL.parkedCars[j] !== car) bump(SOL.parkedCars[j]);
    }
    for (var k = 0; k < SOL.police.length; k++) bump(SOL.police[k]);
  };

  // ------------------------------------------------------------ police ---
  SOL.spawnPoliceCar = function (scene) {
    var p = SOL.player;
    if (!p) return null;
    var a = SOL.randRange(0, Math.PI * 2);
    var x = SOL.clamp(p.pos.x + Math.cos(a) * 60, -CITY.HALF, CITY.HALF);
    var z = SOL.clamp(p.pos.z + Math.sin(a) * 60, -CITY.HALF, CITY.WATER_Z - 10);
    var mesh = SOL.makeCarMesh(0xf5f5f5, 'police');
    // black doors: a dark band box over the body
    var band = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.5, 2.2), new THREE.MeshLambertMaterial({ color: 0x1a1d20 }));
    band.position.y = 0.85;
    mesh.add(band);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    var v = newVehicle(mesh, x, z, 0, 'police');
    v.speed = 0;
    SOL.police.push(v);
    return v;
  };

  SOL.updatePolice = function (dt, scene) {
    var p = SOL.player;
    if (!p) return;
    // wanted count scales with stars: 1 star -> 1 car, 5 stars -> 4 cars
    var want = SOL.wanted === 0 ? 0 : Math.min(4, 1 + Math.floor((SOL.wanted - 1) / 1.5));
    while (SOL.police.length < want) SOL.spawnPoliceCar(scene);
    // flash lightbars
    var flash = Math.floor(SOL.elapsed * 6) % 2 === 0;
    for (var i = 0; i < SOL.police.length; i++) {
      var v = SOL.police[i];
      var red = v.mesh.getObjectByName('lightRed');
      var blue = v.mesh.getObjectByName('lightBlue');
      if (red) red.visible = flash;
      if (blue) blue.visible = !flash;
      // pursuit steering: aim at the player, slide around buildings
      var dx = p.pos.x - v.x, dz = p.pos.z - v.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var targetHeading = Math.atan2(dx, dz);
      var topSpeed = 26 + SOL.wanted * 1.5;
      // stop on top of the player instead of driving past them
      var chaseSpeed = dist < 5 ? 0 : Math.min(topSpeed, dist * 0.6 + 8);
      v.speed = SOL.lerp(v.speed, chaseSpeed, SOL.clamp(dt * 1.2, 0, 1));
      var diff = targetHeading - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.heading += SOL.clamp(diff, -2.2 * dt, 2.2 * dt);
      var nx = v.x + Math.sin(v.heading) * v.speed * dt;
      var nz = v.z + Math.cos(v.heading) * v.speed * dt;
      var fixed = SOL.resolveCollisions(nx, nz, 1.7);
      if (fixed.x !== nx || fixed.z !== nz) {
        // blocked: steer around by turning sharply
        v.heading += 1.4 * dt * (SOL.chance(0.5) ? 1 : -1);
        v.speed *= 0.7;
      } else {
        v.x = fixed.x; v.z = fixed.z;
      }
      v.mesh.position.set(v.x, 0, v.z);
      v.mesh.rotation.y = v.heading;
      // ramming the player's car damages it; touching the player on foot busts
      if (dist < 5) {
        if (SOL.playerCar) {
          SOL.playerCar.speed *= 0.6;
          if (v.crashed <= 0) {
            SOL.audio.crash(false);
            SOL.addShake(0.35);
            SOL.spawnSparks(v.x, 0.9, v.z, 8);
            v.crashed = 0.8;
            SOL.damagePlayer(6);
          }
          v.crashed = Math.max(0, v.crashed - dt);
        } else {
          SOL.bustedTimer += dt;
          if (SOL.bustedTimer > 2) SOL.bustPlayer('The Bay PD caught you on foot.');
        }
      }
    }
    // when the heat is gone, police drive off and despawn
    if (SOL.wanted === 0) {
      for (var j = SOL.police.length - 1; j >= 0; j--) {
        var pv = SOL.police[j];
        var d2 = SOL.dist2d(pv.x, pv.z, p.pos.x, p.pos.z);
        if (d2 > 120) {
          scene.remove(pv.mesh);
          SOL.police.splice(j, 1);
        }
      }
    }
  };

  SOL.clearPolice = function (scene) {
    for (var i = 0; i < SOL.police.length; i++) scene.remove(SOL.police[i].mesh);
    SOL.police.length = 0;
  };
})();
