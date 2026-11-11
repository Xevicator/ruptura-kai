/*
 * Escenario de combate (Phaser 3). Solo dibuja y anima: la lógica vive en game.js.
 * Todo el arte es procedural (formas), sin imágenes externas.
 */
(function () {
  'use strict';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const hex = (s) => Phaser.Display.Color.HexStringToColor(s).color;

  const BG_W = 1680, BG_H = 944;
  const ASSETS = window.ASSETS || {};

  class StageScene extends Phaser.Scene {
    constructor() { super('stage'); }

    preload() {
      Object.keys(ASSETS).forEach((k) => this.load.image(k, ASSETS[k]));
    }

    create() {
      this.beam = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);

      // Texturas generadas para partículas
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8).generateTexture('dot', 16, 16);
      g.clear().fillStyle(0xffffff, 1).fillRect(0, 0, 4, 14).generateTexture('streak', 4, 14);
      g.destroy();

      this.sparks = this.add.particles(0, 0, 'dot', {
        speed: { min: 120, max: 420 }, lifespan: { min: 250, max: 600 }, scale: { start: 0.6, end: 0 },
        blendMode: 'ADD', emitting: false, tint: [0xffffff, 0xffd166, 0xff5722],
      }).setDepth(7);
      this.kiDust = this.add.particles(0, 0, 'streak', {
        speedY: { min: -260, max: -120 }, speedX: { min: -30, max: 30 }, lifespan: 500,
        scale: { start: 1, end: 0 }, alpha: { start: 0.9, end: 0 }, blendMode: 'ADD', emitting: false,
      }).setDepth(4);

      this.hero = this.makeFighter('hero');
      this.rival = this.makeFighter('rival');
      this.beamState = null;

      this.layout();
      this.scale.on('resize', () => this.layout());
      if (this.onReady) this.onReady();
    }

    // ---------- Disposición adaptable ----------
    layout() {
      const w = this.scale.width, h = this.scale.height;
      this.W = w; this.H = h;
      // Fondos 1680x944: el suelo jugable empieza al 78 % y los pies van hacia el 86 %
      this.bgScale = Math.max(w / BG_W, h / BG_H);
      this.groundY = h - BG_H * (1 - 0.86) * this.bgScale;
      const fighterH = Math.min(BG_H * this.bgScale * 0.42, (this.groundY - 70) * 0.95);
      this.unit = Math.max(0.3, fighterH / 180);
      const gap = Math.min(w * 0.24, 300 * this.unit + 40);
      this.heroX = w / 2 - gap;
      this.rivalX = w / 2 + gap;
      this.placeFighter(this.hero, this.heroX, 1);
      this.placeFighter(this.rival, this.rivalX, -1);
      this.drawBackground();
      if (this.ambZone) this.ambZone.setTo(-40, -40, w + 80, h + 40);
    }

    // ---------- Ambiente de cada escenario (partículas por código) ----------
    setAmbient(key) {
      if (this.amb) { this.amb.destroy(); this.amb = null; }
      if (this.boltTimer) { this.boltTimer.remove(); this.boltTimer = null; }
      this.ambZone = new Phaser.Geom.Rectangle(-40, -40, (this.W || 400) + 80, (this.H || 300) + 40);
      const zone = { type: 'random', source: this.ambZone };
      const u = () => Math.max(this.unit || 1, 0.6);
      const cfg = {
        dunas: { texture: 'streak', config: { emitZone: zone, speedX: { min: 260, max: 480 }, speedY: { min: -20, max: 10 }, lifespan: 2200,
          rotate: { min: 84, max: 96 }, scaleY: { min: 0.6, max: 1.6 }, scaleX: 0.55, alpha: { start: 0.7, end: 0 }, tint: [0xfff1d0, 0xf5d39a], frequency: 20, quantity: 2 } },
        norte: { texture: 'dot', config: { emitZone: zone, speedX: { min: -30, max: 40 }, speedY: { min: 40, max: 110 }, lifespan: 6000,
          scale: { min: 0.1, max: 0.32 }, alpha: { start: 0.9, end: 0.2 }, tint: 0xffffff, frequency: 55, quantity: 1 } },
        trueno: { texture: 'streak', config: { emitZone: zone, speedX: { min: -140, max: -100 }, speedY: { min: 520, max: 700 }, lifespan: 900,
          rotate: 12, scaleY: { min: 1.2, max: 2.2 }, scaleX: 0.6, alpha: { start: 0.55, end: 0.15 }, tint: 0xddd6fe, frequency: 14, quantity: 3 } },
        templo: { texture: 'dot', config: { emitZone: zone, speedX: { min: -20, max: 30 }, speedY: { min: -90, max: -35 }, lifespan: 4200,
          scale: { start: 0.28, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xff5722, 0xffa94d, 0xffd166], blendMode: 'ADD', frequency: 90, quantity: 1 } },
      }[key];
      if (!cfg) return;
      this.amb = this.add.particles(0, 0, cfg.texture, cfg.config).setDepth(5);
      if (key === 'trueno') {
        const strike = () => {
          this.boltTimer = this.time.delayedCall(Phaser.Math.Between(4000, 8000), () => {
            this.lightning(Phaser.Math.Between(this.W * 0.1, this.W * 0.9), true);
            strike();
          });
        };
        strike();
      }
    }

    // Rayo en zigzag desde arriba hasta x (lejano = de fondo, sin tocar el suelo)
    lightning(x, far) {
      const g = this.add.graphics().setDepth(far ? 1 : 8).setBlendMode('ADD');
      const yEnd = far ? this.H * 0.45 : this.groundY - 20 * this.unit;
      const pts = [[x + Phaser.Math.Between(-40, 40), -10]];
      const segs = 7;
      for (let i = 1; i <= segs; i++) pts.push([x + (i === segs ? 0 : Phaser.Math.Between(-28, 28) * this.unit), -10 + (yEnd + 10) * (i / segs)]);
      const draw = (w, col, a) => { g.lineStyle(w, col, a).beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => g.lineTo(p[0], p[1])); g.strokePath(); };
      draw((far ? 6 : 12) * this.unit, 0xa78bfa, 0.35);
      draw((far ? 2 : 4) * this.unit, 0xffffff, 0.95);
      this.cameras.main.flash(far ? 120 : 200, 200, 190, 255, true);
      this.tweens.add({ targets: g, alpha: 0, duration: far ? 260 : 420, onComplete: () => g.destroy() });
      if (!far) this.sparks.emitParticleAt(x, yEnd, 14);
    }

    // ---------- Efectos de reglas y técnicas de maestros ----------
    fx(name, side) {
      const f = side === 'rival' ? this.rival : this.hero;
      const midY = this.groundY - 95 * this.unit;
      const label = (txt, col) => this.floatText(f.baseX, this.groundY - 215 * this.unit, txt, col, 26);
      if (name === 'heat') {
        [this.hero, this.rival].forEach((x) => {
          const r = this.add.ellipse(x.c.x, this.groundY - 85 * this.unit, 120 * this.unit, 210 * this.unit, 0xff8a3d, 0.28).setDepth(4).setBlendMode('ADD');
          this.tweens.add({ targets: r, alpha: 0, scaleY: 1.15, y: r.y - 20 * this.unit, duration: 700, onComplete: () => r.destroy() });
          this.floatText(x.baseX, this.groundY - 170 * this.unit, '-5 CORAZA', '#ffb86b', 20);
        });
      } else if (name === 'bolt') {
        this.lightning(f.c.x, false);
        label('+30 KAI', '#c4b5fd');
      } else if (name === 'boltMiss') {
        this.lightning(this.W / 2, false);
      } else if (name === 'burn' || name === 'flames') {
        for (let i = 0; i < 18; i++) {
          const fl = this.add.circle(f.c.x + Phaser.Math.Between(-30, 30) * this.unit, this.groundY - Phaser.Math.Between(20, 150) * this.unit,
            Phaser.Math.Between(6, 13) * this.unit, Phaser.Utils.Array.GetRandom([0xff5722, 0xffa94d, 0xffd166]), 0.9).setDepth(6).setBlendMode('ADD');
          this.tweens.add({ targets: fl, y: fl.y - 50 * this.unit, alpha: 0, scale: 0.2, duration: 600 + i * 30, delay: i * 25, onComplete: () => fl.destroy() });
        }
        if (name === 'burn') this.floatText(f.baseX, this.groundY - 120 * this.unit, '-3', '#ff8a3d', 22);
      } else if (name === 'espejismo') {
        // Siluetas que se desdoblan y el cuerpo parpadea como un espejismo
        for (let i = 0; i < 3; i++) {
          const bs = f.body.getData('baseScale') || 1;
          const g = this.add.image(f.c.x, f.c.y, f.body.texture.key).setOrigin(f.body.originX, 1).setDepth(2)
            .setScale(this.unit * bs * f.dir, this.unit * bs).setTintFill(0xffd27a).setAlpha(0.5).setBlendMode('ADD');
          this.tweens.add({ targets: g, x: g.x + (i - 1) * 60 * this.unit, alpha: 0, duration: 650, onComplete: () => g.destroy() });
        }
        this.tweens.add({ targets: f.body, alpha: 0.2, duration: 90, yoyo: true, repeat: 3, onComplete: () => f.body.setAlpha(1) });
        label('ESPEJISMO', '#ffd27a');
      } else if (name === 'muro' || name === 'muroGuard') {
        // Escudo hexagonal de acero
        const cx = f.baseX + 45 * this.unit * f.dir, r = 95 * this.unit;
        const pts = [];
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r * 0.75, midY + Math.sin(a) * r)); }
        const g = this.add.graphics().setDepth(6);
        g.fillStyle(0x94a3b8, 0.28).fillPoints(pts, true);
        g.lineStyle(4 * this.unit, 0xe2e8f0, 0.95).strokePoints(pts, true);
        g.lineStyle(2 * this.unit, 0x60a5fa, 0.7).strokePoints(pts.map((p) => new Phaser.Math.Vector2(cx + (p.x - cx) * 0.7, midY + (p.y - midY) * 0.7)), true);
        g.setAlpha(0);
        this.tweens.add({ targets: g, alpha: 1, duration: 120, yoyo: true, hold: name === 'muro' ? 380 : 650, onComplete: () => g.destroy() });
        if (name === 'muro') { this.sparks.emitParticleAt(cx, midY, 16); label('MURO DE ACERO', '#e2e8f0'); this.cameras.main.shake(140, 0.006); }
      } else if (name === 'doble') {
        this.lightning(f.c.x - 25 * this.unit, false);
        this.time.delayedCall(140, () => this.lightning(f.c.x + 25 * this.unit, false));
        f.auraLevel = 2.2;
        label('DOBLE TRUENO', '#c4b5fd');
      } else if (name === 'brasas') {
        this.fx('flames', side);
        this.floatText(this.rival.baseX, this.groundY - 200 * this.unit, '+10 KAI', '#ffa94d', 22);
        label('BRASAS', '#ff8a3d');
      }
    }

    // Fondo ilustrado: escala "cover" anclada abajo para que el suelo siempre quede visible
    drawBackground() {
      const { W: w, H: h } = this;
      if (!this.bgImg) return;
      this.bgImg.setPosition(w / 2, h).setScale(this.bgScale);
      this.bgShade.setPosition(0, 0).setSize(w, h);
    }

    setBackground(key) {
      if (key !== this.bgKey) this.setAmbient(key);
      this.bgKey = key;
      if (!this.bgImg) {
        this.bgImg = this.add.image(0, 0, key).setOrigin(0.5, 1).setDepth(0);
        this.bgShade = this.add.rectangle(0, 0, 10, 10, 0x0d0e16, 0.18).setOrigin(0, 0).setDepth(1);
      } else this.bgImg.setTexture(key);
      this.layout();
    }

    // ---------- Luchadores procedurales ----------
    makeFighter(id) {
      const c = this.add.container(0, 0).setDepth(3);
      const aura = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      const body = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 1).setVisible(false);
      const shadow = this.add.ellipse(0, 0, 90, 14, 0x000000, 0.45);
      c.add([shadow, aura, body]);
      const f = { id, c, aura, body, shadow, auraLevel: 0, colors: null, dir: 1, baseX: 0 };
      this.startIdle(f);
      this.time.addEvent({ delay: 60, loop: true, callback: () => this.drawAura(f) });
      return f;
    }

    startIdle(f) {
      if (f.idle) f.idle.stop();
      f.body.y = 0;
      f.idle = this.tweens.add({ targets: f.body, y: -3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }

    // Postura neutra: sin inclinación ni deformación
    resetPose(f) {
      this.tweens.killTweensOf(f.body);
      f.ko = false;
      if (f.colors) this.setPose(f, null);
      const bs = f.body.getData('baseScale') || 1;
      f.body.setAngle(0).setScale(bs).clearTint().setAlpha(1);
      f.c.y = this.groundY;
      f.shadow.setScale(1).setAlpha(1);
      this.startIdle(f);
    }

    // Deformación relativa a la escala base (estirar / aplastar)
    pose(f, sx, sy, angle, duration, ease = 'Quad.out') {
      const bs = f.body.getData('baseScale') || 1;
      return new Promise((r) => this.tweens.add({
        targets: f.body, scaleX: bs * sx, scaleY: bs * sy, angle, duration, ease, onComplete: r,
      }));
    }

    // Imagen fantasma que queda atrás durante un desplazamiento rápido
    ghost(f, tint) {
      if (!f.body.visible) return;
      const bs = f.body.getData('baseScale') || 1;
      const g = this.add.image(f.c.x, f.c.y, f.body.texture.key).setOrigin(f.body.originX, 1).setDepth(2)
        .setScale(this.unit * bs * f.dir * (f.body.scaleX / bs), this.unit * bs * (f.body.scaleY / bs))
        .setAngle(f.body.angle * f.dir).setTintFill(tint).setAlpha(0.45).setBlendMode('ADD');
      this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
    }

    speedLines(x1, x2, y, color) {
      for (let i = 0; i < 5; i++) {
        const yy = y + Phaser.Math.Between(-60, 40) * this.unit;
        const len = Phaser.Math.Between(40, 90) * this.unit;
        const line = this.add.rectangle((x1 + x2) / 2, yy, len, 3, color, 0.8).setDepth(2).setBlendMode('ADD');
        this.tweens.add({ targets: line, x: line.x + (x2 > x1 ? -60 : 60) * this.unit, alpha: 0, scaleX: 0.2, duration: 240, onComplete: () => line.destroy() });
      }
    }

    impactBurst(x, y, big, color = 0xffffff) {
      const ring = this.add.circle(x, y, 10 * this.unit, color, 0).setStrokeStyle(5, color, 1).setDepth(8).setBlendMode('ADD');
      this.tweens.add({ targets: ring, scale: big ? 7 : 4.5, alpha: 0, duration: big ? 380 : 260, ease: 'Quad.out', onComplete: () => ring.destroy() });
      const n = big ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
        const shard = this.add.rectangle(x, y, 26 * this.unit, 4, 0xfff3c4, 1).setDepth(8).setRotation(ang).setBlendMode('ADD');
        const d = (big ? 70 : 45) * this.unit;
        this.tweens.add({ targets: shard, x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, scaleX: 0.1, alpha: 0, duration: 260, ease: 'Quad.out', onComplete: () => shard.destroy() });
      }
    }

    // Congela un instante la acción para dar peso al golpe
    hitStop(ms) {
      this.tweens.timeScale = 0.05;
      setTimeout(() => { this.tweens.timeScale = 1; }, ms);
    }

    placeFighter(f, x, dir) {
      f.dir = dir; f.baseX = x;
      f.c.setPosition(x, this.groundY).setScale(this.unit * dir, this.unit);
    }

    setColors(f, colors) {
      f.colors = colors;
      this.tweens.killTweensOf(f.c);
      f.c.setAlpha(1).setAngle(0);
      this.drawFighter(f);
      this.resetPose(f);
    }

    // Ilustración del personaje (mira a la derecha; el rival se refleja con la escala del contenedor)
    drawFighter(f) {
      const key = f.colors.art;
      if (!this.textures.exists(key)) return;
      f.body.setTexture(key).setVisible(true).setOrigin(0.5, 1);
      f.body.setScale(180 / f.body.height);
      f.body.setData('baseScale', 180 / f.body.height);
      f.guardW = f.body.width;
      f.poseName = null;
    }

    // Cambia a una pose ilustrada (misma escala que la guardia, alineada por los pies y la espalda).
    // Si el personaje no tiene esa pose, se queda en guardia y la animación por código hace el resto.
    hasPose(f, name) { return !!(f.colors && this.textures.exists(f.colors.art + '-' + name)); }
    setPose(f, name) {
      const key = name ? f.colors.art + '-' + name : f.colors.art;
      if (!this.textures.exists(key)) return false;
      f.body.setTexture(key);
      f.poseName = name;
      if (name === 'ko') f.body.setOrigin(0.5, 1);
      else f.body.setOrigin(Math.min(0.5, (f.guardW / 2) / f.body.width), 1);
      return true;
    }

    drawAura(f) {
      const g = f.aura.clear();
      if (!f.colors || f.auraLevel <= 0) return;
      const col = hex(f.colors.aura), t = this.time.now / 120, lv = f.auraLevel;
      for (let i = 0; i < 3; i++) {
        const s = 1 + i * 0.18 + Math.sin(t + i) * 0.05;
        g.fillStyle(col, Math.min(0.09 * lv, 0.28));
        g.fillEllipse(0, -85, 90 * s, 190 * s);
      }
      if (Math.random() < 0.4 * lv) {
        this.kiDust.setParticleTint(col);
        this.kiDust.emitParticleAt(f.c.x + Phaser.Math.Between(-40, 40) * this.unit, this.groundY - 10, 1);
      }
    }

    // ---------- Acciones visuales ----------
    async attack(side, kind) {
      const a = side === 'hero' ? this.hero : this.rival;
      const d = side === 'hero' ? this.rival : this.hero;
      if (kind === 'blast') {
        this.flash(a, hex(a.colors.aura));
        await wait(220);
        const sx = a.c.x + 50 * this.unit * a.dir, sy = this.groundY - 112 * this.unit;
        const orb = this.add.circle(sx, sy, 14 * this.unit, hex(a.colors.aura)).setDepth(6).setBlendMode('ADD');
        await new Promise((r) => this.tweens.add({ targets: orb, x: d.c.x, duration: 260, ease: 'Quad.in', onComplete: r }));
        orb.destroy();
        return;
      }
      const kick = kind === 'kick';
      const reach = Math.abs(d.baseX - a.baseX) - 95 * this.unit;
      const col = hex(a.colors.aura);
      this.tweens.killTweensOf(a.body);
      const real = this.hasPose(a, kick ? 'patada' : 'punetazo');
      const move = kick ? 'patada' : 'punetazo';
      // 1) Anticipación: fotograma de preparación si existe (<art>-<golpe>-1); si no, se echa atrás y se encoge
      if (real && this.hasPose(a, move + '-1')) { this.setPose(a, move + '-1'); await this.pose(a, 0.98, 1.01, -3, kick ? 190 : 150); }
      else await this.pose(a, 0.94, 1.04, kick ? -14 : -9, kick ? 160 : 120);
      // 2) Embestida: pose de ataque (si existe) o estiramiento, con estela
      if (real) { this.setPose(a, kick ? 'patada' : 'punetazo'); this.pose(a, 1.04, 0.98, 3, 90); }
      else this.pose(a, 1.12, 0.94, kick ? 16 : 11, 110);
      const ghostTimer = this.time.addEvent({ delay: 35, repeat: 4, callback: () => this.ghost(a, col) });
      this.speedLines(a.baseX, a.baseX + reach * a.dir, this.groundY - 110 * this.unit, col);
      await new Promise((r) => this.tweens.add({
        targets: a.c, x: a.baseX + reach * a.dir, duration: kick ? 170 : 130, ease: 'Cubic.in', onComplete: r,
      }));
      ghostTimer.remove();
      if (kick) this.tweens.add({ targets: a.c, y: this.groundY - 18 * this.unit, duration: 90, yoyo: true, ease: 'Quad.out' });
      // 3) Recuperación tras el impacto (el hit-stop lo alarga)
      const rec = real && this.hasPose(a, move + '-3');
      this.time.delayedCall(real ? 260 : 170, () => {
        // Fotograma de recuperación (<art>-<golpe>-3) antes de volver a la guardia
        if (!a.ko) this.setPose(a, rec ? move + '-3' : null);
        if (rec) this.time.delayedCall(170, () => { if (!a.ko && a.poseName === move + '-3') this.setPose(a, null); });
        this.pose(a, 1, 1, 0, 280, 'Back.out').then(() => { if (!a.ko) this.startIdle(a); });
        this.tweens.add({ targets: a.c, x: a.baseX, duration: 300, ease: 'Quad.inOut' });
      });
    }

    hit(side, amount, opts = {}) {
      const f = side === 'hero' ? this.hero : this.rival;
      const x = f.baseX, y = this.groundY - 100 * this.unit;
      if (opts.dodged) {
        this.tweens.killTweensOf(f.body);
        this.ghost(f, 0x4ade80);
        this.pose(f, 0.96, 1.03, -12, 100).then(() => this.pose(f, 1, 1, 0, 220, 'Back.out')).then(() => { if (!f.ko) this.startIdle(f); });
        this.tweens.add({ targets: f.c, x: f.baseX - 80 * this.unit * f.dir, y: this.groundY - 20 * this.unit, duration: 130, yoyo: true, ease: 'Quad.out' });
        this.time.delayedCall(60, () => this.ghost(f, 0x4ade80));
        this.floatText(x, y - 30 * this.unit, opts.perfect ? '¡ESQUIVA PERFECTA!' : '¡ESQUIVA!', '#4ade80', 26);
        return;
      }
      const big = opts.crit || amount > 400;
      this.sparks.explode(big ? 26 : 14, x, y);
      this.impactBurst(x - 30 * this.unit * f.dir, y, big);
      this.hitStop(big ? 110 : 60);
      // Retroceso: se dobla hacia atrás, sale despedido y vuelve a su sitio
      this.tweens.killTweensOf(f.body);
      if (this.setPose(f, 'golpeado')) {
        this.pose(f, 1, 1, 0, 60);
        this.time.delayedCall(big ? 420 : 300, () => { if (!f.ko) { this.setPose(f, null); this.pose(f, 1, 1, 0, 160).then(() => { if (!f.ko) this.startIdle(f); }); } });
      } else {
        this.pose(f, 0.93, 1.05, -16, 80).then(() => this.pose(f, 1, 1, 0, 320, 'Back.out')).then(() => { if (!f.ko) this.startIdle(f); });
      }
      this.tweens.add({ targets: f.c, x: f.baseX - (big ? 46 : 26) * this.unit * f.dir, duration: 90, ease: 'Quad.out',
        onComplete: () => this.tweens.add({ targets: f.c, x: f.baseX, duration: 260, ease: 'Quad.inOut' }) });
      if (big) { this.cameras.main.zoomTo(1.06, 70); this.time.delayedCall(160, () => this.cameras.main.zoomTo(1, 220)); }
      this.flash(f, 0xffffff);
      f.body.setTintFill(0xffffff);
      this.time.delayedCall(70, () => f.body.clearTint());
      this.cameras.main.shake(opts.crit || amount > 400 ? 220 : 120, opts.crit || amount > 400 ? 0.012 : 0.005);
      const color = opts.blocked ? '#93c5fd' : opts.crit ? '#fde047' : '#ffffff';
      this.floatText(x, y - 40 * this.unit, (opts.crit ? '¡CRÍTICO! ' : '') + '-' + amount, color, opts.crit ? 34 : 28);
    }

    heal(side, amount) {
      const f = side === 'hero' ? this.hero : this.rival;
      this.floatText(f.baseX, this.groundY - 150 * this.unit, '+' + amount, '#4ade80', 28);
      this.flash(f, 0x4ade80);
    }

    charge(side) {
      const f = side === 'hero' ? this.hero : this.rival;
      f.auraLevel = 2.8;
      this.cameras.main.shake(300, 0.004);
      this.tweens.killTweensOf(f.body);
      const chargePose = this.setPose(f, 'cargar');
      this.pose(f, chargePose ? 1 : 1.05, chargePose ? 1 : 0.93, chargePose ? 0 : -4, 140).then(() => {
        this.tweens.add({ targets: f.body, x: 2, duration: 40, yoyo: true, repeat: 5 });
        return new Promise((r) => this.time.delayedCall(480, r));
      }).then(() => { f.body.x = 0; if (!f.ko) this.setPose(f, null); return this.pose(f, 1, 1, 0, 200, 'Back.out'); }).then(() => { if (!f.ko) this.startIdle(f); });
      this.time.delayedCall(700, () => { f.auraLevel = 0.6; });
      this.floatText(f.baseX, this.groundY - 190 * this.unit, '+KAI', '#7fd4ff', 26);
    }

    setAura(side, level) { (side === 'hero' ? this.hero : this.rival).auraLevel = level; }

    guard(side) {
      const f = side === 'hero' ? this.hero : this.rival;
      const shield = this.add.circle(f.baseX + 30 * this.unit * f.dir, this.groundY - 90 * this.unit, 80 * this.unit, 0x60a5fa, 0.25)
        .setStrokeStyle(3, 0x93c5fd).setDepth(4).setBlendMode('ADD');
      this.tweens.add({ targets: shield, alpha: 0, scale: 1.3, duration: 700, onComplete: () => shield.destroy() });
    }

    flash(f, color) {
      const r = this.add.ellipse(f.c.x, this.groundY - 85 * this.unit, 110 * this.unit, 200 * this.unit, color, 0.5)
        .setDepth(4).setBlendMode('ADD');
      this.tweens.add({ targets: r, alpha: 0, duration: 220, onComplete: () => r.destroy() });
    }

    floatText(x, y, text, color, size) {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Bebas Neue", Impact, sans-serif', fontSize: Math.round(size * Math.max(this.unit, 0.8)) + 'px',
        color, stroke: '#000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1000, ease: 'Quad.out', onComplete: () => t.destroy() });
    }

    ko(side) {
      const f = side === 'hero' ? this.hero : this.rival;
      f.auraLevel = 0;
      f.ko = true;
      this.tweens.killTweensOf(f.body);
      this.tweens.killTweensOf(f.c);
      this.cameras.main.flash(250, 255, 255, 255);
      this.hitStop(160);
      // Sale despedido hacia atrás, pero cae entero dentro de la pantalla (cuerpo tumbado ≈ 185 u)
      const lying = (this.hasPose(f, 'ko') ? 130 : 185) * this.unit + 10;
      const backX = f.dir > 0 ? Math.max(f.baseX - 110 * this.unit, lying) : Math.min(f.baseX + 110 * this.unit, this.W - lying);
      this.tweens.add({ targets: f.c, x: backX, duration: 620, ease: 'Quad.out' });
      this.tweens.add({ targets: f.c, y: this.groundY - 70 * this.unit, duration: 260, ease: 'Quad.out', yoyo: true, hold: 0,
        onComplete: () => {
          this.cameras.main.shake(180, 0.01);
          this.sparks.explode(10, f.c.x, this.groundY);
          this.tweens.add({ targets: f.c, y: this.groundY - 14 * this.unit, duration: 120, yoyo: true, ease: 'Quad.out' });
        } });
      if (this.hasPose(f, 'ko')) {
        // Pose ilustrada: en el aire usa "golpeado" y al tocar el suelo pasa a tumbado
        this.setPose(f, 'golpeado'); f.body.setAngle(-10);
        this.time.delayedCall(500, () => { this.setPose(f, 'ko'); f.body.setAngle(0); });
      } else {
        this.tweens.add({ targets: f.body, angle: -88, duration: 520, ease: 'Quad.in' });
      }
      this.tweens.add({ targets: f.shadow, scaleX: 1.6, alpha: 0.6, duration: 520 });
      this.time.delayedCall(700, () => this.tweens.add({ targets: f.body, alpha: 0.75, duration: 300 }));
    }

    // ---------- Choque de ráfagas ----------
    beamStart() { this.beamState = { p: 0.5 }; this.hero.auraLevel = 2; this.rival.auraLevel = 2; }
    beamSet(p) { if (this.beamState) this.beamState.p = p; }
    beamEnd() {
      const p = this.beamState ? this.beamState.p : 0.5;
      this.beamState = null;
      this.beam.clear();
      const x = Phaser.Math.Linear(this.heroX, this.rivalX, p);
      this.sparks.explode(60, x, this.groundY - 110 * this.unit);
      this.cameras.main.shake(500, 0.02);
      this.cameras.main.flash(300, 255, 220, 160);
      this.hero.auraLevel = 0.6; this.rival.auraLevel = 0.6;
    }

    update() {
      const s = this.beamState;
      if (!s) return;
      const g = this.beam.clear();
      const y = this.groundY - 112 * this.unit;
      const hx = this.heroX + 50 * this.unit, rx = this.rivalX - 50 * this.unit;
      const cx = Phaser.Math.Linear(hx, rx, s.p);
      const t = this.time.now / 50;
      const thick = 26 * this.unit;
      const drawBeam = (x1, x2, col) => {
        for (let i = 3; i >= 1; i--) {
          g.fillStyle(col, 0.18 * i).fillRect(Math.min(x1, x2), y - (thick * i) / 2 - Math.sin(t + i) * 2, Math.abs(x2 - x1), thick * i);
        }
        g.fillStyle(0xffffff, 0.9).fillRect(Math.min(x1, x2), y - thick / 5, Math.abs(x2 - x1), thick / 2.5);
      };
      drawBeam(hx, cx, hex(this.hero.colors.aura));
      drawBeam(cx, rx, hex(this.rival.colors.aura));
      const r = 40 * this.unit + Math.sin(t) * 6;
      g.fillStyle(0xffffff, 0.35).fillCircle(cx, y, r * 1.6);
      g.fillStyle(0xffffff, 0.9).fillCircle(cx, y, r);
      if (Math.random() < 0.6) this.sparks.emitParticleAt(cx, y, 2);
    }
  }

  // ---------- API pública ----------
  const Stage = {
    scene: null,
    init(parentId) {
      return new Promise((resolve) => {
        const scene = new StageScene();
        scene.onReady = () => {
          Stage.scene = scene;
          const el = document.getElementById(parentId);
          if (window.ResizeObserver) new ResizeObserver(() => Stage.refresh()).observe(el);
          window.addEventListener('orientationchange', () => setTimeout(() => Stage.refresh(), 250));
          Stage.refresh();
          resolve();
        };
        new Phaser.Game({
          type: Phaser.AUTO,
          parent: parentId,
          backgroundColor: '#0d0e16',
          scale: { mode: Phaser.Scale.NONE, width: 1, height: 1 },
          banner: false,
          loader: { imageLoadType: 'HTMLImageElement' },
          scene,
        });
      });
    },
    setFighters(hero, rival, bgKey) {
      const s = this.scene;
      if (bgKey) s.setBackground(bgKey);
      s.setColors(s.hero, hero); s.setColors(s.rival, rival);
      s.hero.auraLevel = 0.6; s.rival.auraLevel = 0.6;
      s.layout();
    },
    attack: (side, kind) => Stage.scene.attack(side, kind),
    hit: (side, n, o) => Stage.scene.hit(side, n, o),
    heal: (side, n) => Stage.scene.heal(side, n),
    charge: (side) => Stage.scene.charge(side),
    guard: (side) => Stage.scene.guard(side),
    setAura: (side, l) => Stage.scene.setAura(side, l),
    ko: (side) => Stage.scene.ko(side),
    beamStart: () => Stage.scene.beamStart(),
    beamSet: (p) => Stage.scene.beamSet(p),
    beamEnd: () => Stage.scene.beamEnd(),
    fx: (name, side) => { try { Stage.scene.fx(name, side); } catch (e) { /* un efecto nunca debe romper el combate */ } },
    // Ajusta el lienzo al tamaño real del contenedor (también si nació oculto)
    refresh() {
      const el = document.getElementById('stage');
      if (!Stage.scene || !el) return;
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0 && (w !== Stage.scene.scale.width || h !== Stage.scene.scale.height)) Stage.scene.scale.resize(w, h);
    },
  };
  window.Stage = Stage;
})();
