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
    colors: [
      "#1abc9c",
      "#2ecc71",
      "#3498db",
      "#9b59b6",
      "#063563",
      "#f4e749",
      "#e67e22",
      "#e74c3c",
      "#ecf0f1",
      "#95a5a6",
      "#fd9cfd",
      "#1d1d1d"
    ],
    randomNames: [
      "Doc",
      "Dopey",
      "Sneezy",
      "Bashful",
      "Grumpy",
      "Sneezy",
      "Sleepy",
      "Happy",
      "Sloth",
      "Greed",
      "Gluttony",
      "Lust",
      "Wrath",
      "Pride",
      "Envy",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Febtober",
      "Can anyone read thsi?!?!",
    ]
  };
  Misc.applyUrlSettings(globals);
  MobileHacks.fixHeightHack();

  var score = 0;
  var brushSizeIndex = 0;
  var brushSizes = [ 4, 21, 34, 72 ];
  var painting = false;
  var statusElem = document.getElementById("gamestatus");
  var colorElem = document.getElementById("display");

  var paintButtonElem = document.getElementById("paint-button");
  FastClick.attach(paintButtonElem);
  paintButtonElem.addEventListener('touchstart', function (evt) {
    sendPaintDownCmd();
  });
  paintButtonElem.addEventListener('touchend', function (evt) {
    sendPaintUpCmd();
  });

  var colorButtons = document.getElementById("paint-colors").childNodes
  for (var i = colorButtons.length - 1; i > 0; i--) {
    var buttonElem = colorButtons[i];
    if (buttonElem == undefined) continue;
    FastClick.attach(buttonElem);
    buttonElem.onclick = function () {
      setColor(this.style.backgroundColor);
    };
  };


  FastClick.attach(document.getElementById("increase-brush-size"));
  document.getElementById("increase-brush-size").onclick = function (evt) {
    brushSizeIndex += 1;
    if (brushSizeIndex >= brushSizes.length) brushSizeIndex = 0;

    client.sendCmd('brushSize', { brushSize: brushSizes[brushSizeIndex] });
  };

  FastClick.attach(document.getElementById("decrease-brush-size"));
  document.getElementById("decrease-brush-size").onclick = function (evt) {
    brushSizeIndex -= 1;
    if (brushSizeIndex < 0) brushSizeIndex = brushSizes.length - 1;

    client.sendCmd('brushSize', { brushSize: brushSizes[brushSizeIndex] });
  };
  var client = new GameClient();

  client.addEventListener('timeLeft', function (evt) {
    console.log("Time left: " + evt.timeLeft);
    var minutes = Math.floor(evt.timeLeft / 60);
    var seconds = evt.timeLeft - (minutes * 60);
    if (seconds < 10) {
      seconds = "0" + seconds.toString();
    }
    statusElem.innerHTML = minutes + ":" + seconds;
  });

  if (window.DeviceOrientationEvent) {
    // Listen for the event and handle DeviceOrientationEvent object
    var lastOrientationUpdate = Date.now();
    window.addEventListener('deviceorientation', function (e) {

      // Scale up and send ints
      sendAccelCmd({ x: parseInt(e.alpha * 100), y: parseInt(e.beta * 100) });
    });
  }

  // Note: CommonUI handles these events for almost all the samples.
  var onConnect = function() {
    statusElem.innerHTML = "EVERYBODY PAINT STUFF!";
  };

  var onDisconnect = function() {
    statusElem.innerHTML = "you left the game :(";
  };

  // Because I want the CommonUI to work
  globals.disconnectFn = onDisconnect;
  globals.connectFn = onConnect;

  CommonUI.setupStandardControllerUI(client, globals);

  var sendAccelCmd = function(acceleration) {
    client.sendCmd('accel', acceleration);
  };

  var sendPaintUpCmd = function() {
    paintButtonElem.innerHTML = 'Paint!';
    paintButtonElem.style.opacity = '1.0';
    client.sendCmd('paintup');
  };

  var sendPaintDownCmd = function() {
    paintButtonElem.innerHTML = 'Stop!';
    paintButtonElem.style.opacity = '0.33';
    client.sendCmd('paintdown');
  };

  var randInt = function(range) {
    return Math.floor(Math.random() * range);
  };

  var getRandomColor = function () {
    return globals.colors[randInt(globals.colors.length)];
  };

  // Send the color to the game.
  //
  // This will generate a 'color' event in the corresponding
  // NetPlayer object in the game.
  var setColor = function (color) {
    client.sendCmd('color', {
      // Pick a random color
      color: color,
    });
    paintButtonElem.style.backgroundColor = color;
  };

  setColor(getRandomColor());
  client.sendCmd('setName', { name: globals.randomNames[ randInt(globals.randomNames.length) ] } );
});

