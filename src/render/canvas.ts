import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../config/constants';
import { Attractor } from '../entities/attractor';
import { Door } from '../entities/door';
import { Item } from '../entities/item';
import { Kitten } from '../entities/kitten';
import { Surface } from '../entities/surface';
import { PhysicsWorld } from '../engine/physics';

/**
 * Custom Canvas 2D renderer drawing Matter bodies as flat shapes. Keeps an
 * internal 960x540 logical coordinate space and scales the canvas to fit the
 * window while preserving the 16:9 aspect ratio.
 */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** The canvas element, for attaching pointer listeners. */
  get element(): HTMLCanvasElement {
    return this.canvas;
  }

  /** Convert a screen (client) coordinate to logical game coordinates. */
  clientToLogical(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (LOGICAL_WIDTH / r.width),
      y: (clientY - r.top) * (LOGICAL_HEIGHT / r.height),
    };
  }

  /** Fit the logical 16:9 frame into the window, crisp on retina displays. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.min(
      window.innerWidth / LOGICAL_WIDTH,
      window.innerHeight / LOGICAL_HEIGHT,
    );
    this.canvas.style.width = `${Math.round(LOGICAL_WIDTH * scale)}px`;
    this.canvas.style.height = `${Math.round(LOGICAL_HEIGHT * scale)}px`;
    this.canvas.width = Math.round(LOGICAL_WIDTH * dpr);
    this.canvas.height = Math.round(LOGICAL_HEIGHT * dpr);
    // Draw in logical coordinates; the transform maps them to device pixels.
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** When true, the chaos view is dressed up as a security / pet-cam feed. */
  camOverlay = false;

  render(world: PhysicsWorld): void {
    this.drawRoom();
    for (const surface of world.surfaces) this.drawSurface(surface);
    for (const attractor of world.attractors) this.drawAttractor(attractor);
    for (const door of world.doors) this.drawCabinetBack(door);
    for (const item of world.items) this.drawItem(item);
    for (const door of world.doors) this.drawDoor(door);
    for (const kitten of world.kittens) this.drawKitten(kitten);
    if (this.camOverlay) this.drawCamOverlay();
  }

  /** A cat-cam look: vignette, scanlines, corner brackets, REC dot and clock. */
  private drawCamOverlay(): void {
    const ctx = this.ctx;
    const W = LOGICAL_WIDTH;
    const H = LOGICAL_HEIGHT;
    const now = performance.now();
    ctx.save();

    // Vignette.
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // Scanlines.
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);

    // A soft scan band sweeping down.
    const band = ((now / 14) % (H + 140)) - 70;
    const bg = ctx.createLinearGradient(0, band - 40, 0, band + 40);
    bg.addColorStop(0, 'rgba(255,255,255,0)');
    bg.addColorStop(0.5, 'rgba(255,255,255,0.045)');
    bg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, band - 40, W, 80);

    // Corner viewfinder brackets.
    ctx.strokeStyle = 'rgba(230,230,240,0.5)';
    ctx.lineWidth = 2;
    const m = 18;
    const len = 22;
    const corners: [number, number, number, number][] = [
      [m, m, 1, 1],
      [W - m, m, -1, 1],
      [m, H - m, 1, -1],
      [W - m, H - m, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * len, cy);
      ctx.stroke();
    }

    // Top info row.
    ctx.font = "600 14px ui-monospace, Menlo, Consolas, monospace";
    ctx.textBaseline = 'middle';
    const blink = Math.floor(now / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath();
      ctx.arc(m + 10, m + 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(235,235,245,0.85)';
    ctx.fillText('REC', m + 22, m + 8);
    ctx.fillText('CAT CAM', W / 2 - 34, m + 8);
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
    ctx.textAlign = 'right';
    ctx.fillText(ts, W - m - 6, m + 8);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  /** Cabinet interior, drawn behind its items. */
  private drawCabinetBack(door: Door): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#231d30';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = '#6b5a7a';
    ctx.lineWidth = 4;
    ctx.strokeRect(door.x, door.y, door.w, door.h);
  }

  /** Cabinet door: a swung-open panel when open, a sealing panel when closed. */
  private drawDoor(door: Door): void {
    const ctx = this.ctx;
    if (door.closed) {
      ctx.fillStyle = '#6b5a7a';
      ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(door.x + 6, door.y + 6, door.w - 12, door.h - 12);
      ctx.strokeStyle = '#4a3f5c';
      ctx.lineWidth = 3;
      ctx.strokeRect(door.x + 6, door.y + 6, door.w - 12, door.h - 12);
      // knob
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(door.x + 16, door.y + door.h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Open: a thin door panel hinged on the left, swung outward.
      ctx.fillStyle = 'rgba(107,90,122,0.85)';
      ctx.fillRect(door.x - 10, door.y, 10, door.h);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(door.x - 5, door.y + door.h / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawAttractor(a: Attractor): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.globalAlpha = a.spent ? 0.4 : 1;
    if (a.kind === 'box') {
      // Cardboard box sitting on the floor (origin at its base).
      const w = 58;
      const h = 40;
      ctx.fillStyle = '#b5894f';
      this.roundRect(-w / 2, -h, w, h, 3);
      ctx.fill();
      ctx.fillStyle = '#9c7340';
      ctx.fillRect(-w / 2, -h, w, 7); // open-top shadow
      ctx.strokeStyle = '#8a6636';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // flaps
      ctx.fillStyle = '#c79a5c';
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h);
      ctx.lineTo(-w / 2 - 10, -h - 10);
      ctx.lineTo(-2, -h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w / 2, -h);
      ctx.lineTo(w / 2 + 10, -h - 10);
      ctx.lineTo(2, -h);
      ctx.closePath();
      ctx.fill();
    } else if (a.kind === 'toy') {
      // Toy mouse (origin at its base on a surface).
      ctx.fillStyle = '#9a9aa6';
      ctx.beginPath();
      ctx.ellipse(0, -6, 11, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // ears
      ctx.beginPath();
      ctx.arc(5, -11, 3.5, 0, Math.PI * 2);
      ctx.fill();
      // tail
      ctx.strokeStyle = '#9a9aa6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.quadraticCurveTo(-20, -8, -16, -14);
      ctx.stroke();
      // nose
      ctx.fillStyle = '#e07a8a';
      ctx.beginPath();
      ctx.arc(10, -6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Treat bowl.
      ctx.fillStyle = '#6fa8dc';
      ctx.beginPath();
      ctx.ellipse(0, -4, 20, 9, 0, 0, Math.PI, false);
      ctx.fill();
      ctx.fillStyle = '#c98a4b';
      ctx.beginPath();
      ctx.ellipse(0, -11, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawRoom(): void {
    const ctx = this.ctx;
    const floorTop = LOGICAL_HEIGHT - 40;
    // Wall: a soft vertical gradient so the room has depth.
    const wall = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
    wall.addColorStop(0, '#352d49');
    wall.addColorStop(1, '#271f33');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Baseboard trim where the wall meets the floor.
    ctx.fillStyle = '#231e2f';
    ctx.fillRect(0, floorTop - 12, LOGICAL_WIDTH, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, floorTop - 12, LOGICAL_WIDTH, 2);
  }

  private drawSurface(surface: Surface): void {
    const ctx = this.ctx;
    const b = surface.body;
    const { w, h } = surface.spec;
    ctx.save();
    ctx.translate(b.position.x, b.position.y);

    if (surface.kind === 'floor') {
      ctx.fillStyle = '#3c3450';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(-w / 2, -h / 2, w, 2);
    } else if (surface.kind === 'wall') {
      ctx.fillStyle = '#241f30';
      ctx.fillRect(-w / 2, -h / 2, w, h);
    } else {
      this.drawShelf(w, h);
    }
    ctx.restore();
  }

  /** A mounted wall shelf: contact shadow, brackets, plank, and front edge. */
  private drawShelf(w: number, h: number): void {
    const ctx = this.ctx;
    // Soft contact shadow cast on the wall just below the shelf.
    const sh = ctx.createLinearGradient(0, h / 2, 0, h / 2 + 14);
    sh.addColorStop(0, 'rgba(0,0,0,0.28)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-w / 2 + 3, h / 2, w - 6, 14);

    // Two mounting brackets under the plank, near each end.
    ctx.fillStyle = '#463b57';
    const bw = 9;
    const bh = 13;
    for (const bx of [-w / 2 + 18, w / 2 - 18 - bw]) {
      ctx.beginPath();
      ctx.moveTo(bx, h / 2);
      ctx.lineTo(bx + bw, h / 2);
      ctx.lineTo(bx, h / 2 + bh);
      ctx.closePath();
      ctx.fill();
    }

    // The plank, with a darker front edge and a lit top.
    ctx.fillStyle = '#6b5a7a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#574866';
    ctx.fillRect(-w / 2, h / 2 - 4, w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(-w / 2, -h / 2, w, 3);
  }

  private drawItem(item: Item): void {
    const ctx = this.ctx;
    const b = item.body;
    const { w, h } = item.spec;
    const broken = item.broken;
    // Local box is centered at origin: x in [-w/2, w/2], y in [-h/2, h/2].
    const col = broken ? this.desaturate(item.spec.color) : item.spec.color;

    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    // Telegraph wobble while a kitten winds up to bat it.
    if (item.wobble && !broken) {
      ctx.rotate(Math.sin(performance.now() / 85) * 0.08);
    }

    switch (item.type) {
      case 'mug':
        this.drawMug(w, h, col);
        break;
      case 'vase':
        this.drawVase(w, h, col);
        break;
      case 'laptop':
        this.drawLaptop(w, h, col);
        break;
      case 'lamp':
        this.drawLamp(w, h, col);
        break;
      case 'book':
        this.drawBook(w, h, col);
        break;
      case 'plant':
        this.drawPlant(w, h, col);
        break;
    }

    if (broken) this.drawCracks(w, h);
    ctx.restore();

    // Putty blob indicator at the item's base (drawn upright, unrotated).
    if (item.puttied && !item.broken) {
      ctx.save();
      ctx.translate(b.position.x, b.position.y + h / 2 - 2);
      ctx.fillStyle = '#e8d44f';
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- Item shapes (flat vector art drawn in the item's local box) ---------

  private drawMug(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    const bodyW = w * 0.72;
    const left = -w / 2;
    // Handle (behind body).
    ctx.strokeStyle = this.shade(col, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(left + bodyW - 1, 1, h * 0.26, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Body.
    ctx.fillStyle = col;
    this.roundRect(left, -h / 2, bodyW, h, 5);
    ctx.fill();
    // Rim.
    ctx.fillStyle = this.shade(col, 1.18);
    this.roundRect(left, -h / 2, bodyW, h * 0.16, 3);
    ctx.fill();
    // Inside the rim (the cup opening).
    ctx.fillStyle = this.shade(col, 0.6);
    ctx.beginPath();
    ctx.ellipse(left + bodyW / 2, -h / 2 + h * 0.08, bodyW / 2 - 3, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawVase(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    const cx = 0;
    const top = -h / 2;
    const bot = h / 2;
    // Silhouette: narrow mouth, flares to a round belly, tapers to a small foot.
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.18, top); // mouth left
    ctx.lineTo(cx + w * 0.18, top); // mouth right
    ctx.quadraticCurveTo(cx + w * 0.16, top + h * 0.18, cx + w * 0.42, top + h * 0.45);
    ctx.quadraticCurveTo(cx + w * 0.5, bot - h * 0.12, cx + w * 0.2, bot); // to foot
    ctx.lineTo(cx - w * 0.2, bot);
    ctx.quadraticCurveTo(cx - w * 0.5, bot - h * 0.12, cx - w * 0.42, top + h * 0.45);
    ctx.quadraticCurveTo(cx - w * 0.16, top + h * 0.18, cx - w * 0.18, top);
    ctx.closePath();
    ctx.fill();
    // Rim band.
    ctx.fillStyle = this.shade(col, 1.2);
    ctx.fillRect(cx - w * 0.18, top, w * 0.36, h * 0.06);
    // Glossy highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.14, top + h * 0.45, w * 0.06, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawLaptop(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    const screenH = h * 0.78;
    const baseH = h * 0.2;
    const baseY = h / 2 - baseH;
    // Screen (lid).
    ctx.fillStyle = this.shade(col, 0.9);
    this.roundRect(-w / 2 + 3, -h / 2, w - 6, screenH, 3);
    ctx.fill();
    // Display.
    ctx.fillStyle = '#2d3a4a';
    this.roundRect(-w / 2 + 7, -h / 2 + 4, w - 14, screenH - 8, 2);
    ctx.fill();
    // Screen glint.
    ctx.fillStyle = 'rgba(140,180,220,0.35)';
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 9, -h / 2 + screenH - 6);
    ctx.lineTo(-w / 2 + 9 + (w - 16) * 0.4, -h / 2 + 6);
    ctx.lineTo(-w / 2 + 9 + (w - 16) * 0.2, -h / 2 + 6);
    ctx.lineTo(-w / 2 + 9, -h / 2 + screenH * 0.5);
    ctx.closePath();
    ctx.fill();
    // Base (keyboard deck), slightly wider.
    ctx.fillStyle = this.shade(col, 1.1);
    this.roundRect(-w / 2, baseY, w, baseH, 2);
    ctx.fill();
    ctx.fillStyle = this.shade(col, 0.8);
    ctx.fillRect(-w * 0.12, baseY + baseH * 0.3, w * 0.24, baseH * 0.35); // trackpad
  }

  private drawLamp(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    const top = -h / 2;
    const bot = h / 2;
    // Base.
    ctx.fillStyle = this.shade(col, 0.7);
    ctx.beginPath();
    ctx.moveTo(-w * 0.26, bot);
    ctx.lineTo(w * 0.26, bot);
    ctx.lineTo(w * 0.16, bot - h * 0.1);
    ctx.lineTo(-w * 0.16, bot - h * 0.1);
    ctx.closePath();
    ctx.fill();
    // Stem.
    ctx.fillStyle = this.shade(col, 0.85);
    ctx.fillRect(-w * 0.05, top + h * 0.42, w * 0.1, h * 0.5);
    // Shade (trapezoid).
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, top + h * 0.42);
    ctx.lineTo(w * 0.2, top + h * 0.42);
    ctx.lineTo(w * 0.34, top);
    ctx.lineTo(-w * 0.34, top);
    ctx.closePath();
    ctx.fill();
    // Warm glow at the shade's lower lip.
    ctx.fillStyle = 'rgba(255,240,180,0.5)';
    ctx.fillRect(-w * 0.2, top + h * 0.42 - 2, w * 0.4, 3);
  }

  private drawBook(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    // Cover.
    ctx.fillStyle = col;
    this.roundRect(-w / 2, -h / 2, w, h, 2);
    ctx.fill();
    // Pages (right edge).
    ctx.fillStyle = '#efe7d2';
    ctx.fillRect(w / 2 - 4, -h / 2 + 2, 3, h - 4);
    // Spine band (left).
    ctx.fillStyle = this.shade(col, 0.75);
    ctx.fillRect(-w / 2, -h / 2, 5, h);
    // Title line.
    ctx.fillStyle = this.shade(col, 1.3);
    ctx.fillRect(-w * 0.2, -h * 0.1, w * 0.3, 2);
  }

  private drawPlant(w: number, h: number, col: string): void {
    const ctx = this.ctx;
    const bot = h / 2;
    const potTop = h * 0.12;
    // Pot.
    ctx.fillStyle = '#b5724a';
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, potTop);
    ctx.lineTo(w * 0.3, potTop);
    ctx.lineTo(w * 0.22, bot);
    ctx.lineTo(-w * 0.22, bot);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9855a';
    ctx.fillRect(-w * 0.32, potTop - 3, w * 0.64, 5); // pot rim
    // Foliage: a few leaf blobs.
    ctx.fillStyle = col;
    const leaves: [number, number, number][] = [
      [0, -h * 0.5, w * 0.2],
      [-w * 0.22, -h * 0.28, w * 0.17],
      [w * 0.22, -h * 0.28, w * 0.17],
      [-w * 0.1, -h * 0.1, w * 0.14],
      [w * 0.12, -h * 0.12, w * 0.14],
    ];
    for (const [lx, ly, r] of leaves) {
      ctx.beginPath();
      ctx.ellipse(lx, ly, r, r * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // A dangling vine.
    ctx.strokeStyle = this.shade(col, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, -h * 0.2);
    ctx.quadraticCurveTo(w * 0.5, 0, w * 0.4, potTop);
    ctx.stroke();
  }

  private drawCracks(w: number, h: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 6);
    ctx.lineTo(-w * 0.1, 0);
    ctx.lineTo(w / 3, -h / 2);
    ctx.moveTo(-w * 0.1, 0);
    ctx.lineTo(w / 5, h / 2);
    ctx.moveTo(-w * 0.1, 0);
    ctx.lineTo(w / 2, h / 5);
    ctx.stroke();
  }

  private shade(hex: string, factor: number): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const clamp = (c: number) => Math.max(0, Math.min(255, Math.round(c)));
    const r = clamp(((n >> 16) & 255) * factor);
    const g = clamp(((n >> 8) & 255) * factor);
    const b = clamp((n & 255) * factor);
    return `rgb(${r},${g},${b})`;
  }

  private drawKitten(kitten: Kitten): void {
    const ctx = this.ctx;
    const { x, y } = kitten.body.position;
    const w = kitten.w;
    const h = kitten.h;
    const dir = kitten.facing;
    const cfg = kitten.cfg;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1); // head/front at +x, tail at -x

    // A pre-bat wiggle: small rocking.
    if (kitten.wigglePhase > 0) {
      ctx.rotate(Math.sin(kitten.wigglePhase * Math.PI * 6) * 0.08);
    }

    const { coat, stripe, bib, nose, innerEar, eye } = cfg;
    const bodyR = 11;

    // --- Tail (behind body), striped. A gentle idle flick sways the tip. ---
    const idle = kitten.state === 'nap' || kitten.state === 'wander' || kitten.state === 'stalk';
    const flick = idle ? Math.sin(performance.now() / 260 + (kitten.who === 'A' ? 0 : 1.7)) * 7 : 0;
    const t0x = -w / 2 + 3;
    const t0y = 1;
    const t1x = -w / 2 - 16 - flick * 0.5; // control point
    const t1y = -2;
    const t2x = -w / 2 - 12 - flick; // tip sways
    const t2y = -20;
    ctx.strokeStyle = coat;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(t0x, t0y);
    ctx.quadraticCurveTo(t1x, t1y, t2x, t2y);
    ctx.stroke();
    // Tail bands: sample the actual curve and lay each band across it,
    // perpendicular to the tail's direction at that point.
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 2.6;
    for (const t of [0.42, 0.64, 0.85]) {
      const mt = 1 - t;
      const px = mt * mt * t0x + 2 * mt * t * t1x + t * t * t2x;
      const py = mt * mt * t0y + 2 * mt * t * t1y + t * t * t2y;
      const dx = 2 * mt * (t1x - t0x) + 2 * t * (t2x - t1x);
      const dy = 2 * mt * (t1y - t0y) + 2 * t * (t2y - t1y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len; // perpendicular
      const ny = dx / len;
      const half = 3.3;
      ctx.beginPath();
      ctx.moveTo(px - nx * half, py - ny * half);
      ctx.lineTo(px + nx * half, py + ny * half);
      ctx.stroke();
    }

    // --- Body base coat. ---
    ctx.fillStyle = coat;
    this.roundRect(-w / 2, -h / 2, w, h, bodyR);
    ctx.fill();

    // --- Mackerel stripes along the back (clipped to the body). ---
    ctx.save();
    this.roundRect(-w / 2, -h / 2, w, h, bodyR);
    ctx.clip();
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 4; i++) {
      const sx = i * 7 - 2;
      ctx.beginPath();
      ctx.moveTo(sx, -h / 2 - 2);
      ctx.quadraticCurveTo(sx + 5, -h / 4, sx + 2, 2);
      ctx.stroke();
    }
    // spine stripe
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 3);
    ctx.lineTo(w / 2 - 6, -h / 2 + 3);
    ctx.stroke();
    ctx.restore();

    // --- White bib + white front paws (only on the bicolor kitten). ---
    if (cfg.whiteMarkings) {
      ctx.fillStyle = bib;
      ctx.beginPath();
      ctx.ellipse(w / 2 - 12, h / 2 - 7, 11, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      this.roundRect(w / 2 - 15, h / 2 - 5, 7, 6, 2);
      ctx.fill();
      this.roundRect(w / 2 - 6, h / 2 - 5, 7, 6, 2);
      ctx.fill();
    }

    // --- Head. ---
    const hx = w / 2 - 6; // head center x
    const hy = -h / 2 + 4;
    // ears
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy - 2);
    ctx.lineTo(hx - 12, hy - 15);
    ctx.lineTo(hx - 2, hy - 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 2, hy - 5);
    ctx.lineTo(hx + 11, hy - 15);
    ctx.lineTo(hx + 8, hy - 2);
    ctx.closePath();
    ctx.fill();
    // inner ears
    ctx.fillStyle = innerEar;
    ctx.beginPath();
    ctx.moveTo(hx - 8, hy - 3);
    ctx.lineTo(hx - 10, hy - 11);
    ctx.lineTo(hx - 4, hy - 5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 4, hy - 5);
    ctx.lineTo(hx + 9, hy - 11);
    ctx.lineTo(hx + 7, hy - 3);
    ctx.closePath();
    ctx.fill();
    // head shape
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(hx, hy + 5, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // forehead tabby "M" stripes
    ctx.strokeStyle = stripe;
    ctx.lineWidth = 1.4;
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(hx + dx, hy - 1);
      ctx.lineTo(hx + dx * 1.2, hy + 4);
      ctx.stroke();
    }
    // muzzle (lighter)
    ctx.fillStyle = bib;
    ctx.beginPath();
    ctx.ellipse(hx + 3, hy + 9, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // eyes (green)
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(hx - 1, hy + 4, 3, 0, Math.PI * 2);
    ctx.arc(hx + 7, hy + 4, 3, 0, Math.PI * 2);
    ctx.fill();
    // pupils
    ctx.fillStyle = '#1a1510';
    ctx.beginPath();
    ctx.ellipse(hx - 1, hy + 4, 1.1, 2.4, 0, 0, Math.PI * 2);
    ctx.ellipse(hx + 7, hy + 4, 1.1, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.fillStyle = nose;
    ctx.beginPath();
    ctx.moveTo(hx + 2, hy + 8);
    ctx.lineTo(hx + 5, hy + 8);
    ctx.lineTo(hx + 3.5, hy + 10);
    ctx.closePath();
    ctx.fill();
    // whiskers
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 0.7;
    for (const dy of [-1, 1.5]) {
      ctx.beginPath();
      ctx.moveTo(hx + 5, hy + 9 + dy);
      ctx.lineTo(hx + 16, hy + 7 + dy * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  private desaturate(hex: string): string {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return '#7a7480';
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const gray = Math.round(0.4 * r + 0.4 * g + 0.2 * b);
    const mix = (c: number) => Math.round(c * 0.4 + gray * 0.6);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }
}
