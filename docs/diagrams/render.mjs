#!/usr/bin/env node
// Renders the SDD lifecycle diagrams from model.mjs.
//
//   node docs/diagrams/render.mjs
//
// Writes docs/diagrams/svg/<diagram>-<verbosity>-<theme>.svg for every
// combination, and docs/diagrams/index.html, a page that shows all of them with
// controls for verbosity, orientation and theme. No dependencies.
//
// Structure: colour helpers, SVG primitives, one builder per diagram, then the
// output loop at the bottom. Content lives in model.mjs; change wording there.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from './model.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Colour. OKLCH in, hex out, so every viewer (GitHub, Keynote, browsers) agrees.

function oklchToHex([L, C, H]) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (v) => {
    const c = Math.min(1, Math.max(0, v));
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(g * 255).toString(16).padStart(2, '0');
  };
  return '#' + lin.map(gamma).join('');
}

// A tint is the family hue pulled almost all the way to the ground colour.
function tint([, , H], theme) {
  return theme === 'dark' ? oklchToHex([0.24, 0.035, H]) : oklchToHex([0.965, 0.03, H]);
}

// The palette a diagram is drawn with. `literal` bakes hex values in (for the
// standalone SVGs); otherwise CSS custom properties are emitted so one SVG can
// follow the page theme inside index.html.
function palette(theme, literal = true) {
  const n = M.neutrals[theme];
  const v = (name, hex) => (literal ? hex : `var(--d-${name})`);
  const p = {
    bg: v('bg', oklchToHex(n.background)),
    fg: v('fg', oklchToHex(n.foreground)),
    muted: v('muted', oklchToHex(n.muted)),
    mutedFg: v('mutedFg', oklchToHex(n.mutedForeground)),
    border: v('border', oklchToHex(n.border)),
    brand: v('brand', oklchToHex(n.brand)),
    destructive: v('destructive', oklchToHex(n.destructive)),
    fam: {},
  };
  for (const [id, f] of Object.entries(M.families)) {
    const ink = oklchToHex(f[theme]);
    p.fam[id] = { ink: v(`${id}-ink`, ink), tint: v(`${id}-tint`, tint(f[theme], theme)) };
  }
  return p;
}

// CSS variable block for index.html, one per theme.
function cssVars(theme) {
  const n = M.neutrals[theme];
  const lines = [
    `--d-bg: ${oklchToHex(n.background)};`,
    `--d-fg: ${oklchToHex(n.foreground)};`,
    `--d-muted: ${oklchToHex(n.muted)};`,
    `--d-mutedFg: ${oklchToHex(n.mutedForeground)};`,
    `--d-border: ${oklchToHex(n.border)};`,
    `--d-brand: ${oklchToHex(n.brand)};`,
    `--d-destructive: ${oklchToHex(n.destructive)};`,
  ];
  for (const [id, f] of Object.entries(M.families)) {
    lines.push(`--d-${id}-ink: ${oklchToHex(f[theme])};`, `--d-${id}-tint: ${tint(f[theme], theme)};`);
  }
  return lines.join('\n  ');
}

// ---------------------------------------------------------------------------
// SVG primitives.

