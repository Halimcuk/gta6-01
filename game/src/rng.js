// rng.js — a tiny seeded random generator so the city, traffic and
// pedestrians are identical on every load with the same seed. The game
// never calls Math.random for world layout, only this module.

(function () {
  'use strict';

  var state = 1337;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var next = mulberry32(state);

  SOL.seedRandom = function (seed) {
    state = seed >>> 0;
    next = mulberry32(state);
    SOL.seed = state;
  };

  SOL.rand = function () { return next(); };

  SOL.randRange = function (a, b) { return a + next() * (b - a); };

  SOL.randInt = function (a, b) { return Math.floor(a + next() * (b - a + 1)); };

  SOL.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };

  SOL.chance = function (p) { return next() < p; };
})();
