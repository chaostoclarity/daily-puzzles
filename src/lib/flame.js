// Fire (and, at the top level, lightning) drawn on a canvas behind an element.
// Spilling Bee's comb catches fire at Genius and crackles with lightning at Queen Bee.
import { calm } from './celebrate.js';

// soft round sprites in fire colors, drawn once and reused for every particle
function sprite(rgb) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.35, `rgba(${rgb},0.55)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/** Jagged bolt from (x0,y0) to (x1,y1) by midpoint displacement. */
function bolt(x0, y0, x1, y1, rough, depth, out) {
  if (depth === 0) { out.push([x0, y0, x1, y1]); return; }
  const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * rough;
  const my = (y0 + y1) / 2 + (Math.random() - 0.5) * rough;
  bolt(x0, y0, mx, my, rough / 2, depth - 1, out);
  bolt(mx, my, x1, y1, rough / 2, depth - 1, out);
}

/**
 * flame(canvas, target): returns { set(level), stop() }. level 0 is off, 1 is fire, 2 is fire
 * with lightning. The canvas should sit behind target and extend past it.
 */
export function flame(canvas, target, { onStrike } = {}) {
  const ctx = canvas.getContext('2d');
  let sprites = null;
  let level = 0, raf = 0, last = 0, W = 0, H = 0, cx = 0, cy = 0, R = 0, nextBolt = 0, flash = 0;
  let parts = [], bolts = [], light = true;

  function size() {
    const r = canvas.getBoundingClientRect(), t = target.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = t.left - r.left + t.width / 2; cy = t.top - r.top + t.height / 2; R = t.width / 2;
  }

  function spawn(n) {
    for (let i = 0; i < n; i++) {
      // flames lick up from the top and sides of the comb; a few from anywhere
      const a = Math.random() < 0.8 ? -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.55 : Math.random() * Math.PI * 2;
      const r = R * (0.74 + Math.random() * 0.24);
      const ember = Math.random() < 0.07;
      const big = level === 2 ? 1.15 : 1;
      parts.push({
        x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.9,
        vx: Math.cos(a) * 26 + (Math.random() - 0.5) * 20, vy: -(70 + Math.random() * 80) * big,
        t: 0, life: ember ? 1.3 + Math.random() * 0.9 : (0.45 + Math.random() * 0.45) * big,
        s: ember ? 1.6 + Math.random() * 1.8 : (7 + Math.random() * 9) * big,
        seed: Math.random() * 10, ember,
      });
    }
  }

  function strike() {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7; // mostly up and out the sides
    const r0 = R * 0.78, r1 = R * (1.35 + Math.random() * 0.4);
    const a1 = a + (Math.random() - 0.5) * 0.5;
    const segs = [];
    const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
    bolt(x0, y0, x1, y1, R * 0.42, 6, segs);
    for (let f = 0; f < 2; f++) if (Math.random() < 0.7) { // forks off the middle
      const [mx, my] = segs[Math.floor(segs.length * (0.35 + Math.random() * 0.3))];
      const fa = a1 + (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.4);
      bolt(mx, my, mx + Math.cos(fa) * R * 0.5, my + Math.sin(fa) * R * 0.5, R * 0.2, 4, segs);
    }
    bolts.push({ segs, t: 0, life: 0.32 });
    flash = 1;
    onStrike?.();
  }

  function tick(now) {
    if (!canvas.isConnected) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (document.hidden) return;
    if (level) {
      const want = (level === 2 ? 150 : 115) * dt;
      spawn(Math.floor(want) + (Math.random() < want % 1 ? 1 : 0));
      if (level === 2 && now > nextBolt) { strike(); if (Math.random() < 0.4) strike(); nextBolt = now + 450 + Math.random() * 1100; }
    }
    ctx.clearRect(0, 0, W, H);
    // on dark paper light adds up like real fire; on light paper it would wash out, so paint over
    ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
    // a breath of light behind the comb that flares with each strike
    if (!light && (level || flash > 0)) {
      const glow = 0.2 + (level === 2 ? 0.08 : 0) + flash * 0.35;
      ctx.globalAlpha = glow;
      ctx.drawImage(sprites.gold, cx - R * 1.7, cy - R * 1.7, R * 3.4, R * 3.4);
      flash = Math.max(0, flash - dt * 4);
    }
    parts = parts.filter((p) => p.t < p.life);
    for (const p of parts) {
      p.t += dt;
      p.vy -= (p.ember ? 70 : 230) * dt; // heat rises, faster as it goes
      p.vx += Math.sin(p.t * 10 + p.seed) * 70 * dt; // and flickers side to side
      p.vx *= Math.exp(-2.5 * dt); // tongues pull back toward upright
      p.x += p.vx * dt; p.y += p.vy * dt;
      const f = p.t / p.life;
      if (p.ember) {
        ctx.globalAlpha = Math.max(0, 1 - f);
        ctx.drawImage(sprites.hot, p.x - p.s * 2, p.y - p.s * 2, p.s * 4, p.s * 4);
        continue;
      }
      const img = f < 0.22 ? sprites.hot : f < 0.45 ? sprites.gold : f < 0.72 ? sprites.orange : sprites.red;
      const s = p.s * (f < 0.25 ? 0.7 + f * 1.4 : 1.05 - (f - 0.25) * 1.1); // swells, then thins out
      const stretch = 1.5 + Math.min(1.2, -p.vy / 200); // taller the faster it climbs
      ctx.globalAlpha = Math.max(0, (1 - f) ** 1.1) * (light ? 0.85 : 0.8);
      ctx.drawImage(img, p.x - s, p.y - s * stretch * 0.8, s * 2, s * 2 * stretch);
    }
    bolts = bolts.filter((b) => b.t < b.life);
    if (bolts.length) {
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffd36b';
      for (const b of bolts) {
        b.t += dt;
        const a = (1 - b.t / b.life) * (0.55 + Math.random() * 0.45); // flicker
        const outer = light ? `rgba(230,130,20,${a * 0.6})` : `rgba(255,190,70,${a * 0.5})`;
        const core = light ? `rgba(255,236,170,${a})` : `rgba(255,252,235,${a})`;
        for (const [w, col, blur] of [[9, outer, 22], [3, core, 10]]) {
          ctx.lineWidth = w; ctx.strokeStyle = col; ctx.shadowBlur = blur;
          ctx.beginPath();
          for (const [x0, y0, x1, y1] of b.segs) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    if (!level && !parts.length && !bolts.length && flash <= 0) { cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, W, H); }
  }

  const onResize = () => { if (raf) size(); };
  window.addEventListener('resize', onResize);

  return {
    set(l) {
      if (calm()) l = 0;
      if (l === level) return;
      level = l;
      if (!l || raf) return;
      light = !/dark/.test(getComputedStyle(canvas).colorScheme || '');
      sprites = light
        ? { hot: sprite('255,214,92'), gold: sprite('255,170,30'), orange: sprite('240,96,18'), red: sprite('190,40,12') }
        : { hot: sprite('255,244,200'), gold: sprite('255,196,58'), orange: sprite('255,122,26'), red: sprite('194,48,10') };
      size();
      last = performance.now();
      nextBolt = last + 400;
      raf = requestAnimationFrame(tick);
    },
    stop() { level = 0; cancelAnimationFrame(raf); raf = 0; window.removeEventListener('resize', onResize); },
  };
}
