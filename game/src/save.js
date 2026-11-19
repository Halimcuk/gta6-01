// save.js — localStorage persistence: cash, completed jobs, the current
// job, health, position and play time. The save is written on every job
// completion, on bust/waste, and from the pause menu.

(function () {
  'use strict';

  SOL.saveGame = function () {
    try {
      var p = SOL.player;
      var data = {
        version: 1,
        money: SOL.money,
        missionIndex: SOL.missionIndex,
        completedMissions: SOL.completedMissions.slice(),
        bestWanted: SOL.bestWanted || 0,
        playTime: SOL.playTime,
        health: p ? p.health : 100,
        pos: p ? { x: p.pos.x, z: p.pos.z } : { x: 0, z: 120 },
        savedAt: Date.now(),
      };
      localStorage.setItem(SOL.SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  };

  SOL.loadSave = function () {
    try {
      var raw = localStorage.getItem(SOL.SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== 1) return null;
      return data;
    } catch (e) {
      return null;
    }
  };

  SOL.applySave = function (data) {
    SOL.money = data.money || 0;
    SOL.missionIndex = data.missionIndex || 0;
    SOL.completedMissions = (data.completedMissions || []).slice();
    SOL.bestWanted = data.bestWanted || 0;
    SOL.playTime = data.playTime || 0;
    if (SOL.player && data.pos) {
      SOL.player.pos.set(data.pos.x, 0, data.pos.z);
      SOL.player.health = data.health || 100;
      SOL.player.mesh.position.copy(SOL.player.pos);
    }
  };

  SOL.hasSave = function () {
    return !!SOL.loadSave();
  };
})();
