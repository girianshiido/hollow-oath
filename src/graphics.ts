import { HEROES, SEALS, type HeroId, type Strike } from './content.ts';

type Effect = {kind: Strike | 'heal' | 'hurt' | 'seal'; start: number; seeds: number[]};
const COLORS: Record<Effect['kind'], string> = {
  steel: '#ffe6ba', ember: '#ff924c', rime: '#9fe9ff', storm: '#d1adff',
  heal: '#9effc1', hurt: '#ff604d', seal: '#ffe4a3'
};

const BLADE_DURATION: Record<HeroId, number> = {
  vanguard: 440, hexweaver: 355, nightblade: 335, oathkeeper: 530
};
function drawBlade(ctx: CanvasRenderingContext2D, hero: HeroId, x: number, y: number,
  size: number, t: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.shadowColor = color;
  ctx.shadowBlur = 13;
  const fade = 1 - t;
  ctx.lineWidth = 0.01 * fade;
  ctx.beginPath();
  switch (hero) {
    case 'vanguard': {
      // A heavy diagonal cut with a broad, incandescent leading edge.
      const drop = Math.min(1, t * 5) * .14;
      ctx.moveTo(-.29, -.35 + drop);
      ctx.quadraticCurveTo(-.04, -.25 + drop, .29, .29 + drop);
      ctx.lineWidth = .034 * fade;
      ctx.stroke();
      ctx.shadowBlur = 3;
      ctx.lineWidth = .009 * fade;
      ctx.strokeStyle = '#fff4d7';
      ctx.stroke();
      break;
    }
    case 'hexweaver': {
      // A slender rapier thrust and a violet diamond on impact.
      const reach = Math.min(1, t * 5) * .34;
      ctx.moveTo(-.44 + reach, .20 - reach * .42);
      ctx.lineTo(.11 + reach, -.034 - reach * .42);
      ctx.stroke();
      const r = .045 + t * .15;
      ctx.translate(.12, -.045);
      ctx.rotate(-.4);
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath();
      ctx.lineWidth = .004 * fade;
      ctx.stroke();
      break;
    }
    case 'nightblade': {
      // Two crossing cuts, with the return cut arriving just behind the first.
      const dash = Math.min(1, t * 6) * .13;
      ctx.moveTo(-.30 + dash, .22);
      ctx.quadraticCurveTo(-.01 + dash, -.12, .26 + dash, -.22);
      ctx.stroke();
      if (t >= .12) {
        ctx.beginPath();
        ctx.moveTo(-.29 - dash, -.16);
        ctx.quadraticCurveTo(-.01 - dash, .13, .28 - dash, .21);
        ctx.lineWidth = .007 * fade;
        ctx.stroke();
      }
      break;
    }
    case 'oathkeeper': {
      // A rising crescent followed by a short halo along the blade path.
      const lift = Math.min(1, t * 4) * .17;
      ctx.moveTo(-.36, .20 - lift);
      ctx.quadraticCurveTo(.22, .38 - lift, .27, -.28 - lift);
      ctx.lineWidth = .018 * fade;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(.06, .14 - lift, .09 + t * .30, .035 + t * .13, -.45, 0, Math.PI * 2);
      ctx.lineWidth = .004 * fade;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

export class Effects {
  private canvas: HTMLCanvasElement;
  private hero: HeroId;
  private ctx: CanvasRenderingContext2D | null;
  private effects: Effect[] = [];
  private width = 0;
  private height = 0;
  private observer: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, hero: HeroId) {
    this.canvas = canvas;
    this.hero = hero;
    this.ctx = canvas.getContext('2d');
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
  }
  dispose(): void { this.observer.disconnect(); }
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  add(kind: Effect['kind']): void {
    this.effects.push({kind, start: performance.now(), seeds: Array.from({length: 16}, () => Math.random())});
  }
  draw(now: number): void {
    const {ctx, width: w, height: h, effects} = this;
    if (!ctx || !effects.length) return;
    ctx.clearRect(0, 0, w, h);
    const size = Math.min(w, h);
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i]!;
      const duration = e.kind === 'heal' ? 800 : e.kind === 'steel' ? BLADE_DURATION[this.hero] : 490;
      const t = Math.max(0, (now - e.start) / duration);
      if (t >= 1) { effects.splice(i, 1); continue; }
      const x = w * 0.5, y = h * (e.kind === 'heal' ? 0.75 : 0.49);
      const a = 1 - t;
      const color = e.kind === 'steel' ? HEROES[this.hero].color : COLORS[e.kind];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      if (e.kind === 'steel') {
        drawBlade(ctx, this.hero, x, y, size, t, color);
      } else if (e.kind === 'storm') {
        ctx.lineWidth = 3 * a;
        ctx.shadowColor = color; ctx.shadowBlur = 18;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.moveTo(x + (j - 1) * size * 0.13, 0);
          for (let k = 1; k <= 6; k++) ctx.lineTo(x + (e.seeds[j * 4 + k]! - 0.5) * size * 0.38, y * k / 6);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      } else if (e.kind === 'ember' || e.kind === 'rime') {
        const travel = Math.min(t / 0.43, 1);
        const px = x + (1 - travel) * size * 0.41;
        const py = y + (1 - travel) * size * 0.51;
        const r = Math.max(1, size * (0.037 + (travel === 1 ? 0.19 * (t - 0.43) : 0)));
        if (e.kind === 'ember') {
          const glow = ctx.createRadialGradient(px, py, 1, px, py, r);
          glow.addColorStop(0, '#fff4b5'); glow.addColorStop(0.45, '#ff843b'); glow.addColorStop(1, '#fe481600');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.lineWidth = 4 * a;
          ctx.shadowColor = color; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.moveTo(px - r, py - r); ctx.lineTo(px + r * 1.6, py + r * 1.8); ctx.stroke();
        }
      } else if (e.kind === 'seal' || e.kind === 'heal') {
        ctx.lineWidth = 1.8 * a;
        ctx.beginPath();
        ctx.ellipse(x, y, size * (0.11 + t * 0.4), size * (0.08 + t * 0.28), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const glow = ctx.createRadialGradient(x, y, size * 0.2, x, y, Math.max(w, h) * 0.71);
        glow.addColorStop(0, '#ff332600'); glow.addColorStop(1, '#ff33265c');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
      }
      if (e.kind !== 'hurt') {
        ctx.fillStyle = color;
        for (let j = 0; j < e.seeds.length; j++) {
          const seed = e.seeds[j]!;
          const angle = j / e.seeds.length * Math.PI * 2;
          const distance = size * t * (0.15 + seed * 0.3);
          const xx = x + Math.cos(angle) * distance;
          const yy = y + Math.sin(angle) * distance - (e.kind === 'heal' ? t * size * 0.35 : 0);
          ctx.fillRect(xx, yy, 1 + seed * 3 * a, 1 + seed * 3 * a);
        }
      }
      ctx.restore();
    }
  }
}
export const strikeColor = (strike: Strike) => SEALS[strike].color;
