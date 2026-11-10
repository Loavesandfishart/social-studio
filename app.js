/* Loaves and Fish Social Studio
   Everything runs in the browser. No uploads leave the device. */
'use strict';

/* ---------- brand tokens (from loavesandfish.in/assets/style.css) ---------- */
const C = { paper:'#FFF8EC', paper2:'#FFF1D6', ink:'#1E1B2E', ink2:'#4A4560', muted:'#7A7490',
  sun:'#FFC93C', coral:'#FF6B6B', teal:'#2EC4B6', lilac:'#B8A4FF', mint:'#C7F2E3', pink:'#FFD6E0', white:'#FFFFFF' };
const CHIP_COLORS = [C.sun, C.mint, C.pink, C.lilac, C.teal];
const F = { head:'"Fredoka"', body:'"Nunito"', hand:'"Caveat"' };
const font = (w, s, f) => `${w} ${Math.max(1, Math.round(s))}px ${f}, sans-serif`;

/* ---------- output sizes ---------- */
const FORMATS = [
  { id:'ig34', name:'Instagram feed 3:4', w:1080, h:1440, use:'Instagram feed posts and carousels (matches the 3:4 profile grid)' },
  { id:'p45',  name:'Portrait 4:5',       w:1080, h:1350, use:'Instagram scheduled or boosted posts, Facebook feed, Threads' },
  { id:'sq',   name:'Square 1:1',         w:1080, h:1080, use:'Facebook, LinkedIn, WhatsApp Business catalogue' },
  { id:'v916', name:'Reel / Story 9:16',  w:1080, h:1920, use:'Instagram Reels and Stories, YouTube Shorts, Facebook Reels, WhatsApp Status', safe:true },
  { id:'pin',  name:'Pinterest 2:3',      w:1000, h:1500, use:'Pinterest pins (gift-idea boards)' },
  { id:'wide', name:'Landscape 16:9',     w:1920, h:1080, use:'YouTube video and thumbnail, X, LinkedIn' },
];

const TEMPLATES = [
  { id:'spotlight', name:'Spotlight', desc:'Full-bleed photo, callout card' },
  { id:'polaroid',  name:'Polaroid',  desc:'Photo in a tilted print on paper' },
  { id:'before',    name:'Photo → Ink', desc:'Original photo next to the drawing' },
  { id:'ink',       name:'Ink frame', desc:'Dark ink background, framed artwork' },
  { id:'clean',     name:'Clean reel', desc:'Minimal overlay for reels' },
  { id:'proof',     name:'Proof', desc:'Customer photo → artwork, for approval' },
];

const PRESET_CHIPS = [
  'Pen-drawn in ink', 'A4 illustration ₹500', 'Framed ₹650', 'Colour +₹100',
  'White ink on black paper', 'Free shipping above ₹1,250', 'Up to 2 people per portrait',
  'Made by hand in Chennai', 'Bulk gifting for teams', 'Order from your phone',
];

/* ---------- state ---------- */
const S = {
  files: [], sel: 0, second: null,
  template: 'spotlight', fmt: 'ig34',
  exportFmts: new Set(['ig34', 'v916']),
  text: { eyebrow:'Portraits from your photos', headline:'Your photo, drawn in ink.', sub:'Real pens on real paper.',
          sticker:'₹500', cta:'loavesandfish.in', capA:'your photo', capB:'drawn in ink' },
  chips: ['Pen-drawn in ink', 'Framed ₹650'],
  proof: { mount: 'sheet', tag: 'Black ink · A4', tagSub: 'Unframed', note: 'Proof for approval', watermark: true },
  customChips: [],
  style: 'subtle',
  showLogo: true, showSafe: true, endCard: true, imgDur: 7,
  animStart: null,
};
const SUB = () => S.style === 'subtle';
const SOFT_CHIPS = ['#FFF1D6', '#E6F7F0', '#FDE9EE', '#EEEAFE', '#E3F6F4'];
let KB = 1;            // Ken Burns multiplier used during photo-reel export
let dirty = true;
let exporting = false;

const IMG = {};
const $ = s => document.querySelector(s);
const cur = () => S.files[S.sel] || null;
const fmtById = id => FORMATS.find(f => f.id === id);

