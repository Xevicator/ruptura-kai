/*
 * Sonido de Ruptura Kai: efectos y música generados por código con Web Audio.
 * Sin archivos de audio ni licencias de terceros. Se engancha a la API de Stage.
 */
(function () {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('ruptura_mute') === '1'; } catch (e) { /* sin almacenamiento */ }

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (musicKey && !musicTimer) startMusic();
    return ctx;
  }
  // Los navegadores móviles solo permiten audio tras un toque del usuario
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) => window.addEventListener(ev, ensure, { passive: true }));

  const now = () => ctx.currentTime;

  function tone({ type = 'sine', f = 440, f2 = null, t = 0, dur = 0.15, vol = 0.3, attack = 0.005, bus = sfxBus }) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    const s = now() + t;
    o.frequency.setValueAtTime(f, s);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), s + dur);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(bus);
    o.start(s); o.stop(s + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.2, vol = 0.3, filter = 'lowpass', freq = 1200, freq2 = null, q = 1, bus = sfxBus }) {
    if (!ctx) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = filter; fl.Q.value = q;
    const s = now() + t;
    fl.frequency.setValueAtTime(freq, s);
    if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, s + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    src.connect(fl); fl.connect(g); g.connect(bus);
    src.start(s, Math.random() * 0.5); src.stop(s + dur + 0.05);
  }

  const vib = (p) => { if (!muted && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* no disponible */ } };

  // ---------- Efectos ----------
  const SFX = {
    whoosh: (heavy) => noise({ dur: heavy ? 0.28 : 0.18, vol: 0.25, filter: 'bandpass', freq: 600, freq2: heavy ? 2400 : 3200, q: 0.8 }),
    hit: (big) => {
      tone({ type: 'sine', f: big ? 140 : 180, f2: 45, dur: big ? 0.3 : 0.2, vol: big ? 0.9 : 0.7 });
      noise({ dur: big ? 0.22 : 0.12, vol: big ? 0.6 : 0.45, freq: big ? 2500 : 3500, freq2: 300 });
    },
    blocked: () => { tone({ type: 'square', f: 900, f2: 600, dur: 0.08, vol: 0.12 }); noise({ dur: 0.1, vol: 0.3, filter: 'highpass', freq: 2500 }); },
    dodge: () => noise({ dur: 0.25, vol: 0.25, filter: 'bandpass', freq: 3000, freq2: 800, q: 2 }),
    perfect: () => { [880, 1320, 1760].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.05, dur: 0.25, vol: 0.18 })); },
    rupture: () => {
      noise({ dur: 0.6, vol: 0.7, freq: 6000, freq2: 200 });
      tone({ type: 'sawtooth', f: 220, f2: 55, dur: 0.5, vol: 0.35 });
      [1200, 900, 1500].forEach((f, i) => tone({ type: 'square', f, t: 0.04 * i, dur: 0.06, vol: 0.08 }));
    },
    charge: () => { tone({ type: 'sawtooth', f: 110, f2: 440, dur: 0.6, vol: 0.18, attack: 0.1 }); noise({ dur: 0.6, vol: 0.12, filter: 'bandpass', freq: 400, freq2: 2000, q: 3 }); },
    guard: () => { tone({ type: 'triangle', f: 330, f2: 300, dur: 0.25, vol: 0.2 }); tone({ type: 'sine', f: 660, dur: 0.2, vol: 0.08, t: 0.02 }); },
    heal: () => { [523, 659, 784].forEach((f, i) => tone({ type: 'sine', f, t: i * 0.07, dur: 0.3, vol: 0.15 })); },
    ko: () => { tone({ type: 'sine', f: 90, f2: 30, dur: 0.9, vol: 0.9 }); noise({ dur: 0.8, vol: 0.4, freq: 1200, freq2: 80 }); },
    beam: () => { tone({ type: 'sawtooth', f: 80, f2: 160, dur: 1.2, vol: 0.25, attack: 0.15 }); noise({ dur: 1.2, vol: 0.3, filter: 'bandpass', freq: 300, freq2: 1800, q: 2 }); },
    beamEnd: () => { noise({ dur: 0.9, vol: 0.8, freq: 5000, freq2: 100 }); tone({ type: 'sine', f: 120, f2: 30, dur: 0.8, vol: 0.9 }); },
    tap: () => tone({ type: 'triangle', f: 700 + Math.random() * 200, dur: 0.05, vol: 0.08 }),
    ui: () => tone({ type: 'triangle', f: 660, f2: 880, dur: 0.06, vol: 0.08 }),
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'square', f, t: i * 0.12, dur: i === 3 ? 0.6 : 0.14, vol: 0.12 })); },
    lose: () => { [392, 349, 311, 262].forEach((f, i) => tone({ type: 'triangle', f, t: i * 0.18, dur: i === 3 ? 0.7 : 0.2, vol: 0.18 })); },
    levelup: () => { [784, 988, 1175, 1568].forEach((f, i) => tone({ type: 'triangle', f, t: 0.7 + i * 0.08, dur: 0.3, vol: 0.14 })); },
  };

  // ---------- Música por escuela (bucle procedimental de 2 compases) ----------
  const THEMES = {
    hub: { bpm: 84, root: 110, scale: [0, 3, 5, 7, 10], wave: 'triangle', drums: false },
    dunas: { bpm: 112, root: 110, scale: [0, 1, 4, 5, 7, 8, 10], wave: 'sawtooth', drums: true },
    norte: { bpm: 100, root: 98, scale: [0, 2, 3, 7, 8], wave: 'square', drums: true },
    trueno: { bpm: 132, root: 116.5, scale: [0, 3, 5, 6, 7, 10], wave: 'sawtooth', drums: true },
    templo: { bpm: 120, root: 103.8, scale: [0, 1, 5, 7, 8], wave: 'square', drums: true },
  };
  let musicTimer = null, musicKey = null, step = 0, nextT = 0, pattern = null;

  function makePattern(th) {
    // Melodía fija por escuela (semilla simple) para que suene igual cada vez
    let seed = Math.round(th.root * 7);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const mel = [];
    for (let i = 0; i < 32; i++) mel.push(rnd() < (th.drums ? 0.55 : 0.35) ? th.scale[Math.floor(rnd() * th.scale.length)] + (rnd() < 0.3 ? 12 : 0) : null);
    return mel;
  }
  function scheduleMusic() {
    if (!ctx || !musicKey || muted) { if (ctx) nextT = now() + 0.1; return; }
    const th = THEMES[musicKey];
    const sixteenth = 60 / th.bpm / 4;
    if (nextT < now()) nextT = now() + 0.05;
    while (nextT < now() + 0.25) {
      const t = nextT - now();
      const i = step % 32;
      const bassNote = [0, 0, 7, 5][Math.floor(i / 8)];
      if (i % 4 === 0) tone({ type: 'triangle', f: th.root / 2 * Math.pow(2, bassNote / 12), t, dur: sixteenth * 3, vol: 0.35, bus: musicBus });
      const n = pattern[i];
      if (n !== null) tone({ type: th.wave, f: th.root * 2 * Math.pow(2, n / 12), t, dur: sixteenth * 1.6, vol: 0.07, attack: 0.01, bus: musicBus });
      if (th.drums) {
        if (i % 8 === 0) tone({ type: 'sine', f: 120, f2: 40, t, dur: 0.18, vol: 0.6, bus: musicBus });
        if (i % 8 === 4) noise({ t, dur: 0.12, vol: 0.25, filter: 'highpass', freq: 1500, bus: musicBus });
        if (i % 2 === 1) noise({ t, dur: 0.03, vol: 0.06, filter: 'highpass', freq: 7000, bus: musicBus });
      } else if (i % 16 === 0) {
        [0, 7, 12].forEach((s) => tone({ type: 'sine', f: th.root * Math.pow(2, s / 12), t, dur: sixteenth * 14, vol: 0.06, attack: 0.4, bus: musicBus }));
      }
      nextT += sixteenth; step++;
    }
  }
  function startMusic() {
    clearInterval(musicTimer);
    nextT = now() + 0.1;
    musicTimer = setInterval(scheduleMusic, 100);
  }
  function music(key) {
    const k = THEMES[key] ? key : null;
    if (k === musicKey) return;
    musicKey = k;
    clearInterval(musicTimer); musicTimer = null;
    if (!musicKey) return;
    pattern = makePattern(THEMES[musicKey]);
    step = 0;
    if (ctx) startMusic(); // si aún no hay audio, arranca en el primer toque (ensure)
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('ruptura_mute', m ? '1' : '0'); } catch (e) { /* ignorar */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
    document.querySelectorAll('[data-mute]').forEach((b) => { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-label', m ? 'Activar sonido' : 'Silenciar'); });
  }

  const play = (name, ...a) => { if (muted || !ensure()) return; try { SFX[name](...a); } catch (e) { /* audio no disponible */ } };

  // ---------- Enganche con el escenario ----------
  function hookStage() {
    const S = window.Stage;
    if (!S || S.__audio) return;
    S.__audio = true;
    const wrap = (name, fn) => { const orig = S[name]; S[name] = function (...a) { try { fn(...a); } catch (e) { /* nunca romper el juego por el audio */ } return orig.apply(this, a); }; };
    wrap('attack', (side, kind) => setTimeout(() => play('whoosh', kind === 'kick'), 120));
    wrap('hit', (side, amount, o = {}) => {
      if (o.dodged) { play(o.perfect ? 'perfect' : 'dodge'); return; }
      if (o.broke) play('rupture');
      else if (o.blocked) play('blocked');
      else play('hit', !!o.crit);
      if (side === 'hero') vib(o.crit || o.broke ? [40, 30, 60] : 35);
    });
    wrap('heal', () => play('heal'));
    wrap('charge', () => play('charge'));
    wrap('guard', () => play('guard'));
    wrap('ko', (side) => { play('ko'); if (side === 'hero') vib([80, 40, 160]); });
    wrap('beamStart', () => play('beam'));
    wrap('beamEnd', () => play('beamEnd'));
  }

  window.Sfx = { play, music, setMuted, get muted() { return muted; }, hookStage, vib };
  hookStage();
  setMuted(muted);
})();
