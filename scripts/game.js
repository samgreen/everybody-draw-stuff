
"use strict";

// Require will call this with GameServer, GameSupport, and Misc once
// gameserver.js, gamesupport.js, and misc.js have loaded.

// Start the main app logic.
requirejs([
    'hft/gameserver',
    'hft/gamesupport',
    'hft/misc/misc',
  ], function(GameServer, GameSupport, Misc) {

  var statusElem = document.getElementById("status");
  var canvas = document.getElementById("painting");
  var overlayCanvas = document.getElementById("painting-overlay");
  var exemplarCanvas = document.getElementById("exemplar");

  function resizeWindow()
  {
    canvas.width = window.innerWidth / 2;
    canvas.height = window.innerHeight;

    overlayCanvas.width = window.innerWidth / 2;
    overlayCanvas.height = window.innerHeight;

    exemplarCanvas.width = window.innerWidth / 2;
    exemplarCanvas.height = window.innerHeight;

    needsRedrawImage = true;
  }

  window.addEventListener("resize", function()
  {
    resizeWindow();
  });

  window.addEventListener("onload", function()
  {
    resizeWindow();
  });

  resizeWindow();

  var exemplarImage = document.getElementById("exemplar-image");

  var ctx = canvas.getContext("2d");
  var overlayCtx = overlayCanvas.getContext("2d");
  var exemplarCtx = exemplarCanvas.getContext("2d");
  var needsRedrawImage = true;

  exemplarImage.onload = function()
  {
    needsRedrawImage = true;
  };

  var players = [];
  var globals = {
    sensitivity: 40
  };
  Misc.applyUrlSettings(globals);

  var pickRandomPosition = function() {
    return {
      x: 30 + Misc.randInt(canvas.width  - 60),
      y: 30 + Misc.randInt(canvas.height - 60),
    };
  };

  var Goal = function() {
      this.pickGoal();
      this.radiusesSquared = globals.itemSize * 2 * globals.itemSize;
  };

  Goal.prototype.pickGoal = function() {
    this.position = pickRandomPosition();
  };

  Goal.prototype.hit = function(otherPosition) {
    var dx = otherPosition.x - this.position.x;
    var dy = otherPosition.y - this.position.y;
    return dx * dx + dy * dy < this.radiusesSquared;
  };

  var Player = function(netPlayer, name) {
    this.netPlayer = netPlayer;
    this.name = name;
    this.position = pickRandomPosition();
    this.color = "green";

    this.painting = false;

    this.brushRadius = 10.0;

    this.lastDown = false;
    this.lastScreenX = 0;
    this.lastScreenY = 0;

    this.lastEvtX = 0;
    this.centerX = 0;

    var player = this;

    netPlayer.addEventListener('disconnect', Player.prototype.disconnect.bind(this));
    netPlayer.addEventListener('color', Player.prototype.setColor.bind(this));

    netPlayer.addEventListener('busy', function (evt) {
      player.busy = evt.busy;
    });

    netPlayer.addEventListener('setName', function (evt) {
      player.name = evt.name;
    });
    netPlayer.addEventListener('accel', function (evt)
    {
      if( player.busy )
        return;

      var screenX = evt.x / 100.0 - player.centerX;
      if( screenX > 180.0 )
        screenX -= 360.0;
      var xCoef = ((-screenX / globals.sensitivity) + 0.5);
      screenX = xCoef * canvas.clientWidth;
      var screenY = canvas.clientHeight - (evt.y / 100.0 / globals.sensitivity) * canvas.clientHeight;

      if( xCoef < -0.1 )
        player.centerX += 10.0;

      if( xCoef > 1.1 )
        player.centerX -= 10.0;

      player.lastEvtX = evt.x;

      if (player.painting)
      {
        var mx = screenX;
        var my = screenY;

        if( player.lastDown )
        {
          mx = player.lastScreenX;
          my = player.lastScreenY;
        }

        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = player.color;
        ctx.lineWidth = 2.0 * player.brushRadius;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(screenX, screenY);
        ctx.closePath();
        ctx.stroke();

        player.lastDown = true;
      }
      else
      {
        player.lastDown = false;
      }

      player.lastScreenX = screenX;
      player.lastScreenY = screenY;
    });

    netPlayer.addEventListener('paintdown', function (evt)
    {
      player.painting = !player.painting;
    });

    netPlayer.addEventListener('paintup', function (evt)
    {
      player.painting = false;
    });
  };

  // The player disconnected.
  Player.prototype.disconnect = function()
  {
    for (var ii = 0; ii < players.length; ++ii)
    {
      var player = players[ii];
      if (player === this)
      {
        players.splice(ii, 1);
        return;
      }
    }
  };

  Player.prototype.handleBusyMsg = function()
  {
    console.log("handling busy msge");
    this.painting = false;
  };

  Player.prototype.setColor = function(cmd) {
    this.color = cmd.color;
  };

  var server = new GameServer();
  GameSupport.init(server, globals);

  var goal = new Goal();

  // A new player has arrived.
  server.addEventListener('playerconnect', function(netPlayer, name)
  {
    players.push(new Player(netPlayer, name));
  });


  function drawClock(clockCanvasCtx, portion)
  {
    clockCanvasCtx.fillStyle = "#0ff";

    clockCanvasCtx.beginPath();
    clockCanvasCtx.moveTo(100,0);
    clockCanvasCtx.arc(
        100, 100, 100, -Math.PI / 2, -Math.PI / 2 + 2.0 * Math.PI);
    clockCanvasCtx.fill();

    clockCanvasCtx.fillStyle = "#00f";

    clockCanvasCtx.beginPath();
    clockCanvasCtx.moveTo(100,100);
    clockCanvasCtx.lineTo(100,0);
    clockCanvasCtx.arc(
        100, 100, 100, -Math.PI / 2, -Math.PI / 2 + portion * 2.0 * Math.PI);
    clockCanvasCtx.fill();

    clockCanvasCtx.fillStyle = "#00f";

    clockCanvasCtx.strokeStyle = "#000";
    clockCanvasCtx.beginPath();
    clockCanvasCtx.moveTo(100,0);
    clockCanvasCtx.arc(
        100, 100, 100, -Math.PI / 2, -Math.PI / 2 + 2.0 * Math.PI);
    clockCanvasCtx.stroke();
  }

  function drawCountdown(count, portion)
  {
    overlayCtx.fillStyle = "#05f";
    overlayCtx.textAlign = "center";
    overlayCtx.font = "800 " + parseInt((1.0 - portion) * 1000) + "px 'Dosis'";
    overlayCtx.textAlign = "center";
    overlayCtx.fillText("" + count, overlayCanvas.width/2, (1.0 - 0.5 *portion) * overlayCanvas.height);
  }

  function drawBrush(player)
  {
      var n = 8;
      for( var i = 0; i < n; i++ )
      {
        overlayCtx.strokeStyle = ["#000", "#fff"][i % 2];

        overlayCtx.lineWidth = 1;
        overlayCtx.beginPath();

        overlayCtx.arc(
          player.lastScreenX, player.lastScreenY,
          player.brushRadius, 2 * Math.PI * (i-0.5) / n, 2 * Math.PI * (i+0.5) / n);
        overlayCtx.stroke();
      }
  }

  var lastTime = 0;
  var timeLeft = 10;

  var render = function()
  {
    var now = Date.now();
    var secondPortion = now - lastTime;

    if( secondPortion > 1000 )
    {
        timeLeft--;
        if( timeLeft < 0 )
        {
          timeLeft = 0;
        }
        lastTime = now;
    }

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    var n = players.length;
    for( var i = 0; i < n; i++ )
    {
      var player = players[i];

      drawBrush(player);

      overlayCtx.fillStyle = "#000";
      overlayCtx.lineWidth = 1;
      overlayCtx.textAlign = "center";
      overlayCtx.font = "800 20px 'Dosis'";
      overlayCtx.fillText(player.name, player.lastScreenX, player.lastScreenY - 1.4*player.brushRadius);
    }

    if( needsRedrawImage )
    {
      exemplarCtx.drawImage(exemplarImage, 0,0, exemplarCanvas.width, exemplarCanvas.height);
      exemplarCtx.lineWidth = 20.0;
      exemplarCtx.strokeStyle = "#111";
      exemplarCtx.strokeRect(0, 0, exemplarCanvas.width, exemplarCanvas.height);
      needsRedrawImage = false;
    }

    drawClock(exemplarCtx, 1.0 - timeLeft / 60.0);
    if( timeLeft <= 5 && timeLeft > 0 )
    {
      drawCountdown(timeLeft, secondPortion / 1000.0);
    }
  };
  GameSupport.run(globals, render);
});