/* ---------- drawing primitives ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeOut = x => 1 - Math.pow(1 - x, 3);
const anim = (t, d, dur = 0.55) => t == null ? 1 : (t <= d ? 0 : (SUB() ? easeOut : easeBack)(clamp((t - d) / (SUB() ? dur * 1.4 : dur), 0, 1)));
const fade = (t, d, dur = 0.5) => t == null ? 1 : clamp((t - d) / dur, 0, 1);

function pop(ctx, cx, cy, p, fn) {
  if (p <= 0) return;
  ctx.save(); ctx.globalAlpha *= Math.min(1, p * 1.4);
  const sc = SUB() ? 0.94 + 0.06 * p : p;
  ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
  fn(); ctx.restore();
}
function slide(ctx, p, dy, fn) {
  if (p <= 0) return;
  ctx.save(); ctx.globalAlpha *= clamp(p, 0, 1); ctx.translate(0, (1 - clamp(p, 0, 1)) * dy);
  fn(); ctx.restore();
}
const tilt = deg => SUB() ? 0 : deg * Math.PI / 180;
function card(ctx, x, y, w, h, r, fill, u, sh = 8, shColor = C.ink) {
  if (SUB()) {
    ctx.save();
    if (sh) { ctx.shadowColor = 'rgba(30,27,46,.16)'; ctx.shadowBlur = 34 * u; ctx.shadowOffsetY = 10 * u; }
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.restore();
    ctx.lineWidth = 1.5 * u; ctx.strokeStyle = 'rgba(30,27,46,.12)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
    return;
  }
  if (sh) { ctx.fillStyle = shColor; ctx.beginPath(); ctx.roundRect(x + sh * u, y + sh * u, w, h, r); ctx.fill(); }
  ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.stroke();
}
function pill(ctx, x, y, w, h, fill, u, sh = 4) { card(ctx, x, y, w, h, h / 2, fill, u, SUB() ? 0 : sh); }

function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width <= maxW || !line) line = t; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
function fit(ctx, text, maxW, size, weight, fam, maxLines) {
  let s = size, lines;
  for (;;) {
    ctx.font = font(weight, s, fam);
    lines = wrap(ctx, text, maxW);
    const ok = lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW);
    if (ok || s <= size * 0.45) break;
    s *= 0.93;
  }
  return { lines, size: s };
}
function textBlock(ctx, text, x, y, maxW, o) {
  if (!text) return 0;
  const weight = o.weight || 600, fam = o.fam || F.head;
  const base = SUB() && fam === F.head && o.size > 50 * (o.u || 1) ? o.size * 0.86 : o.size;
  const { lines, size } = fit(ctx, text, maxW, base, SUB() && weight === 600 ? 500 : weight, fam, o.maxLines || 2);
  const lh = size * (o.lh || 1.12);
  if (!o.dry) {
    ctx.font = font(SUB() && weight === 600 ? 500 : weight, size, fam); ctx.fillStyle = o.color || C.ink;
    ctx.textBaseline = 'top'; ctx.textAlign = o.align || 'left';
    const ax = o.align === 'center' ? x + maxW / 2 : o.align === 'right' ? x + maxW : x;
    lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lh));
    if (o.squiggle) {
      const lastW = Math.min(maxW, ctx.measureText(lines[lines.length - 1]).width);
      const sx = o.align === 'center' ? x + (maxW - lastW) / 2 : o.align === 'right' ? x + maxW - lastW : x;
      squiggle(ctx, sx, y + lines.length * lh + size * 0.02, lastW, size * (SUB() ? 0.07 : 0.16), C.sun);
    }
  }
  return lines.length * lh + (o.squiggle ? size * 0.22 : 0);
}
function squiggle(ctx, x, y, w, sw, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = sw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + sw * 0.6);
  const n = Math.max(2, Math.round(w / (sw * 9)));
  for (let i = 1; i <= n; i++) {
    const x1 = x + (w * (i - 0.5)) / n, x2 = x + (w * i) / n;
    ctx.quadraticCurveTo(x1, y + (i % 2 ? -sw * 0.5 : sw * 1.6), x2, y + sw * 0.6);
  }
  ctx.stroke(); ctx.restore();
}

const patCache = {};
function dots(ctx, W, H, u, color) {
  const key = color + Math.round(u * 100) + S.style;
  if (!patCache[key]) {
    const s = Math.max(8, Math.round(22 * u)), c = document.createElement('canvas');
    c.width = c.height = s; const x = c.getContext('2d');
    x.fillStyle = color; x.globalAlpha = SUB() ? 0.5 : 1; x.beginPath(); x.arc(s / 2, s / 2, Math.max(1, 1.6 * u), 0, Math.PI * 2); x.fill();
    patCache[key] = c;
  }
  ctx.save(); ctx.fillStyle = ctx.createPattern(patCache[key], 'repeat'); ctx.fillRect(0, 0, W, H); ctx.restore();
}

function mediaSize(m) {
  if (!m || !m.el) return null;
  return m.type === 'video' ? [m.el.videoWidth, m.el.videoHeight] : [m.el.naturalWidth, m.el.naturalHeight];
}
function drawMedia(ctx, m, x, y, w, h, r = 0, u = 1) {
  ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  const sz = mediaSize(m);
  if (!sz || !sz[0]) {
    ctx.fillStyle = C.paper2; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(30,27,46,.12)'; ctx.lineWidth = 3 * u;
    for (let i = -h; i < w; i += 28 * u) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke(); }
    ctx.fillStyle = C.muted; ctx.font = font(600, Math.min(w, h) * 0.07, F.head);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Add a photo', x + w / 2, y + h / 2);
  } else {
    const s = Math.max(w / sz[0], h / sz[1]) * (m.zoom || 1) * KB;
    const dw = sz[0] * s, dh = sz[1] * s;
    const dx = x + (w - dw) / 2 + (m.ox || 0) * (dw - w) / 2;
    const dy = y + (h - dh) / 2 + (m.oy || 0) * (dh - h) / 2;
    ctx.drawImage(m.el, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawContain(ctx, m, x, y, w, h, bg, u) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  const sz = mediaSize(m);
  if (!sz || !sz[0]) {
    ctx.fillStyle = C.muted; ctx.font = font(600, Math.min(w, h) * 0.07, F.head);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Add the artwork', x + w / 2, y + h / 2);
  } else {
    const s = Math.min(w / sz[0], h / sz[1]) * (m.zoom || 1);
    const dw = sz[0] * s, dh = sz[1] * s;
    const ex = Math.max(0, dw - w) / 2, ey = Math.max(0, dh - h) / 2;
    ctx.drawImage(m.el, x + (w - dw) / 2 + (m.ox || 0) * ex, y + (h - dh) / 2 + (m.oy || 0) * ey, dw, dh);
  }
  ctx.restore();
}

function starPath(ctx, r, n = 14) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = (i * Math.PI) / n, rr = i % 2 ? r * 0.86 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
}
function sticker(ctx, text, cx, cy, r, u, p = 1) {
  if (!text) return;
  if (SUB()) {
    r *= 0.8;
    pop(ctx, cx, cy, p, () => {
      ctx.save(); ctx.shadowColor = 'rgba(30,27,46,.18)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = C.paper; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.lineWidth = 1.5 * u; ctx.strokeStyle = C.coral; ctx.beginPath(); ctx.arc(cx, cy, r - 7 * u, 0, Math.PI * 2); ctx.stroke();
      const { lines, size } = fit(ctx, text, r * 1.35, r * 0.46, 600, F.head, 2);
      ctx.font = font(600, size, F.head); ctx.fillStyle = C.coral; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lh = size * 1.02, y0 = cy - ((lines.length - 1) * lh) / 2;
      lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh + 2 * u));
    });
    return;
  }
  pop(ctx, cx, cy, p, () => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-10 * Math.PI / 180);
    ctx.save(); ctx.translate(6 * u, 6 * u); starPath(ctx, r); ctx.fillStyle = C.ink; ctx.fill(); ctx.restore();
    starPath(ctx, r); ctx.fillStyle = C.coral; ctx.fill(); ctx.lineWidth = 4 * u; ctx.strokeStyle = C.ink; ctx.stroke();
    const { lines, size } = fit(ctx, text, r * 1.3, r * 0.52, 700, F.head, 2);
    ctx.font = font(700, size, F.head); ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lh = size * 1.02, y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, 0, y0 + i * lh));
    ctx.restore();
  });
}

function arrow(ctx, x1, y1, x2, y2, u, color = C.ink, bend = 0.35, ctrl = null) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1;
  const cx = ctrl ? ctrl[0] : mx - dy * bend, cy = ctrl ? ctrl[1] : my + dx * bend;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = (SUB() ? 3 : 6) * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([3 * u, 14 * u]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y2 - cy, x2 - cx), L = 30 * u;
  ctx.beginPath();
  ctx.moveTo(x2 - L * Math.cos(a - 0.5), y2 - L * Math.sin(a - 0.5)); ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - L * Math.cos(a + 0.5), y2 - L * Math.sin(a + 0.5)); ctx.stroke();
  ctx.restore();
}

function polaroid(ctx, m, box, u, cap, rot, p = 1, aspect = 4 / 5) {
  const b = 22 * u, capH = cap ? 80 * u : b;
  let pw = box.w - 2 * b, ph = pw / aspect;
  if (ph + b + capH > box.h) { ph = box.h - b - capH; pw = ph * aspect; }
  const fw = pw + 2 * b, fh = ph + b + capH, cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  pop(ctx, cx, cy, p, () => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((SUB() ? rot * 0.35 : rot) * Math.PI / 180);
    card(ctx, -fw / 2, -fh / 2, fw, fh, 10 * u, C.white, u, 9);
    drawMedia(ctx, m, -fw / 2 + b, -fh / 2 + b, pw, ph, 4 * u, u);
    if (!SUB()) { ctx.lineWidth = 3 * u; ctx.strokeStyle = C.ink; ctx.strokeRect(-fw / 2 + b, -fh / 2 + b, pw, ph); }
    if (cap) {
      const { size } = fit(ctx, cap, fw - 2 * b, 56 * u, 700, F.hand, 1);
      ctx.fillStyle = SUB() ? C.ink2 : C.ink; ctx.font = font(700, size, F.hand); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cap, 0, fh / 2 - capH / 2);
    }
    ctx.restore();
  });
  return { cx, cy, fw, fh };
}

/* ---------- stackable items (measure + draw) ---------- */
function stackH(items, w) {
  const list = items.filter(Boolean);
  return list.reduce((a, it, i) => a + it.h(w) + (i ? it.gap || 0 : 0), 0);
}
function stack(items, x, y, w) {
  let cy = y;
  items.filter(Boolean).forEach((it, i) => { if (i) cy += it.gap || 0; const h = it.h(w); it.draw(x, cy, w, h); cy += h; });
}
function itText(ctx, text, o, p = 1, gap = 0) {
  if (!text) return null;
  return { gap, h: w => textBlock(ctx, text, 0, 0, w, { ...o, dry: true }),
    draw: (x, y, w) => slide(ctx, p, 40 * (o.u || 1), () => textBlock(ctx, text, x, y, w, o)) };
}
function itEyebrow(ctx, text, u, align, p = 1, gap = 0, fill = C.sun) {
  if (!text) return null;
  const size = 30 * u, h = size * 1.75;
  if (SUB()) {
    const sz = 24 * u, label = text.toUpperCase();
    return { gap, h: () => sz * 1.3, draw: (x, y, w) => slide(ctx, p, 10 * u, () => {
      ctx.font = font(800, sz, F.body); ctx.letterSpacing = (3 * u) + 'px';
      ctx.fillStyle = fill === C.sun ? C.coral : fill; ctx.textBaseline = 'top';
      ctx.textAlign = align; const ax = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
      ctx.fillText(label, ax, y, w); ctx.letterSpacing = '0px';
    }) };
  }
  return { gap, h: () => h + 4 * u, draw: (x, y, w) => {
    ctx.font = font(600, size, F.head);
    const tw = Math.min(w - 10 * u, ctx.measureText(text).width + 36 * u);
    const px = align === 'center' ? x + (w - tw) / 2 : align === 'right' ? x + w - tw : x;
    pop(ctx, px + tw / 2, y + h / 2, p, () => {
      ctx.save(); ctx.translate(px + tw / 2, y + h / 2); ctx.rotate(-2 * Math.PI / 180);
      pill(ctx, -tw / 2, -h / 2, tw, h, fill, u, 0);
      ctx.fillStyle = C.ink; ctx.font = font(600, size, F.head); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, 0, 2 * u, tw - 24 * u); ctx.restore();
    });
  } };
}
function itChips(ctx, chips, u, align, t, delay, gap = 0) {
  if (!chips.length) return null;
  const size = (SUB() ? 26 : 30) * u, padX = 20 * u, h = size * 1.75, g = 12 * u;
  const cWeight = SUB() ? 700 : 800;
  const layout = w => {
    ctx.font = font(800, size, F.body);
    const rows = [[]]; let rw = 0;
    chips.forEach((txt, i) => {
      const cw = Math.min(w, ctx.measureText(txt).width + padX * 2);
      if (rw && rw + g + cw > w) { rows.push([]); rw = 0; }
      rows[rows.length - 1].push({ txt, cw, i }); rw += (rw ? g : 0) + cw;
    });
    return rows;
  };
  return { gap, h: w => { const r = layout(w); return r.length * h + (r.length - 1) * g + 6 * u; },
    draw: (x, y, w) => {
      layout(w).forEach((row, ri) => {
        const total = row.reduce((a, b) => a + b.cw, 0) + g * (row.length - 1);
        let sx = align === 'center' ? x + (w - total) / 2 : align === 'right' ? x + w - total : x;
        row.forEach(it => {
          const cx = sx + it.cw / 2, cy = y + ri * (h + g) + h / 2;
          pop(ctx, cx, cy, anim(t, delay + it.i * 0.18), () => {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(tilt(it.i % 2 ? 1.5 : -1.5));
            pill(ctx, -it.cw / 2, -h / 2, it.cw, h, (SUB() ? SOFT_CHIPS : CHIP_COLORS)[it.i % CHIP_COLORS.length], u);
            ctx.fillStyle = SUB() ? C.ink2 : C.ink; ctx.font = font(cWeight, size, F.body); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(it.txt, 0, 2 * u, it.cw - padX); ctx.restore();
          });
          sx += it.cw + g;
        });
      });
    } };
}
function itCta(ctx, text, u, align, p = 1, gap = 0, fill = C.ink, color = C.paper) {
  if (!text) return null;
  if (SUB() && fill === C.sun) { fill = C.paper; color = C.ink; }
  const size = (SUB() ? 28 : 32) * u, h = size * 1.9;
  return { gap, h: () => h + 6 * u, draw: (x, y, w) => {
    const label = text + '  →';
    ctx.font = font(800, size, F.body);
    const tw = Math.min(w - 8 * u, ctx.measureText(label).width + 52 * u);
    const px = align === 'center' ? x + (w - tw) / 2 : align === 'right' ? x + w - tw : x;
    pop(ctx, px + tw / 2, y + h / 2, p, () => {
      pill(ctx, px, y, tw, h, fill, u, fill === C.ink ? 0 : 5);
      ctx.fillStyle = color; ctx.font = font(800, size, F.body); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, px + tw / 2, y + h / 2 + 2 * u, tw - 30 * u);
    });
  } };
}
function itLogo(ctx, u, align, width, p = 1, gap = 0, onInk = false) {
  if (!S.showLogo) return null;
  if (onInk) {
    const img = IMG.ink, sx = img.width * 0.13, sy = img.height * 0.24, sw = img.width * 0.74, sh = img.height * 0.6;
    const h = width * sh / sw;
    return { gap, h: () => h, draw: (x, y, w) => {
      const px = align === 'center' ? x + (w - width) / 2 : align === 'right' ? x + w - width : x;
      slide(ctx, p, -20 * u, () => ctx.drawImage(img, sx, sy, sw, sh, px, y, width, h));
    } };
  }
  const img = IMG.logo, lh = width * img.height / img.width, padX = 26 * u, padY = 16 * u;
  const bw = width + padX * 2, bh = lh + padY * 2;
  return { gap, h: () => bh + 6 * u, draw: (x, y, w) => {
    const px = align === 'center' ? x + (w - bw) / 2 : align === 'right' ? x + w - bw : x;
    slide(ctx, p, -20 * u, () => { card(ctx, px, y, bw, bh, 22 * u, SUB() ? 'rgba(255,248,236,.94)' : C.paper, u, 5); ctx.drawImage(img, px + padX, y + padY, width, lh); });
  } };
}

