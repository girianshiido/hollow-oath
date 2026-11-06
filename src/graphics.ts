import { SEALS, type Strike } from './content.ts';

type Effect = {kind: Strike | 'heal' | 'hurt' | 'seal'; start: number; seeds: number[]};
const COLORS: Record<Effect['kind'], string> = {
  steel: '#ffe6ba', ember: '#ff924c', rime: '#9fe9ff', storm: '#d1adff',
  heal: '#9effc1', hurt: '#ff604d', seal: '#ffe4a3'
};

export class Effects {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private effects: Effect[] = [];
  private width = 0;
  private height = 0;
  private observer: ResizeObserver;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
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
      const t = (now - e.start) / (e.kind === 'heal' ? 800 : 490);
      if (t >= 1) { effects.splice(i, 1); continue; }
      const x = w * 0.5, y = h * (e.kind === 'heal' ? 0.75 : 0.49);
      const a = 1 - t;
      const color = COLORS[e.kind];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.globalAlpha = a;
      if (e.kind === 'steel') {
        ctx.shadowColor = '#f3ac57'; ctx.shadowBlur = 15;
        ctx.lineWidth = 5 * a;
        ctx.beginPath();
        ctx.moveTo(x - size * 0.31, y + size * 0.24);
        ctx.quadraticCurveTo(x - size * 0.09, y - size * 0.08, x + size * 0.29, y - size * 0.21);
        ctx.stroke();
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
