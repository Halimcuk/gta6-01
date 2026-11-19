// missions.js — the story jobs. Each mission is a small state machine with
// an objective marker, a HUD line and a payout. Completing one unlocks the
// next; the save records which are done.

(function () {
  'use strict';

  var CITY = SOL.CITY;

  function currentDef() {
    return SOL.MISSIONS[SOL.missionIndex] || null;
  }

  SOL.missions = {
    // Start (or resume) the current mission.
    startCurrent: function () {
      var def = currentDef();
      if (!def) {
        SOL.mission = null;
        SOL.missionTarget = null;
        SOL.clearBeacon();
        return;
      }
      var m = { def: def, step: 0, timer: def.timeLimit || 0, state: 'active' };
      SOL.mission = m;
      if (def.id === 'wheels-up') {
        // any car, then the garage
        m.step = 0;
        SOL.missionTarget = null;
        SOL.clearBeacon();
      } else if (def.id === 'sunset-courier') {
        // 0 = get in a car, 1 = drive to the pier; already driving? skip ahead
        if (SOL.playerCar) {
          m.step = 1;
          SOL.missionTarget = SOL.pierEnd;
          SOL.setBeacon(SOL.pierEnd.x, SOL.pierEnd.z, 0xf5d76e);
        } else {
          m.step = 0;
          SOL.missionTarget = null;
          SOL.clearBeacon();
        }
      } else if (def.id === 'heat-wave') {
        // force the heat on: the job starts hot
        SOL.wanted = 3;
        SOL.heatTimer = 0;
        m.step = 0;
        SOL.missionTarget = SOL.hideoutPos;
        SOL.setBeacon(SOL.hideoutPos.x, SOL.hideoutPos.z, 0x7ec8f2);
        SOL.hudToast('The heat is on! Lose the cops — or reach the hideout.');
      } else if (def.id === 'the-big-score') {
        m.step = 0; // 0 = reach the bank, 1 = grab cash (hold still), 2 = escape
        SOL.missionTarget = SOL.bankPos;
        SOL.setBeacon(SOL.bankPos.x, SOL.bankPos.z, 0xf5d76e);
      }
      SOL.hudObjective(def.title + ' — ' + def.briefing);
      SOL.hudToast(def.startText);
      SOL.audio.missionStart();
    },

    objectiveText: function () {
      var m = SOL.mission;
      if (!m) return 'All jobs done — Solmar Bay is yours, Rex.';
      var d = m.def;
      if (d.id === 'wheels-up') {
        return m.step === 0 ? 'Jack any car (walk up and press E)' : 'Drive to Mara\'s garage';
      }
      if (d.id === 'sunset-courier') {
        if (m.step === 0) return 'Get in a car — the package is waiting';
        return 'Deliver the package to the pier';
      }
      if (d.id === 'heat-wave') {
        return 'Lose the heat: reach 0 stars, or hide at the garage';
      }
      if (d.id === 'the-big-score') {
        if (m.step === 0) return 'Drive to the Meridian Bank';
        if (m.step === 1) return 'Grabbing the cash… stay put!';
        return 'Escape to the hideout — do not get busted';
      }
      return d.briefing;
    },

    // Called when the player gets into any car.
    onEnterCar: function () {
      var m = SOL.mission;
      if (!m) return;
      if (m.def.id === 'wheels-up' && m.step === 0) {
        m.step = 1;
        SOL.missionTarget = SOL.garagePos;
        SOL.setBeacon(SOL.garagePos.x, SOL.garagePos.z, 0xf5d76e);
        SOL.hudToast('Nice wheels. Now bring it to Mara\'s garage.');
      } else if (m.def.id === 'sunset-courier' && m.step === 0) {
        m.step = 1;
        SOL.missionTarget = SOL.pierEnd;
        SOL.setBeacon(SOL.pierEnd.x, SOL.pierEnd.z, 0xf5d76e);
        SOL.hudToast('Package in the trunk. Floor it to the pier!');
      }
    },

    // Called when the wanted level reaches zero during heat-wave.
    onHeatCleared: function () {
      var m = SOL.mission;
      if (m && m.def.id === 'heat-wave' && m.state === 'active') {
        SOL.missions.complete(m, 'Clean. The PD lost your trail.');
      }
    },

    complete: function (m, note) {
      m.state = 'done';
      var reward = m.def.reward;
      SOL.money += reward;
      SOL.completedMissions.push(m.def.id);
      SOL.missionIndex += 1;
      SOL.clearBeacon();
      SOL.missionTarget = null;
      SOL.audio.missionDone();
      SOL.floatCash('+' + SOL.formatMoney(reward));
      SOL.showBanner('JOB DONE — ' + m.def.title, note + '  +' + SOL.formatMoney(reward));
      SOL.saveGame();
      // brief breather, then the next job starts
      setTimeout(function () {
        if (SOL.phase === 'playing') SOL.missions.startCurrent();
      }, 3500);
      SOL.mission = null;
    },

    fail: function (m, reason) {
      m.state = 'failed';
      SOL.clearBeacon();
      SOL.missionTarget = null;
      SOL.audio.denied();
      SOL.showBanner('JOB FAILED', reason + ' Talk to Mara to try again.');
      SOL.mission = null;
      setTimeout(function () {
        if (SOL.phase === 'playing') SOL.missions.startCurrent();
      }, 3500);
    },

    update: function (dt) {
      var m = SOL.mission;
      if (!m || m.state !== 'active' || SOL.phase !== 'playing') return;
      var p = SOL.player;
      if (!p) return;
      // countdown missions
      if (m.timer > 0) {
        m.timer -= dt;
        if (m.timer <= 0) {
          SOL.missions.fail(m, 'Out of time.');
          return;
        }
      }
      var d = m.def;
      if (d.id === 'wheels-up' && m.step === 1) {
        if (SOL.playerCar && SOL.dist2d(p.pos.x, p.pos.z, SOL.garagePos.x, SOL.garagePos.z) < 10) {
          SOL.missions.complete(m, 'Mara likes the wheels. You\'re in the crew now.');
        }
      } else if (d.id === 'sunset-courier' && m.step === 1) {
        if (SOL.dist2d(p.pos.x, p.pos.z, SOL.pierEnd.x, SOL.pierEnd.z) < 9) {
          SOL.missions.complete(m, 'Delivered with seconds to spare. The pier crew tips well.');
        }
      } else if (d.id === 'heat-wave') {
        if (SOL.dist2d(p.pos.x, p.pos.z, SOL.hideoutPos.x, SOL.hideoutPos.z) < 10 && SOL.wanted > 0) {
          SOL.wanted = 0;
          SOL.clearPolice(SOL.scene);
          SOL.missions.complete(m, 'You vanished into the garage. The PD never saw you.');
        }
      } else if (d.id === 'the-big-score') {
        if (m.step === 0) {
          // the bank tower is 30 m wide: trigger outside its walls
          if (SOL.dist2d(p.pos.x, p.pos.z, SOL.bankPos.x, SOL.bankPos.z) < 22) {
            m.step = 1;
            m.grabTimer = 3;
            SOL.setBeacon(SOL.bankPos.x, SOL.bankPos.z, 0xff6b35);
            SOL.hudToast('Cracking the vault… hold still, 3 seconds.');
          }
        } else if (m.step === 1) {
          m.grabTimer -= dt;
          var still = SOL.playerCar ? Math.abs(SOL.playerCar.speed) < 1 : true;
          if (!still) m.grabTimer = 3; // moving resets the grab
          if (m.grabTimer <= 0) {
            m.step = 2;
            SOL.wanted = 4;
            SOL.heatTimer = 0;
            SOL.missionTarget = SOL.hideoutPos;
            SOL.setBeacon(SOL.hideoutPos.x, SOL.hideoutPos.z, 0xff6b35);
            SOL.hudToast('Cash grabbed! 4 stars — run for the hideout!');
            SOL.audio.sirenBlip();
          }
        } else if (m.step === 2) {
          if (SOL.dist2d(p.pos.x, p.pos.z, SOL.hideoutPos.x, SOL.hideoutPos.z) < 10) {
            if (SOL.wanted > 0) {
              SOL.wanted = 0;
              SOL.clearPolice(SOL.scene);
            }
            SOL.missions.complete(m, 'The big score is in the bag. Solmar Bay is yours.');
          }
        }
      }
    },
  };
})();