/* ---------- templates ---------- */
function geo(fmt) {
  const W = fmt.w, H = fmt.h, u = Math.min(W, H) / 1080, pad = 60 * u;
  return { W, H, u, pad, land: W / H > 1.2, top: fmt.safe ? H * 0.12 : pad, bot: fmt.safe ? H * 0.17 : pad };
}
function chipList() { return S.chips.slice(0, 4); }

const DRAW = {
  spotlight(ctx, fmt, m, t) {
    const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text;
    drawMedia(ctx, m, 0, 0, W, H, 0, u);
    if (S.showLogo) itLogo(ctx, u, 'left', 260 * u, fade(t, 0.1)).draw(pad, top, W);
    sticker(ctx, T.sticker, W - pad - 105 * u, top + 105 * u, 105 * u, u, anim(t, 0.7));
    const cw = land ? W * 0.46 : W - pad * 2, ip = 40 * u, iw = cw - ip * 2;
    const items = [
      itEyebrow(ctx, T.eyebrow, u, 'left', anim(t, 0.45)),
      itText(ctx, T.headline, { size: 84 * u, color: C.ink, maxLines: 2, u }, fade(t, 0.35), 16 * u),
      itText(ctx, T.sub, { size: 36 * u, weight: 700, fam: F.body, color: C.ink2, maxLines: 2, lh: 1.25, u }, fade(t, 0.5), 10 * u),
      itChips(ctx, chipList(), u, 'left', t, 0.9, 22 * u),
      itCta(ctx, T.cta, u, 'left', anim(t, 1.4), 24 * u),
    ];
    const ch = stackH(items, iw) + ip * 2, cy = H - bot - ch;
    slide(ctx, fade(t, 0.2), 80 * u, () => card(ctx, pad, cy, cw, ch, 30 * u, C.paper, u, 9));
    stack(items, pad + ip, cy + ip, iw);
  },

  polaroid(ctx, fmt, m, t) {
    const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text;
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); dots(ctx, W, H, u, 'rgba(30,27,46,.09)');
    if (land) {
      const colW = W * 0.46;
      const items = [itLogo(ctx, u, 'left', 300 * u, fade(t, 0.1)),
        itEyebrow(ctx, T.eyebrow, u, 'left', anim(t, 0.4), 36 * u),
        itText(ctx, T.headline, { size: 88 * u, maxLines: 3, u, squiggle: true }, fade(t, 0.3), 16 * u),
        itText(ctx, T.sub, { size: 36 * u, weight: 700, fam: F.body, color: C.ink2, maxLines: 2, lh: 1.25, u }, fade(t, 0.5), 12 * u),
        itChips(ctx, chipList(), u, 'left', t, 1.0, 26 * u),
        itCta(ctx, T.cta, u, 'left', anim(t, 1.5), 28 * u)];
      const h = stackH(items, colW); stack(items, pad, (H - h) / 2, colW);
      const box = { x: W * 0.52, y: pad, w: W * 0.48 - pad, h: H - pad * 2 };
      const pr = polaroid(ctx, m, box, u, T.capA, 3, anim(t, 0.2));
      sticker(ctx, T.sticker, pr.cx + pr.fw / 2 - 40 * u, pr.cy - pr.fh / 2 + 40 * u, 95 * u, u, anim(t, 0.8));
      return;
    }
    const w = W - pad * 2;
    const head = [itLogo(ctx, u, 'center', 300 * u, fade(t, 0.1)),
      itEyebrow(ctx, T.eyebrow, u, 'center', anim(t, 0.4), 26 * u),
      itText(ctx, T.headline, { size: 80 * u, maxLines: 2, align: 'center', u }, fade(t, 0.3), 12 * u)];
    const foot = [itText(ctx, T.sub, { size: 34 * u, weight: 700, fam: F.body, color: C.ink2, maxLines: 2, lh: 1.25, align: 'center', u }, fade(t, 0.6)),
      itChips(ctx, chipList(), u, 'center', t, 1.0, 20 * u),
      itCta(ctx, T.cta, u, 'center', anim(t, 1.5), 22 * u)];
    const hh = stackH(head, w), fh = stackH(foot, w);
    stack(head, pad, top, w);
    stack(foot, pad, H - bot - fh, w);
    const box = { x: pad * 1.4, y: top + hh + 34 * u, w: W - pad * 2.8, h: H - bot - fh - top - hh - 68 * u };
    const pr = polaroid(ctx, m, box, u, T.capA, -3, anim(t, 0.2));
    sticker(ctx, T.sticker, pr.cx + pr.fw / 2 - 20 * u, pr.cy + pr.fh / 2 - 150 * u, 100 * u, u, anim(t, 0.8));
  },

  before(ctx, fmt, m, t) {
    const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text;
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); dots(ctx, W, H, u, 'rgba(30,27,46,.09)');
    const w = W - pad * 2, tall = H / W > 1.15;
    const head = [itLogo(ctx, u, 'center', 280 * u, fade(t, 0.1)),
      itText(ctx, T.headline, { size: 80 * u, maxLines: 2, align: 'center', u, squiggle: true }, fade(t, 0.25), 20 * u)];
    const foot = [itChips(ctx, chipList(), u, 'center', t, 2.0), itCta(ctx, T.cta, u, 'center', anim(t, 2.5), 20 * u)];
    const hh = stackH(head, w), fh = stackH(foot, w);
    stack(head, pad, top, w); stack(foot, pad, H - bot - fh, w);
    const ay = top + hh + 30 * u, ah = H - bot - fh - ay - 30 * u;
    let bA, bB;
    if (tall) {
      bA = { x: pad * 0.6, y: ay, w: W * 0.6, h: ah * 0.54 };
      bB = { x: W - pad * 0.6 - W * 0.6, y: ay + ah * 0.46, w: W * 0.6, h: ah * 0.54 };
    } else {
      const bw = (w - 60 * u) / 2;
      bA = { x: pad, y: ay, w: bw, h: ah }; bB = { x: pad + bw + 60 * u, y: ay, w: bw, h: ah };
    }
    const pa = polaroid(ctx, S.second, bA, u, T.capA, -4, anim(t, 0.4));
    const pb = polaroid(ctx, m, bB, u, T.capB, 3, anim(t, 1.3));
    const pa2 = fade(t, 0.9);
    if (pa2 > 0) {
      ctx.save(); ctx.globalAlpha *= pa2;
      if (tall) arrow(ctx, pa.cx + pa.fw / 2 + 10 * u, pa.cy - pa.fh * 0.1, pb.cx + pb.fw * 0.2, pb.cy - pb.fh / 2 - 16 * u, u, C.ink, -0.45);
      else arrow(ctx, pa.cx + pa.fw / 2 - 10 * u, pa.cy - pa.fh * 0.38, pb.cx - pb.fw / 2 + 10 * u, pb.cy - pb.fh * 0.38, u, C.ink, -0.4);
      ctx.restore();
    }
    sticker(ctx, T.sticker, pb.cx + pb.fw / 2 - 10 * u, pb.cy - pb.fh / 2 + 10 * u, 90 * u, u, anim(t, 1.8));
  },

  ink(ctx, fmt, m, t) {
    const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text;
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H); dots(ctx, W, H, u, 'rgba(255,248,236,.07)');
    const textItems = al => [
      itEyebrow(ctx, T.eyebrow, u, al, anim(t, 0.5)),
      itText(ctx, T.headline, { size: 80 * u, color: C.paper, maxLines: 2, align: al, u, squiggle: true }, fade(t, 0.4), 16 * u),
      itText(ctx, T.sub, { size: 34 * u, weight: 700, fam: F.body, color: 'rgba(255,248,236,.82)', maxLines: 2, lh: 1.25, align: al, u }, fade(t, 0.6), 12 * u),
      itChips(ctx, chipList(), u, al, t, 1.0, 22 * u),
      itCta(ctx, T.cta, u, al, anim(t, 1.5), 24 * u, C.sun, C.ink)];
    const frame = (x, y, w, h) => {
      const b = 16 * u;
      slide(ctx, fade(t, 0.15), 50 * u, () => {
        if (!SUB()) { ctx.fillStyle = C.sun; ctx.beginPath(); ctx.roundRect(x + 14 * u, y + 14 * u, w, h, 22 * u); ctx.fill(); }
        ctx.fillStyle = C.paper; ctx.beginPath(); ctx.roundRect(x, y, w, h, 22 * u); ctx.fill();
        drawMedia(ctx, m, x + b, y + b, w - 2 * b, h - 2 * b, 12 * u, u);
      });
      sticker(ctx, T.sticker, x + w - 30 * u, y + 30 * u, 100 * u, u, anim(t, 0.9));
    };
    if (land) {
      const fw = W * 0.44;
      frame(pad, pad, fw, H - pad * 2 - 14 * u);
      const colW = W - fw - pad * 3.4;
      const items = [itLogo(ctx, u, 'left', 420 * u, fade(t, 0.1), 0, true), ...textItems('left').map((it, i) => it && i === 0 ? { ...it, gap: 30 * u } : it)];
      const h = stackH(items, colW); stack(items, W - pad - colW, (H - h) / 2, colW);
      return;
    }
    const w = W - pad * 2;
    const logo = itLogo(ctx, u, 'center', 440 * u, fade(t, 0.1), 0, true);
    const lh = logo ? logo.h() : 0;
    if (logo) logo.draw(pad, top, w);
    const items = textItems('center'), fh = stackH(items, w);
    stack(items, pad, H - bot - fh, w);
    const fy = top + lh + 34 * u, fhh = H - bot - fh - fy - 50 * u;
    const fw = Math.min(w - 20 * u, fhh * 0.8);
    frame((W - fw) / 2 - 7 * u, fy, fw, fhh);
  },

  clean(ctx, fmt, m, t) {
    const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text;
    drawMedia(ctx, m, 0, 0, W, H, 0, u);
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, 'rgba(30,27,46,0)'); g.addColorStop(1, SUB() ? 'rgba(30,27,46,.5)' : 'rgba(30,27,46,.72)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // stacked callouts top-left
    const size = 32 * u, h = size * 1.8;
    chipList().forEach((txt, i) => {
      ctx.font = font(800, size, F.body);
      const cw = Math.min(W * 0.7, ctx.measureText(txt).width + 44 * u), y = top + i * (h + 16 * u);
      pop(ctx, pad + cw / 2, y + h / 2, anim(t, 0.3 + i * 0.35), () => {
        ctx.save(); ctx.translate(pad + cw / 2, y + h / 2); ctx.rotate(tilt(i % 2 ? 1.5 : -1.5));
        pill(ctx, -cw / 2, -h / 2, cw, h, SUB() ? 'rgba(255,248,236,.92)' : CHIP_COLORS[i % CHIP_COLORS.length], u);
        ctx.fillStyle = SUB() ? C.ink2 : C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font(800, size, F.body);
        ctx.fillText(txt, 0, 2 * u, cw - 24 * u); ctx.restore();
      });
    });
    sticker(ctx, T.sticker, W - pad - 100 * u, top + 100 * u, 100 * u, u, anim(t, 1.6));
    const colW = land ? W * 0.5 : W - pad * 2;
    const items = [itText(ctx, T.headline, { size: 76 * u, color: C.paper, maxLines: 2, u }, fade(t, 0.8)),
      itCta(ctx, T.cta, u, 'left', anim(t, 1.2), 20 * u, C.sun, C.ink),
      itLogo(ctx, u, 'left', 230 * u, fade(t, 0.1), 24 * u)];
    const ih = stackH(items, colW); stack(items, pad, H - bot - ih, colW);
  },
};

