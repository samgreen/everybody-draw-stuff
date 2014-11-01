/*
 * Copyright 2014, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
"use strict";

// Start the main app logic.
requirejs([
    'hft/commonui',
    'hft/gameclient',
    'hft/misc/input',
    'hft/misc/misc',
    'hft/misc/mobilehacks',
    'hft/misc/touch',
  ], function(
    CommonUI,
    GameClient,
    Input,
    Misc,
    MobileHacks,
    Touch) {

  var globals = {
    debug: false,
  };
  Misc.applyUrlSettings(globals);
  MobileHacks.fixHeightHack();

  var score = 0;
  var statusElem = document.getElementById("gamestatus");
  var colorElem = document.getElementById("display");

  var paintButtonElem = document.getElementById("paint-button");
  paintButtonElem.addEventListener('touchstart', sendStartDrawCmd);
  paintButtonElem.addEventListener('touchend', sendStopDrawCmd);
  paintButtonElem.onpointerdown = function (evt) {
    sendPaintDownCmd();
  };

  paintButtonElem.onpointerup = function (evt) {
    sendPaintUpCmd();
  };

  paintButtonElem.onclick = function (evt) {
    sendPaintDownCmd();
  };

  var calibrateButtonElem = document.getElementById("calibrate-button");
  calibrateButtonElem.onclick = function (evt) {
    console.log('Clicked calibrate!');
  };
>>>>>>> 2efce076551d3462ec3995e74c1f5b4ee65aaa7f

  var client = new GameClient();

  if (window.DeviceOrientationEvent) {
    // Listen for the event and handle DeviceOrientationEvent object
    var lastOrientationUpdate = Date.now();
    window.addEventListener('deviceorientation', function (e) {
      var now = Date.now();
      var diff = now - lastOrientationUpdate;
      if (diff < 75) return; // 200ms throttling

      // Scale up and send ints
      sendAccelCmd({ x: parseInt(e.alpha * 100), y: parseInt(e.beta * 100) });
      lastOrientationUpdate = now;
    });
  }

  // Note: CommonUI handles these events for almost all the samples.
  var onConnect = function() {
    statusElem.innerHTML = "welcome to everybody draw stuff!";
  };

  var onDisconnect = function() {
    statusElem.innerHTML = "you left the game :(";
  };

  // Because I want the CommonUI to work
  globals.disconnectFn = onDisconnect;
  globals.connectFn = onConnect;

  CommonUI.setupStandardControllerUI(client, globals);

  var sendStartDrawCmd = function(target) {
    console.log('startPaint');
    client.sendCmd('startPaint', {});
  };

  var sendStopDrawCmd = function(target) {
    console.log('stopPaint');
    client.sendCmd('stopPaint', {});
  var randInt = function(range) {
    return Math.floor(Math.random() * range);
  };

  var sendAccelCmd = function(acceleration) {
    client.sendCmd('accel', acceleration);
  };

  var randInt = function(range) {
    return Math.floor(Math.random() * range);
  };
  
  var getRandomColor = function () {
    return 'rgb(' + randInt(256) + "," + randInt(256) + "," + randInt(256) + ")";
  };

  var sendPaintUpCmd = function() {
    client.sendCmd('paintup');
  };

  var sendPaintDownCmd = function() {
    client.sendCmd('paintdown');
  };

  // Send the color to the game.
  //
  // This will generate a 'color' event in the corresponding
  // NetPlayer object in the game.
  client.sendCmd('color', {
    // Pick a random color
    color: getRandomColor(),
  });
  colorElem.style.backgroundColor = color;

  // Update our score when the game tells us.
  client.addEventListener('scored', function(cmd) {
    score += cmd.points;
    statusElem.innerHTML = "You scored: " + cmd.points + " total: " + score;
  });
});

