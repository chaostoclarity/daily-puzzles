// Win celebration: a canvas confetti burst in the game's own colors.
// Shared by every game; a game can ask for its own piece shape (Spilling Bee uses hexagons).

const G = 1100; // gravity, px/s²
let canvas = null, c2 = null, parts = [], raf = 0, last = 0, W = 0, H = 0;

export const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function rgb(c) {
  c = c.trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let x = m[1];
    if (x.length === 3) x = [...x].map((ch) => ch + ch).join('');
    return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16));
  }
  m = c.match(/rgba?\(([^)]+)\)/);
  if (m) return m[1].split(/[ ,/]+/).slice(0, 3).map(Number);
  return [192, 139, 12];
}
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

/** Colors for a burst: the game's color with lighter and deeper tones, plus the highlighter yellow. */
export function palette(el = document.querySelector('.screen') || document.documentElement) {
  const cs = getComputedStyle(el);
  const g = rgb(cs.getPropertyValue('--g') || '#c08b0c');
  const mark = rgb(cs.getPropertyValue('--mark') || '#f3c11b');
  const white = [255, 255, 255], black = [0, 0, 0];
  return [mix(g, white, 0), mix(g, white, 0.35), mix(g, white, 0.6), mix(g, black, 0.25), mix(mark, white, 0), mix(mark, white, 0.45)];
}

function ensureCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    c2 = canvas.getContext('2d');
  }
  if (!canvas.isConnected) document.body.append(canvas);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  c2.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawn(x, y, angle, spread, speed, n, colors, shape) {
  for (let i = 0; i < n; i++) {
    const a = (angle + (Math.random() - 0.5) * spread) * Math.PI / 180;
    const v = speed * (0.45 + Math.random() * 0.55);
    const kind = shape === 'mix' ? (Math.random() < 0.7 ? 'strip' : 'dot') : shape;
    parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      s: kind === 'hex' ? 6 + Math.random() * 6 : 5 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 12,
      ph: Math.random() * Math.PI * 2, vph: 6 + Math.random() * 8,
      color: colors[(Math.random() * colors.length) | 0], kind,
      t: 0, life: 2.2 + Math.random() * 1.4,
    });
  }
}

function hexPath(s) {
  c2.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k * 60) * Math.PI / 180;
    c2[k ? 'lineTo' : 'moveTo'](Math.cos(a) * s, Math.sin(a) * s);
  }
  c2.closePath();
}

function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  c2.clearRect(0, 0, W, H);
  parts = parts.filter((p) => p.t < p.life && p.y < H + 40);
  for (const p of parts) {
    p.t += dt;
    const drag = Math.exp(-(p.kind === 'dot' ? 1.2 : 2.4) * dt);
    p.vx *= drag; p.vy = p.vy * drag + G * dt * (p.kind === 'dot' ? 1 : 0.55);
    p.vx += Math.sin(p.ph) * 18 * dt; // flutter sideways
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.rot += p.vr * dt; p.ph += p.vph * dt;
    const fade = Math.min(1, (p.life - p.t) / 0.5);
    c2.save();
    c2.globalAlpha = Math.max(0, fade);
    c2.translate(p.x, p.y);
    c2.rotate(p.rot);
    c2.scale(1, Math.cos(p.ph)); // turning over in the air
    c2.fillStyle = p.color;
    if (p.kind === 'dot') { c2.beginPath(); c2.arc(0, 0, p.s * 0.45, 0, Math.PI * 2); c2.fill(); }
    else if (p.kind === 'hex') { hexPath(p.s * 0.7); c2.fill(); }
    else c2.fillRect(-p.s * 0.35, -p.s, p.s * 0.7, p.s * 2);
    c2.restore();
  }
  if (parts.length) raf = requestAnimationFrame(frame);
  else { raf = 0; c2.clearRect(0, 0, W, H); canvas.remove(); }
}

/**
 * Fire confetti. origin: {x, y} in viewport px for a burst; cannons: also shoot from both
 * bottom corners; count scales the amount; shape: 'mix' (strips and dots) or 'hex'.
 */
export function celebrate({ origin = null, cannons = true, count = 1, shape = 'mix', colors = null } = {}) {
  if (calm() || typeof document === 'undefined') return;
  ensureCanvas();
  const cols = colors || palette();
  if (origin) spawn(origin.x, origin.y, -90, 360, 520, Math.round(70 * count), cols, shape);
  if (cannons) {
    const v = Math.sqrt(2 * G * 0.55 * H) * 1.25;
    spawn(-10, H * 0.92, -62, 26, v, Math.round(80 * count), cols, shape);
    spawn(W + 10, H * 0.92, -118, 26, v, Math.round(80 * count), cols, shape);
  }
  if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
}

/** Center of an element, for a burst origin. */
export function centerOf(el) {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