DRAW.proof = function (ctx, fmt, m, t) {
  const { W, H, u, pad, land, top, bot } = geo(fmt), T = S.text, P = S.proof;
  const black = P.mount === 'black';
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H); dots(ctx, W, H, u, 'rgba(30,27,46,.09)');
  // header: logo left, note right
  const logo = itLogo(ctx, u, 'left', 250 * u, fade(t, 0.1));
  const lh = logo ? logo.h() : 0;
  if (logo) logo.draw(pad, top, W);
  if (P.note) {
    ctx.save(); ctx.font = font(800, 24 * u, F.body); ctx.letterSpacing = (3 * u) + 'px';
    ctx.fillStyle = C.coral; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(P.note.toUpperCase(), W - pad, top + Math.max(lh, 40 * u) / 2); ctx.restore();
  }
  // footer: style label
  const tagH = 64 * u;
  if (P.tag) {
    ctx.font = font(800, 30 * u, F.body);
    const tw = ctx.measureText(P.tag).width + 52 * u, ty = H - bot - tagH;
    ctx.save(); ctx.fillStyle = C.white; ctx.strokeStyle = 'rgba(30,27,46,.14)'; ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.roundRect(pad, ty, tw, tagH, tagH / 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(P.tag, pad + 26 * u, ty + tagH / 2 + 2 * u);
    if (P.tagSub) { ctx.font = font(800, 24 * u, F.body); ctx.fillStyle = C.muted; ctx.fillText(P.tagSub, pad + tw + 24 * u, ty + tagH / 2 + 2 * u); }
    ctx.restore();
  }
  // artwork area
  const ay = top + Math.max(lh, 40 * u) + 40 * u, ah = H - bot - tagH - 44 * u - ay;
  const hasPhoto = !!S.second;
  const framed = P.mount === 'frame';
  const outerAspect = 1 / 1.414;
  let aw = Math.min(ah * outerAspect, (hasPhoto ? 0.56 : 0.8) * W);
  let ahh = aw / outerAspect;
  const acx = hasPhoto ? (land ? W * 0.6 : W * 0.6) : W / 2, acy = ay + ah / 2;
  const x0 = acx - aw / 2, y0 = acy - ahh / 2;
  slide(ctx, fade(t, 0.2), 40 * u, () => {
    ctx.save(); ctx.shadowColor = 'rgba(30,27,46,.22)'; ctx.shadowBlur = 40 * u; ctx.shadowOffsetY = 16 * u;
    ctx.fillStyle = framed ? '#24212C' : black ? '#16141C' : C.white; ctx.fillRect(x0, y0, aw, ahh); ctx.restore();
    let ix = x0, iy = y0, iw = aw, ih = ahh;
    if (framed) {
      const fw = aw * 0.075; ctx.strokeStyle = '#3A3644'; ctx.lineWidth = 2 * u; ctx.strokeRect(x0 + 3 * u, y0 + 3 * u, aw - 6 * u, ahh - 6 * u);
      ix += fw; iy += fw; iw -= 2 * fw; ih -= 2 * fw;
      ctx.fillStyle = '#FCFBF7'; ctx.fillRect(ix, iy, iw, ih);
      const mat = aw * 0.09; ix += mat; iy += mat; iw -= 2 * mat; ih -= 2 * mat;
    } else {
      const p = aw * 0.06; ix += p; iy += p; iw -= 2 * p; ih -= 2 * p;
    }
    drawContain(ctx, m, ix, iy, iw, ih, black ? '#16141C' : C.white, u);
    if (framed) { ctx.strokeStyle = 'rgba(30,27,46,.18)'; ctx.lineWidth = 1.5 * u; ctx.strokeRect(ix, iy, iw, ih); }
    if (P.watermark) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, aw, ahh); ctx.clip();
      ctx.translate(acx, acy); ctx.rotate(-30 * Math.PI / 180);
      ctx.font = font(700, 30 * u, F.head); ctx.fillStyle = black ? 'rgba(255,248,236,.16)' : 'rgba(30,27,46,.10)';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let yy = -ahh; yy <= ahh; yy += 110 * u) for (let xx = -aw; xx <= aw; xx += 360 * u)
        ctx.fillText('PROOF · loavesandfish.in', xx + ((yy / (110 * u)) % 2 ? 180 * u : 0), yy);
      ctx.restore();
    }
  });
  if (hasPhoto) {
    const pw = Math.min(W * 0.27, aw * 0.6);
    const box = { x: Math.max(pad * 0.5, x0 - pw * 1.05), y: y0 + ahh * 0.42, w: pw, h: pw * 1.3 };
    const pr = polaroid(ctx, S.second, box, u, T.capA, -4, anim(t, 0.6));
    const p2 = fade(t, 1.0);
    if (p2 > 0) { ctx.save(); ctx.globalAlpha *= p2;
      // up from the top of the photo, then level into the artwork's left edge
      const sx = pr.cx, sy = pr.cy - pr.fh / 2 - 22 * u, ex = x0 - 16 * u, ey = Math.min(sy - 70 * u, y0 + ahh * 0.32);
      arrow(ctx, sx, sy, ex, ey, u, C.ink2, 0, [sx, ey]); ctx.restore(); }
  }
};

