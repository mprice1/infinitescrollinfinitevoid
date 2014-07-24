var tweets = [];
var curated_tweet_query_params = '?q=from:@_infinite_void_'
var regular_tweet_query_params = '?q="the%20void"%20-fill%20-filling%20-fills%20-enter'
var next_tweet_query_params = curated_tweet_query_params
var canvas;
var updateCanvas;
var wnd;
var fading;

// Parameter callback gets the stripped tweet text.
function getNextTweets(callback) {

  // TODO: Fix to work with the new twitter API one day... this will require some form of
  // server side proxy since there is no way to search twitter without authenticating anymore :/
  callback();
  return;

  $.ajax({
    url: 'http://search.twitter.com/search.json' + next_tweet_query_params,
    crossDomain: true,
    dataType: 'jsonp',
    success: function(d){
      var result_text = [];
      for (var i = 0; i < d.results.length; i++) {
        result_text.push(d.results[i].text);
      }
      tweets = tweets.concat(result_text);
      if (d.next_page) {
        next_tweet_query_params = d.next_page;
      } else {
        next_tweet_query_params = regular_tweet_query_params;
      }
      typeof callback === 'function' && callback();
    },
  });
}

function nextTweetText() {
  // if (tweets.length < 3) {
  //   getNextTweets();
  // }
  // if (tweets.length > 0) {
  //   tweet_text = tweets.pop();
  //   tweet_text = tweet_text.replace(/RT @[^ ]*($| )/g, '').replace(/@[^ ]*($| )/g, '').replace(/http:\/\/t\.co\/[^ ]*/g, '')
  //   return tweet_text;
  // }
  return 'what can you possibly hope to find in this place?';
}

// Final init that depends on assets being loaded.
function start() {
  showNext();
}

