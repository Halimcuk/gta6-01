// wanted.js — the Bay PD heat system. Crimes raise stars, quiet time
// cools them, and at zero stars the chase is over. Getting caught on
// foot or flattened ends the run with a busted / wasted screen.

(function () {
  'use strict';

  SOL.addHeat = function (stars) {
    if (SOL.phase !== 'playing') return;
    if (stars > 0) {
      var before = SOL.wanted;
      SOL.wanted = SOL.clamp(SOL.wanted + stars, 0, 5);
      if (SOL.wanted > before) {
        SOL.heatTimer = 0;
        SOL.crimeFlash = 1;
        if (SOL.wanted >= 3) SOL.audio.sirenBlip();
        SOL.hudToast('Wanted level ' + SOL.wanted + ' — Bay PD is on you!');
      }
    } else {
      // noise keeps the current heat alive without raising it
      SOL.heatTimer = 0;
    }
  };

  SOL.updateWanted = function (dt) {
    if (SOL.phase !== 'playing') return;
    SOL.heatTimer += dt;
    SOL.crimeFlash = Math.max(0, SOL.crimeFlash - dt * 2);
    // after 18 quiet seconds the heat starts to cool, one star at a time
    if (SOL.wanted > 0 && SOL.heatTimer > 18) {
      SOL.heatTimer = 12; // then one star per 6 quiet seconds
      SOL.wanted -= 1;
      SOL.hudToast('Heat cooling down… wanted level ' + SOL.wanted + '.');
      if (SOL.wanted === 0) {
        SOL.hudToast('You lost them. Clean — for now.');
        SOL.missions.onHeatCleared();
      }
    }
    // busted timer only counts while a cop car is on top of the player
    if (!SOL.playerCar) {
      var near = false;
      for (var i = 0; i < SOL.police.length; i++) {
        if (SOL.dist2d(SOL.player.pos.x, SOL.player.pos.z, SOL.police[i].x, SOL.police[i].z) < 5) near = true;
      }
      if (!near) SOL.bustedTimer = Math.max(0, SOL.bustedTimer - dt * 2);
    } else {
      SOL.bustedTimer = 0;
    }
  };

  SOL.bustPlayer = function (reason) {
    if (SOL.phase !== 'playing') return;
    SOL.phase = 'busted';
    SOL.audio.busted();
    SOL.audio.setEngine(0, false);
    SOL.audio.setSiren(false);
    // the cops take a cut of your cash
    var fine = Math.min(SOL.money, 200);
    SOL.money -= fine;
    SOL.wanted = 0;
    SOL.clearPolice(SOL.scene);
    SOL.showEndScreen('BUSTED', reason + ' The Bay PD took ' + SOL.formatMoney(fine) + ' in fines.');
    SOL.saveGame();
  };

  SOL.wastePlayer = function (reason) {
    if (SOL.phase !== 'playing') return;
    SOL.phase = 'wasted';
    SOL.audio.busted();
    SOL.audio.setEngine(0, false);
    SOL.audio.setSiren(false);
    SOL.wanted = 0;
    SOL.clearPolice(SOL.scene);
    SOL.showEndScreen('WASTED', reason + ' Mara\'s crew dragged you out of it — minus your ride.');
    if (SOL.playerCar) {
      SOL.scene.remove(SOL.playerCar.mesh);
      SOL.playerCar = null;
    }
    SOL.player.health = 100;
    SOL.player.onFoot = true;
    SOL.player.mesh.visible = true;
    SOL.saveGame();
  };
})();
