// city.js — builds Solmar Bay: a 9x9 road grid of concrete blocks, towers
// downtown, low beachfront hotels to the south, a sand beach, the bay,
// a pier, palm trees, street lamps and a central plaza. All geometry is
// procedural; building footprints are registered as colliders.

(function () {
  'use strict';

  var CITY = SOL.CITY;
  var P = SOL.PALETTE;

  var buildingMats = [];
  var roofMat = null;
  var trunkMat = null;
  var leafMat = null;
  var lampMat = null;

  function box(w, h, d, mat) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    return m;
  }

  function addCollider(x, z, w, d) {
    SOL.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }

  // Circle (radius r) vs AABB push-out. Returns corrected {x, z}.
  SOL.resolveCollisions = function (x, z, r) {
    for (var i = 0; i < SOL.colliders.length; i++) {
      var c = SOL.colliders[i];
      var nx = SOL.clamp(x, c.minX, c.maxX);
      var nz = SOL.clamp(z, c.minZ, c.maxZ);
      var dx = x - nx, dz = z - nz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 < 0.0001) {
          // centre inside the box: push out along the smallest penetration
          var pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
          var m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - r;
          else if (m === pr) x = c.maxX + r;
          else if (m === pt) z = c.minZ - r;
          else z = c.maxZ + r;
        } else {
          var d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        }
      }
    }
    return { x: x, z: z };
  };

  SOL.pointInCollider = function (x, z) {
    for (var i = 0; i < SOL.colliders.length; i++) {
      var c = SOL.colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  };

  function buildGround(scene) {
    // base ground slab (sidewalk grey-green) under the whole city
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.HALF * 2 + 120, CITY.HALF * 2 + 120),
      new THREE.MeshLambertMaterial({ color: P.ground })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 20);
    scene.add(ground);

    // sand beach, south edge
    var sandTex = SOL.sandTexture();
    sandTex.repeat.set(10, 2);
    var sand = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.HALF * 2 + 120, CITY.WATER_Z - CITY.BEACH_Z + 8),
      new THREE.MeshLambertMaterial({ map: sandTex })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, (CITY.BEACH_Z + CITY.WATER_Z) / 2 + 4);
    scene.add(sand);

    // the bay: two tones, animated in main.js via material colour
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.HALF * 2 + 400, 500),
      new THREE.MeshLambertMaterial({ color: P.water })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.05, CITY.WATER_Z + 250);
    water.name = 'bayWater';
    scene.add(water);
    SOL.bayWater = water;
  }

  function buildRoads(scene) {
    var roadTex = SOL.roadTexture();
    var mat = new THREE.MeshLambertMaterial({ map: roadTex });
    var walkTex = SOL.sidewalkTexture();
    walkTex.repeat.set(24, 24);
    var walkMat = new THREE.MeshLambertMaterial({ map: walkTex });

    // sidewalk slabs under each block
    for (var bi = -CITY.GRID; bi < CITY.GRID; bi++) {
      for (var bj = -CITY.GRID; bj < CITY.GRID; bj++) {
        var cx = (bi + 0.5) * CITY.PITCH;
        var cz = (bj + 0.5) * CITY.PITCH;
        var slab = new THREE.Mesh(new THREE.PlaneGeometry(CITY.BLOCK + 8, CITY.BLOCK + 8), walkMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.04, cz);
        scene.add(slab);
      }
    }

    // roads: horizontal strips
    var len = CITY.HALF * 2 + 16;
    for (var i = -CITY.GRID; i <= CITY.GRID; i++) {
      var c = i * CITY.PITCH;
      var texH = roadTex.clone();
      texH.needsUpdate = true;
      texH.repeat.set(len / 16, 1);
      var roadH = new THREE.Mesh(
        new THREE.PlaneGeometry(len, CITY.ROAD),
        new THREE.MeshLambertMaterial({ map: texH })
      );
      roadH.rotation.x = -Math.PI / 2;
      roadH.rotation.z = Math.PI / 2;
      roadH.position.set(0, 0.06, c);
      scene.add(roadH);

      var texV = roadTex.clone();
      texV.needsUpdate = true;
      texV.repeat.set(len / 16, 1);
      var roadV = new THREE.Mesh(
        new THREE.PlaneGeometry(len, CITY.ROAD),
        new THREE.MeshLambertMaterial({ map: texV })
      );
      roadV.rotation.x = -Math.PI / 2;
      roadV.position.set(c, 0.06, 0);
      scene.add(roadV);
    }
  }

  var FACADE_COLORS = [0xd8c9a3, 0xb8c4cc, 0xd9a441, 0x9fb8a4, 0xc98a7a, 0x8fa3b8, 0xe0d6c2, 0x7fa8a0];

  function buildBuildings(scene) {
    roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4d52 });
    for (var bi = -CITY.GRID; bi < CITY.GRID; bi++) {
      for (var bj = -CITY.GRID; bj < CITY.GRID; bj++) {
        var cx = (bi + 0.5) * CITY.PITCH;
        var cz = (bj + 0.5) * CITY.PITCH;
        var distCenter = Math.sqrt(cx * cx + cz * cz);
        // central plaza block: fountain square, no buildings
        if (bi === 0 && bj === 0) { buildPlaza(scene, cx, cz); continue; }
        // beachfront row: low hotels
        var beachfront = bj === CITY.GRID - 1;
        var downtown = distCenter < 130;
        var spots = [];
        if (downtown || beachfront) {
          spots.push({ x: cx, z: cz, w: CITY.BLOCK * 0.8, d: CITY.BLOCK * 0.8 });
        } else {
          // four smaller buildings per block
          var q = CITY.BLOCK / 4;
          spots.push({ x: cx - q, z: cz - q, w: q * 1.7, d: q * 1.7 });
          spots.push({ x: cx + q, z: cz - q, w: q * 1.7, d: q * 1.7 });
          spots.push({ x: cx - q, z: cz + q, w: q * 1.7, d: q * 1.7 });
          spots.push({ x: cx + q, z: cz + q, w: q * 1.7, d: q * 1.7 });
        }
        for (var s = 0; s < spots.length; s++) {
          var sp = spots[s];
          var h;
          if (beachfront) h = SOL.randRange(10, 22);
          else if (downtown) h = SOL.randRange(28, 78);
          else h = SOL.randRange(8, 26);
          var floors = Math.max(2, Math.round(h / 6));
          var color = SOL.pick(FACADE_COLORS);
          var tex = SOL.buildingTexture(color, floors, 5);
          var mat = new THREE.MeshLambertMaterial({ map: tex });
          var b = box(sp.w, h, sp.d, mat);
          b.position.set(sp.x, h / 2, sp.z);
          scene.add(b);
          var roof = box(sp.w + 0.6, 0.8, sp.d + 0.6, roofMat);
          roof.position.set(sp.x, h + 0.4, sp.z);
          scene.add(roof);
          // rooftop box (AC / lift housing) on tall towers
          if (h > 40 && SOL.chance(0.6)) {
            var top = box(sp.w * 0.3, 3, sp.d * 0.3, roofMat);
            top.position.set(sp.x, h + 2, sp.z);
            scene.add(top);
          }
          addCollider(sp.x, sp.z, sp.w, sp.d);
          SOL.buildings.push({ x: sp.x, z: sp.z, w: sp.w, d: sp.d, h: h, color: color });
        }
      }
    }
  }

  function buildPlaza(scene, cx, cz) {
    // circular fountain at the city centre
    var basin = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 10, 1.2, 24),
      new THREE.MeshLambertMaterial({ color: 0x8fa3b8 })
    );
    basin.position.set(cx, 0.6, cz);
    scene.add(basin);
    var waterTop = new THREE.Mesh(
      new THREE.CylinderGeometry(8.2, 8.2, 0.4, 24),
      new THREE.MeshLambertMaterial({ color: P.water })
    );
    waterTop.position.set(cx, 1.1, cz);
    waterTop.name = 'fountainWater';
    scene.add(waterTop);
    SOL.fountainWater = waterTop;
    var spout = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.6, 4, 12),
      new THREE.MeshLambertMaterial({ color: 0xd8d2c0 })
    );
    spout.position.set(cx, 2.6, cz);
    scene.add(spout);
    addCollider(cx, cz, 20, 20);
    SOL.buildings.push({ x: cx, z: cz, w: 20, d: 20, h: 4, color: 0x8fa3b8 });
    // benches around the plaza
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      var bench = box(4, 0.8, 1.4, new THREE.MeshLambertMaterial({ color: 0x6b4f2a }));
      bench.position.set(cx + Math.cos(a) * 15, 0.4, cz + Math.sin(a) * 15);
      bench.rotation.y = -a + Math.PI / 2;
      scene.add(bench);
    }
  }

  function buildPier(scene) {
    // wooden pier reaching into the bay from the beach
    var wood = new THREE.MeshLambertMaterial({ color: 0x9a7b4f });
    var deck = box(10, 0.8, 60, wood);
    deck.position.set(0, 1.2, CITY.WATER_Z + 22);
    scene.add(deck);
    for (var i = 0; i < 5; i++) {
      var z = CITY.WATER_Z + 2 + i * 11;
      var postL = box(0.8, 3, 0.8, wood);
      postL.position.set(-4.6, 0.4, z);
      scene.add(postL);
      var postR = box(0.8, 3, 0.8, wood);
      postR.position.set(4.6, 0.4, z);
      scene.add(postR);
    }
    var hut = box(8, 5, 8, new THREE.MeshLambertMaterial({ color: 0xe0d6c2 }));
    hut.position.set(0, 3.8, CITY.WATER_Z + 48);
    scene.add(hut);
    var hutRoof = box(9.5, 0.8, 9.5, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
    hutRoof.position.set(0, 6.6, CITY.WATER_Z + 48);
    scene.add(hutRoof);
    addCollider(0, CITY.WATER_Z + 48, 8, 8);
    SOL.buildings.push({ x: 0, z: CITY.WATER_Z + 48, w: 8, d: 8, h: 7, color: 0xe0d6c2 });
    SOL.pierEnd = { x: 0, z: CITY.WATER_Z + 40 };
  }

  function buildPalmsAndLamps(scene) {
    trunkMat = new THREE.MeshLambertMaterial({ color: P.palmTrunk });
    leafMat = new THREE.MeshLambertMaterial({ color: P.palmLeaf });
    lampMat = new THREE.MeshLambertMaterial({ color: P.lampPole });

    function palm(x, z, scale) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 6, 7), trunkMat);
      trunk.position.y = 3;
      trunk.rotation.z = SOL.randRange(-0.08, 0.08);
      g.add(trunk);
      for (var i = 0; i < 6; i++) {
        var frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
        var a = (i / 6) * Math.PI * 2;
        frond.position.set(Math.cos(a) * 1.2, 6.2, Math.sin(a) * 1.2);
        frond.rotation.z = Math.cos(a) * 1.1;
        frond.rotation.x = -Math.sin(a) * 1.1;
        frond.scale.set(1, 1, 0.35);
        g.add(frond);
      }
      g.position.set(x, 0, z);
      g.scale.setScalar(scale || 1);
      scene.add(g);
      SOL.palms.push(g);
    }

    // palms along the beach and scattered on sidewalks
    for (var x = -CITY.HALF + 20; x <= CITY.HALF - 10; x += 34) {
      palm(x + SOL.randRange(-4, 4), CITY.BEACH_Z + SOL.randRange(4, 18), SOL.randRange(0.9, 1.3));
    }
    for (var i = 0; i < 26; i++) {
      var bi = SOL.randInt(-CITY.GRID, CITY.GRID - 1);
      var bj = SOL.randInt(-CITY.GRID, CITY.GRID - 1);
      if (bi === 0 && bj === 0) continue;
      var px = (bi + 0.5) * CITY.PITCH + SOL.pick([-1, 1]) * (CITY.BLOCK / 2 + 2);
      var pz = (bj + 0.5) * CITY.PITCH + SOL.randRange(-CITY.BLOCK / 2, CITY.BLOCK / 2);
      if (!SOL.pointInCollider(px, pz)) palm(px, pz, SOL.randRange(0.8, 1.1));
    }

    // street lamps at intersections
    var bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
    for (var ix = -CITY.GRID; ix <= CITY.GRID; ix++) {
      for (var iz = -CITY.GRID; iz <= CITY.GRID; iz++) {
        if ((ix + iz) % 2 !== 0) continue;
        var lx = ix * CITY.PITCH + CITY.ROAD / 2 + 1.5;
        var lz = iz * CITY.PITCH + CITY.ROAD / 2 + 1.5;
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
        pole.position.set(lx, 3.5, lz);
        scene.add(pole);
        var arm = box(2.4, 0.25, 0.25, lampMat);
        arm.position.set(lx - 1.1, 6.9, lz);
        scene.add(arm);
        var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
        bulb.position.set(lx - 2.2, 6.8, lz);
        scene.add(bulb);
      }
    }
  }

  // Landmark towers so the skyline reads from anywhere.
  function buildLandmarks(scene) {
    // the Meridian Bank tower — tall, gold-topped, at the north-east quarter
    var bankX = 2.5 * CITY.PITCH, bankZ = -2.5 * CITY.PITCH;
    var bankTex = SOL.buildingTexture(0x2c3e50, 12, 6);
    var bank = box(30, 95, 30, new THREE.MeshLambertMaterial({ map: bankTex }));
    bank.position.set(bankX, 47.5, bankZ);
    scene.add(bank);
    var gold = box(31, 2, 31, new THREE.MeshLambertMaterial({ color: 0xd9a441 }));
    gold.position.set(bankX, 96, bankZ);
    scene.add(gold);
    addCollider(bankX, bankZ, 30, 30);
    SOL.buildings.push({ x: bankX, z: bankZ, w: 30, d: 30, h: 96, color: 0x2c3e50 });
    SOL.bankPos = { x: bankX, z: bankZ };
    // Mara's garage — the crew hideout, south-west quarter
    var gX = -2.5 * CITY.PITCH, gZ = 2.5 * CITY.PITCH;
    var garage = box(26, 9, 20, new THREE.MeshLambertMaterial({ color: 0x7a2e2e }));
    garage.position.set(gX, 4.5, gZ);
    scene.add(garage);
    var door = box(14, 6, 0.6, new THREE.MeshLambertMaterial({ color: 0x3a3d42 }));
    door.position.set(gX, 3, gZ - 10.2);
    scene.add(door);
    addCollider(gX, gZ, 26, 20);
    SOL.buildings.push({ x: gX, z: gZ, w: 26, d: 20, h: 9, color: 0x7a2e2e });
    SOL.garagePos = { x: gX, z: gZ - 14 };
    SOL.hideoutPos = { x: gX, z: gZ - 14 };
  }

  SOL.buildCity = function (scene) {
    buildGround(scene);
    buildRoads(scene);
    buildBuildings(scene);
    buildLandmarks(scene);
    buildPier(scene);
    buildPalmsAndLamps(scene);
  };

  // Random free point on a road (for spawning traffic / peds).
  SOL.randomRoadPoint = function () {
    var i = SOL.randInt(-CITY.GRID, CITY.GRID);
    if (SOL.chance(0.5)) return { x: SOL.randRange(-CITY.HALF, CITY.HALF), z: i * CITY.PITCH };
    return { x: i * CITY.PITCH, z: SOL.randRange(-CITY.HALF, CITY.HALF) };
  };

  // Random free point on a sidewalk (near a road, off the asphalt).
  SOL.randomSidewalkPoint = function () {
    var p = SOL.randomRoadPoint();
    var off = SOL.pick([-1, 1]) * (CITY.ROAD / 2 + 2.5);
    if (Math.abs(p.x) > Math.abs(p.z)) { /* on a vertical road */ p.x += off; }
    else p.z += off;
    return p;
  };
})();