function drawEndCard(ctx, fmt, et) {
  const { W, H, u, pad } = geo(fmt), a = clamp(et / 0.4, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H); dots(ctx, W, H, u, 'rgba(255,248,236,.07)');
  const w = W - pad * 2;
  const items = [itLogo(ctx, u, 'center', Math.min(W * 0.75, 700 * u), anim(et, 0.1), 0, true) || itText(ctx, 'Loaves and Fish', { size: 90 * u, color: C.paper, align: 'center', u }),
    itText(ctx, 'Your photo, drawn in ink.', { size: 64 * u, fam: F.hand, weight: 700, color: C.paper, align: 'center', maxLines: 2, u }, fade(et, 0.5), 34 * u),
    itCta(ctx, S.text.cta || 'loavesandfish.in', u, 'center', anim(et, 0.9), 34 * u, C.sun, C.ink)];
  const h = stackH(items, w); stack(items, pad, (H - h) / 2, w);
  ctx.restore();
}

function render(ctx, fmt, m, t) {
  ctx.save(); ctx.clearRect(0, 0, fmt.w, fmt.h);
  ctx.textBaseline = 'top';
  (DRAW[S.template] || DRAW.spotlight)(ctx, fmt, m, t);
  ctx.restore();
}

/* ---------- preview ---------- */
const cv = $('#cv'), pctx = cv.getContext('2d');
function previewTime() {
  const m = cur();
  if (m && m.type === 'video') return Math.max(0, m.el.currentTime - (m.trimStart || 0));
  if (S.animStart != null) {
    const t = (performance.now() - S.animStart) / 1000;
    if (t < 4) return t;
    S.animStart = null;
  }
  return null;
}
function drawPreview() {
  const fmt = fmtById(S.fmt);
  if (cv.width !== fmt.w || cv.height !== fmt.h) { cv.width = fmt.w; cv.height = fmt.h; }
  render(pctx, fmt, cur(), previewTime());
  if (fmt.safe && S.showSafe) {
    const { W, H, top, bot, u } = geo(fmt);
    pctx.save(); pctx.fillStyle = 'rgba(255,107,107,.16)';
    pctx.fillRect(0, 0, W, top); pctx.fillRect(0, H - bot, W, bot);
    pctx.strokeStyle = C.coral; pctx.setLineDash([16, 10]); pctx.lineWidth = 3;
    pctx.beginPath(); pctx.moveTo(0, top); pctx.lineTo(W, top); pctx.moveTo(0, H - bot); pctx.lineTo(W, H - bot); pctx.stroke();
    pctx.fillStyle = C.coral; pctx.font = font(800, 26 * u, F.body); pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
    pctx.fillText('App buttons cover this area (preview only)', W / 2, top / 2);
    pctx.fillText('Caption and buttons cover this area (preview only)', W / 2, H - bot / 2);
    pctx.restore();
  }
}
function loop() {
  const m = cur();
  if (!exporting) {
    const vid = m && m.type === 'video';
    if (vid) {
      const v = m.el;
      if (v.currentTime < m.trimStart - 0.05 || v.currentTime > m.trimEnd) v.currentTime = m.trimStart;
      if (v.paused) v.play().catch(() => {});
    }
    if (dirty || vid || S.animStart != null) { drawPreview(); dirty = false; }
  }
  requestAnimationFrame(loop);
}

