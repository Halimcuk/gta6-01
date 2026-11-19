// input.js — keyboard + mouse state, pointer lock, and the on-screen
// control hints. The game reads SOL.input.keys each frame; nothing here
// touches game logic.

(function () {
  'use strict';

  var keys = {};
  var mouseDX = 0;
  var mouseDY = 0;
  var locked = false;
  var anyKey = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    anyKey = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyF') SOL.punchQueued = true;
    if (e.code === 'KeyE') SOL.enterQueued = true;
    if (e.code === 'Escape' || e.code === 'KeyP') SOL.pauseQueued = true;
  }

  function onKeyUp(e) { keys[e.code] = false; }

  function onMouseMove(e) {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  }

  function onMouseDown() {
    if (SOL.phase === 'playing' && !locked) {
      SOL.requestLock();
    }
  }

  function onLockChange() {
    locked = document.pointerLockElement != null;
  }

  SOL.input = {
    keys: keys,
    get mouseDX() { return mouseDX; },
    get mouseDY() { return mouseDY; },
    get locked() { return locked; },
    get anyKey() { return anyKey; },
    consumeMouse: function () {
      var d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    clear: function () {
      for (var k in keys) keys[k] = false;
      mouseDX = 0; mouseDY = 0; anyKey = false;
    },
    down: function (code) { return !!keys[code]; },
    // WASD as a -1..1 pair, already camera-relative in player.js
    moveAxes: function () {
      var x = 0, y = 0;
      if (keys.KeyW || keys.ArrowUp) y += 1;
      if (keys.KeyS || keys.ArrowDown) y -= 1;
      if (keys.KeyA || keys.ArrowLeft) x -= 1;
      if (keys.KeyD || keys.ArrowRight) x += 1;
      return { x: x, y: y };
    },
  };

  SOL.bindInput = function () {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    document.addEventListener('pointerlockchange', onLockChange);
  };

  SOL.requestLock = function () {
    if (document.pointerLockElement) return;
    var el = SOL.renderer ? SOL.renderer.domElement : document.body;
    if (el.requestPointerLock) {
      try {
        var p = el.requestPointerLock();
        if (p && p.catch) p.catch(function () { /* headless / denied: ignore */ });
      } catch (e) { /* headless: ignore */ }
    }
  };
})();
