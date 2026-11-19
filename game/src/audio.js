// audio.js — all sound is synthesised with WebAudio. No audio files.
// Engine hum, sirens, punches, crashes, pickups and mission jingles are
// built from oscillators and filtered noise, so the game stays fully offline.

(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var engineOsc = null;
  var engineOsc2 = null;
  var engineGain = null;
  var engineFilter = null;
  var sirenOsc = null;
  var sirenGain = null;
  var sirenLfo = null;
  var started = false;

  function ensureContext() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t);
  }

  SOL.audio = {
    init: function () {
      if (started) return;
      if (!ensureContext()) return;
      started = true;
      if (ctx.state === 'suspended') ctx.resume();
      // engine: two detuned saws through a lowpass, pitch follows speed
      engineOsc = ctx.createOscillator();
      engineOsc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc2.type = 'square';
      engineOsc.frequency.value = 50;
      engineOsc2.frequency.value = 25;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 400;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // siren: triangle wave wobbling between two tones
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 1.4;
      var lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    },

    setEngine: function (speed01, on) {
      if (!ctx || !engineGain) return;
      var t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 130, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(22 + speed01 * 65, t, 0.08);
      engineFilter.frequency.setTargetAtTime(300 + speed01 * 900, t, 0.1);
    },

    setSiren: function (on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.3);
    },

    punch: function () { noiseBurst(0.12, 0.35, 500); tone(90, 0.1, 'sine', 0.3, 50); },
    crash: function (hard) { noiseBurst(hard ? 0.4 : 0.18, hard ? 0.5 : 0.25, 600); tone(70, 0.25, 'sine', 0.3, 40); },
    pickup: function () { tone(660, 0.12, 'sine', 0.25); setTimeout(function () { tone(880, 0.16, 'sine', 0.25); }, 90); },
    denied: function () { tone(160, 0.2, 'square', 0.15, 110); },
    missionStart: function () { tone(523, 0.14, 'triangle', 0.25); setTimeout(function () { tone(659, 0.14, 'triangle', 0.25); }, 130); setTimeout(function () { tone(784, 0.22, 'triangle', 0.25); }, 260); },
    missionDone: function () {
      var notes = [523, 659, 784, 1047];
      notes.forEach(function (f, i) {
        setTimeout(function () { tone(f, 0.25, 'triangle', 0.28); }, i * 120);
      });
    },
    busted: function () { tone(392, 0.3, 'sawtooth', 0.2, 196); setTimeout(function () { tone(311, 0.5, 'sawtooth', 0.2, 155); }, 280); },
    sirenBlip: function () { tone(900, 0.12, 'triangle', 0.2, 1400); },
    click: function () { tone(1200, 0.05, 'square', 0.12); },
  };

  // First user gesture unlocks audio on every browser.
  SOL.bindAudioGesture = function () {
    var unlock = function () {
      SOL.audio.init();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  };
})();