/* ---------- UI ---------- */
function buildUI() {
  $('#tpls').innerHTML = TEMPLATES.map(t => `<button class="tpl" data-t="${t.id}"><b>${t.name}</b><small>${t.desc}</small></button>`).join('');
  $('#tpls').onclick = e => { const b = e.target.closest('.tpl'); if (!b) return; S.template = b.dataset.t; syncUI(); };

  $('#fmtTabs').innerHTML = FORMATS.map(f => `<button data-f="${f.id}">${f.name}</button>`).join('');
  $('#fmtTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.fmt = b.dataset.f; syncUI(); };

  $('#fmtChecks').innerHTML = FORMATS.map(f => `<label class="check"><input type="checkbox" value="${f.id}" ${S.exportFmts.has(f.id) ? 'checked' : ''}> ${f.name} <span class="muted">${f.w}×${f.h}</span></label>`).join('');
  $('#fmtChecks').onchange = e => { e.target.checked ? S.exportFmts.add(e.target.value) : S.exportFmts.delete(e.target.value); };

  $('#guide').innerHTML = '<tr><th>Size</th><th>Use it for</th></tr>' + FORMATS.map(f => `<tr><td><b>${f.name}</b><br><span class="muted">${f.w}×${f.h}</span></td><td>${f.use}</td></tr>`).join('');

  document.querySelectorAll('[data-k]').forEach(inp => {
    inp.value = S.text[inp.dataset.k];
    inp.oninput = () => { S.text[inp.dataset.k] = inp.value; dirty = true; };
  });

  renderChips();
  $('#chips').onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const c = b.dataset.c, i = S.chips.indexOf(c);
    if (i >= 0) S.chips.splice(i, 1); else if (S.chips.length < 4) S.chips.push(c);
    renderChips(); dirty = true;
  };
  const addChip = () => { const v = $('#chipIn').value.trim(); if (!v) return;
    if (!PRESET_CHIPS.includes(v) && !S.customChips.includes(v)) S.customChips.push(v);
    if (!S.chips.includes(v) && S.chips.length < 4) S.chips.push(v);
    $('#chipIn').value = ''; renderChips(); dirty = true; };
  $('#chipAdd').onclick = addChip;
  $('#chipIn').onkeydown = e => { if (e.key === 'Enter') addChip(); };

  const fileIn = $('#fileIn'), drop = $('#drop');
  fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ''; };
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
  $('#fileB').onchange = async e => { const f = e.target.files[0]; if (!f) return; const m = await loadMedia(f); if (m) { S.second = m; $('#slotBName').textContent = m.name; dirty = true; } };

  $('#files').onclick = e => {
    const x = e.target.closest('.x'), f = e.target.closest('.f');
    if (x) { const i = +x.dataset.i; const [m] = S.files.splice(i, 1); if (m.type === 'video') m.el.pause(); URL.revokeObjectURL(m.url); S.sel = Math.min(S.sel, S.files.length - 1); }
    else if (f) select(+f.dataset.i);
    renderFiles(); syncUI();
  };

  $('#zoom').oninput = e => { const m = cur(); if (m) { m.zoom = +e.target.value; dirty = true; } };
  $('#resetPos').onclick = () => { const m = cur(); if (m) { m.zoom = 1; m.ox = 0; m.oy = 0; syncUI(); } };
  $('#style').onchange = e => { S.style = e.target.value; dirty = true; };
  const pr = S.proof;
  $('#pMount').value = pr.mount; $('#pTag').value = pr.tag; $('#pSub').value = pr.tagSub; $('#pNote').value = pr.note; $('#pWm').checked = pr.watermark;
  $('#pMount').onchange = e => {
    pr.mount = e.target.value;
    const auto = { sheet: 'Unframed', frame: 'Framed', black: 'White ink on black paper' };
    if (!pr.tagSub || Object.values(auto).includes(pr.tagSub)) { pr.tagSub = auto[pr.mount]; $('#pSub').value = pr.tagSub; }
    dirty = true;
  };
  $('#pTag').oninput = e => { pr.tag = e.target.value; dirty = true; };
  $('#pSub').oninput = e => { pr.tagSub = e.target.value; dirty = true; };
  $('#pNote').oninput = e => { pr.note = e.target.value; dirty = true; };
  $('#pWm').onchange = e => { pr.watermark = e.target.checked; dirty = true; };
  $('#showLogo').onchange = e => { S.showLogo = e.target.checked; dirty = true; };
  $('#showSafe').onchange = e => { S.showSafe = e.target.checked; dirty = true; };
  $('#endCard').onchange = e => { S.endCard = e.target.checked; };
  $('#imgDur').onchange = e => { S.imgDur = clamp(+e.target.value || 7, 3, 30); e.target.value = S.imgDur; };
  $('#trimS').onchange = e => { const m = cur(); if (m) { m.trimStart = clamp(+e.target.value, 0, m.trimEnd - 0.5); e.target.value = m.trimStart; } };
  $('#trimE').onchange = e => { const m = cur(); if (m) { m.trimEnd = clamp(+e.target.value, m.trimStart + 0.5, m.el.duration); e.target.value = m.trimEnd; } };
  $('#replay').onclick = () => { const m = cur(); if (m && m.type === 'video') m.el.currentTime = m.trimStart; else S.animStart = performance.now(); };

  // drag to pan, wheel to zoom
  let drag = null;
  cv.addEventListener('pointerdown', e => { const m = cur(); if (!m) return; cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, ox: m.ox, oy: m.oy }; });
  cv.addEventListener('pointermove', e => {
    const m = cur(); if (!drag || !m) return;
    const r = cv.getBoundingClientRect();
    m.ox = clamp(drag.ox + (e.clientX - drag.x) / r.width * 2.4, -1, 1);
    m.oy = clamp(drag.oy + (e.clientY - drag.y) / r.height * 2.4, -1, 1);
    dirty = true;
  });
  cv.addEventListener('pointerup', () => drag = null);
  cv.addEventListener('wheel', e => { const m = cur(); if (!m) return; e.preventDefault();
    m.zoom = clamp((m.zoom || 1) * (e.deltaY < 0 ? 1.05 : 0.95), 1, 3); $('#zoom').value = m.zoom; dirty = true; }, { passive: false });

  $('#expImg').onclick = exportImages;
  $('#expVid').onclick = exportVideos;
  const mime = pickMime();
  $('#mimeNote').textContent = !mime ? 'This browser cannot record video. Use Chrome or Safari.'
    : mime.includes('avc1') ? 'Videos save as MP4 (H.264). Keep this tab open and visible while rendering: it records in real time.'
    : mime.startsWith('video/mp4') ? 'This browser saves MP4 without H.264, which Instagram may reject. Use Chrome or Safari on Mac.'
    : 'This browser records WebM, which Instagram does not accept. Use Chrome or Safari for MP4.';
}

