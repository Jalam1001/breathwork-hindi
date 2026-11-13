// Animated aurora background: a few large soft colour blobs that drift slowly, plus floating light particles.
// Rendered at reduced resolution (it's all soft gradients), capped at ~30 fps, paused when the page is hidden,
// and drawn once (static) when the user prefers reduced motion.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const PALETTES = {
  home: ['#22D3EE', '#A78BFA', '#FB7185', '#34D399'],
  in: ['#22D3EE', '#2DD4BF', '#38BDF8', '#5EEAD4'],
  hold: ['#A78BFA', '#8B5CF6', '#C084FC', '#818CF8'],
  out: ['#FB7185', '#F59E0B', '#F97316', '#F472B6'],
};

export class Aurora {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d', { alpha: false });
    this.cols = PALETTES.home.map(hex); this.target = this.cols.map((c) => [...c]);
    this.energy = 0.5; this.energyT = 0.5; this.dark = true; this.night = false; this.dirty = true;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.parts = Array.from({ length: 34 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, s: 0.006 + Math.random() * 0.014, p: Math.random() * 6.28 }));
    this.t0 = performance.now(); this.last = 0;
    this.loop = this.loop.bind(this);
    addEventListener('resize', () => this.resize());
    this.reduced.addEventListener?.('change', () => { this.dirty = true; });
    this.resize();
  }
  resize() {
    const s = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
    this.scale = s; this.w = this.c.width = Math.max(1, Math.round(innerWidth * s)); this.h = this.c.height = Math.max(1, Math.round(innerHeight * s));
    this.dirty = true;
  }
  setPalette(list) {
    const next = list.map(hex);
    if (next.every((c, i) => c.every((v, j) => v === this.target[i][j]))) return;
    this.target = next; this.dirty = true;
  }
  setEnergy(e) { this.energyT = e; }
  setMode({ dark = this.dark, night = this.night }) { if (dark !== this.dark || night !== this.night) { this.dark = dark; this.night = night; this.dirty = true; } }
  start() { if (!this.raf) this.raf = requestAnimationFrame(this.loop); }
  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    if (this.reduced.matches) {
      if (this.dirty) { this.cols = this.target.map((c) => [...c]); this.energy = 0.5; this.draw(0); this.dirty = false; }
      return;
    }
    if (now - this.last < 33) return; // ~30 fps is plenty for slow gradients
    const dt = Math.min(120, now - this.last || 33); this.last = now;
    const k = 1 - Math.exp(-dt / 900), ke = 1 - Math.exp(-dt / 300);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) this.cols[i][j] += (this.target[i][j] - this.cols[i][j]) * k;
    this.energy += (this.energyT - this.energy) * ke;
    this.draw((now - this.t0) / 1000);
  }
  draw(t) {
    const { g, w, h } = this, dark = this.dark, e = this.energy;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = dark ? (this.night ? '#02040A' : '#060A18') : '#EEF1FB';
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    const A = (dark ? 0.4 : 0.32) * (this.night ? 0.5 : 1) * (0.7 + 0.45 * e), R = Math.max(w, h);
    const blobs = [[0.2, 0.18, 0.31, 0], [0.82, 0.3, 0.23, 1.7], [0.3, 0.82, 0.19, 3.1], [0.78, 0.88, 0.27, 4.4]];
    blobs.forEach(([bx, by, sp, ph], i) => {
      const x = w * (bx + 0.2 * Math.sin(t * sp * 0.5 + ph)), y = h * (by + 0.15 * Math.cos(t * sp * 0.4 + ph * 1.3));
      const r = R * (0.4 + 0.16 * e + 0.05 * Math.sin(t * 0.3 + ph));
      const c = this.cols[i].map(Math.round).join(',');
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${c},${A})`); gr.addColorStop(0.45, `rgba(${c},${A * 0.4})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    const pc = dark ? '255,255,255' : this.cols[1].map(Math.round).join(',');
    for (const p of this.parts) {
      const y = (((p.y - t * p.s) % 1) + 1) % 1, x = p.x + 0.02 * Math.sin(t * 0.5 + p.p);
      const a = (dark ? 0.55 : 0.5) * (0.45 + 0.55 * Math.sin(t * 0.8 + p.p) ** 2) * (this.night ? 0.55 : 1);
      g.fillStyle = `rgba(${pc},${a.toFixed(3)})`;
      g.beginPath(); g.arc(x * w, y * h, p.r * this.scale * 2.2 * (0.8 + 0.4 * e), 0, 6.283); g.fill();
    }
  }
}
