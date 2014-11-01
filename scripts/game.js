
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
  var exemplarCanvas = document.getElementById("exemplar");

  function resizeWindow()
  {
    canvas.width = window.innerWidth / 2;
    canvas.height = window.innerHeight;

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
  var exemplarCtx = exemplarCanvas.getContext("2d");
  var needsRedrawImage = true;

  exemplarImage.onload = function()
  {
    needsRedrawImage = true;
  };

  var players = [];
  var globals = {
    sensitivity: 50
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

    this.brushRadius = 15.0;

    this.lastDown = false;
    this.lastScreenX = 0;
    this.lastScreenY = 0;

    var player = this;

    netPlayer.addEventListener('disconnect', Player.prototype.disconnect.bind(this));
    netPlayer.addEventListener('move', Player.prototype.movePlayer.bind(this));
    netPlayer.addEventListener('color', Player.prototype.setColor.bind(this));
    netPlayer.addEventListener('setName', function (evt) {
      console.log("Name: " + evt.name);
    });
    netPlayer.addEventListener('accel', function (evt)
    {
      var screenX = evt.x / 100.0;
      if( screenX > 180.0 )
        screenX -= 360.0;
      screenX = ((-screenX / globals.sensitivity) + 0.5) * canvas.clientWidth;
      var screenY = canvas.clientHeight - (evt.y / 100.0 / globals.sensitivity) * canvas.clientHeight;

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
        player.lastScreenX = screenX;
        player.lastScreenY = screenY;
      }
      else
      {
        player.lastDown = false;
      }
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
  Player.prototype.disconnect = function() {
    for (var ii = 0; ii < players.length; ++ii) {
      var player = players[ii];
      if (player === this) {
        players.splice(ii, 1);
        return;
      }
    }
  };

  Player.prototype.movePlayer = function(cmd)
  {
    this.position.x = Math.floor(cmd.x * canvas.clientWidth);
    this.position.y = Math.floor(cmd.y * canvas.clientHeight);
    if (goal.hit(this.position))
    {
      // This will generate a 'scored' event on the client (player's smartphone)
      // that corresponds to this player.
      this.netPlayer.sendCmd('scored',
      {
        points: 5 + Misc.randInt(6), // 5 to 10 points
      });
      goal.pickGoal();
    }
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

  var render = function()
  {
    if ( needsRedrawImage )
    {
      exemplarCtx.drawImage(exemplarImage, 0,0, exemplarCanvas.width, exemplarCanvas.height);
      needsRedrawImage = false;
    }
  };
  GameSupport.run(globals, render);
});