function renderChips() {
  const all = [...PRESET_CHIPS, ...S.customChips];
  $('#chips').innerHTML = all.map(c => `<button class="chip ${S.chips.includes(c) ? 'on' : ''}" data-c="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('');
}
function renderFiles() {
  $('#files').innerHTML = S.files.map((m, i) => `<div class="f ${i === S.sel ? 'on' : ''}" data-i="${i}">
    ${m.type === 'video' ? `<video src="${m.url}" muted></video><span class="v">VIDEO</span>` : `<img src="${m.url}" alt="">`}
    <button class="x" data-i="${i}" title="Remove">✕</button></div>`).join('');
}
function select(i) {
  S.files.forEach((m, j) => { if (m.type === 'video' && j !== i) m.el.pause(); });
  S.sel = i;
}
function syncUI() {
  document.querySelectorAll('.tpl').forEach(b => b.classList.toggle('on', b.dataset.t === S.template));
  document.querySelectorAll('#fmtTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === S.fmt));
  $('#slotB').hidden = !['before', 'proof'].includes(S.template);
  $('#proofBox').hidden = S.template !== 'proof';
  const m = cur(), vid = m && m.type === 'video';
  $('#vidCtl').hidden = !vid; $('#imgDurL').hidden = !!vid;
  if (m) { $('#zoom').value = m.zoom; }
  if (vid) { $('#trimS').value = m.trimStart.toFixed(1); $('#trimE').value = m.trimEnd.toFixed(1); }
  dirty = true;
}

async function loadMedia(f) {
  const type = f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'image' : null;
  if (!type) return null;
  const url = URL.createObjectURL(f);
  let el;
  try {
    if (type === 'image') { el = new Image(); el.src = url; await el.decode(); }
    else {
      el = document.createElement('video'); Object.assign(el, { src: url, muted: true, playsInline: true, loop: true, preload: 'auto' });
      await new Promise((res, rej) => { el.onloadeddata = res; el.onerror = rej; });
    }
  } catch { alert(`Could not open ${f.name}. iPhone HEIC photos need converting to JPG first.`); return null; }
  return { name: f.name.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-'), type, url, el, zoom: 1, ox: 0, oy: 0,
    trimStart: 0, trimEnd: type === 'video' ? el.duration : 0 };
}
async function addFiles(list) {
  for (const f of list) { const m = await loadMedia(f); if (m) S.files.push(m); }
  if (S.files.length) select(S.files.length - 1);
  renderFiles(); syncUI();
}

/* ---------- export ---------- */
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function progress(p, txt) {
  $('#prog').hidden = p == null;
  if (p == null) return;
  $('#progBar').style.width = (p * 100).toFixed(1) + '%'; $('#progTxt').textContent = txt;
}
const stamp = () => new Date().toISOString().slice(0, 10);
const fmtList = () => FORMATS.filter(f => S.exportFmts.has(f.id));

async function exportImages() {
  const fmts = fmtList(); if (!fmts.length) return alert('Tick at least one size.');
  const media = $('#allFiles').checked && S.files.length ? S.files : [cur()];
  const type = $('#imgType').value, ext = type === 'jpeg' ? 'jpg' : 'png';
  const out = []; let n = 0; const total = media.length * fmts.length;
  for (const m of media) for (const f of fmts) {
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    render(c.getContext('2d'), f, m, null);
    const blob = await new Promise(r => c.toBlob(r, 'image/' + type, 0.93));
    out.push({ blob, name: `loavesandfish-${S.template}-${f.id}-${m ? m.name : 'blank'}.${ext}` });
    progress(++n / total, `Rendering ${n} of ${total}`);
  }
  if (out.length === 1) saveBlob(out[0].blob, out[0].name);
  else {
    const zip = new JSZip(); out.forEach(o => zip.file(o.name, o.blob));
    saveBlob(await zip.generateAsync({ type: 'blob' }), `loavesandfish-${S.template}-${stamp()}.zip`);
  }
  progress(null);
}

const MIMES = ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
function pickMime() { return window.MediaRecorder ? MIMES.find(m => MediaRecorder.isTypeSupported(m)) : null; }
let AC = null;

async function recordOne(fmt, m, onTick) {
  const c = document.createElement('canvas'); c.width = fmt.w; c.height = fmt.h;
  const ctx = c.getContext('2d');
  const stream = c.captureStream(30);
  const isVid = m && m.type === 'video';
  AC = AC || new AudioContext(); await AC.resume();
  const dest = AC.createMediaStreamDestination();
  // silent tone keeps the audio track alive so the MP4 muxer never stalls (photo reels have no sound)
  const osc = AC.createOscillator(), mute = AC.createGain(); mute.gain.value = 0; osc.connect(mute).connect(dest); osc.start();
  if (isVid) { m.srcNode = m.srcNode || AC.createMediaElementSource(m.el); m.srcNode.connect(dest); }
  dest.stream.getAudioTracks().forEach(tr => stream.addTrack(tr));
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 160_000 });
  const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => rec.onstop = r);
  const mainDur = isVid ? m.trimEnd - m.trimStart : S.imgDur, endDur = S.endCard ? 2.5 : 0;

  let v;
  if (isVid) {
    v = m.el; v.pause(); v.loop = false; v.muted = false;
    v.currentTime = m.trimStart; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
  }
  render(ctx, fmt, m, 0);
  rec.start(500);
  if (isVid) await v.play();
  const t0 = performance.now();
  let endT0 = null;
  await new Promise(res => {
    const tick = () => {
      const now = performance.now();
      if (endT0 == null) {
        const done = isVid ? (v.ended || v.currentTime >= m.trimEnd) : (now - t0) / 1000 >= mainDur;
        if (done) { endT0 = now; if (isVid) v.pause(); }
      }
      if (endT0 == null) {
        const t = isVid ? v.currentTime - m.trimStart : (now - t0) / 1000;
        KB = isVid ? 1 : 1 + 0.08 * (t / mainDur);
        render(ctx, fmt, m, t); onTick(t / (mainDur + endDur));
      } else {
        const et = (now - endT0) / 1000;
        if (et >= endDur) { res(); return; }
        drawEndCard(ctx, fmt, et); onTick((mainDur + et) / (mainDur + endDur));
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  KB = 1;
  rec.stop(); await stopped; osc.stop();
  if (isVid) { m.srcNode.disconnect(); v.muted = true; v.loop = true; }
  const type = mime.split(';')[0];
  return new Blob(chunks, { type });
}

async function exportVideos() {
  const fmts = fmtList(); if (!fmts.length) return alert('Tick at least one size.');
  const m = cur(); if (!m) return alert('Add a photo or video first.');
  if (!pickMime()) return alert('This browser cannot record video. Use Chrome or Safari.');
  exporting = true; $('#expVid').disabled = $('#expImg').disabled = true;
  const ext = pickMime().startsWith('video/mp4') ? 'mp4' : 'webm';
  const out = [];
  try {
    for (let i = 0; i < fmts.length; i++) {
      const f = fmts[i];
      const blob = await recordOne(f, m, p => progress((i + clamp(p, 0, 1)) / fmts.length, `Recording ${f.name} (${i + 1} of ${fmts.length}). Keep this tab visible.`));
      out.push({ blob, name: `loavesandfish-${S.template}-${f.id}-${m.name}.${ext}` });
    }
    if (out.length === 1) saveBlob(out[0].blob, out[0].name);
    else { const zip = new JSZip(); out.forEach(o => zip.file(o.name, o.blob)); saveBlob(await zip.generateAsync({ type: 'blob' }), `loavesandfish-reels-${stamp()}.zip`); }
  } catch (err) { console.error(err); alert('Recording failed: ' + err.message); }
  exporting = false; $('#expVid').disabled = $('#expImg').disabled = false; progress(null); dirty = true;
}

/* ---------- boot ---------- */
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
(async function boot() {
  [IMG.logo, IMG.ink] = await Promise.all([loadImg('assets/logo-horizontal-tight.png'), loadImg('assets/logo-on-ink.png')]);
  await Promise.all(['600 40px Fredoka', '700 40px Fredoka', '700 40px Nunito', '800 40px Nunito', '700 40px Caveat']
    .map(f => document.fonts.load(f).catch(() => {})));
  buildUI(); syncUI(); loop();
})();
