// textures.js — every texture in the game is painted on a canvas at load
// time. No image files, no network: the city facades, road markings and
// the minimap tiles all come from here.

(function () {
  'use strict';

  var cache = {};

  function canvasTexture(w, h, painter) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    painter(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  // A building facade: tinted concrete with a grid of lit and dark windows,
  // a darker ground floor with a shopfront band, and a roofline cap.
  SOL.buildingTexture = function (baseColor, floors, cols) {
    var key = baseColor + '|' + floors + '|' + cols;
    if (cache[key]) return cache[key];
    var tex = canvasTexture(128, 256, function (ctx, w, h) {
      var base = '#' + baseColor.toString(16).padStart(6, '0');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      // subtle vertical shading
      var grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.25)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      grad.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // windows
      var ww = w / cols, wh = h / (floors + 1);
      for (var f = 0; f < floors; f++) {
        for (var col = 0; col < cols; col++) {
          var lit = SOL.rand() < 0.28;
          ctx.fillStyle = lit ? '#ffe9a8' : '#1d2733';
          ctx.fillRect(col * ww + ww * 0.22, 10 + f * wh + wh * 0.25, ww * 0.56, wh * 0.5);
        }
      }
      // ground floor shopfront
      ctx.fillStyle = '#20242a';
      ctx.fillRect(0, h - wh * 0.9, w, wh * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(0, h - wh * 0.9, w, 3);
      // roof cap
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, w, 6);
    });
    cache[key] = tex;
    return tex;
  };

  // Asphalt with a dashed centre line, tiled along the road.
  SOL.roadTexture = function () {
    if (cache.road) return cache.road;
    var tex = canvasTexture(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#3a3d42';
      ctx.fillRect(0, 0, w, h);
      // speckle
      for (var i = 0; i < 500; i++) {
        ctx.fillStyle = 'rgba(255,255,255,' + (SOL.rand() * 0.05) + ')';
        ctx.fillRect(SOL.rand() * w, SOL.rand() * h, 2, 2);
      }
      // centre dashes (vertical, so the texture repeats along the road)
      ctx.fillStyle = '#f5d76e';
      ctx.fillRect(w / 2 - 2, 8, 4, 44);
      ctx.fillRect(w / 2 - 2, 72, 4, 44);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cache.road = tex;
    return tex;
  };

  // Pale concrete sidewalk slab with expansion joints.
  SOL.sidewalkTexture = function () {
    if (cache.walk) return cache.walk;
    var tex = canvasTexture(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#b9b3a4';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cache.walk = tex;
    return tex;
  };

  // Sand with a soft noise grain.
  SOL.sandTexture = function () {
    if (cache.sand) return cache.sand;
    var tex = canvasTexture(128, 128, function (ctx, w, h) {
      ctx.fillStyle = '#e8d29a';
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 900; i++) {
        ctx.fillStyle = 'rgba(120,90,40,' + (SOL.rand() * 0.12) + ')';
        ctx.fillRect(SOL.rand() * w, SOL.rand() * h, 2, 2);
      }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    cache.sand = tex;
    return tex;
  };
})();
