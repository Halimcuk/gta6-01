// effects.js — particles for sparks and dust, the objective beacon,
// screen shake, and floating cash popups. Cheap, pooled, no textures.

(function () {
  'use strict';

  var particles = [];
  var particleGeo = null;
  var beacon = null;
  var beaconRing = null;

  function initGeo() {
    if (particleGeo) return;
    particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  }

  SOL.spawnSparks = function (x, y, z, count) {
    initGeo();
    for (var i = 0; i < (count || 8); i++) {
      var mat = new THREE.MeshBasicMaterial({ color: SOL.pick([0xffd76e, 0xff9f43, 0xffffff, 0xff6b35]) });
      var m = new THREE.Mesh(particleGeo, mat);
      m.position.set(x, y, z);
      SOL.scene.add(m);
      particles.push({
        mesh: m,
        vx: SOL.randRange(-6, 6), vy: SOL.randRange(1, 7), vz: SOL.randRange(-6, 6),
        life: SOL.randRange(0.3, 0.7),
      });
    }
  };

  SOL.spawnDust = function (x, y, z) {
    initGeo();
    var mat = new THREE.MeshBasicMaterial({ color: 0xcbb98f, transparent: true, opacity: 0.28 });
    var m = new THREE.Mesh(particleGeo, mat);
    m.scale.setScalar(1.3);
    m.position.set(x, y, z);
    SOL.scene.add(m);
    particles.push({ mesh: m, vx: SOL.randRange(-1, 1), vy: 0.6, vz: SOL.randRange(-1, 1), life: 0.8 });
  };

  SOL.updateParticles = function (dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        SOL.scene.remove(p.mesh);
        p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) p.mesh.position.y = 0.1;
      p.mesh.material.opacity = Math.min(1, p.life * 2);
      p.mesh.rotation.x += dt * 5;
      p.mesh.rotation.y += dt * 7;
    }
  };

  // The glowing objective column + pulsing ground ring at the mission target.
  SOL.setBeacon = function (x, z, color) {
    SOL.clearBeacon();
    var mat = new THREE.MeshBasicMaterial({
      color: color || 0xf5d76e, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true), mat);
    beacon.position.set(x, 30, z);
    SOL.scene.add(beacon);
    var ringMat = new THREE.MeshBasicMaterial({
      color: color || 0xf5d76e, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    beaconRing = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.4, 24), ringMat);
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.set(x, 0.12, z);
    SOL.scene.add(beaconRing);
    SOL.beaconPos = { x: x, z: z };
  };

  SOL.clearBeacon = function () {
    if (beacon) { SOL.scene.remove(beacon); beacon = null; }
    if (beaconRing) { SOL.scene.remove(beaconRing); beaconRing = null; }
    SOL.beaconPos = null;
  };

  SOL.updateBeacon = function (dt) {
    if (!beacon || !beaconRing) return;
    var pulse = 0.5 + Math.sin(SOL.elapsed * 3) * 0.3;
    beacon.material.opacity = 0.18 + pulse * 0.15;
    var s = 1 + Math.sin(SOL.elapsed * 3) * 0.12;
    beaconRing.scale.set(s, s, 1);
    beaconRing.rotation.z += dt * 0.8;
  };

  SOL.addShake = function (amount) {
    SOL.shake = Math.min(1, SOL.shake + amount);
  };

  SOL.updateShake = function (dt) {
    SOL.shake = Math.max(0, SOL.shake - dt * 1.8);
  };

  // Floating "+$500" popup over the HUD.
  SOL.floatCash = function (text) {
    var el = document.getElementById('cash-pop');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('pop');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('pop');
  };
})();
