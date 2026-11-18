// Sunset Harbor — keyboard + mouse input.
'use strict';

// Input state: held keys (by KeyboardEvent.code), mouse position in screen
// pixels, mouse button state, and edge-triggered "just pressed" keys.
var Input = {
  keys: {},
  pressed: {},   // code -> true only on the frame it went down
  mouseX: CFG.VIEW_W / 2,
  mouseY: CFG.VIEW_H / 2,
  mouseDown: false,
  mouseClicked: false,

  init: function (canvas) {
    var self = this;
    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code]) self.pressed[e.code] = true;
      self.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    window.addEventListener('blur', function () { self.keys = {}; self.mouseDown = false; });
    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouseX = e.clientX - r.left;
      self.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', function (e) {
      if (e.button === 0) { self.mouseDown = true; self.mouseClicked = true; }
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  },

  down: function (code) { return !!this.keys[code]; },
  justPressed: function (code) { return !!this.pressed[code]; },
  // WASD or arrows.
  axisX: function () {
    return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0) -
           (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
  },
  axisY: function () {
    return (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0) -
           (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0);
  },
  sprint: function () { return this.down('ShiftLeft') || this.down('ShiftRight'); },
  // Call at the end of each frame to clear edge triggers.
  endFrame: function () { this.pressed = {}; this.mouseClicked = false; },
};
