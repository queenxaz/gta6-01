// input.js — keyboard and mouse input for Sunset Harbor.
// Tracks held keys, pressed-this-frame edges, and the mouse position in
// screen and world space. Also owns the "any key" wake-up for audio.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };
  let anyKey = false;

  function keyName(e) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return k;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
    anyKey = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
    anyKey = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, pressed, mouse,
    /** True while the key is held (accepts 'w' or 'ArrowUp' style names). */
    down(...names) { return names.some((n) => keys.has(n)); },
    /** True only on the frame the key went down. */
    wasPressed(...names) { return names.some((n) => pressed.has(n)); },
    /** True once any key or click has happened (audio unlock). */
    get anyKey() { return anyKey; },
    /** Clear per-frame edge state; call at the end of each frame. */
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