const FONT = {
  display: "Fraunces, 'Iowan Old Style', Georgia, serif",
  sans: "Geist, 'Geist Sans', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rough text width in px. Geist is a touch wider than 0.5em on average.
const tw = (s, size, mono = false) => s.length * size * (mono ? 0.6 : 0.54);

function wrap(s, maxChars) {
  const words = String(s).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function text(x, y, s, o = {}) {
  const size = o.size ?? 13;
  const fam = o.mono ? FONT.mono : o.display ? FONT.display : FONT.sans;
  const attrs = [
    `x="${x}"`, `y="${y}"`,
    `font-family="${fam}"`, `font-size="${size}"`,
    o.weight ? `font-weight="${o.weight}"` : '',
    `fill="${o.fill}"`,
    o.anchor ? `text-anchor="${o.anchor}"` : '',
    o.ls ? `letter-spacing="${o.ls}"` : '',
    o.italic ? 'font-style="italic"' : '',
    o.cls ? `class="${o.cls}"` : '',
  ].filter(Boolean).join(' ');
  const str = o.upper ? String(s).toUpperCase() : s;
  return `<text ${attrs}>${esc(str)}</text>`;
}

// Multi-line text. Returns markup; height is lines * lh.
function lines(x, y, arr, o = {}) {
  const lh = o.lh ?? (o.size ?? 13) * 1.3;
  return arr.map((l, i) => text(x, y + i * lh, l, o)).join('');
}

function rect(x, y, w, h, o = {}) {
  const attrs = [
    `x="${x}"`, `y="${y}"`, `width="${w}"`, `height="${h}"`,
    `rx="${o.rx ?? 8}"`,
    `fill="${o.fill ?? 'none'}"`,
    o.stroke ? `stroke="${o.stroke}"` : '',
    o.sw ? `stroke-width="${o.sw}"` : '',
    o.dash ? `stroke-dasharray="${o.dash}"` : '',
    o.cls ? `class="${o.cls}"` : '',
  ].filter(Boolean).join(' ');
  return `<rect ${attrs}/>`;
}

const markerId = (c) => 'arr-' + String(c).replace(/[^a-z0-9]/gi, '');

// An orthogonal or straight polyline with an arrowhead at the end.
function edge(pts, o = {}) {
  const c = o.stroke;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const attrs = [
    `d="${d}"`, 'fill="none"', `stroke="${c}"`, `stroke-width="${o.sw ?? 1.5}"`,
    o.dash ? `stroke-dasharray="${o.dash}"` : '',
    o.noHead ? '' : `marker-end="url(#${markerId(c)})"`,
    'stroke-linejoin="round"',
  ].filter(Boolean).join(' ');
  let out = `<path ${attrs}/>`;
  if (o.label) {
    // Label sits at the midpoint of the longest segment, lifted off the line.
    let best = 0, bi = 0;
    for (let i = 1; i < pts.length; i++) {
      const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (len > best) { best = len; bi = i; }
    }
    const a = pts[bi - 1], b = pts[bi];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const horizontal = Math.abs(b[1] - a[1]) < Math.abs(b[0] - a[0]);
    const left = o.labelSide === 'left';
    const lx = o.lx ?? (horizontal ? mx : left ? mx - 8 : mx + 8);
    const ly = o.ly ?? (horizontal ? my - 6 : my + 4);
    const w = tw(o.label, 11, true) + 8;
    const anchor = horizontal ? 'middle' : left ? 'end' : 'start';
    const bx = anchor === 'middle' ? lx - w / 2 : anchor === 'end' ? lx - w + 4 : lx - 4;
    out += rect(bx, ly - 10, w, 14, { fill: o.labelBg, rx: 3 });
    out += text(lx, ly, o.label, { size: 11, mono: true, fill: o.labelFill ?? c, anchor });
  }
  return out;
}

function markers(colours) {
  return [...new Set(colours)].map((c) =>
    `<marker id="${markerId(c)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0.5 L10 5 L0 9.5 z" fill="${c}"/></marker>`,
  ).join('');
}

// The site's eyebrow: a slash, then mono small caps.
function eyebrow(x, y, s, P) {
  return text(x, y, '/', { size: 11, mono: true, fill: P.brand }) + text(x + 12, y, s, { size: 11, mono: true, fill: P.brand, upper: true, ls: '0.08em' });
}

// Diagram heading block. Returns markup and the y where content may start.
function heading(P, d, x = 40, y = 44) {
  let out = eyebrow(x, y, d.eyebrow, P);
  out += text(x, y + 34, d.title, { size: 28, display: true, fill: P.fg });
  out += rect(x, y + 48, 40, 1.5, { fill: P.brand, rx: 0 });
  out += text(x, y + 70, d.subtitle, { size: 13, fill: P.mutedFg });
  return { out, y: y + 100 };
}

// A rounded chip: verb, optional role line, optional marks.
function chip(x, y, w, s, P, ink, tintFill, opts = {}) {
  const verbLines = wrap(s.verb, Math.floor((w - (s.id ? 62 : 34)) / 7.2));
  const roleShown = opts.showRole && s.role;
  const noteLines = s.note ? wrap(s.note, Math.floor((w - 24) / 6)) : [];
  const h = 10 + verbLines.length * 16 + (roleShown ? 14 : 0) + (noteLines.length ? 4 + noteLines.length * 13 : 0) + 8;
  let out = rect(x, y, w, h, { fill: tintFill, stroke: ink, sw: 1, rx: 6, dash: s.optional ? '4 3' : undefined, cls: 'chip' });
  out += rect(x, y, 3, h, { fill: ink, rx: 0 });
  if (s.id) out += text(x + 12, y + 20, s.id, { size: 11, mono: true, fill: P.mutedFg });
  const tx = x + (s.id ? 40 : 12);
  out += lines(tx, y + 20, verbLines, { size: 13, fill: P.fg, lh: 16 });
  if (roleShown) {
    const role = M.roles[s.role] ?? s.role;
    out += text(tx, y + 20 + verbLines.length * 16 - 2, role, { size: 10.5, mono: true, fill: P.mutedFg });
  }
  if (noteLines.length) {
    const ny = y + 20 + verbLines.length * 16 + (roleShown ? 14 : 0) + 2;
    out += lines(x + 12, ny, noteLines, { size: 10.5, fill: P.mutedFg, lh: 13, italic: true });
  }
  if (s.loop) out += loopMark(x + w - 18, y + 14, ink);
  if (s.human) out += humanMark(x + w - (s.loop ? 34 : 18), y + 14, P.brand);
  return { out, h };
}

// The two marks are Lucide icons (https://lucide.dev, ISC licence), inlined
// from lucide-static: `rotate-cw` for "runs the review loop" and `user` for
// "a person decides here". Lucide draws on a 24-unit grid with a 2-unit
// stroke; they are scaled to 15px and centred on (cx, cy).
const ICON_PX = 15;
function lucide(cls, cx, cy, c, inner) {
  const s = ICON_PX / 24;
  return `<g class="${cls}" transform="translate(${cx - ICON_PX / 2} ${cy - ICON_PX / 2}) scale(${s})" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
}
function loopMark(cx, cy, c) {
  return lucide('loopmark', cx, cy, c, '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>');
}
function humanMark(cx, cy, c) {
  return lucide('humanmark', cx, cy, c, '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>');
}

function modeBadge(x, y, mode, P, ink) {
  const m = M.modes[mode];
  const w = tw(m.short, 9.5, true) + 14;
  const fill = mode === 'human' ? P.brand : mode === 'manual' ? P.muted : 'none';
  const stroke = mode === 'human' ? P.brand : P.border;
  const fg = mode === 'human' ? P.bg : P.mutedFg;
  return rect(x, y, w, 16, { fill, stroke, sw: 1, rx: 8 }) +
    text(x + w / 2, y + 11.5, m.short, { size: 9.5, mono: true, fill: fg, anchor: 'middle', ls: '0.06em' });
}
const badgeWidth = (mode) => tw(M.modes[mode].short, 9.5, true) + 14;

function svgDoc(w, h, body, P, colours, meta) {
  const bg = rect(0, 0, w, h, { fill: P.bg, rx: 0 });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d" font-family="${FONT.sans}">
<title id="t">${esc(meta.title)}</title><desc id="d">${esc(meta.subtitle)}</desc>
<defs>${markers(colours)}</defs>
${bg}${body}</svg>`;
}

// Legend of the marks the journey and steering diagrams use, plus roles when asked.
function legend(x, y, P, V, opts = {}) {
  let out = '';
  let cx = x;
  const item = (mark, label) => {
    out += mark(cx, y);
    cx += 18;
    out += text(cx, y + 4, label, { size: 11.5, fill: P.mutedFg });
    cx += tw(label, 11.5) + 26;
  };
  item((a, b) => loopMark(a + 6, b, P.fg), 'runs the review loop');
  item((a, b) => humanMark(a + 6, b, P.brand), 'a person decides');
  if (opts.optional) item((a, b) => rect(a, b - 6, 12, 12, { stroke: P.mutedFg, sw: 1, dash: '3 2', rx: 3 }), 'optional');
  if (opts.modes) {
    for (const mode of ['human', 'manual', 'agent']) {
      out += modeBadge(cx, y - 8, mode, P);
      cx += badgeWidth(mode) + 6;
      out += text(cx, y + 4, M.modes[mode].label, { size: 11.5, fill: P.mutedFg });
      cx += tw(M.modes[mode].label, 11.5) + 22;
    }
  }
  return { out, w: cx - x };
}

// One row per agent: its name, then what it does. Three columns, each wide
// enough for the longest name plus the longest description in that column.
function roleLegend(x, y, ids, P, cols = 3) {
  let out = eyebrow(x, y, 'who does it', P);
  const rows = ids.map((id) => [M.roles[id], M.roleDoes[id] ?? '']);
  const nameW = Math.max(...rows.map(([n]) => tw(n, 11, true))) + 16;
  const perCol = Math.ceil(rows.length / cols);
  const colWidths = [];
  for (let c = 0; c < cols; c++) {
    const slice = rows.slice(c * perCol, (c + 1) * perCol);
    colWidths.push(nameW + Math.max(0, ...slice.map(([, d]) => tw(d, 11.5))) + 28);
  }
  rows.forEach(([name, does], i) => {
    const col = Math.floor(i / perCol);
    const cx = x + colWidths.slice(0, col).reduce((a, b) => a + b, 0);
    const cy = y + 22 + (i % perCol) * 18;
    out += text(cx, cy, name, { size: 11, mono: true, fill: P.fg }) + text(cx + nameW, cy, does, { size: 11.5, fill: P.mutedFg });
  });
  return { out, h: 22 + perCol * 18, w: colWidths.reduce((a, b) => a + b, 0) };
}

// ---------------------------------------------------------------------------
// Diagram 1: the journey.

const CHIP_W = 232;
const CARD_PAD = 14;

function stageHeader(x, y, st, P, V, wide) {
  const f = P.fam[st.family];
  let out = text(x, y + 30, String(st.n), { size: 30, display: true, fill: f.ink });
  const titleLines = wrap(st.title, wide ? 26 : 22);
  out += lines(x + 30, y + 16, titleLines, { size: 14.5, weight: 600, fill: P.fg, lh: 17 });
  const by = y + 22 + titleLines.length * 17;
  out += modeBadge(x + 30, by, st.mode, P);
  return { out, h: by + 22 - y };
}

function stageCardLR(x, y, st, P, V) {
  const f = P.fam[st.family];
  const w = CHIP_W + CARD_PAD * 2;
  let inner = '';
  const hd = stageHeader(x + CARD_PAD, y + CARD_PAD, st, P, V, false);
  inner += hd.out;
  let cy = y + CARD_PAD + hd.h + 6;
  for (const s of st.steps) {
    const c = chip(x + CARD_PAD, cy, CHIP_W, s, P, f.ink, f.tint, { showRole: V.showRole });
    inner += c.out;
    cy += c.h + 6;
  }
  const h = cy - y + CARD_PAD - 6;
  const card = rect(x, y, w, h, { fill: P.bg, stroke: P.border, sw: 1, rx: 10, cls: 'stage' });
  return { out: `<g class="stage-g" data-stage="${st.id}">${card}${inner}</g>`, w, h };
}

function stageCardTB(x, y, st, P, V, cols = 3) {
  const f = P.fam[st.family];
  const headW = 236;
  const w = headW + cols * (CHIP_W + 10) + CARD_PAD;
  let inner = '';
  const hd = stageHeader(x + CARD_PAD, y + CARD_PAD, st, P, V, true);
  inner += hd.out;
  // Chips in a grid, row heights per row.
  let rowY = y + CARD_PAD;
  let maxBottom = y + CARD_PAD + hd.h;
  st.steps.forEach((s, i) => {
    const col = i % cols;
    if (col === 0 && i > 0) rowY = maxBottom + 8;
    const c = chip(x + headW + col * (CHIP_W + 10), rowY, CHIP_W, s, P, f.ink, f.tint, { showRole: V.showRole });
    inner += c.out;
    maxBottom = Math.max(maxBottom, rowY + c.h);
  });
  const h = maxBottom - y + CARD_PAD;
  const card = rect(x, y, w, h, { fill: P.bg, stroke: P.border, sw: 1, rx: 10, cls: 'stage' });
  return { out: `<g class="stage-g" data-stage="${st.id}">${card}${inner}</g>`, w, h };
}

function motif(x, y, P, V, ink, tintFill) {
  const J = M.journey.motif;
  let out = '';
  const w = 196, gap = 44;
  let cx = x;
  const boxes = [];
  out += eyebrow(x, y, J.title, P);
  const by = y + 14;
  J.steps.forEach((s, i) => {
    const c = chip(cx, by, w, s, P, ink, tintFill, { showRole: V.showRole });
    boxes.push({ x: cx, y: by, w, h: c.h });
    out += c.out;
    if (i < J.steps.length - 1) out += edge([[cx + w, by + 18], [cx + w + gap, by + 18]], { stroke: P.fg });
    cx += w + gap;
  });
  // Back edge: revise -> review, labelled iterate. Forward: review -> approve, converged.
  const b = boxes;
  const yb = by + Math.max(...b.map((k) => k.h)) + 22;
  out += edge([[b[2].x + w / 2, b[2].y + b[2].h], [b[2].x + w / 2, yb], [b[1].x + w / 2, yb], [b[1].x + w / 2, b[1].y + b[1].h]], { stroke: ink, label: J.back, labelBg: P.bg });
  const yt = by - 12;
  out += edge([[b[1].x + w / 2 + 30, b[1].y], [b[1].x + w / 2 + 30, yt], [b[3].x + w / 2, yt], [b[3].x + w / 2, b[3].y]], { stroke: ink, label: J.forward, labelBg: P.bg });
  out += text(x, yb + 22, J.note, { size: 11.5, fill: P.mutedFg });
  return { out, w: cx - gap - x, h: yb + 30 - y };
}

function journeyLR(P, V) {
  const J = M.journey;
  const hd = heading(P, { eyebrow: 'diagram 1 · journey', title: J.title, subtitle: J.subtitle });
  let out = hd.out;
  const top = hd.y + 26;
  const x0 = 40;
  const GAP = 34;
  const colours = [P.fg, P.brand, P.mutedFg, ...Object.values(P.fam).map((f) => f.ink)];

  // Entry pills.
  const entryW = 150;
  const stageX = x0 + entryW + 56;
  let cards = [];
  let x = stageX;
  const groupBoxes = [];
  for (const g of J.groups) {
    const gx = x;
    for (const st of g.stages) {
      const c = stageCardLR(x, top, st, P, V);
      cards.push({ st, x, y: top, w: c.w, h: c.h, out: c.out });
      x += c.w + GAP;
    }
    groupBoxes.push({ g, x: gx, w: x - GAP - gx });
    x += 26; // extra breathing room between groups
  }
  const maxH = Math.max(...cards.map((c) => c.h));

  // Group brackets above the cards.
  for (const gb of groupBoxes) {
    out += rect(gb.x, top - 22, gb.w, 1, { fill: P.border, rx: 0 });
    out += text(gb.x, top - 30, gb.g.label, { size: 12, weight: 600, fill: P.fg });
    out += text(gb.x + tw(gb.g.label, 12) + 22, top - 30, gb.g.note, { size: 11, mono: true, fill: P.mutedFg, upper: true, ls: '0.06em' });
  }

  // Entries feeding stage 1.
  const e0 = cards[0];
  J.entries.forEach((e, i) => {
    const ey = top + 40 + i * 44;
    out += rect(x0, ey, entryW, 30, { fill: P.muted, stroke: P.border, sw: 1, rx: 15 });
    out += text(x0 + entryW / 2, ey + 19, e.label, { size: 12.5, fill: P.fg, anchor: 'middle' });
    out += edge([[x0 + entryW, ey + 15], [x0 + entryW + 28, ey + 15], [x0 + entryW + 28, top + 62], [e0.x, top + 62]], { stroke: P.mutedFg, noHead: i > 0 });
  });

  // Cards and the arrows between them.
  cards.forEach((c, i) => {
    out += c.out;
    if (i < cards.length - 1) {
      const n = cards[i + 1];
      out += edge([[c.x + c.w, top + 62], [n.x, top + 62]], { stroke: P.fg, sw: 1.6 });
    }
  });

  // Loop back: last card to the first per-spec card, below everything.
  const from = cards.find((c) => c.st.id === J.loopBack.from);
  const to = cards.find((c) => c.st.id === J.loopBack.to);
  const yb = top + maxH + 34;
  out += edge([[from.x + from.w / 2, from.y + from.h], [from.x + from.w / 2, yb], [to.x + to.w / 2, yb], [to.x + to.w / 2, to.y + to.h]], { stroke: P.fam.reflect.ink, sw: 1.6, label: J.loopBack.label, labelBg: P.bg, dash: '6 4' });

  // Motif and legend beneath.
  const my = yb + 44;
  const mo = motif(x0, my, P, V, P.fam.documents.ink, P.fam.documents.tint);
  out += mo.out;
  const lg = legend(x0 + mo.w + 60, my + 30, P, V, { optional: true, modes: true });
  out += lg.out;
  let bottom = my + mo.h + 20;
  let right = x0 + mo.w + 60 + lg.w + 40;
  if (V.legend) {
    const rl = roleLegend(x0 + mo.w + 60, my + 60, usedRoles(J), P);
    out += rl.out;
    bottom = Math.max(bottom, my + 60 + rl.h + 10);
    right = Math.max(right, x0 + mo.w + 60 + rl.w + 40);
  }
  const w = Math.max(x - 26 - GAP + 40, right);
  return svgDoc(w, bottom + 10, out, P, colours, J);
}

function journeyTB(P, V) {
  const J = M.journey;
  const hd = heading(P, { eyebrow: 'diagram 1 · journey', title: J.title, subtitle: J.subtitle });
  let out = hd.out;
  const x0 = 40;
  const colours = [P.fg, P.brand, P.mutedFg, ...Object.values(P.fam).map((f) => f.ink)];

  // Entry pills side by side, merging into stage 1.
  let y = hd.y;
  const entryW = 160;
  J.entries.forEach((e, i) => {
    const ex = x0 + 40 + i * (entryW + 30);
    out += rect(ex, y, entryW, 30, { fill: P.muted, stroke: P.border, sw: 1, rx: 15 });
    out += text(ex + entryW / 2, y + 19, e.label, { size: 12.5, fill: P.fg, anchor: 'middle' });
    out += edge([[ex + entryW / 2, y + 30], [ex + entryW / 2, y + 48], [x0 + 60, y + 48], [x0 + 60, y + 70]], { stroke: P.mutedFg, noHead: i > 0 });
  });
  y += 70;

  const GAP = 28;
  const cards = [];
  let width = 0;
  for (const g of J.groups) {
    out += text(x0, y + 14, g.label, { size: 12, weight: 600, fill: P.fg });
    out += text(x0 + tw(g.label, 12) + 22, y + 14, g.note, { size: 11, mono: true, fill: P.mutedFg, upper: true, ls: '0.06em' });
    y += 24;
    const gy = y;
    for (const st of g.stages) {
      const c = stageCardTB(x0, y, st, P, V);
      cards.push({ st, x: x0, y, w: c.w, h: c.h, out: c.out });
      width = Math.max(width, c.w);
      y += c.h + GAP;
    }
    out += rect(x0 - 16, gy, 2, y - GAP - gy, { fill: P.border, rx: 0 });
    y += 10;
  }
  cards.forEach((c, i) => {
    out += c.out;
    if (i < cards.length - 1) {
      const n = cards[i + 1];
      out += edge([[c.x + 60, c.y + c.h], [n.x + 60, n.y]], { stroke: P.fg, sw: 1.6 });
    }
  });
  const from = cards.find((c) => c.st.id === J.loopBack.from);
  const to = cards.find((c) => c.st.id === J.loopBack.to);
  const xr = x0 + width + 30;
  out += edge([[from.x + from.w, from.y + from.h / 2], [xr, from.y + from.h / 2], [xr, to.y + to.h / 2], [to.x + to.w, to.y + to.h / 2]], { stroke: P.fam.reflect.ink, sw: 1.6, dash: '6 4', label: J.loopBack.label, labelBg: P.bg, lx: xr + 8, ly: (from.y + to.y) / 2 + 40 });

  const mo = motif(x0, y + 10, P, V, P.fam.documents.ink, P.fam.documents.tint);
  out += mo.out;
  y += 10 + mo.h + 24;
  const lg = legend(x0, y, P, V, { optional: true, modes: false });
  out += lg.out;
  y += 26;
  out += modesOnly(x0, y, P);
  y += 30;
  let right = Math.max(x0 + width + 110, x0 + mo.w + 40);
  if (V.legend) {
    const rl = roleLegend(x0, y, usedRoles(J), P, 2);
    out += rl.out;
    y += rl.h + 10;
    right = Math.max(right, x0 + rl.w + 40);
  }
  return svgDoc(right, y + 20, out, P, colours, J);
}

function modesOnly(x, y, P) {
  let out = '';
  let cx = x;
  for (const mode of ['human', 'manual', 'agent']) {
    out += modeBadge(cx, y - 8, mode, P);
    cx += badgeWidth(mode) + 6;
    out += text(cx, y + 4, M.modes[mode].label, { size: 11.5, fill: P.mutedFg });
    cx += tw(M.modes[mode].label, 11.5) + 22;
  }
  return out;
}

function usedRoles(J) {
  const ids = new Set();
  for (const g of J.groups) for (const st of g.stages) for (const s of st.steps) if (s.role) ids.add(s.role);
  for (const s of J.motif.steps) ids.add(s.role);
  return [...ids];
}

// ---------------------------------------------------------------------------
// Diagram 2: hierarchical state machine (UML statechart notation).

function stateBox(x, y, w, h, st, P, opts = {}) {
  const f = st.family ? P.fam[st.family] : { ink: P.fg, tint: P.muted };
  let out = rect(x, y, w, h, { fill: f.tint, stroke: f.ink, sw: 1.2, rx: 10 });
  const lab = wrap(st.label, Math.floor((w - 20) / 7.4));
  const ty = y + h / 2 - ((lab.length - 1) * 15) / 2 + 4.5;
  out += lines(x + w / 2, ty, lab, { size: 13, fill: P.fg, anchor: 'middle', lh: 15, weight: st.composite ? 600 : 400 });
  if (st.composite) {
    // UML's decomposition icon: two small circles joined by a line.
    const cx = x + w - 20, cy = y + h - 9;
    out += `<g fill="none" stroke="${f.ink}" stroke-width="1.2"><circle cx="${cx - 6}" cy="${cy}" r="3.5"/><circle cx="${cx + 6}" cy="${cy}" r="3.5"/><line x1="${cx - 2.5}" y1="${cy}" x2="${cx + 2.5}" y2="${cy}"/></g>`;
  }
  return out;
}

const initial = (x, y, P) => `<circle cx="${x}" cy="${y}" r="6" fill="${P.fg}"/>`;
const finalState = (x, y, P) => `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${P.fg}" stroke-width="1.5"/><circle cx="${x}" cy="${y}" r="4.5" fill="${P.fg}"/>`;

function compositeFrame(x, y, w, h, label, P, ink) {
  let out = rect(x, y, w, h, { fill: 'none', stroke: ink, sw: 1.2, rx: 14 });
  const lw = tw(label, 12, true) + 20;
  out += rect(x + 14, y - 10, lw, 20, { fill: P.bg, rx: 10, stroke: ink, sw: 1.2 });
  out += text(x + 14 + lw / 2, y + 4, label, { size: 12, mono: true, fill: ink, anchor: 'middle' });
  return out;
}

function fsmDiagram(P, V) {
  const F = M.fsm;
  const hd = heading(P, { eyebrow: 'diagram 2 · state machine', title: F.title, subtitle: F.subtitle });
  let out = hd.out;
  const colours = [P.fg, P.mutedFg, P.destructive, ...Object.values(P.fam).map((f) => f.ink)];
  const W = 1180;
  const x0 = 40;

  // Tier 1: product.
  const t1y = hd.y + 10;
  const t1h = 120;
  out += compositeFrame(x0, t1y, W - 80, t1h, F.product.label, P, P.fg);
  const sw = 150, sh = 48, gap = 62;
  const sy = t1y + 40;
  const pos1 = {};
  let sx = x0 + 60;
  out += initial(x0 + 32, sy + sh / 2, P);
  F.product.states.forEach((st) => {
    if (st.final) {
      pos1[st.id] = { x: sx, y: sy, w: 20, h: sh };
      out += finalState(sx + 10, sy + sh / 2, P);
      out += text(sx + 10, sy + sh + 18, st.label, { size: 11.5, fill: P.mutedFg, anchor: 'middle' });
    } else {
      const w = st.composite ? 190 : sw;
      pos1[st.id] = { x: sx, y: sy, w, h: sh };
      out += stateBox(sx, sy, w, sh, st, P);
    }
    sx += pos1[st.id].w + gap;
  });
  for (const t of F.product.transitions) {
    if (t.from === 'init') { out += edge([[x0 + 38, sy + sh / 2], [pos1[t.to].x, sy + sh / 2]], { stroke: P.fg }); continue; }
    const a = pos1[t.from], b = pos1[t.to];
    out += edge([[a.x + a.w, sy + sh / 2], [b.x, sy + sh / 2]], { stroke: P.fg, label: t.label, labelBg: P.bg, labelFill: P.mutedFg, ly: sy - 8 });
  }

  // Tier 2: one spec, expanded from "Specs in progress".
  const t2y = t1y + t1h + 60;
  const t2h = 190;
  const working = pos1.working;
  out += edge([[working.x + working.w / 2, working.y + working.h], [working.x + working.w / 2, t2y]], { stroke: P.mutedFg, dash: '3 3', noHead: true });
  out += compositeFrame(x0, t2y, W - 80, t2h, F.spec.label, P, P.fam.documents.ink);
  const s2y = t2y + 70;
  const pos2 = {};
  sx = x0 + 60;
  out += initial(x0 + 32, s2y + sh / 2, P);
  const sw2 = 138, gap2 = 34;
  F.spec.states.forEach((st) => {
    pos2[st.id] = { x: sx, y: s2y, w: sw2, h: sh };
    out += stateBox(sx, s2y, sw2, sh, st, P);
    sx += sw2 + gap2;
  });
  pos2.final = { x: sx, y: s2y, w: 20, h: sh };
  out += finalState(sx + 10, s2y + sh / 2, P);
  for (const t of F.spec.transitions) {
    if (t.from === 'init') { out += edge([[x0 + 38, s2y + sh / 2], [pos2[t.to].x, s2y + sh / 2]], { stroke: P.fg }); continue; }
    const a = pos2[t.from], b = pos2[t.to];
    if (t.kind === 'back') {
      const yy = s2y - 26;
      out += edge([[a.x + a.w / 2 - 20, a.y], [a.x + a.w / 2 - 20, yy], [b.x + b.w / 2, yy], [b.x + b.w / 2, b.y]], { stroke: P.destructive, label: t.label, labelBg: P.bg, ly: yy - 6 });
    } else if (t.kind === 'self') {
      const cx = a.x + a.w / 2, by = a.y + a.h;
      out += edge([[cx - 22, by], [cx - 22, by + 22], [cx + 22, by + 22], [cx + 22, by]], { stroke: P.mutedFg, label: t.label, labelBg: P.bg, ly: by + 40, lx: cx });
    } else {
      out += edge([[a.x + a.w, s2y + sh / 2], [b.x, s2y + sh / 2]], { stroke: P.fg, label: t.label, labelBg: P.bg, labelFill: P.mutedFg, ly: s2y - 8 });
    }
  }
  out += text(x0 + W - 100, t2y + t2h - 12, F.spec.note, { size: 11, fill: P.mutedFg, italic: true, anchor: 'end' });

  // Tier 3: one document phase, expanded from Requirements.
  const t3y = t2y + t2h + 60;
  const t3h = 240;
  const req = pos2.requirements;
  out += edge([[req.x + req.w / 2, req.y + req.h], [req.x + req.w / 2, t3y]], { stroke: P.mutedFg, dash: '3 3', noHead: true });
  out += compositeFrame(x0, t3y, W - 80, t3h, F.document.label, P, P.fam.documents.ink);
  out += text(x0 + 20, t3y + t3h - 12, 'Design and tasks contain the same machine.', { size: 11, fill: P.mutedFg, italic: true });
  const s3y = t3y + 76;
  const pos3 = {};
  sx = x0 + 60;
  out += initial(x0 + 32, s3y + sh / 2, P);
  const docStates = F.document.states.filter((s) => !s.final);
  const order = ['drafted', 'review', 'revising', 'capped'];
  docStates.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const sw3 = 150, gap3 = 120;
  // drafted, review on the main line; revising below review; capped above review's right.
  pos3.drafted = { x: sx, y: s3y, w: sw3, h: sh };
  pos3.review = { x: sx + sw3 + gap3, y: s3y, w: sw3, h: sh };
  pos3.revising = { x: pos3.review.x + sw3 + gap3, y: s3y + 66, w: sw3, h: 40 };
  pos3.capped = { x: pos3.review.x + sw3 + gap3, y: s3y - 62, w: sw3, h: 40 };
  pos3.approved = { x: pos3.capped.x + sw3 + 140, y: s3y, w: 20, h: sh };
  for (const st of docStates) out += stateBox(pos3[st.id].x, pos3[st.id].y, pos3[st.id].w, pos3[st.id].h, { ...st, family: 'documents' }, P);
  out += finalState(pos3.approved.x + 10, s3y + sh / 2, P);
  out += text(pos3.approved.x + 10, s3y + sh + 18, 'Approved', { size: 11.5, fill: P.mutedFg, anchor: 'middle' });
  const c = (p) => [p.x + p.w / 2, p.y + p.h / 2];
  out += edge([[x0 + 38, s3y + sh / 2], [pos3.drafted.x, s3y + sh / 2]], { stroke: P.fg });
  out += edge([[pos3.drafted.x + sw3, s3y + sh / 2], [pos3.review.x, s3y + sh / 2]], { stroke: P.fg, label: 'approval requested', labelBg: P.bg, labelFill: P.mutedFg, ly: s3y - 8 });
  // review -> revising (down-right), revising -> review (back, below)
  out += edge([[pos3.review.x + sw3, s3y + sh / 2 + 10], [pos3.revising.x, s3y + sh / 2 + 10], [pos3.revising.x, pos3.revising.y]], { stroke: P.fg, label: 'iterate', labelBg: P.bg, labelFill: P.mutedFg, lx: pos3.review.x + sw3 + gap3 / 2, ly: s3y + sh / 2 + 24 });
  out += edge([[c(pos3.revising)[0], pos3.revising.y + pos3.revising.h], [c(pos3.revising)[0], pos3.revising.y + pos3.revising.h + 16], [c(pos3.review)[0], pos3.revising.y + pos3.revising.h + 16], [c(pos3.review)[0], pos3.review.y + sh]], { stroke: P.fg, label: 'v(N+1) requested', labelBg: P.bg, labelFill: P.mutedFg });
  // review -> capped (up-right)
  out += edge([[pos3.review.x + sw3, s3y + sh / 2 - 10], [pos3.capped.x, s3y + sh / 2 - 10], [pos3.capped.x, pos3.capped.y + pos3.capped.h]], { stroke: P.fam.reflect.ink, label: 'iterate at v9', labelBg: P.bg, lx: pos3.review.x + sw3 + gap3 / 2, ly: s3y + sh / 2 - 16 });
  // capped -> approved
  out += edge([[pos3.capped.x + sw3, pos3.capped.y + 20], [pos3.approved.x + 10, pos3.capped.y + 20], [pos3.approved.x + 10, s3y + sh / 2 - 8]], { stroke: P.fam.reflect.ink, label: 'narrow check', labelBg: P.bg });
  // review -> approved (converged), passing between revising and capped
  out += edge([[pos3.review.x + sw3, s3y + sh / 2], [pos3.approved.x + 2, s3y + sh / 2]], { stroke: P.fam.build.ink, label: 'converged', labelBg: P.bg, lx: pos3.revising.x + sw3 + 66, ly: s3y + sh / 2 - 6 });

  const H = t3y + t3h + 30;
  return svgDoc(W, H, out, P, colours, F);
}

// ---------------------------------------------------------------------------
// Diagrams 3 and 4: flow charts with a column grid.

function flowNode(n, x, y, w, P, f, V) {
  if (n.kind === 'decision') {
    const h = 56;
    const cx = x + w / 2, cy = y + h / 2;
    let out = `<path d="M${cx} ${y} L${x + w} ${cy} L${cx} ${y + h} L${x} ${cy} z" fill="${P.muted}" stroke="${P.mutedFg}" stroke-width="1.2"/>`;
    out += text(cx, cy + 4, n.verb, { size: 12, fill: P.fg, anchor: 'middle', weight: 600 });
    return { out, h };
  }
  if (n.kind === 'stop' || n.kind === 'end') {
    const stop = n.kind === 'stop';
    const ink = stop ? P.destructive : f.ink;
    const vl = wrap(n.verb, Math.floor((w - 24) / 7.2));
    const nl = n.note ? wrap(n.note, Math.floor((w - 24) / 6)) : [];
    const h = 16 + vl.length * 16 + (nl.length ? 2 + nl.length * 13 : 0);
    let out = rect(x, y, w, h, { fill: stop ? 'none' : ink, stroke: ink, sw: 1.4, rx: 14, dash: stop ? '5 3' : undefined });
    out += lines(x + w / 2, y + 21, vl, { size: 12.5, fill: stop ? ink : P.bg, anchor: 'middle', weight: 600, lh: 16 });
    if (nl.length) out += lines(x + w / 2, y + 21 + vl.length * 16 + 1, nl, { size: 10.5, fill: stop ? P.mutedFg : P.bg, anchor: 'middle', lh: 13, italic: true });
    return { out, h };
  }
  const c = chip(x, y, w, { ...n, id: undefined }, P, f.ink, f.tint, { showRole: V.showRole });
  return { out: c.out, h: c.h };
}

// Route an edge between two placed nodes on the grid.
function routeEdge(e, a, b, P, f) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const stroke = e.kind === 'stop' ? P.destructive : e.kind === 'back' ? f.ink : P.fg;
  const o = { stroke, label: e.label, labelBg: P.bg, labelFill: e.kind ? stroke : P.mutedFg, dash: e.kind === 'stop' ? '5 3' : undefined };
  const sameRow = Math.abs(ac.y - bc.y) < 4;
  const sameCol = Math.abs(ac.x - bc.x) < 4;
  if (sameRow) {
    if (bc.x > ac.x) return edge([[a.x + a.w, ac.y], [b.x, ac.y]], o);
    if (e.kind !== 'back') return edge([[a.x, ac.y], [b.x + b.w, ac.y]], o);
    // A loop back along the same row: arc over the top.
    const yy = Math.min(a.y, b.y) - 24;
    return edge([[ac.x, a.y], [ac.x, yy], [bc.x, yy], [bc.x, b.y]], o);
  }
  if (sameCol) {
    const down = bc.y > ac.y;
    const off = e.kind === 'back' ? 14 : e.twin ? -14 : 0;
    return edge([[ac.x + off, down ? a.y + a.h : a.y], [bc.x + off, down ? b.y : b.y + b.h]], { ...o, labelSide: e.twin ? 'left' : undefined });
  }
  if (e.kind !== 'back' && Math.abs(bc.x - ac.x) > 260) {
    // Far target on another row: drop to just above it, run across, come in from the top.
    const yy = b.y - 26;
    return edge([[ac.x, a.y + a.h], [ac.x, yy], [bc.x, yy], [bc.x, b.y]], o);
  }
  // L-shaped: leave vertically, arrive horizontally, unless the target is
  // directly below/above in a neighbouring column, then leave horizontally.
  if (e.kind === 'back') {
    // Leave from the side, travel horizontally, then vertically into the target.
    const leftwards = bc.x < ac.x;
    const sx = leftwards ? a.x : a.x + a.w;
    const arriveTop = bc.y < ac.y;
    return edge([[sx, ac.y], [bc.x, ac.y], [bc.x, arriveTop ? b.y + b.h : b.y]], o);
  }
  if (bc.y > ac.y) {
    // Down then across, or across then down when the target is directly below a neighbour.
    return edge([[ac.x, a.y + a.h], [ac.x, bc.y], [bc.x > ac.x ? b.x : b.x + b.w, bc.y]], o);
  }
  return edge([[ac.x, a.y], [ac.x, bc.y], [bc.x > ac.x ? b.x : b.x + b.w, bc.y]], o);
}

function flowDiagram(D, layout, P, V, eyebrowText) {
  const hd = heading(P, { eyebrow: eyebrowText, title: D.title, subtitle: D.subtitle });
  let out = hd.out;
  const f = P.fam[D.family];
  const colours = [P.fg, P.mutedFg, P.destructive, f.ink];
  const COL = 255, ROW = 138, W = 200;
  const x0 = 40, y0 = hd.y + 36;
  const placed = {};
  let maxX = 0, maxY = 0;
  for (const n of D.nodes) {
    const [c, r] = layout[n.id];
    const x = x0 + c * COL, y = y0 + r * ROW;
    const w = n.kind === 'decision' ? 130 : W;
    const nx = n.kind === 'decision' ? x + (W - 130) / 2 : x;
    const r2 = flowNode(n, nx, y, w, P, f, V);
    placed[n.id] = { x: nx, y, w, h: r2.h, out: r2.out };
    maxX = Math.max(maxX, nx + w);
    maxY = Math.max(maxY, y + r2.h);
  }
  // Mark twin edges (two edges between the same vertical pair) so they offset.
  for (const e of D.edges) {
    if (D.edges.some((o) => o !== e && o.from === e.to && o.to === e.from)) e.twin = e.kind !== 'back';
  }
  for (const e of D.edges) out += routeEdge(e, placed[e.from], placed[e.to], P, f);
  for (const n of D.nodes) out += placed[n.id].out;
  let bottom = maxY + 30;
  let right = Math.max(maxX + 40, 900);
  if (V.legend) {
    const ids = [...new Set(D.nodes.filter((n) => n.role).map((n) => n.role))];
    const rl = roleLegend(x0, bottom + 10, ids, P, 2);
    out += rl.out;
    bottom += rl.h + 20;
    right = Math.max(right, x0 + rl.w + 40);
  }
  return svgDoc(right, bottom, out, P, colours, D);
}

const reviewLayout = {
  draft: [0, 1], request: [1, 1], review: [2, 1], verdict: [3, 1], approve: [4, 1], clean: [5, 1],
  cap: [3, 0], narrow: [4, 0], escalate: [1, 0],
  standoff: [3, 2], revise: [2, 2],
};

const taskLayout = {
  pick: [0, 0], impl: [1, 0], verify: [2, 0], verdict: [3, 0], done: [4, 0], more: [5, 0],
  defect: [1, 1], fix: [3, 1], adjudicate: [4, 1],
  e2e: [0, 2], e2eVerdict: [1, 2], close: [2, 2], pr: [3, 2], ci: [4, 2], complete: [5, 2],
  failed: [1, 3], reconcile: [4, 3],
};

// ---------------------------------------------------------------------------
// Diagram 5: steering into specs.

function steeringDiagram(P, V) {
  const S = M.steering;
  const hd = heading(P, { eyebrow: 'diagram 5 · steering', title: S.title, subtitle: S.subtitle });
  let out = hd.out;
  const fs = P.fam.steering, fd = P.fam.decomposition, fdoc = P.fam.documents;
  const colours = [P.fg, P.mutedFg, fs.ink, fd.ink, fdoc.ink];
  const x0 = 40, y0 = hd.y + 16;

  // Column 1: the steering documents, plus existing code.
  const dw = 250, dh = 58, dgap = 14;
  const docPos = [];
  out += eyebrow(x0, y0 - 8, 'steering documents', P);
  S.docs.forEach((d, i) => {
    const y = y0 + 6 + i * (dh + dgap);
    out += rect(x0, y, dw, dh, { fill: fs.tint, stroke: fs.ink, sw: 1, rx: 6, dash: d.optional ? '4 3' : undefined });
    out += rect(x0, y, 3, dh, { fill: fs.ink, rx: 0 });
    out += text(x0 + 14, y + 22, d.file, { size: 13, mono: true, fill: P.fg, weight: 600 });
    if (d.optional) out += text(x0 + 14 + tw(d.file, 13, true) + 8, y + 22, 'optional', { size: 10, mono: true, fill: P.mutedFg, upper: true, ls: '0.06em' });
    out += text(x0 + 14, y + 41, d.says, { size: 11.5, fill: P.mutedFg });
    out += loopMark(x0 + dw - 16, y + 14, fs.ink);
    docPos.push({ x: x0, y, w: dw, h: dh });
  });
  const ey = y0 + 6 + S.docs.length * (dh + dgap) + 12;
  out += rect(x0, ey, dw, dh, { fill: 'none', stroke: P.mutedFg, sw: 1, rx: 6, dash: '4 3' });
  out += text(x0 + 14, ey + 22, S.existing.label, { size: 13, fill: P.fg, weight: 600 });
  out += text(x0 + 14, ey + 41, S.existing.says, { size: 11.5, fill: P.mutedFg });
  out += humanMark(x0 + dw - 16, ey + 14, P.brand);

  // Column 2: the decomposition.
  const cx = x0 + dw + 90;
  const cw = 330;
  const cy = y0 + 20;
  const ch = 32 + S.decomposition.sections.length * 20 + 20;
  out += eyebrow(cx, y0 - 8, 'decomposition', P);
  out += rect(cx, cy, cw, ch, { fill: fd.tint, stroke: fd.ink, sw: 1, rx: 8 });
  out += rect(cx, cy, 3, ch, { fill: fd.ink, rx: 0 });
  out += text(cx + 16, cy + 24, S.decomposition.file, { size: 13, mono: true, fill: P.fg, weight: 600 });
  out += loopMark(cx + cw - 16, cy + 14, fd.ink);
  S.decomposition.sections.forEach((s, i) => {
    out += text(cx + 16, cy + 46 + i * 20, '·', { size: 12, fill: fd.ink });
    out += text(cx + 28, cy + 46 + i * 20, s, { size: 12, fill: P.fg });
  });
  out += humanMark(cx + cw - 36, cy + 14, P.brand);
  // Edges from each doc into the decomposition's left edge.
  docPos.forEach((d) => {
    out += edge([[d.x + d.w, d.y + d.h / 2], [cx - 30, d.y + d.h / 2], [cx - 30, cy + ch / 2], [cx, cy + ch / 2]], { stroke: fs.ink, noHead: true });
  });
  out += edge([[x0 + dw, ey + dh / 2], [cx - 30, ey + dh / 2], [cx - 30, cy + ch / 2]], { stroke: P.mutedFg, dash: '4 3', noHead: true });
  out += edge([[cx - 30, cy + ch / 2], [cx, cy + ch / 2]], { stroke: fs.ink });

  // Column 3: INDEX and the ordered specs as a small DAG.
  const ix = cx + cw + 90;
  out += eyebrow(ix, y0 - 8, 'the queue', P);
  const iy = cy;
  out += rect(ix, iy, 220, 66, { fill: P.muted, stroke: P.border, sw: 1, rx: 6 });
  out += text(ix + 14, iy + 22, S.index.file, { size: 13, mono: true, fill: P.fg, weight: 600 });
  out += lines(ix + 14, iy + 40, wrap(S.index.says, 32), { size: 11, fill: P.mutedFg, lh: 13 });
  out += edge([[cx + cw, cy + ch / 2], [ix - 30, cy + ch / 2], [ix - 30, iy + 27], [ix, iy + 27]], { stroke: fd.ink, label: 'approved', labelBg: P.bg, lx: cx + cw + 10, ly: cy + ch / 2 - 8 });
  // DAG below INDEX.
  const dagY = iy + 100;
  const nodeW = 78, nodeH = 34;
  const dagPos = { A: [ix, dagY + 40], B: [ix + 120, dagY], C: [ix + 120, dagY + 80], D: [ix + 240, dagY + 40] };
  out += edge([[ix + 100, iy + 54], [ix + 100, dagY - 14]], { stroke: P.mutedFg, dash: '3 3', noHead: true });
  for (const sp of S.specs) {
    for (const dep of sp.deps) {
      const a = dagPos[dep], b = dagPos[sp.id];
      out += edge([[a[0] + nodeW, a[1] + nodeH / 2], [b[0], b[1] + nodeH / 2]], { stroke: fdoc.ink });
    }
  }
  for (const sp of S.specs) {
    const [x, y] = dagPos[sp.id];
    out += rect(x, y, nodeW, nodeH, { fill: fdoc.tint, stroke: fdoc.ink, sw: 1, rx: 17 });
    out += text(x + nodeW / 2, y + 22, sp.label, { size: 12.5, fill: P.fg, anchor: 'middle', weight: 600 });
  }
  out += text(ix, dagY + 150, 'Worked in dependency order, one at a time.', { size: 11.5, fill: P.mutedFg });

  const bottom = Math.max(ey + dh, dagY + 160) + 30;
  out += text(x0, bottom, S.loop, { size: 11.5, fill: P.mutedFg });
  const lg = legend(x0, bottom + 28, P, V, { optional: true });
  out += lg.out;
  return svgDoc(ix + 340, bottom + 50, out, P, colours, S);
}

// ---------------------------------------------------------------------------
// index.html: every diagram, with controls.

function page(svgs) {
  const light = cssVars('light');
  const dark = cssVars('dark');
  const V = M.verbosity;
  const sections = [
    { id: 'journey', n: 1, title: M.journey.title, sub: M.journey.subtitle, orient: true },
    { id: 'fsm', n: 2, title: M.fsm.title, sub: M.fsm.subtitle },
    { id: 'review-loop', n: 3, title: M.reviewLoop.title, sub: M.reviewLoop.subtitle },
    { id: 'task-loop', n: 4, title: M.taskLoop.title, sub: M.taskLoop.subtitle },
    { id: 'steering', n: 5, title: M.steering.title, sub: M.steering.subtitle },
  ];
  const figure = (sec, v, orient) => {
    const key = orient ? `${sec.id}-${orient}-${v}` : `${sec.id}-${v}`;
    return `<div class="fig" data-v="${v}"${orient ? ` data-o="${orient}"` : ''}>${svgs[key]}</div>`;
  };
  const body = sections.map((sec) => `
<section id="${sec.id}" aria-label="${esc(sec.title)}">
  <div class="scroll">${Object.keys(V).map((v) => sec.orient ? ['lr', 'tb'].map((o) => figure(sec, v, o)).join('') : figure(sec, v)).join('')}</div>
</section>`).join('');

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SDD Lifecycle Diagrams</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&family=Geist:wght@400;600&family=Geist+Mono:wght@400;600&display=swap">
<style>
:root {
  ${light}
  --font-display: Fraunces, 'Iowan Old Style', Georgia, serif;
  --font-sans: Geist, 'Geist Sans', Inter, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${dark} color-scheme: dark; } }
:root[data-theme="dark"] { ${dark} color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--d-bg); color: var(--d-fg); font-family: var(--font-sans); font-size: 15px; line-height: 1.5; padding-block: 0 80px; padding-inline: clamp(16px, 4vw, 48px); }
header { max-width: 72ch; padding-block: 48px 8px; }
h1 { font-family: var(--font-display); font-weight: 400; font-size: 2.25rem; line-height: 1.1; letter-spacing: -0.025em; margin: 0 0 6px; text-wrap: balance; }
h1 + .rule { width: 40px; height: 1.5px; background: var(--d-brand); margin: 12px 0 18px; }
h2 { font-family: var(--font-display); font-weight: 400; font-size: 1.75rem; line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 4px; }
.eyebrow { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--d-brand); margin: 0 0 8px; }
.eyebrow .slash { margin-right: 6px; }
.sub { color: var(--d-mutedFg); margin: 0 0 16px; max-width: 65ch; }
.intro { color: var(--d-fg); max-width: 65ch; }
.controls { display: flex; flex-wrap: wrap; gap: 20px 32px; align-items: flex-start; padding-block: 18px 12px; border-top: 1px solid var(--d-border); border-bottom: 1px solid var(--d-border); margin-block: 20px 8px; }
.ctl { display: flex; flex-direction: column; gap: 6px; }
.ctl > span { font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--d-mutedFg); }
.seg { display: inline-flex; border: 1px solid var(--d-border); border-radius: 999px; overflow: hidden; }
.seg button { font: inherit; font-size: 13px; background: none; border: 0; color: var(--d-fg); padding: 6px 14px; cursor: pointer; }
.seg button + button { border-left: 1px solid var(--d-border); }
.seg button[aria-pressed="true"] { background: var(--d-fg); color: var(--d-bg); }
.seg button:focus-visible { outline: 2px solid var(--d-brand); outline-offset: -2px; }
section { padding-block: 40px 8px; border-top: 1px solid var(--d-border); margin-top: 24px; }
.scroll { overflow-x: auto; padding-bottom: 8px; }
.fig { display: none; }
.fig svg { display: block; max-width: none; height: auto; }
.fig.on { display: block; }
.fig .stage-g { cursor: pointer; }
.fig .stage-g:hover .stage { stroke: var(--d-fg); }
.hint { font-size: 12.5px; color: var(--d-mutedFg); margin: 8px 0 0; }
.files { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--d-border); color: var(--d-mutedFg); font-size: 13px; max-width: 72ch; }
.files code { font-family: var(--font-mono); font-size: 12px; color: var(--d-fg); }
@media (prefers-reduced-motion: no-preference) { .seg button { transition: background .15s, color .15s; } }
</style>
<header>
  <p class="eyebrow"><span class="slash">/</span> spec-workflow</p>
  <h1>The SDD lifecycle, drawn</h1>
  <div class="rule"></div>
  <p class="intro">Five diagrams of what spec-driven development prescribes: the whole journey from a blank page to a closed spec, the state machine underneath it, the two loops that do most of the work, and how the steering documents become a queue of specs. Read them before the text, not instead of it.</p>