function showNext() {
  updateCanvas();
  var twt = nextTweetText();
  try {
    window.history.pushState("", "", twt.replace(/ /g, '_').replace(/\//g, ''));
  } catch(e) {}
  var box = $('<div class="temp"><img src=\'' + canvas.toDataURL() + '\'></div>');
  box.attr('title', twt);
  box.css('background');
  $('#container').append(box);
  box.css({'opacity': '0'})
  box.animate({'opacity': '1'}, 800, doneShowing);
}

function doneShowing() {
  fading = false;
  checkScroll();
}

var $doc = $(document);
function checkScroll() {
  if($doc.height() - (wnd.scrollTop() + wnd.height()) <= 250) {
    if (!fading) {
      fading = true;
      showNext();
    }
  }
}

// Init that can be done independent of assets.
function init() {
wnd = $(window);
fading = false;

var pstar = $('.pstars');
function onScroll(e) {
  pstar.css('background-position-y', (wnd.scrollTop() % 256) + 'px');
  checkScroll();
}

var scroll_v0 = 1.0;
var scroll_v = 0;
var scroll_dt = 25;
var scroll_decay = 0.9;
var going = false;
function onMouseWheel(e) {
  var dir = scroll_orient * e.originalEvent[delta] > 0 ? -1 : 1;
  scroll_v = dir * scroll_v0;
  scroll_v = Math.max(scroll_v, -scroll_v0);
  scroll_v = Math.min(scroll_v, scroll_v0);
  if (going) return false;
  (function mv() {
    going = true;
    scroll_v *= scroll_decay;
    wnd.scrollTop(wnd.scrollTop() + scroll_v * scroll_dt);
    if (Math.abs(scroll_v) > 0.1) {
      window.setTimeout(mv, scroll_dt);
    } else {going = false;}
  })();
  return false;
}

var autoscroll = false;
var autoscroll_speed = 1;
function toggleAutoScroll() {
  autoscroll = !autoscroll;
  (function doAutoScroll() {
    if (autoscroll) {
     wnd.scrollTop(wnd.scrollTop() + autoscroll_speed);
     NPR.requestAnimFrame.call(window, doAutoScroll);
    }
  })();
}
wnd.dblclick(toggleAutoScroll);

var ff = (/Firefox/i.test(navigator.userAgent));
var mousewheelevt= ff ? "wheel" : "mousewheel";
var delta = ff ?  'deltaY' : 'wheelDeltaY';
var scroll_orient = ff ? -1 : 1;
wnd.bind(mousewheelevt, onMouseWheel);
wnd.scroll(onScroll);

canvas = document.createElement('canvas');
canvas.width = 640;
canvas.height = 480;
initgl();

  // Load assets and wait before continuing.
  var NUM_ASSETS = 3;
  var assets_loaded = 0;
  function assetLoaded() {
    if (++assets_loaded == NUM_ASSETS) start();
  }
  getNextTweets(assetLoaded);
  try {
    models['q'] = new NPR.Mesh('asteroid.json', assetLoaded);
    texs['rock'] = NPR.loadTexture('rock.png', assetLoaded, true);
  } catch (e) { assetLoaded(); }
}

// fallback for no webgl.
function updateCanvas2d() {
  // TODO: Do something with shitty prerendered sprites idk.
}

//
// WebGL stuff.
//
var gl;
var texs = {};
var shaders = {};
var models = {};

var asteroid_vert_src = "\
  attribute vec3 aVertexPosition;\
  attribute vec3 aVertexNormal;\
  attribute vec2 aVertexTexcoord;\
  uniform mat4 uMVMatrix;\
  uniform mat4 uPMatrix;\
  uniform mat3 uNMatrix;\
  uniform vec3 uLightDir;\
  varying float vDiffuseIntensity;\
  varying vec2 vTexCoord;\
  varying float vFacingRatio;\
  void main(void) {\
    vTexCoord = aVertexTexcoord;\
    vDiffuseIntensity = dot(normalize(uLightDir), uNMatrix * aVertexNormal);\
    vFacingRatio = 1.0 - dot(normalize(uNMatrix * aVertexNormal), vec3(0.0, 0.0, 1.0));\
    vFacingRatio = min(0.95, max(vFacingRatio, 0.0));\
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);\
  }\
  "
var asteroid_frag_src = "\
  #ifdef GL_ES\n\
    precision highp float;\n\
  #endif\n\
  uniform vec3 uColor;\
  uniform vec3 uLightColor;\
  uniform vec3 uRimColor;\
  uniform vec3 uAmbientColor;\
  uniform sampler2D uTexture;\
  uniform vec2 uScale;\
  varying vec2 vTexCoord;\
  varying float vDiffuseIntensity;\
  varying float vFacingRatio;\
  \
  void main(void) {\
    vec2 tc = vTexCoord * uScale;\
    vec4 texcol = texture2D(uTexture, tc);\
    float lightIntensity = vDiffuseIntensity + vFacingRatio;\
    vec3 col = vec3(0,0,0);\
    col = col + (texcol.rgb * uLightColor) * vDiffuseIntensity;\
    col = col + (texcol.rgb * uRimColor) * vFacingRatio * vFacingRatio * 2.0;\
    col = col + uAmbientColor;\
    col = min(col, vec3(1.0, 1.0, 1.0));\
    gl_FragColor.rgb = col;\
    gl_FragColor.a = 1.0;\
  }\
  "

function initgl() {
  NPR.start(canvas);
  gl = NPR.gl;

  if (!gl) {
    updateCanvas = updateCanvas2d;
    gl = canvas.getContext('2d');
    return;
  }
  updateCanvas = updateCanvasGl;

  // TODO: Fallback to something shitty if no webgl.
  shaders['red'] = (new NPR.TextureShader()).setUniforms({uColor: [1,0,0,1]});

  shaders['ast'] = new NPR.Shader(asteroid_vert_src, asteroid_frag_src);
  shaders['ast'].attributes = {
    "VertexPositionBuffer" : gl.getAttribLocation(shaders['ast'].program, "aVertexPosition"),
    "VertexNormalBuffer" : gl.getAttribLocation(shaders['ast'].program, "aVertexNormal"),
    "TextureCoordinateBuffer" : gl.getAttribLocation(shaders['ast'].program, "aVertexTexcoord")
  }
  
  // shaders['ast'].setUniforms({});

  NPR.pMatrix = mat4.perspective(45, gl.viewportWidth/gl.viewportHeight, 0.01, 500, NPR.pMatrix);
  gl.clearColor(0,0,0,0);
}

function updateCanvasGl() {
  gl.enable(gl.DEPTH_TEST);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.bindTexture(gl.TEXTURE_2D, texs['rock']);
  shaders['ast'].setUniforms({
    uLightDir: [2*Math.random()-1, 2*Math.random()-1, 2*Math.random()-1],
    uLightColor: getLightColor(),
    uRimColor: randVec(),

  });
  for (var i = 0; i < Math.random() * 10000; i++) {
    var tile = Math.random() * 2 + 1;
    mat4.identity(NPR.mvMatrix);
    mat4.translate(NPR.mvMatrix, [Math.random() * 40 - 20, Math.random() * 40 - 20, Math.random() * -150]);
    randomRotate(NPR.mvMatrix);
    shaders['ast'].setMatrixUniforms(NPR.mvMatrix, NPR.pMatrix, true)
    .setUniforms({
      'uScale' : [tile, tile],
      uAmbientColor: [Math.random() * 0.05 + 0.025, Math.random() * 0.05 + 0.025, Math.random() * 0.05 + 0.025]
    }).drawModel(models['q']);
  }


}

function getLightColor() {
  var choice = Math.random();
  if (choice < .7) {
    // Most of the time, do a normal yellowish light.
    return [1, .8, .6]; 
  } else {
    // Totally random.
    return randVec();
  }
}

function randVec() {
  return [Math.random(), Math.random(), Math.random()];
}

function randomRotate(m4) {
  mat4.rotate(m4, Math.random() * Math.PI, [1, 0, 0]);
  mat4.rotate(m4, Math.random() * Math.PI, [0, 1, 0]);
}