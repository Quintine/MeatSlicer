// ---- keyboard + mouse input ----
const Input = {
  keys: {},
  pressed: {},   // edge-triggered, cleared each frame
  mx: W / 2, my: H / 2,
  mdown: false,
  mpressed: false, // edge-triggered mouse
  mreleased: false,
  anyKey: false,
};

function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (!Input.keys[k]) Input.pressed[k] = true;
    Input.keys[k] = true;
    Input.anyKey = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { Input.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { Input.keys = {}; Input.mdown = false; });

  function setMouse(e) {
    const r = canvas.getBoundingClientRect();
    Input.mx = (e.clientX - r.left) * (W / r.width);
    Input.my = (e.clientY - r.top) * (H / r.height);
  }
  canvas.addEventListener('mousemove', setMouse);
  canvas.addEventListener('mousedown', (e) => {
    setMouse(e);
    if (e.button === 0) { Input.mdown = true; Input.mpressed = true; Input.anyKey = true; }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) { Input.mdown = false; Input.mreleased = true; }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function clearInputEdges() {
  Input.pressed = {};
  Input.mpressed = false;
  Input.mreleased = false;
  Input.anyKey = false;
}

function keyDown(...ks) { return ks.some(k => Input.keys[k]); }
function keyPressed(...ks) { return ks.some(k => Input.pressed[k]); }
