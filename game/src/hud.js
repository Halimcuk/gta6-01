// hud.js — the on-screen interface: cash, wanted stars, health, speed,
// the mission line, the minimap, toasts, banners, and the damage flash.
// The minimap is a top-down canvas redrawn every frame.

(function () {
  'use strict';

  var CITY = SOL.CITY;
  var mapCanvas = null;
  var mapCtx = null;
  var toastTimer = null;
  var bannerTimer = null;

  function el(id) { return document.getElementById(id); }

  SOL.initHud = function () {
    mapCanvas = el('minimap');
    if (mapCanvas) mapCtx = mapCanvas.getContext('2d');
  };

  SOL.hudToast = function (text) {
    var t = el('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 4200);
  };

  SOL.hudObjective = function (text) {
    var o = el('objective');
    if (o) o.textContent = text;
  };

  SOL.showBanner = function (title, sub) {
    var b = el('banner');
    if (!b) return;
    el('banner-title').textContent = title;
    el('banner-sub').textContent = sub || '';
    b.classList.add('show');
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.classList.remove('show'); }, 3400);
  };

  SOL.hudFlashDamage = function () {
    var f = el('damage-flash');
    if (!f) return;
    f.classList.remove('flash');
    void f.offsetWidth;
    f.classList.add('flash');
  };

  function starString(n) {
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  SOL.updateHud = function () {
    var p = SOL.player;
    if (!p) return;
    var cash = el('cash');
    if (cash) cash.textContent = SOL.formatMoney(SOL.money);
    var stars = el('stars');
    if (stars) {
      stars.textContent = starString(SOL.wanted);
      stars.classList.toggle('hot', SOL.wanted > 0);
    }
    var hp = el('health-fill');
    if (hp) hp.style.width = Math.max(0, p.health) + '%';
    var speed = el('speed');
    if (speed) {
      var kmh = SOL.playerCar ? Math.abs(SOL.playerCar.speed) * 3.6 : 0;
      speed.textContent = SOL.playerCar ? Math.round(kmh) + ' km/h' : '';
    }
    var obj = el('objective-line');
    if (obj) obj.textContent = SOL.missions.objectiveText();
    var timer = el('mission-timer');
    if (timer) {
      timer.textContent = SOL.mission && SOL.mission.timer > 0 ? SOL.formatClock(SOL.mission.timer) : '';
    }
    var hint = el('context-hint');
    if (hint) {
      if (p.onFoot) {
        var car = SOL.nearestCar(4.5);
        hint.textContent = car ? 'Press E — get in the car' : 'WASD move · Shift run · Space jump · F punch';
      } else {
        hint.textContent = 'WASD drive · E get out · Space handbrake';
      }
    }
    var clock = el('clock');
    if (clock) {
      var h = Math.floor(SOL.timeOfDay) % 24;
      var m = Math.floor((SOL.timeOfDay % 1) * 60);
      clock.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
    SOL.drawMinimap();
  };

  // -------------------------------------------------------------- minimap ---
  SOL.drawMinimap = function () {
    if (!mapCtx || !SOL.player) return;
    var S = mapCanvas.width;
    var range = CITY.HALF + 60;
    function toMap(x, z) {
      return {
        x: ((x + range) / (range * 2)) * S,
        y: ((z + range) / (range * 2)) * S,
      };
    }
    mapCtx.clearRect(0, 0, S, S);
    // water + sand (south)
    mapCtx.fillStyle = '#0e5a80';
    mapCtx.fillRect(0, 0, S, S);
    mapCtx.fillStyle = '#3f6b4f';
    var tl = toMap(-range, -range);
    var br = toMap(range, CITY.BEACH_Z);
    mapCtx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    // blocks
    mapCtx.fillStyle = '#5a5f66';
    for (var bi = -CITY.GRID; bi < CITY.GRID; bi++) {
      for (var bj = -CITY.GRID; bj < CITY.GRID; bj++) {
        var a = toMap(bi * CITY.PITCH + 8, bj * CITY.PITCH + 8);
        var b = toMap((bi + 1) * CITY.PITCH - 8, (bj + 1) * CITY.PITCH - 8);
        mapCtx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
    }
    // roads
    mapCtx.strokeStyle = '#2c2f33';
    mapCtx.lineWidth = 2;
    for (var i = -CITY.GRID; i <= CITY.GRID; i++) {
      var p1 = toMap(-range, i * CITY.PITCH);
      var p2 = toMap(range, i * CITY.PITCH);
      mapCtx.beginPath(); mapCtx.moveTo(p1.x, p1.y); mapCtx.lineTo(p2.x, p2.y); mapCtx.stroke();
      var q1 = toMap(i * CITY.PITCH, -range);
      var q2 = toMap(i * CITY.PITCH, range);
      mapCtx.beginPath(); mapCtx.moveTo(q1.x, q1.y); mapCtx.lineTo(q2.x, q2.y); mapCtx.stroke();
    }
    // mission target blip (pulsing yellow diamond)
    if (SOL.missionTarget) {
      var mt = toMap(SOL.missionTarget.x, SOL.missionTarget.z);
      var pulse = 4 + Math.sin(SOL.elapsed * 5) * 2;
      mapCtx.fillStyle = '#f5d76e';
      mapCtx.beginPath();
      mapCtx.moveTo(mt.x, mt.y - pulse - 3);
      mapCtx.lineTo(mt.x + pulse + 3, mt.y);
      mapCtx.lineTo(mt.x, mt.y + pulse + 3);
      mapCtx.lineTo(mt.x - pulse - 3, mt.y);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // traffic (white dots) and police (red dots)
    mapCtx.fillStyle = '#e8e8e8';
    for (var t = 0; t < SOL.traffic.length; t++) {
      var tp = toMap(SOL.traffic[t].x, SOL.traffic[t].z);
      mapCtx.fillRect(tp.x - 1.5, tp.y - 1.5, 3, 3);
    }
    mapCtx.fillStyle = '#ff3344';
    for (var c = 0; c < SOL.police.length; c++) {
      var cp = toMap(SOL.police[c].x, SOL.police[c].z);
      mapCtx.beginPath(); mapCtx.arc(cp.x, cp.y, 3, 0, Math.PI * 2); mapCtx.fill();
    }
    // player arrow (rotates with heading / camera)
    var pp = toMap(SOL.player.pos.x, SOL.player.pos.z);
    var heading = SOL.playerCar ? SOL.playerCar.heading : SOL.player.yaw;
    mapCtx.save();
    mapCtx.translate(pp.x, pp.y);
    mapCtx.rotate(heading);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.strokeStyle = '#111111';
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7); mapCtx.lineTo(5, 6); mapCtx.lineTo(0, 3); mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill(); mapCtx.stroke();
    mapCtx.restore();
    // north tick
    mapCtx.fillStyle = '#ffffff';
    mapCtx.font = 'bold 11px sans-serif';
    mapCtx.fillText('N', S - 14, 14);
  };

  // --------------------------------------------------------------- menus ---
  SOL.showScreen = function (id) {
    ['start-screen', 'pause-screen', 'end-screen'].forEach(function (s) {
      var e = document.getElementById(s);
      if (e) e.classList.toggle('hidden', s !== id);
    });
    var hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('hidden', id === 'start-screen');
  };

  SOL.showEndScreen = function (title, sub) {
    var t = el('end-title');
    if (t) t.textContent = title;
    var s = el('end-sub');
    if (s) s.textContent = sub;
    SOL.showScreen('end-screen');
    if (document.exitPointerLock) document.exitPointerLock();
  };

  SOL.updateStartScreenStats = function () {
    var s = el('start-stats');
    if (!s) return;
    s.textContent = 'Cash ' + SOL.formatMoney(SOL.money) +
      ' · Jobs done ' + SOL.completedMissions.length + ' / ' + SOL.MISSIONS.length +
      ' · Best wanted ' + (SOL.bestWanted || 0) + '★';
  };
})();
