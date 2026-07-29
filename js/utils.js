// ---- math / helper utilities ----
const TAU = Math.PI * 2;

function rand(a, b) { return a + Math.random() * (b - a); }
function irand(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function chance(p) { return Math.random() < p; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; }
function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
// distance from point to segment (for beam weapons)
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(px, py, x1, y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = clamp(t, 0, 1);
  return dist(px, py, x1 + t * dx, y1 + t * dy);
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deterministic blood trim for UI panels. It is deliberately static so richer
// presentation never adds per-frame allocations or visual noise during combat.
function drawBloodTrim(ctx, x, y, w, seed, alpha) {
  const oldAlpha = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1;
  const usable = Math.max(1, Math.floor(w - 18));
  ctx.save();
  ctx.globalAlpha = oldAlpha * (alpha === undefined ? 0.72 : alpha);
  ctx.fillStyle = '#861020';
  ctx.fillRect(x + 2, y, w - 4, 3);
  for (let i = 0; i < 6; i++) {
    const px = x + 9 + ((i * 47 + (seed || 0) * 29) % usable);
    const r = 2 + ((i + (seed || 0)) % 3);
    ctx.beginPath(); ctx.arc(px, y + 2, r, 0, TAU); ctx.fill();
    if ((i + (seed || 0)) % 2 === 0) {
      const drip = 4 + ((i * 7 + (seed || 0) * 3) % 13);
      ctx.fillRect(px - 1, y + 2, 2, drip);
      ctx.beginPath(); ctx.arc(px, y + 2 + drip, 1.6, 0, TAU); ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(235,54,70,0.45)';
  ctx.fillRect(x + 4, y, Math.max(10, w * 0.22), 1);
  ctx.restore();
}

function pixelPanelPath(ctx, x, y, w, h, cut) {
  const c = Math.max(0, Math.min(cut === undefined ? 7 : cut, w / 3, h / 3));
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
}

// Shared hard-edged panel language for HUD and modal screens. Chamfered corners,
// one-pixel highlights, and square corner pins keep it modern without losing the
// authored 2D pixel aesthetic.
function drawPixelPanel(ctx, x, y, w, h, opts) {
  const o = opts || {};
  const cut = o.cut === undefined ? 7 : o.cut;
  ctx.save();
  if (o.shadow !== false) {
    ctx.fillStyle = o.shadowColor || 'rgba(0,0,0,0.5)';
    pixelPanelPath(ctx, x + 4, y + 5, w, h, cut); ctx.fill();
  }
  ctx.fillStyle = o.fill || 'rgba(10,5,8,0.88)';
  pixelPanelPath(ctx, x, y, w, h, cut); ctx.fill();
  ctx.strokeStyle = o.border || 'rgba(111,45,57,0.9)';
  ctx.lineWidth = o.lineWidth || 1;
  pixelPanelPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, Math.max(1, cut - 0.5)); ctx.stroke();
  ctx.strokeStyle = o.highlight || 'rgba(255,217,186,0.08)';
  ctx.beginPath(); ctx.moveTo(x + cut + 2, y + 2); ctx.lineTo(x + w - cut - 2, y + 2); ctx.stroke();
  const accent = o.accent || '#8f1f2f';
  ctx.fillStyle = accent;
  ctx.fillRect(x + cut, y, Math.max(16, Math.min(w * 0.34, 92)), 2);
  ctx.fillRect(x + 2, y + cut, 2, Math.max(12, Math.min(h * 0.32, 34)));
  ctx.fillStyle = 'rgba(210,171,115,0.28)';
  ctx.fillRect(x + cut, y + 5, 3, 3);
  ctx.fillRect(x + w - cut - 3, y + 5, 3, 3);
  ctx.fillRect(x + cut, y + h - 8, 3, 3);
  ctx.fillRect(x + w - cut - 3, y + h - 8, 3, 3);
  if (o.blood) drawBloodTrim(ctx, x + 2, y + 2, w - 4, o.seed || 0, o.bloodAlpha === undefined ? 0.38 : o.bloodAlpha);
  ctx.restore();
}

function drawPixelBar(ctx, x, y, w, h, value, opts) {
  const o = opts || {};
  const k = clamp(value, 0, 1);
  ctx.save();
  ctx.fillStyle = o.track || '#11080c'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = o.fill || '#b51d35'; ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * k), Math.max(1, h - 4));
  if (k > 0) {
    ctx.fillStyle = o.glint || 'rgba(255,210,180,0.3)';
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * k), 1);
  }
  const segments = o.segments || 0;
  if (segments > 1) {
    ctx.fillStyle = o.divider || 'rgba(5,2,4,0.6)';
    for (let i = 1; i < segments; i++) {
      const sx = x + Math.round((w * i) / segments);
      ctx.fillRect(sx, y + 1, 1, h - 2);
    }
  }
  ctx.strokeStyle = o.border || '#55303a'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawPixelTag(ctx, text, x, y, opts) {
  const o = opts || {};
  ctx.save();
  ctx.font = o.font || 'bold 10px monospace';
  const w = o.width || Math.ceil(ctx.measureText(text).width) + 16;
  const h = o.height || 22;
  drawPixelPanel(ctx, x, y, w, h, {
    cut: 4, shadow: false, fill: o.fill || 'rgba(15,7,10,0.86)',
    border: o.border || 'rgba(101,48,58,0.8)', accent: o.accent || '#7d1a29',
  });
  ctx.fillStyle = o.color || '#cdbdb2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2 + 1);
  ctx.restore();
  return w;
}
