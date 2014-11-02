
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
  var statsCanvas = document.getElementById("stats");
  var splashCanvas = document.getElementById("splash");

  var currentLevel = 0;

  var players = [];
  var globals = {
    sensitivity: 40,
    timeLimit: 120,
    levels: [
      "images/clean.png",
      "images/nyan.png",
      "images/smiley.png",
      "images/cardinalgamejam.jpg",
      "images/apple.jpg"
    ]
  };

  var getNextLevelImage = function()
  {
    currentLevel = currentLevel % globals.levels.length;
    exemplarImage.src = globals.levels[currentLevel]
    currentLevel++;
  };

  function resizeWindow()
  {
    canvas.width = window.innerWidth / 2;
    canvas.height = window.innerHeight * 0.8;

    statsCanvas.width = window.innerWidth;
    statsCanvas.height = window.innerHeight * 0.2;

    overlayCanvas.width = window.innerWidth / 2;
    overlayCanvas.height = window.innerHeight * 0.8;

    exemplarCanvas.width = window.innerWidth / 2;
    exemplarCanvas.height = window.innerHeight * 0.8;

    splashCanvas.width = window.innerWidth;
    splashCanvas.height = window.innerHeight;

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

  getNextLevelImage();

  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  var overlayCtx = overlayCanvas.getContext("2d");
  var exemplarCtx = exemplarCanvas.getContext("2d");
  var statsCtx = statsCanvas.getContext("2d");
  var splashCtx = splashCanvas.getContext("2d");

  var statsCanvas;

  var needsRedrawImage = true;

  exemplarImage.onload = function()
  {
    needsRedrawImage = true;
  };

  Misc.applyUrlSettings(globals);

  var pickRandomPosition = function() {
    return {
      x: 30 + Misc.randInt(canvas.width  - 60),
      y: 30 + Misc.randInt(canvas.height - 60),
    };
  };


  var accuracy = 0;

  var compareImages = function (callback) {
    var diff = resemble(canvas.toDataURL()).compareTo(exemplarCanvas.toDataURL()).onComplete(function(d){
      //console.log("Mismatch: " + d["misMatchPercentage"]);

      accuracy  = 100 - d["misMatchPercentage"];

      var diffImg = new Image();
      //diffImg.src = d.getImageDataUrl();
      //document.body.appendChild(diffImg);

      callback(d);
    });
    diff.ignoreAntialiasing();
    //diff.ignoreColors();
  };
  // setInterval(compareImages, 30000);

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
    netPlayer.addEventListener('brushSize', function (evt) {
      player.brushRadius = evt.brushSize;
    });
    netPlayer.addEventListener('busy', function (evt) {
      player.busy = evt.busy;
    });

    netPlayer.addEventListener('setName', function (evt) {
      player.name = evt.name;
    });
    netPlayer.addEventListener('accel', function (evt)
    {
      if( player.busy || rewardScreen )
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


  function drawClock(portion)
  {
    var clockRadius = statsCanvas.height * 0.35;

    statsCtx.save();
    statsCtx.translate(statsCanvas.width / 2, statsCanvas.height / 2);

    statsCtx.fillStyle = "#a11";
    statsCtx.beginPath();
    statsCtx.moveTo(clockRadius,0);
    statsCtx.arc(
        0, 0, clockRadius, -Math.PI / 2, -Math.PI / 2 + 2.0 * Math.PI);
    statsCtx.fill();

    statsCtx.fillStyle = "#eee";
    statsCtx.beginPath();
    statsCtx.moveTo(0,0);
    statsCtx.lineTo(0,clockRadius);
    statsCtx.arc(
        0, 0, clockRadius, -Math.PI / 2, -Math.PI / 2 + portion * 2.0 * Math.PI);
    statsCtx.fill();

    statsCtx.restore();
  }

  function drawCountdown(count, portion)
  {
    splashCtx.clearRect(0,0,splashCanvas.width, splashCanvas.height);
    splashCtx.fillStyle = "#05f";
    splashCtx.textAlign = "center";
    splashCtx.font = "800 " + parseInt((1.0 - portion) * 1000) + "px 'Dosis'";
    splashCtx.textAlign = "center";
    splashCtx.fillText("" + count, overlayCanvas.width/2, (1.0 - 0.5 *portion) * overlayCanvas.height);
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
  var timeLeft = globals.timeLimit;

  var rewardScreen = false;
  var rewardScreenTime0 = 0;

  var startRewardScreen = function()
  {
    compareImages(function() {
      rewardScreen = true;
      rewardScreenTime0 = Date.now();
    });
  }

  var render = function()
  {
    if( rewardScreen )
    {
      renderRewardScreen();
      return;
    }

    var now = Date.now();
    var secondPortion = now - lastTime;

    if( secondPortion > 1000 )
    {
        timeLeft--;
        if( timeLeft < 0 )
        {
          splashCtx.clearRect(0,0,splashCanvas.width, splashCanvas.height);
          startRewardScreen();
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
      overlayCtx.font = "800 25px 'Dosis'";
      overlayCtx.fillText(player.name, player.lastScreenX, player.lastScreenY - 1.4*player.brushRadius);
    }

    if( needsRedrawImage )
    {
      exemplarCtx.drawImage(exemplarImage, 0,0, exemplarCanvas.width, exemplarCanvas.height);
      // exemplarCtx.lineWidth = 20.0;
      // exemplarCtx.strokeStyle = "#111";
      // exemplarCtx.strokeRect(0, 0, exemplarCanvas.width, exemplarCanvas.height);
      // ctx.drawImage(exemplarImage, 0,0, exemplarCanvas.width, exemplarCanvas.height);
      needsRedrawImage = false;
    }

    drawClock(1.0 - timeLeft / globals.timeLimit);
    if( timeLeft <= 5 && timeLeft > 0 )
    {
      drawCountdown(timeLeft, secondPortion / 1000.0);
    }
  };


  var drawStar = function(centerX, centerY, fillOn)
  {
    var n = 10;
    var radius = 150;

    splashCtx.fillStyle = "#ee0";

    for( var j = 0; j < 1 + fillOn ? 1 : 0; j++ )
    {
      splashCtx.beginPath();
      for( var i = 0; i < n; i++ )
      {
        var theta = 2.0 * Math.PI * (i-0.5) / n;
        var factor = [1.0, 0.378][i % 2];

        var x = centerX + factor * radius * Math.cos(theta);
        var y = centerY + factor * radius * Math.sin(theta);

        if( i == 0 )
        {
          splashCtx.moveTo(x, y);
        }
        else
        {
          splashCtx.lineTo(x, y);
        }
      }
      splashCtx.closePath();

      if( j == 0 )
      {
        splashCtx.stroke();
      }
      else
      {
        splashCtx.fill();
      }
    }
  }

  var renderRewardScreen = function()
  {
    var t = Date.now() - rewardScreenTime0;

    splashCtx.clearRect(0, 0, splashCanvas.width, splashCanvas.height);

    var h = 0.0;

    if( t > 0 && t < 1000 )
    {
      var x = t/1000.0;
      h = 2.0 * splashCanvas.height * ( 1.0 - (3.0 * x*x - 2.0 * x*x*x) );
    }

    if( t > 5000 && t < 6000 )
    {
      var x = (t-5000)/1000.0;
      h = 2.0 * splashCanvas.height * ( 2.0 * x*x*x - 3.0 * x*x );
    }

    if( t > 6000 )
    {
      h = 2.0 * splashCanvas.height;
    }

    splashCtx.save();
    splashCtx.translate(0, -h);
    splashCtx.translate(splashCanvas.width / 2, splashCanvas.height / 2);

    splashCtx.fillStyle = "#aab";
    splashCtx.fillRect(-600,-300,1200,600);

    splashCtx.strokeStyle = "#334";
    splashCtx.lineWidth = 10;
    splashCtx.lineJoin = "round";
    splashCtx.strokeRect(-600,-300,1200,600);

    var starf0 = (t > 1300);
    var starf1 = (t > 1600);
    var starf2 = (t > 1900);

    drawStar(-325,-100, starf0 && (accuracy > 0));
    drawStar(0,-100, starf1 && (accuracy > 5));
    drawStar(325,-100, starf2 && (accuracy > 10));

    if( starf2 )
    {
      splashCtx.fillStyle = "#000";
      splashCtx.font = "150px 'Dosis'";
      splashCtx.textAlign = "center";
      splashCtx.fillText("Accuracy : " + parseInt(accuracy) + "%", 0,200);
    }

    splashCtx.restore();

    if( t > 6000 )
    {
      rewardScreen = false;
      timeLeft = globals.timeLimit;
      ctx.clearRect(0,0, canvas.width, canvas.height);
      getNextLevelImage();
    }


  }

  GameSupport.run(globals, render);
});


/*
James Cryer / Huddle 2014
URL: https://github.com/Huddle/Resemble.js
*/

(function(_this){
    'use strict';

    var pixelTransparency = 1;

    var errorPixelColor = { // Color for Error Pixels. Between 0 and 255.
        red: 255,
        green: 0,
        blue: 255,
        alpha: 255
    };

    function colorsDistance(c1, c2){
        return (Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b))/3;
    }

    var errorPixelTransform = {
        flat : function (d1, d2){
            return {
                r: errorPixelColor.red,
                g: errorPixelColor.green,
                b: errorPixelColor.blue,
                a: errorPixelColor.alpha
            }
        },
        movement: function (d1, d2){
            return {
                r: ((d2.r*(errorPixelColor.red/255)) + errorPixelColor.red)/2,
                g: ((d2.g*(errorPixelColor.green/255)) + errorPixelColor.green)/2,
                b: ((d2.b*(errorPixelColor.blue/255)) + errorPixelColor.blue)/2,
                a: d2.a
            }
        },
        flatDifferenceIntensity: function (d1, d2){
            return {
                r: errorPixelColor.red,
                g: errorPixelColor.green,
                b: errorPixelColor.blue,
                a: colorsDistance(d1, d2)
            }
        },
        movementDifferenceIntensity: function (d1, d2){
            var ratio = colorsDistance(d1, d2)/255 * 0.8;
            return {
                r: ((1-ratio)*(d2.r*(errorPixelColor.red/255)) + ratio*errorPixelColor.red),
                g: ((1-ratio)*(d2.g*(errorPixelColor.green/255)) + ratio*errorPixelColor.green),
                b: ((1-ratio)*(d2.b*(errorPixelColor.blue/255)) + ratio*errorPixelColor.blue),
                a: d2.a
            }
        }
    };

    var errorPixelTransformer = errorPixelTransform.flat;

    var largeImageThreshold = 1200;

    var httpRegex = /^https?:\/\//;
    var documentDomainRegex = new RegExp('^https?://' + document.domain);

    _this['resemble'] = function( fileData ){

        var data = {};
        var images = [];
        var updateCallbackArray = [];

        var tolerance = { // between 0 and 255
            red: 16,
            green: 16,
            blue: 16,
            alpha: 16,
            minBrightness: 16,
            maxBrightness: 240
        };

        var ignoreAntialiasing = false;
        var ignoreColors = false;

        function triggerDataUpdate(){
            var len = updateCallbackArray.length;
            var i;
            for(i=0;i<len;i++){
                if (typeof updateCallbackArray[i] === 'function'){
                    updateCallbackArray[i](data);
                }
            }
        }

        function loop(x, y, callback){
            var i,j;

            for (i=0;i<x;i++){
                for (j=0;j<y;j++){
                    callback(i, j);
                }
            }
        }

        function parseImage(sourceImageData, width, height){

            var pixelCount = 0;
            var redTotal = 0;
            var greenTotal = 0;
            var blueTotal = 0;
            var brightnessTotal = 0;

            loop(height, width, function(verticalPos, horizontalPos){
                var offset = (verticalPos*width + horizontalPos) * 4;
                var red = sourceImageData[offset];
                var green = sourceImageData[offset + 1];
                var blue = sourceImageData[offset + 2];
                var brightness = getBrightness(red,green,blue);

                pixelCount++;

                redTotal += red / 255 * 100;
                greenTotal += green / 255 * 100;
                blueTotal += blue / 255 * 100;
                brightnessTotal += brightness / 255 * 100;
            });

            data.red = Math.floor(redTotal / pixelCount);
            data.green = Math.floor(greenTotal / pixelCount);
            data.blue = Math.floor(blueTotal / pixelCount);
            data.brightness = Math.floor(brightnessTotal / pixelCount);

            triggerDataUpdate();
        }

        function loadImageData( fileData, callback ){
            var fileReader;
            var hiddenImage = new Image();

            if (httpRegex.test(fileData) && !documentDomainRegex.test(fileData)) {
                hiddenImage.setAttribute('crossorigin', 'anonymous');
            }

            hiddenImage.onload = function() {

                var hiddenCanvas =  document.createElement('canvas');
                var imageData;
                var width = hiddenImage.width;
                var height = hiddenImage.height;

                hiddenCanvas.width = width;
                hiddenCanvas.height = height;
                hiddenCanvas.getContext('2d').drawImage(hiddenImage, 0, 0, width, height);
                imageData = hiddenCanvas.getContext('2d').getImageData(0, 0, width, height);

                images.push(imageData);

                callback(imageData, width, height);
            };

            if (typeof fileData === 'string') {
                hiddenImage.src = fileData;
                if (hiddenImage.complete) {
                    hiddenImage.onload();
                }
            } else if (typeof fileData.data !== 'undefined'
                    && typeof fileData.width === 'number'
                    && typeof fileData.height === 'number') {
                images.push(fileData);
                callback(fileData, fileData.width, fileData.height);
            } else {
                fileReader = new FileReader();
                fileReader.onload = function (event) {
                    hiddenImage.src = event.target.result;
                };
                fileReader.readAsDataURL(fileData);
            }
        }

        function isColorSimilar(a, b, color){

            var absDiff = Math.abs(a - b);

            if(typeof a === 'undefined'){
                return false;
            }
            if(typeof b === 'undefined'){
                return false;
            }

            if(a === b){
                return true;
            } else if ( absDiff < tolerance[color] ) {
                return true;
            } else {
                return false;
            }
        }

        function isNumber(n) {
            return !isNaN(parseFloat(n));
        }

        function isPixelBrightnessSimilar(d1, d2){
            var alpha = isColorSimilar(d1.a, d2.a, 'alpha');
            var brightness = isColorSimilar(d1.brightness, d2.brightness, 'minBrightness');
            return brightness && alpha;
        }

        function getBrightness(r,g,b){
            return 0.3*r + 0.59*g + 0.11*b;
        }

        function isRGBSame(d1,d2){
            var red = d1.r === d2.r;
            var green = d1.g === d2.g;
            var blue = d1.b === d2.b;
            return red && green && blue;
        }

        function isRGBSimilar(d1, d2){
            var red = isColorSimilar(d1.r,d2.r,'red');
            var green = isColorSimilar(d1.g,d2.g,'green');
            var blue = isColorSimilar(d1.b,d2.b,'blue');
            var alpha = isColorSimilar(d1.a, d2.a, 'alpha');

            return red && green && blue && alpha;
        }

        function isContrasting(d1, d2){
            return Math.abs(d1.brightness - d2.brightness) > tolerance.maxBrightness;
        }

        function getHue(r,g,b)
        {
            r = r / 255;
            g = g / 255;
            b = b / 255;
            var max = Math.max(r, g, b), min = Math.min(r, g, b);
            var h;
            var d;

            if (max == min){
                h = 0; // achromatic
            } else{
                d = max - min;
                switch(max){
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    case b: h = (r - g) / d + 4; break;
                }
                h /= 6;
            }

            return h;
        }

        function isAntialiased(sourcePix, data, cacheSet, verticalPos, horizontalPos, width){
            var offset;
            var targetPix;
            var distance = 1;
            var i;
            var j;
            var hasHighContrastSibling = 0;
            var hasSiblingWithDifferentHue = 0;
            var hasEquivilantSibling = 0;

            addHueInfo(sourcePix);

            for (i = distance*-1; i <= distance; i++){
                for (j = distance*-1; j <= distance; j++){

                    if(i===0 && j===0){
                        // ignore source pixel
                    } else {

                        offset = ((verticalPos+j)*width + (horizontalPos+i)) * 4;
                        targetPix = getPixelInfo(data, offset, cacheSet);

                        if(targetPix === null){
                            continue;
                        }

                        addBrightnessInfo(targetPix);
                        addHueInfo(targetPix);

                        if( isContrasting(sourcePix, targetPix) ){
                            hasHighContrastSibling++;
                        }

                        if( isRGBSame(sourcePix,targetPix) ){
                            hasEquivilantSibling++;
                        }

                        if( Math.abs(targetPix.h - sourcePix.h) > 0.3 ){
                            hasSiblingWithDifferentHue++;
                        }

                        if( hasSiblingWithDifferentHue > 1 || hasHighContrastSibling > 1){
                            return true;
                        }
                    }
                }
            }

            if(hasEquivilantSibling < 2){
                return true;
            }

            return false;
        }

        function errorPixel(px, offset, data1, data2){
            var data = errorPixelTransformer(data1, data2);
            px[offset] = data.r;
            px[offset + 1] = data.g;
            px[offset + 2] = data.b;
            px[offset + 3] = data.a;
        }

        function copyPixel(px, offset, data){
            px[offset] = data.r; //r
            px[offset + 1] = data.g; //g
            px[offset + 2] = data.b; //b
            px[offset + 3] = data.a * pixelTransparency; //a
        }

        function copyGrayScalePixel(px, offset, data){
            px[offset] = data.brightness; //r
            px[offset + 1] = data.brightness; //g
            px[offset + 2] = data.brightness; //b
            px[offset + 3] = data.a * pixelTransparency; //a
        }

        function getPixelInfo(data, offset, cacheSet){
            var r;
            var g;
            var b;
            var d;
            var a;

            r = data[offset];

            if(typeof r !== 'undefined'){
                g = data[offset+1];
                b = data[offset+2];
                a = data[offset+3];
                d = {
                    r: r,
                    g: g,
                    b: b,
                    a: a
                };

                return d;
            } else {
                return null;
            }
        }

        function addBrightnessInfo(data){
            data.brightness = getBrightness(data.r,data.g,data.b); // 'corrected' lightness
        }

        function addHueInfo(data){
            data.h = getHue(data.r,data.g,data.b);
        }

        function analyseImages(img1, img2, width, height){

            var hiddenCanvas = document.createElement('canvas');

            var data1 = img1.data;
            var data2 = img2.data;

            hiddenCanvas.width = width;
            hiddenCanvas.height = height;

            var context = hiddenCanvas.getContext('2d');
            var imgd = context.createImageData(width,height);
            var targetPix = imgd.data;

            var mismatchCount = 0;

            var time = Date.now();

            var skip;

            if(!!largeImageThreshold && ignoreAntialiasing && (width > largeImageThreshold || height > largeImageThreshold)){
                skip = 6;
            }

            loop(height, width, function(verticalPos, horizontalPos){

                if(skip){ // only skip if the image isn't small
                    if(verticalPos % skip === 0 || horizontalPos % skip === 0){
                        return;
                    }
                }

                var offset = (verticalPos*width + horizontalPos) * 4;
                var pixel1 = getPixelInfo(data1, offset, 1);
                var pixel2 = getPixelInfo(data2, offset, 2);

                if(pixel1 === null || pixel2 === null){
                    return;
                }

                if (ignoreColors){

                    addBrightnessInfo(pixel1);
                    addBrightnessInfo(pixel2);

                    if( isPixelBrightnessSimilar(pixel1, pixel2) ){
                        copyGrayScalePixel(targetPix, offset, pixel2);
                    } else {
                        errorPixel(targetPix, offset, pixel1, pixel2);
                        mismatchCount++;
                    }
                    return;
                }

                if( isRGBSimilar(pixel1, pixel2) ){
                    copyPixel(targetPix, offset, pixel1, pixel2);

                } else if( ignoreAntialiasing && (
                        addBrightnessInfo(pixel1), // jit pixel info augmentation looks a little weird, sorry.
                        addBrightnessInfo(pixel2),
                        isAntialiased(pixel1, data1, 1, verticalPos, horizontalPos, width) ||
                        isAntialiased(pixel2, data2, 2, verticalPos, horizontalPos, width)
                    )){

                    if( isPixelBrightnessSimilar(pixel1, pixel2) ){
                        copyGrayScalePixel(targetPix, offset, pixel2);
                    } else {
                        errorPixel(targetPix, offset, pixel1, pixel2);
                        mismatchCount++;
                    }
                } else {
                    errorPixel(targetPix, offset, pixel1, pixel2);
                    mismatchCount++;
                }

            });

            data.misMatchPercentage = (mismatchCount / (height*width) * 100).toFixed(2);
            data.analysisTime = Date.now() - time;

            data.getImageDataUrl = function(text){
                var barHeight = 0;

                if(text){
                    barHeight = addLabel(text,context,hiddenCanvas);
                }

                context.putImageData(imgd, 0, barHeight);

                return hiddenCanvas.toDataURL("image/png");
            };
        }

        function addLabel(text, context, hiddenCanvas){
            var textPadding = 2;

            context.font = '12px sans-serif';

            var textWidth = context.measureText(text).width + textPadding*2;
            var barHeight = 22;

            if(textWidth > hiddenCanvas.width){
                hiddenCanvas.width = textWidth;
            }

            hiddenCanvas.height += barHeight;

            context.fillStyle = "#666";
            context.fillRect(0,0,hiddenCanvas.width,barHeight -4);
            context.fillStyle = "#fff";
            context.fillRect(0,barHeight -4,hiddenCanvas.width, 4);

            context.fillStyle = "#fff";
            context.textBaseline = "top";
            context.font = '12px sans-serif';
            context.fillText(text, textPadding, 1);

            return barHeight;
        }

        function normalise(img, w, h){
            var c;
            var context;

            if(img.height < h || img.width < w){
                c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                context = c.getContext('2d');
                context.putImageData(img, 0, 0);
                return context.getImageData(0, 0, w, h);
            }

            return img;
        }

        function compare(one, two){

            function onceWeHaveBoth(){
                var width;
                var height;
                if(images.length === 2){
                    width = images[0].width > images[1].width ? images[0].width : images[1].width;
                    height = images[0].height > images[1].height ? images[0].height : images[1].height;

                    if( (images[0].width === images[1].width) && (images[0].height === images[1].height) ){
                        data.isSameDimensions = true;
                    } else {
                        data.isSameDimensions = false;
                    }

                    data.dimensionDifference = { width: images[0].width - images[1].width, height: images[0].height - images[1].height };

                    analyseImages( normalise(images[0],width, height), normalise(images[1],width, height), width, height);

                    triggerDataUpdate();
                }
            }

            images = [];
            loadImageData(one, onceWeHaveBoth);
            loadImageData(two, onceWeHaveBoth);
        }

        function getCompareApi(param){

            var secondFileData,
                hasMethod = typeof param === 'function';

            if( !hasMethod ){
                // assume it's file data
                secondFileData = param;
            }

            var self = {
                ignoreNothing: function(){

                    tolerance.red = 16;
                    tolerance.green = 16;
                    tolerance.blue = 16;
                    tolerance.alpha = 16;
                    tolerance.minBrightness = 16;
                    tolerance.maxBrightness = 240;

                    ignoreAntialiasing = false;
                    ignoreColors = false;

                    if(hasMethod) { param(); }
                    return self;
                },
                ignoreAntialiasing: function(){

                    tolerance.red = 32;
                    tolerance.green = 32;
                    tolerance.blue = 32;
                    tolerance.alpha = 32;
                    tolerance.minBrightness = 64;
                    tolerance.maxBrightness = 96;

                    ignoreAntialiasing = true;
                    ignoreColors = false;

                    if(hasMethod) { param(); }
                    return self;
                },
                ignoreColors: function(){

                    tolerance.alpha = 16;
                    tolerance.minBrightness = 16;
                    tolerance.maxBrightness = 240;

                    ignoreAntialiasing = false;
                    ignoreColors = true;

                    if(hasMethod) { param(); }
                    return self;
                },
                repaint: function(){
                    if(hasMethod) { param(); }
                    return self;
                },
                onComplete: function( callback ){

                    updateCallbackArray.push(callback);

                    var wrapper = function(){
                        compare(fileData, secondFileData);
                    };

                    wrapper();

                    return getCompareApi(wrapper);
                }
            };

            return self;
        }

        return {
            onComplete: function( callback ){
                updateCallbackArray.push(callback);
                loadImageData(fileData, function(imageData, width, height){
                    parseImage(imageData.data, width, height);
                });
            },
            compareTo: function(secondFileData){
                return getCompareApi(secondFileData);
            }
        };

    };

    _this['resemble'].outputSettings = function(options){
        var key;
        var undefined;

        if(options.errorColor){
            for (key in options.errorColor) {
                errorPixelColor[key] = options.errorColor[key] === undefined ? errorPixelColor[key] : options.errorColor[key];
            }
        }

        if(options.errorType && errorPixelTransform[options.errorType] ){
            errorPixelTransformer = errorPixelTransform[options.errorType];
        }

        pixelTransparency = isNaN(Number(options.transparency)) ? pixelTransparency : options.transparency;

        if (options.largeImageThreshold !== undefined) {
            largeImageThreshold = options.largeImageThreshold;
        }

        return this;
    };

}(this));