</header>
<div class="controls">
  <div class="ctl"><span>Detail</span><div class="seg" id="ctl-v">${Object.entries(V).map(([k, v], i) => `<button type="button" data-v="${k}" aria-pressed="${i === 0}">${esc(v.label)}</button>`).join('')}</div></div>
  <div class="ctl"><span>Journey layout</span><div class="seg" id="ctl-o"><button type="button" data-o="lr" aria-pressed="true">Left to right</button><button type="button" data-o="tb" aria-pressed="false">Top to bottom</button></div></div>
  <div class="ctl"><span>Theme</span><div class="seg" id="ctl-t"><button type="button" data-t="" aria-pressed="true">System</button><button type="button" data-t="light" aria-pressed="false">Light</button><button type="button" data-t="dark" aria-pressed="false">Dark</button></div></div>
</div>
<p class="hint">Click a stage in the journey to jump to the diagram that zooms into it.</p>
${body}
<p class="files">Source: <code>docs/diagrams/model.mjs</code> holds the words, <code>render.mjs</code> draws them. Static SVGs for every combination are in <code>docs/diagrams/svg/</code>.</p>
<script>
(function () {
  var state = { v: 'roles', o: 'lr' };
  try { var s = JSON.parse(localStorage.getItem('sdd-diagrams') || '{}'); if (s.v) state.v = s.v; if (s.o) state.o = s.o; } catch (e) {}
  function apply() {
    document.querySelectorAll('.fig').forEach(function (f) {
      var on = f.dataset.v === state.v && (!f.dataset.o || f.dataset.o === state.o);
      f.classList.toggle('on', on);
    });
    document.querySelectorAll('#ctl-v button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === state.v)); });
    document.querySelectorAll('#ctl-o button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.o === state.o)); });
    try { localStorage.setItem('sdd-diagrams', JSON.stringify(state)); } catch (e) {}
  }
  document.getElementById('ctl-v').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { state.v = b.dataset.v; apply(); } });
  document.getElementById('ctl-o').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { state.o = b.dataset.o; apply(); } });
  document.getElementById('ctl-t').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.t) document.documentElement.setAttribute('data-theme', b.dataset.t); else document.documentElement.removeAttribute('data-theme');
    document.querySelectorAll('#ctl-t button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });
  var zoom = { steering: 'steering', decomposition: 'steering', requirements: 'review-loop', design: 'review-loop', tasks: 'review-loop', implementation: 'task-loop', retrospective: 'fsm', closeout: 'fsm' };
  document.addEventListener('click', function (e) {
    var g = e.target.closest('.stage-g'); if (!g) return;
    var id = zoom[g.dataset.stage]; if (id) document.getElementById(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  apply();
})();
</script>`;
}

// ---------------------------------------------------------------------------
// Output.

const builders = {
  'journey-lr': (P, V) => journeyLR(P, V),
  'journey-tb': (P, V) => journeyTB(P, V),
  fsm: (P, V) => fsmDiagram(P, V),
  'review-loop': (P, V) => flowDiagram(M.reviewLoop, reviewLayout, P, V, 'diagram 3 · review loop'),
  'task-loop': (P, V) => flowDiagram(M.taskLoop, taskLayout, P, V, 'diagram 4 · implementation loop'),
  steering: (P, V) => steeringDiagram(P, V),
};

const outDir = join(here, 'svg');
mkdirSync(outDir, { recursive: true });
let count = 0;
for (const [name, build] of Object.entries(builders)) {
  for (const [vk, V] of Object.entries(M.verbosity)) {
    for (const theme of ['light', 'dark']) {
      writeFileSync(join(outDir, `${name}-${vk}-${theme}.svg`), build(palette(theme, true), V));
      count++;
    }
  }
}
// The page uses CSS variables so one SVG per diagram and verbosity follows the theme.
const pageSvgs = {};
for (const [name, build] of Object.entries(builders)) {
  for (const [vk, V] of Object.entries(M.verbosity)) {
    pageSvgs[`${name}-${vk}`] = build(palette('light', false), V).replace(/<svg /, '<svg style="background:var(--d-bg)" ');
  }
}
writeFileSync(join(here, 'index.html'), page(pageSvgs));
console.log(`wrote ${count} SVGs and index.html to ${here}`);
