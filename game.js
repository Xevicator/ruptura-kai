/*
 * Lógica del prototipo: progreso, combate Coraza/Núcleo por turnos, QTE de esquiva y Choque de Núcleos.
 * Personajes y nombres propios del proyecto (sin propiedad intelectual de terceros).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SAVE_KEY = 'legado_proto_v1';
  const RITMO = !!window.RUPTURA_RITMO;

  // ---------- Datos ----------
  const HERO_LOOK = { art: 'ren', aura: '#ff8a3d' };

  const RIVALS = [
    { id: 'bandido', name: 'Bandido de la Duna', title: 'Saqueador del desierto', nucleo: 70, mult: 0.8, ai: 0.35, clash: 0.075, exp: 70, gold: 300,
      bg: 'dunas', look: { art: 'bandido', aura: '#f59e0b' } },
    { id: 'lobo', name: 'Lobo Yamato', title: 'Puño del clan del norte', nucleo: 90, mult: 1.0, ai: 0.5, clash: 0.10, exp: 140, gold: 650,
      bg: 'norte', look: { art: 'lobo', aura: '#60a5fa' } },
    { id: 'tigre', name: 'Tigre Colmillo de Trueno', title: 'Jefe del valle', nucleo: 110, mult: 1.2, ai: 0.65, clash: 0.125, exp: 260, gold: 1400,
      bg: 'trueno', look: { art: 'tigre', aura: '#c084fc' } },
    // Maestros: jefes de cada escuela
    { id: 'matriarca', master: true, sig: 'espejismo', name: 'Matriarca Arena', title: 'Maestra de la Escuela del Sol', nucleo: 90, mult: 0.95, ai: 0.55, clash: 0.09, exp: 120, gold: 500,
      bg: 'dunas', look: { art: 'matriarca', aura: '#f59e0b' }, lines: [['m','«El sol no tiene prisa. Tu Coraza se agrieta sola si te quedas quieto.»'],['ren','Entonces no me quedaré quieto.'],['m','Bien. Demuéstramelo antes de que caiga la tarde.']] },
    { id: 'guardian', master: true, sig: 'muro', name: 'Guardián del Paso', title: 'Maestro de la Escuela del Acero', nucleo: 110, mult: 1.1, ai: 0.65, clash: 0.11, exp: 200, gold: 900,
      bg: 'norte', look: { art: 'guardian', aura: '#60a5fa' }, lines: [['m','«Nadie cruza el paso. Golpea cuanto quieras: mi guardia es de acero.»'],['ren','Todo acero tiene una grieta.'],['m','Muchos lo dijeron. Sus nombres están bajo la nieve.']] },
    { id: 'voltio', master: true, sig: 'doble', name: 'Gemela Voltio', title: 'Maestra de la Escuela de la Tormenta', nucleo: 125, mult: 1.25, ai: 0.75, clash: 0.13, exp: 320, gold: 1600,
      bg: 'trueno', look: { art: 'voltio', aura: '#c084fc' }, lines: [['m','«Cuenta los truenos, aprendiz. El tercero siempre es mío.»'],['ren','¿Y si el tercero me encuentra en guardia?'],['m','Entonces quizá merezcas el valle. Quizá.']] },
    { id: 'abad', master: true, sig: 'brasas', name: 'Abad Ceniza', title: 'Maestro de la Escuela del Fuego', nucleo: 140, mult: 1.35, ai: 0.85, clash: 0.14, exp: 450, gold: 2500,
      bg: 'templo', look: { art: 'abad', aura: '#ff5722' }, lines: [['m','«Todo lo que arde deja ceniza. Veamos qué queda de ti.»'],['ren','He cruzado tres escuelas para llegar aquí.'],['m','Y aquí termina el camino… o empieza de verdad.']] },
  ];

  // Mapa de las Escuelas (GDD): cada escenario es una escuela con su regla y su maestro.
  // Los maestros aún no tienen arte: se muestran como «Próximamente».
  const SCHOOLS = [
    { id: 'sol', name: 'Dunas del Sol Rojo', school: 'Escuela del Sol', bg: 'dunas', color: '#f59e0b',
      rule: 'El calor resta 5 de Coraza a ambos cada turno.', master: 'matriarca', disciples: ['bandido'] },
    { id: 'acero', name: 'Paso de Yamato', school: 'Escuela del Acero', bg: 'norte', color: '#60a5fa',
      rule: 'La Guardia para el 80% del daño, pero Cargar solo da +20 Kai.', master: 'guardian', disciples: ['lobo'] },
    { id: 'tormenta', name: 'Valle del Trueno', school: 'Escuela de la Tormenta', bg: 'trueno', color: '#c084fc',
      rule: 'Cada 3 turnos cae un rayo: +30 Kai a quien esté en Guardia.', master: 'voltio', disciples: ['tigre'] },
    { id: 'fuego', name: 'Templo de la Llama', school: 'Escuela del Fuego', bg: 'templo', color: '#ff5722',
      rule: 'La Patada deja quemadura (3 por turno, 3 turnos) y el Estallido hace +30%.', master: 'abad', disciples: [] },
  ];
  const rivalById = (id) => RIVALS.find((r) => r.id === id);

  const RANKS = ['NOVATO', 'APRENDIZ', 'GUERRERO', 'VETERANO', 'MAESTRO'];
  const rankOf = (lv) => RANKS[Math.min(RANKS.length - 1, Math.floor((lv - 1) / 2))];

  // ---------- Guardado ----------
  const defaults = () => ({ level: 1, exp: 0, gold: 0, wins: 0, beaten: [], dojo: { golpe: 0, defensa: 0, nucleo: 0 }, tower: 0, hold: false, tut: false, tutR: false });
  function load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s.level === 'number') { const d = defaults(); const o = Object.assign(d, s); o.dojo = Object.assign(defaults().dojo, s.dojo || {}); if (s.tut === undefined) o.tut = (s.beaten || []).length > 0; return o; } } catch (e) { /* sin almacenamiento */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (e) { /* ignorar */ } }
  let P = load();

  const heroStats = (lv) => ({ nucleo: 100 + 5 * (lv - 1), mult: 1 + 0.06 * (lv - 1), coraza: 100 });
  const expNeeded = (lv) => 100 + 60 * (lv - 1);

  // ---------- Navegación ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    if (window.Sfx) Sfx.music(id === 'screen-battle' ? (B && B.rival.bg) : id === 'screen-result' ? null : 'hub');
    if (id === 'screen-battle') Stage.refresh();
  }

  // ---------- HUB ----------
  function renderHub() {
    const st = heroStats(P.level);
    $('hub-gold').textContent = P.gold.toLocaleString('es-ES');
    $('hub-level').textContent = P.level;
    $('hub-rank').textContent = RANKS[Math.min(RANKS.length - 1, Math.floor((P.level - 1) / 2))];
    const pct = Math.floor((P.exp / expNeeded(P.level)) * 100);
    $('hub-exp').style.width = pct + '%';
    $('hub-exp-txt').textContent = pct + '%';
    $('hub-hp').textContent = st.nucleo;
    $('hub-atk').textContent = Math.round(st.mult * 100) + '%';
    $('hub-ki').textContent = st.coraza;
    $('hub-wins').textContent = P.wins;

    const towerOpen = P.beaten.includes('matriarca');
    $('btn-tower').disabled = !towerOpen;
    $('tower-sub').textContent = towerOpen ? `Mejor piso: ${P.tower}/30` : '🔒 Vence a la Matriarca Arena';
    $('opt-hold').checked = !!P.hold;

    const list = $('rival-list');
    list.innerHTML = '';
    const A = window.ASSETS || {};
    const done = (id) => P.beaten.includes(id);
    SCHOOLS.forEach((sc, i) => {
      const prev = SCHOOLS[i - 1];
      // Una escuela se abre al vencer al maestro de la anterior
      const locked = i > 0 && !done(prev.master);
      const card = document.createElement('section');
      card.className = 'school' + (locked ? ' locked' : '');
      card.style.setProperty('--c', sc.color);
      card.style.setProperty('--school-bg', `url("${A[sc.bg] || ''}")`);
      card.innerHTML =
        `<header><small>${sc.school.toUpperCase()}</small><h3>${sc.name}</h3></header>` +
        `<p class="rule"><b>Regla:</b> ${sc.rule}</p>`;
      const rows = document.createElement('div');
      rows.className = 'school-fights';
      const master = rivalById(sc.master);
      const fights = sc.disciples.map(rivalById).concat([master]);
      fights.forEach((r) => {
        const isM = !!r.master;
        const lockedR = locked || (isM && !sc.disciples.every(done));
        const b = document.createElement('button');
        b.className = 'rival' + (isM ? ' master' : '') + (lockedR ? ' locked' : '');
        b.dataset.rival = r.id;
        b.disabled = lockedR;
        b.style.setProperty('--c', r.look.aura);
        const why = locked ? '🔒 Vence al maestro anterior' : '🔒 Vence antes a los discípulos';
        b.innerHTML =
          `<div class="avatar${A[r.look.art + '-retrato'] ? ' portrait' : ''}" style="background-image:url('${A[r.look.art + '-retrato'] || A[r.look.art] || ''}')"></div>` +
          `<div class="info"><b>${isM ? '♛ ' : ''}${r.name}</b><small>${lockedR ? why : isM ? '♛ ' + SIGS[r.sig].name + ': ' + SIGS[r.sig].desc : 'Discípulo · ' + r.title}</small></div>` +
          `<div class="power"><small>PODER</small>${Math.round(r.nucleo * r.mult * 10)}</div>` +
          (done(r.id) ? '<span class="done">✓ VENCIDO</span>' : '');
        if (!lockedR) b.addEventListener('click', () => startBattle(r));
        rows.appendChild(b);
      });
      card.appendChild(rows);
      list.appendChild(card);
    });
  }

  // ---------- Combate Coraza / Núcleo (reglas v1 del GDD; valores para ajustar en pruebas) ----------
  // Coraza 100 · Núcleo según luchador · Kai 0-100.
  // Con Coraza en pie: el daño va a la Coraza y solo el 20% pasa al Núcleo.
  // Coraza rota: todo al Núcleo ×1,5 durante 2 turnos; luego vuelve a 50.
  // Sin recibir golpes en una ronda: Coraza +10. Pierde quien vacía su Núcleo.
  const RULES = {
    strike: 12, strikeKai: 15,
    kick: 25, kickCost: 30, stunChance: 0.3,
    charge: 40, chargeTaken: 1.25,
    guard: 0.4,
    patch: 20, patches: 3,
    burst: 35, burstBroken: 50, burstCost: 100,
    leak: 0.2, brokenMult: 1.5, brokenTurns: 2, rebuild: 50, regen: 10,
    crit: 0.15, critMult: 1.5,
  };
  // Técnicas propias de los maestros y modificadores de la Torre (una novedad por combate)
  const SIGS = {
    espejismo: { name: 'Espejismo', desc: 'Si cargas Kai, esquiva tu siguiente ataque.', tip: 'La Matriarca esquiva el ataque que lanzas justo después de cargar. Carga y luego ponte en Guardia o usa un Parche antes de atacar.' },
    muro: { name: 'Muro de acero', desc: 'Empieza con 150 de Coraza y contraataca si le golpeas en Guardia.', tip: 'No golpees al Guardián cuando está en Guardia: carga Kai ese turno y ataca después.' },
    doble: { name: 'Doble trueno', desc: 'Cada 3 turnos ataca dos veces seguidas.', tip: 'Voltio ataca dos veces en los turnos múltiplos de 3: ponte en Guardia justo antes.' },
    brasas: { name: 'Brasas', desc: 'Cada golpe que te da te quema y le da +10 Kai.', tip: 'Cada golpe del Abad te quema y le carga: esquiva mejor o usa Guardia para que no lance tantos Estallidos.' },
  };
  const MODS = {
    sinparche: { name: 'Sin Parches', desc: 'No puedes usar Parches en este piso.' },
    kai: { name: 'Kai desbordado', desc: 'Ambos empezáis con 60 de Kai.' },
    limite: { name: 'Contrarreloj', desc: 'Vence antes del turno 9 o pierdes.' },
    estallido: { name: 'Emboscada', desc: 'El rival empieza con el Estallido cargado.' },
    cristal: { name: 'Corazas de cristal', desc: 'Ambos empezáis con solo 50 de Coraza.' },
    furia: { name: 'Furia', desc: 'El rival hace +25% de daño, pero tiene −20% de Núcleo.' },
  };
  const MOD_ORDER = ['sinparche', 'kai', 'cristal', 'estallido', 'furia', 'limite'];
  const SCHOOL_RULE_ID = { dunas: 'sol', norte: 'acero', trueno: 'tormenta', templo: 'fuego' };

  let B = null; // estado de batalla
  let busy = true;

  // Dojo: Golpe +10% daño de Golpe/Patada por rango; Defensa +15 Coraza máx.; Núcleo +15 Kai inicial y +10% fuerza en el Choque.
  const DOJO = [
    { id: 'golpe', name: 'GOLPE', color: '#ff5722', desc: (n) => `+${n * 10}% de daño con Golpe Rápido y Patada Furia.` },
    { id: 'defensa', name: 'DEFENSA', color: '#60a5fa', desc: (n) => `+${n * 15} de Coraza máxima (empiezas con ${100 + n * 15}).` },
    { id: 'nucleo', name: 'NÚCLEO', color: '#e9c400', desc: (n) => `Empiezas con ${n * 15} de Kai y empujas un ${n * 10}% más en el Choque de Núcleos.` },
  ];
  const DOJO_COST = [300, 700, 1500];
  function heroFighter(st) {
    const d = P.dojo;
    const f = fighter(st.nucleo, st.mult);
    f.corazaMax = f.coraza = 100 + 15 * d.defensa;
    f.kai = 15 * d.nucleo;
    f.tech = 1 + 0.1 * d.golpe;
    return f;
  }

  const fighter = (nucleo, mult) => ({
    nucleo, nucleoMax: nucleo, coraza: 100, corazaMax: 100, kai: 0, mult,
    guard: false, charging: false, broken: 0, stun: 0, hit: false, burn: 0,
  });

  async function startBattle(rival, opts = {}) {
    await stageReady;
    const st = heroStats(P.level);
    const school = SCHOOLS.find((s) => s.bg === rival.bg);
    B = {
      retry: !!opts.retry, rival, school, rule: SCHOOL_RULE_ID[rival.bg] || '',
      turn: 1, perfect: 0, patches: RULES.patches,
      p: heroFighter(st),
      r: fighter(rival.nucleo, rival.mult),
      stats: { pBrokeTurn: 0, rBroken: 0, chargedHit: 0, guards: 0, bursts: 0 },
    };
    Prueba.start(rival);
    $('r-name').textContent = rival.name.toUpperCase();
    $('p-name').textContent = 'REN';
    $('clash-qte').style.setProperty('--rc', rival.look.aura);
    B.sig = rival.sig || ''; B.mod = rival.mod || '';
    const { p: hp, r: rp } = B;
    if (B.sig === 'muro') rp.corazaMax = rp.coraza = 150;
    if (B.mod === 'sinparche') B.patches = 0;
    if (B.mod === 'kai') { hp.kai = Math.max(hp.kai, 60); rp.kai = 60; }
    if (B.mod === 'estallido') rp.kai = 100;
    if (B.mod === 'cristal') { hp.coraza = 50; rp.coraza = 50; }
    if (B.mod === 'furia') { rp.mult *= 1.25; rp.nucleo = rp.nucleoMax = Math.round(rp.nucleoMax * 0.8); }
    const extra = B.sig ? `<br><b class="sig">♛ ${SIGS[B.sig].name.toUpperCase()}</b>${SIGS[B.sig].desc}`
      : B.mod ? `<br><b class="sig">⚑ ${MODS[B.mod].name.toUpperCase()}</b>${MODS[B.mod].desc}` : '';
    $('rule-chip').innerHTML = (school ? `<b>${school.name.toUpperCase()}</b>${school.rule}` : '') + extra;
    $('charge-cost').textContent = '+' + chargeGain();
    $('guard-info').textContent = B.rule === 'acero' ? '−80% daño' : '−60% daño';
    show('screen-battle');
    Stage.refresh();
    Stage.setFighters(HERO_LOOK, rival.look, rival.bg);
    $('screen-result').style.setProperty('--res-bg', `url("${(window.ASSETS || {})[rival.bg] || ''}")`);
    log(`¡${rival.name} te desafía! Rompe su <b>Coraza</b> para llegar a su Núcleo.`);
    renderBattle();
    setBusy(true);
    $('turn-banner').textContent = 'TURNO 1';
    if (rival.lines && !opts.retry) await showDialog(rival);
    if (rival.lines) log(`<b>${rival.name}:</b> ${rival.lines[rival.lines.length - 1][1]}`);
    if (RITMO) { B.tut = null; await rtIntro(); rtStart(); return; }
    B.tut = !P.tut && !rival.tower && !rival.master ? { seen: {} } : null;
    if (B.tut) {
      await coach('Bienvenido a tu primer combate. Cada luchador tiene <b>Coraza</b> (barra morada) y <b>Núcleo</b> (barra grande). <b>Pierde quien vacía su Núcleo.</b>');
      await coach('Mientras la Coraza aguanta, solo el 20% del daño llega al Núcleo. Empieza con <b>GOLPE RÁPIDO</b>: daña su Coraza y te da <b>+15 Kai</b>.', 'strike');
    }
    setBusy(false);
    renderBattle();
  }

  // ---------- Tutorial del primer combate ----------
  function coach(html, glowAct) {
    if (!B || !B.tut) return Promise.resolve();
    return new Promise((resolve) => {
      const box = $('coach');
      $('coach-text').innerHTML = html;
      box.classList.remove('hidden');
      const done = (skip) => {
        $('coach-ok').onclick = null; $('coach-skip').onclick = null;
        box.classList.add('hidden');
        if (skip) { B.tut = null; P.tut = true; save(); glow(null); }
        else glow(glowAct || null);
        if (window.Sfx) Sfx.play('ui');
        resolve();
      };
      $('coach-ok').onclick = () => done(false);
      $('coach-skip').onclick = () => done(true);
    });
  }
  function glow(act) {
    document.querySelectorAll('.cmd').forEach((b) => b.classList.toggle('coach-glow', !!act && b.dataset.act === act));
  }
  // Se llama al empezar cada turno del jugador: muestra el aviso que toque, uno cada vez
  async function tutorialTurn() {
    if (!B || !B.tut) return;
    const { p, r } = B, seen = B.tut.seen;
    const once = async (key, html, act) => { if (seen[key]) return false; seen[key] = true; await coach(html, act); return true; };
    if (r.broken && await once('break', '<b>¡RUPTURA!</b> Su Coraza está rota: durante 2 turnos tus golpes van <b>directos al Núcleo ×1,5</b>. ¡Aprovecha!', 'kick')) return;
    if (p.kai >= 100 && await once('burst', '¡Tienes <b>100 de Kai</b>! Lanza el <b>ESTALLIDO KAI</b>: hace mucho más daño si su Coraza está rota. Si el rival también tiene 100, habrá un <b>Choque de Núcleos</b>: toca sin parar.', 'ultimate')) return;
    if (p.coraza < 45 && !p.broken && await once('def', 'Tu Coraza está baja. Usa <b>GUARDIA</b> (−60% de daño este turno) o un <b>PARCHE</b> (+20 de Coraza) antes de que se rompa.', 'guard')) return;
    if (p.kai >= 30 && await once('kick', 'Con <b>30 de Kai</b> puedes usar <b>PATADA FURIA</b>: el doble de daño y un 30% de probabilidad de <b>aturdir</b> al rival.', 'kick')) return;
    if (B.turn >= 4 && await once('rule', `Cada escenario tiene su <b>regla</b>, la tienes encima del registro. Aquí: ${B.school ? B.school.rule : ''}`)) return;
  }

  const chargeGain = () => (B && B.rule === 'acero' ? 20 : RULES.charge);
  const guardMult = () => (B && B.rule === 'acero' ? 0.2 : RULES.guard);

  function log(msg) { $('log').innerHTML = msg; }

  function setStatus(el, text, cls) { el.textContent = text; el.className = 'status' + (cls ? ' ' + cls : ''); }

  function renderSide(x, f) {
    $(x + '-nuc').style.width = clamp(f.nucleo / f.nucleoMax, 0, 1) * 100 + '%';
    $(x + '-nuc-txt').textContent = `${Math.max(0, Math.ceil(f.nucleo))} / ${f.nucleoMax}`;
    const cor = $(x + '-cor');
    cor.classList.toggle('broken', f.broken > 0);
    cor.style.width = clamp(f.coraza / f.corazaMax, 0, 1) * 100 + '%';
    $(x + '-cor-txt').textContent = f.broken ? 'ROTA' : Math.round(f.coraza);
    $(x + '-kai').style.width = clamp(f.kai / 100, 0, 1) * 100 + '%';
    $(x + '-kai-txt').textContent = Math.round(f.kai);
    const st = f.act ? [f.act.kind === 'burst' ? '¡ESTALLIDO!' : '¡ATACA!', 'red'] : f.broken ? ['RUPTURA', 'purple'] : f.stun ? ['ATURDIDO', ''] : f.guard ? ['GUARDIA', 'blue']
      : f.charging ? ['CARGANDO', ''] : f.burn ? ['QUEMADURA', ''] : ['', ''];
    setStatus($(x + '-status'), st[0], st[1]);
  }

  function renderBattle() {
    renderSide('p', B.p);
    renderSide('r', B.r);
    $('potions').textContent = 'x' + B.patches;
    updateButtons();
  }

  function canAct(act) {
    if (RITMO) return rtCan(act);
    if (busy || !B) return false;
    const p = B.p;
    if (act === 'kick') return p.kai >= RULES.kickCost;
    if (act === 'ultimate') return p.kai >= RULES.burstCost;
    if (act === 'charge') return p.kai < 100;
    if (act === 'potion') return B.patches > 0 && !p.broken && p.coraza < p.corazaMax;
    return true;
  }

  function updateButtons() {
    document.querySelectorAll('.cmd').forEach((b) => {
      const ok = canAct(b.dataset.act);
      b.disabled = !ok;
      if (b.dataset.act === 'ultimate') b.classList.toggle('ready', ok);
    });
  }

  function setBusy(v) {
    busy = v;
    $('turn-banner').classList.toggle('enemy', v);
    if (!v && B) $('turn-banner').textContent = 'TURNO ' + B.turn;
    updateButtons();
  }

  // Aplica un golpe de `base` puntos de `att` a `def`.
  function strikeOn(att, def, base, opts = {}) {
    let raw = base * att.mult * (opts.noVar ? 1 : rand(0.9, 1.1));
    const crit = !opts.noCrit && Math.random() < RULES.crit;
    if (crit) raw *= RULES.critMult;
    if (def.guard) raw *= guardMult();
    if (def.charging) raw *= RULES.chargeTaken;
    if (opts.scale) raw *= opts.scale;
    def.hit = true;
    const wasBroken = def.broken > 0;
    let toNuc, broke = false;
    if (wasBroken) {
      toNuc = raw * RULES.brokenMult;
    } else {
      def.coraza -= raw;
      toNuc = raw * RULES.leak;
      if (def.coraza <= 0) { def.coraza = 0; def.broken = RULES.brokenTurns; broke = true; }
    }
    def.nucleo -= toNuc;
    return { shown: Math.max(1, Math.round(wasBroken ? toNuc : raw)), toNuc, crit, broke, wasBroken, blocked: def.guard };
  }

  function breakMsg(def, who) {
    if (def === B.p) B.stats.pBrokeTurn = B.stats.pBrokeTurn || B.turn;
    else B.stats.rBroken++;
    return ` <b>¡RUPTURA!</b> La Coraza de ${who} se rompe: su Núcleo recibe ×1,5 durante 2 turnos.`;
  }

  // Estallido directo (sin choque): 35, o 50 al Núcleo si la Coraza ya está rota.
  function burstOn(att, def, scaleExtra = 1) {
    const scale = (B.rule === 'fuego' ? 1.3 : 1) * scaleExtra;
    def.hit = true;
    if (def.broken) {
      let dmg = RULES.burstBroken * att.mult * scale;
      if (def.guard) dmg *= guardMult();
      def.nucleo -= dmg;
      return { shown: Math.round(dmg), crit: true, broke: false, wasBroken: true };
    }
    const d = strikeOn(att, def, RULES.burst, { noCrit: true, noVar: true, scale });
    d.crit = true;
    return d;
  }

  const where = (d) => (d.wasBroken ? ' al Núcleo' : ' a la Coraza');

  async function playerAct(act) {
    if (!canAct(act)) return;
    const { p, r } = B;
    glow(null);
    setBusy(true);
    p.guard = false; p.charging = false;

    if (act === 'strike' || act === 'kick') {
      const kick = act === 'kick';
      if (kick) p.kai -= RULES.kickCost;
      await Stage.attack('hero', kick ? 'kick' : 'strike');
      if (B.sig === 'espejismo' && p.lastAct === 'charge') {
        Stage.fx('espejismo', 'rival');
        if (!kick) p.kai = Math.min(100, p.kai + RULES.strikeKai);
        log(`♛ <b>Espejismo:</b> ${B.rival.name} leyó tu carga y esquiva el ataque.`);
        B.stats.sigHits = (B.stats.sigHits || 0) + 1;
        p.lastAct = act;
        renderBattle();
        if (await checkEnd()) return;
        await wait(450);
        return rivalTurn();
      }
      const wasGuard = r.guard;
      const d = strikeOn(p, r, (kick ? RULES.kick : RULES.strike) * (p.tech || 1));
      Stage.hit('rival', d.shown, d);
      if (!kick) p.kai = Math.min(100, p.kai + RULES.strikeKai);
      let msg = `${kick ? 'Patada Furia' : 'Golpe Rápido'}: <b>${d.shown}</b>${where(d)}${d.crit ? ' (crítico)' : ''}.`;
      if (B.sig === 'muro' && wasGuard && r.nucleo > 0) {
        log(msg + ' ♛ <b>Muro de acero:</b> ¡contraataque!');
        renderBattle();
        Stage.fx('muro', 'rival');
        await wait(450);
        await Stage.attack('rival', 'strike');
        const c = strikeOn(r, p, RULES.kick);
        Stage.hit('hero', c.shown, c);
        msg += ` ♛ <b>Muro de acero:</b> te contraataca con <b>${c.shown}</b>.` + (c.broke ? breakMsg(p, 'Ren') : '');
        B.stats.sigHits = (B.stats.sigHits || 0) + 1;
      }
      if (d.broke) msg += breakMsg(r, 'tu rival');
      if (kick && Math.random() < RULES.stunChance) { r.stun = 1; msg += ' ¡Rival aturdido!'; }
      if (kick && B.rule === 'fuego') { r.burn = 3; msg += ' Le dejas una quemadura.'; }
      log(msg);
    } else if (act === 'charge') {
      p.kai = Math.min(100, p.kai + chargeGain());
      p.charging = true;
      Stage.charge('hero');
      log(`Concentras tu energía: <b>+${chargeGain()} Kai</b>. Quedas expuesto este turno (+25% daño).`);
      await wait(600);
    } else if (act === 'guard') {
      p.guard = true;
      B.stats.guards++;
      Stage.guard('hero');
      log(`Adoptas postura de guardia: <b>−${Math.round((1 - guardMult()) * 100)}%</b> daño recibido.`);
      await wait(400);
    } else if (act === 'potion') {
      p.coraza = Math.min(p.corazaMax, p.coraza + RULES.patch);
      B.patches--;
      Stage.heal('hero', RULES.patch);
      log(`Refuerzas tu Coraza: <b>+${RULES.patch}</b>.`);
      await wait(500);
    } else if (act === 'ultimate') {
      p.kai -= RULES.burstCost;
      B.stats.bursts++;
      renderBattle();
      if (r.kai >= RULES.burstCost && !r.stun) {
        // Ambos tienen el Estallido listo en el mismo turno: Choque de Núcleos
        r.kai -= RULES.burstCost;
        log(`¡Lanzas el <b>Estallido Kai</b> y ${B.rival.name} responde con el suyo!`);
        renderBattle();
        await wait(500);
        await clash();
      } else {
        await Stage.attack('hero', 'kick');
        const d = burstOn(p, r);
        Stage.hit('rival', d.shown, d);
        log(`¡<b>Estallido Kai</b>! <b>${d.shown}</b>${where(d)}.` + (d.broke ? breakMsg(r, 'tu rival') : ''));
      }
    }

    p.lastAct = act;
    renderBattle();
    if (await checkEnd()) return;
    await wait(450);
    await rivalTurn();
  }

  function rivalChoice() {
    const { p, r } = B;
    const smart = B.rival.ai; // 0..1: cuánto aprovecha las reglas
    if (B.sig === 'doble' && B.turn % 3 === 0) return r.kai >= RULES.kickCost ? 'heavy' : 'strike';
    if (B.sig === 'muro' && !r.broken && r.kai < RULES.burstCost && Math.random() < 0.35) return 'guard';
    if (r.kai >= RULES.burstCost && Math.random() < 0.75) return 'ultimate';
    if (p.broken && r.kai >= RULES.kickCost && Math.random() < smart) return 'heavy';
    if (r.broken && Math.random() < smart * 0.6) return 'guard';
    if (B.rule === 'tormenta' && B.turn % 3 === 0 && Math.random() < smart) return 'guard';
    if (r.kai >= RULES.kickCost && Math.random() < 0.45) return 'heavy';
    if (r.kai < 40 && Math.random() < 0.3) return 'charge';
    return 'strike';
  }

  async function rivalStrike(heavy) {
    const { p, r } = B;
    if (B.tut && !B.tut.seen.dodge) {
      B.tut.seen.dodge = true;
      await coach('¡El rival va a atacar! Aparecerá un <b>anillo que se cierra</b>: <b>toca la pantalla justo cuando se cierre</b>. Esquiva perfecta = sin daño y +15 Kai.');
    }
    const slow = B.tut && (B.tut.dodges = (B.tut.dodges || 0) + 1) <= 2 ? 1.6 : 1; // las dos primeras, más lentas
    const dodge = await dodgeQTE((heavy ? 820 : 950) * slow);
    await Stage.attack('rival', heavy ? 'kick' : 'strike');
    if (p.charging) B.stats.chargedHit++;
    if (dodge === 'perfect') {
      Stage.hit('hero', 0, { dodged: true, perfect: true });
      p.kai = Math.min(100, p.kai + 15);
      B.perfect++;
      log('¡Esquiva perfecta! <b>+15 Kai</b>.');
      return;
    }
    const d = strikeOn(r, p, heavy ? RULES.kick : RULES.strike, { scale: dodge === 'good' ? 0.5 : 1 });
    Stage.hit('hero', d.shown, d);
    let msg = (dodge === 'good' ? 'Esquiva parcial: recibes ' : 'Recibes ') + `<b>${d.shown}</b>${d.wasBroken ? ' en el Núcleo' : ' en la Coraza'}${d.blocked ? ' (bloqueado)' : ''}.`;
    if (d.broke) msg += breakMsg(p, 'Ren');
    if (heavy && B.rule === 'fuego') { p.burn = 3; msg += ' Te deja una quemadura.'; }
    if (B.sig === 'brasas') { Stage.fx('brasas', 'hero'); p.burn = 3; r.kai = Math.min(100, r.kai + 10); msg += ' ♛ <b>Brasas:</b> te quema y gana +10 Kai.'; B.stats.sigHits = (B.stats.sigHits || 0) + 1; }
    if (B.sig === 'doble' && B.turn % 3 === 0) B.stats.sigHits = (B.stats.sigHits || 0) + 1;
    log(msg);
  }

  async function rivalTurn() {
    const { p, r } = B;
    r.guard = false; r.charging = false;
    $('turn-banner').textContent = 'TURNO RIVAL';
    if (r.stun) {
      r.stun = 0;
      log(`${B.rival.name} está aturdido y pierde el turno.`);
      renderBattle();
      await wait(700);
      return endRound();
    }
    const act = rivalChoice();

    if (act === 'charge') {
      r.kai = Math.min(100, r.kai + chargeGain()); r.charging = true; Stage.charge('rival');
      log(`${B.rival.name} concentra su Kai. Está expuesto.`);
      await wait(700);
    } else if (act === 'guard') {
      r.guard = true; Stage.guard('rival');
      if (B.sig === 'muro') Stage.fx('muroGuard', 'rival');
      log(`${B.rival.name} se pone en guardia.`);
      await wait(600);
    } else if (act === 'ultimate') {
      r.kai -= RULES.burstCost;
      if (p.kai >= RULES.burstCost) {
        p.kai -= RULES.burstCost;
        log(`¡${B.rival.name} lanza su Estallido y tu Kai responde! ¡Choque de Núcleos!`);
        renderBattle();
        await wait(500);
        await clash();
      } else {
        log(`¡${B.rival.name} lanza su <b>Estallido</b>! ¡Esquiva!`);
        renderBattle();
        const dodge = await dodgeQTE(760);
        await Stage.attack('rival', 'kick');
        if (dodge === 'perfect') {
          Stage.hit('hero', 0, { dodged: true, perfect: true });
          B.perfect++;
          log('¡Esquivas el Estallido por completo!');
        } else {
          const d = burstOn(r, p, dodge === 'good' ? 0.5 : 1);
          Stage.hit('hero', d.shown, d);
          log(`${dodge === 'good' ? 'Esquiva parcial. ' : ''}El Estallido te alcanza: <b>${d.shown}</b>${where(d)}.` + (d.broke ? breakMsg(p, 'Ren') : ''));
        }
      }
    } else {
      const heavy = act === 'heavy';
      if (heavy) r.kai -= RULES.kickCost; else r.kai = Math.min(100, r.kai + RULES.strikeKai);
      const times = B.sig === 'doble' && B.turn % 3 === 0 ? 2 : 1;
      if (times === 2) { Stage.fx('doble', 'rival'); await wait(500); }
      for (let k = 0; k < times; k++) {
        if (k === 1) { renderBattle(); if (p.nucleo <= 0) break; await wait(300); }
        log(times === 2 ? `♛ <b>Doble trueno:</b> ${B.rival.name} ataca ${k ? 'otra vez' : 'dos veces'}…` : `${B.rival.name} ataca con ${heavy ? 'una <b>técnica</b>' : 'un golpe'}…`);
        await rivalStrike(heavy);
      }
    }
    renderBattle();
    if (await checkEnd()) return;
    await endRound();
  }

  async function endRound() {
    const { p, r } = B;
    const notes = [];
    // Reglas de escenario
    if (B.rule === 'sol') {
      if (!p.broken || !r.broken) Stage.fx('heat');
      for (const f of [p, r]) {
        if (f.broken) continue;
        f.coraza -= 5;
        if (f.coraza <= 0) {
          f.coraza = 0; f.broken = RULES.brokenTurns + 1; // +1: el descuento de este mismo cierre
          if (f === p) B.stats.pBrokeTurn = B.stats.pBrokeTurn || B.turn;
          notes.push(f === p ? 'El calor rompe tu Coraza.' : 'El calor rompe la Coraza rival.');
        }
      }
    }
    if (B.rule === 'tormenta' && B.turn % 3 === 0) {
      const lucky = [p, r].filter((f) => f.guard);
      lucky.forEach((f) => { f.kai = Math.min(100, f.kai + 30); Stage.fx('bolt', f === p ? 'hero' : 'rival'); });
      if (!lucky.length) Stage.fx('boltMiss');
      notes.push(lucky.length ? `⚡ Cae un rayo: +30 Kai a ${lucky.map((f) => (f === p ? 'Ren' : B.rival.name)).join(' y ')}.` : '⚡ Cae un rayo, pero nadie estaba en Guardia.');
    }
    for (const f of [p, r]) {
      if (f.burn) { f.nucleo -= 3; f.burn--; Stage.fx('burn', f === p ? 'hero' : 'rival'); }
      if (f.broken) {
        f.broken--;
        if (!f.broken) { f.coraza = RULES.rebuild; notes.push(f === p ? 'Tu Coraza se recompone (50).' : 'La Coraza rival se recompone (50).'); }
      } else if (!f.hit) {
        f.coraza = Math.min(f.corazaMax, f.coraza + RULES.regen);
      }
      f.hit = false;
    }
    p.charging = false;
    B.turn++;
    if (B.rule === 'tormenta' && B.turn % 3 === 0) notes.push('⚡ El cielo se carga: este turno caerá un rayo.');
    if (B.sig === 'doble' && B.turn % 3 === 0) notes.push('♛ Voltio prepara su Doble trueno.');
    if (B.mod === 'limite') {
      if (B.turn > 8) { log('⚑ Se acabó el tiempo.'); await wait(900); showResult(false, 'tiempo'); return; }
      if (B.turn >= 6) notes.push(`⚑ Quedan ${9 - B.turn} turno(s).`);
    }
    if (notes.length) log($('log').innerHTML + ' ' + notes.join(' '));
    renderBattle();
    if (await checkEnd()) return;
    await wait(250);
    await tutorialTurn();
    setBusy(false);
    renderBattle();
  }

  // =====================================================================
  // ---------- MODO RITMO: combate en tiempo real (versión a comparar) ----------
  // Sin turnos: cada acción tiene recarga; Guardia y Cargar se mantienen pulsados.
  // El rival avisa sus ataques (anillo): esquiva tocando el escenario, bloquea con Guardia
  // o interrúmpelo con una Patada. Reloj de 60 s: si se acaba, gana quien tenga más Núcleo (%).
  // =====================================================================
  const RT = {
    time: 60, strike: 4, strikeKai: 4, strikeCd: 0.6, kick: 10, kickCd: 1.6, kickStun: 0.25,
    potionCd: 3, kaiRegen: 3, chargeRate: 30, brokenSec: 3, regenDelay: 3, regenRate: 5,
    rStrike: 11, rHeavy: 24, rNucleo: 1.5,
    solDrain: 1.2, boltEvery: 10, burnDps: 3, burnSec: 3, interruptStun: 1.2, counterWin: 1.2,
  };
  // Estilo de combate de cada rival (pesos de decisión y ritmo)
  const STYLES = {
    agresivo: { name: 'Agresivo', think: [0.5, 0.9], w: { strike: 6, heavy: 1.5, guard: 0.4, charge: 0.6 }, combo: 3, tele: 0.75 },
    defensivo: { name: 'Defensivo', think: [0.7, 1.2], w: { strike: 3, heavy: 1, guard: 3, charge: 1 }, combo: 1, tele: 0.7, counter: true },
    explosivo: { name: 'Explosivo', think: [0.8, 1.3], w: { strike: 2, heavy: 3, guard: 0.6, charge: 3 }, combo: 2, tele: 0.85 },
  };
  const STYLE_OF = { bandido: 'agresivo', lobo: 'defensivo', tigre: 'explosivo', matriarca: 'agresivo', guardian: 'defensivo', voltio: 'agresivo', abad: 'explosivo' };
  const styleFor = (rv) => STYLES[STYLE_OF[rv.id] || STYLE_OF[rv.look && rv.look.art] || ['agresivo', 'defensivo', 'explosivo'][(rv.floor || 0) % 3]];
  // Sucesos a mitad de combate: uno al azar por combate
  const EVENTS = [
    { id: 'lluvia', name: 'LLUVIA DE KAI', desc: 'Ambos ganáis +40 de Kai.', run: (p, r) => { p.kai = Math.min(100, p.kai + 40); r.kai = Math.min(100, r.kai + 40); } },
    { id: 'temblor', name: 'TEMBLOR', desc: 'La tierra tiembla: ambas Corazas pierden 30.', run: (p, r) => [p, r].forEach((f) => { if (f.broken) return; f.coraza -= 30; if (f.coraza <= 0) { f.coraza = 0; f.broken = RT.brokenSec; } }) },
    { id: 'furia', name: 'FURIA', desc: 'Tu rival acelera durante 8 segundos.', run: () => { B.rt.fast = 8; } },
    { id: 'aliento', name: 'SEGUNDO ALIENTO', desc: 'Quien va perdiendo recompone su Coraza.', run: (p, r) => { const f = p.nucleo / p.nucleoMax <= r.nucleo / r.nucleoMax ? p : r; f.broken = 0; f.coraza = Math.max(f.coraza, f.corazaMax * 0.6); } },
    { id: 'sobrecarga', name: 'SOBRECARGA', desc: 'Durante 8 segundos, todos los golpes hacen el doble.', run: () => { B.rt.dmgX = 8; } },
  ];

  function rtBanner(title, desc) {
    const el = $('rt-event');
    el.innerHTML = `<b>${title}</b>${desc ? `<small>${desc}</small>` : ''}`;
    el.classList.remove('hidden', 'show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(rtBanner.t); rtBanner.t = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  // Anillo de aviso con cancelación (para poder interrumpir al rival)
  function rtRing(dur) {
    const box = $('dodge-qte'), ring = $('dodge-shrink');
    let done = false, resolveFn, timer;
    const promise = new Promise((res) => { resolveFn = res; });
    box.classList.remove('hidden', 'result-good', 'result-bad');
    ring.classList.remove('go'); void ring.offsetWidth;
    ring.style.setProperty('--dur', dur + 'ms'); ring.classList.add('go');
    const t0 = performance.now();
    const finish = (res, quiet) => {
      if (done) return; done = true; clearTimeout(timer);
      box.removeEventListener('pointerdown', onTap);
      if (quiet) { box.classList.add('hidden'); resolveFn(res); return; }
      box.classList.add(res === 'miss' ? 'result-bad' : 'result-good');
      setTimeout(() => box.classList.add('hidden'), 180);
      resolveFn(res);
    };
    const onTap = (e) => {
      e.preventDefault();
      const t = (performance.now() - t0) / dur;
      if (t >= 0.78 && t <= 1.12) finish('perfect'); else if (t >= 0.55) finish('good'); else finish('miss');
    };
    box.addEventListener('pointerdown', onTap);
    timer = setTimeout(() => finish('miss'), dur * 1.12);
    return { promise, cancel: () => finish('cancel', true) };
  }

  function rtCan(act) {
    if (!B || !B.rt || B.rt.ended || B.rt.paused) return false;
    const p = B.p, cd = B.rt.cd;
    if (act === 'strike') return cd.strike <= 0;
    if (act === 'kick') return cd.kick <= 0 && p.kai >= RULES.kickCost;
    if (act === 'ultimate') return p.kai >= RULES.burstCost;
    if (act === 'charge') return p.kai < 100;
    if (act === 'potion') return cd.potion <= 0 && B.patches > 0 && !p.broken && p.coraza < p.corazaMax;
    return true; // guard
  }

  function rtBreak(def, who) { def.broken = RT.brokenSec; return breakMsg(def, who); }

  // ---- Acciones del jugador ----
  async function rtPress(act) {
    if (!rtCan(act)) return;
    const { p, r } = B, rt = B.rt;
    if (act === 'guard') { p.guard = true; p.charging = false; B.stats.guards++; Stage.guard('hero'); rt.guardFx = 0.7; return; }
    if (act === 'charge') { p.charging = true; p.guard = false; Stage.charge('hero'); rt.chargeFx = 0.9; return; }
    p.guard = false; if (p.charging) { p.charging = false; p.chargeEnd = rt.clock; }
    if (act === 'potion') {
      B.patches--; rt.cd.potion = RT.potionCd;
      p.coraza = Math.min(p.corazaMax, p.coraza + RULES.patch); Stage.heal('hero', RULES.patch);
      log(`Refuerzas tu Coraza: <b>+${RULES.patch}</b>.`); return;
    }
    if (act === 'ultimate') {
      p.kai -= RULES.burstCost; B.stats.bursts++;
      const rivalBurst = r.act && r.act.kind === 'burst';
      if (rivalBurst || (r.kai >= RULES.burstCost && !r.stun && Math.random() < 0.6)) {
        if (rivalBurst) r.act.ring.cancel(); else r.kai -= RULES.burstCost;
        r.act = null;
        rt.paused = true;
        log(`¡Lanzas el <b>Estallido Kai</b> y ${B.rival.name} responde! ¡Choque de Núcleos!`);
        await clash();
        rt.paused = false; rt.next = rand(0.8, 1.2);
        rtAfterHit();
        return;
      }
      Stage.attack('hero', 'kick');
      await wait(330);
      if (rt.ended) return;
      const d = burstOn(p, r);
      if (d.broke) r.broken = RT.brokenSec;
      r.lastHit = rt.clock;
      Stage.hit('rival', d.shown, d);
      log(`¡<b>Estallido Kai</b>! <b>${d.shown}</b>${where(d)}.` + (d.broke ? ' <b>¡RUPTURA!</b>' : ''));
      if (r.act && r.act.kind !== 'burst') { r.act.ring.cancel(); r.act = null; r.stun = RT.interruptStun; }
      rtAfterHit();
      return;
    }
    // Golpe o Patada
    const kick = act === 'kick';
    if (kick) { p.kai -= RULES.kickCost; rt.cd.kick = RT.kickCd; } else rt.cd.strike = RT.strikeCd;
    Stage.attack('hero', kick ? 'kick' : 'strike');
    await wait(kick ? 360 : 290);
    if (rt.ended || rt.paused) return;
    if (B.sig === 'espejismo' && p.chargeEnd && rt.clock - p.chargeEnd < 1.5) {
      p.chargeEnd = 0; Stage.fx('espejismo', 'rival');
      B.stats.sigHits = (B.stats.sigHits || 0) + 1;
      log(`♛ <b>Espejismo:</b> ${B.rival.name} leyó tu carga y esquiva.`); return;
    }
    const wasGuard = r.guard;
    let scale = rt.dmgX > 0 ? 2 : 1;
    const counter = p.counterT > 0; if (counter) { scale *= 1.5; p.counterT = 0; }
    const d = strikeOn(p, r, (kick ? RT.kick : RT.strike) * (p.tech || 1), { scale });
    r.lastHit = rt.clock;
    Stage.hit('rival', d.shown, d);
    if (!kick) p.kai = Math.min(100, p.kai + RT.strikeKai);
    let msg = `${kick ? 'Patada' : 'Golpe'}${counter ? ' de castigo' : ''}: <b>${d.shown}</b>${where(d)}.`;
    if (d.broke) msg += rtBreak(r, 'tu rival');
    if (kick) {
      if (r.act && r.act.kind !== 'burst') { r.act.ring.cancel(); r.act = null; r.stun = RT.interruptStun; msg += ' <b>¡Le interrumpes!</b>'; }
      else if (Math.random() < RT.kickStun) { r.stun = 0.8; msg += ' ¡Aturdido!'; }
      if (B.rule === 'fuego') { r.burnT = RT.burnSec; msg += ' Le quemas.'; }
    }
    if (B.sig === 'muro' && wasGuard && r.nucleo > 0 && !r.act) {
      Stage.fx('muro', 'rival'); msg += ' ♛ <b>Muro de acero:</b> ¡contraataque!';
      B.stats.sigHits = (B.stats.sigHits || 0) + 1;
      rtRivalAttack('strike', 0.45);
    } else if (rt.style.counter && wasGuard && !r.act && Math.random() < 0.5) rtRivalAttack('strike', 0.5);
    log(msg);
    rtAfterHit();
  }
  function rtRelease(act) {
    if (!B || !B.rt) return;
    if (act === 'guard') B.p.guard = false;
    if (act === 'charge' && B.p.charging) { B.p.charging = false; B.p.chargeEnd = B.rt.clock; }
  }

  // ---- Rival ----
  function rtRivalAttack(kind, teleOverride) {
    const { p, r } = B, rt = B.rt;
    const fast = rt.fast > 0 ? 0.75 : 1;
    const tele = (teleOverride || (kind === 'burst' ? 1.1 : kind === 'heavy' ? rt.style.tele + 0.15 : rt.style.tele)) * fast * (rt.slowTut > 0 ? 1.6 : 1);
    if (kind === 'heavy') r.kai -= RULES.kickCost;
    if (kind === 'burst') r.kai -= RULES.burstCost;
    r.guard = false; r.charging = false;
    const ring = rtRing(tele * 1000);
    r.act = { kind, ring };
    $('r-status').textContent = kind === 'burst' ? '¡ESTALLIDO!' : '¡ATACA!'; $('r-status').className = 'status red';
    if (kind === 'burst') log(`¡${B.rival.name} prepara su <b>Estallido</b>! Esquiva, o responde con el tuyo.`);
    ring.promise.then(async (res) => {
      if (res === 'cancel' || rt.ended) return;
      r.act = null;
      Stage.attack('rival', kind === 'strike' ? 'strike' : 'kick');
      await wait(260);
      if (rt.ended || rt.paused) return;
      if (p.charging) B.stats.chargedHit++;
      if (res === 'perfect') {
        Stage.hit('hero', 0, { dodged: true, perfect: true });
        p.kai = Math.min(100, p.kai + 15); B.perfect++; p.counterT = RT.counterWin;
        log('¡Esquiva perfecta! <b>+15 Kai</b> y tu siguiente golpe castiga ×1,5.');
      } else {
        const scale = (res === 'good' ? 0.5 : 1) * (rt.dmgX > 0 ? 2 : 1);
        const d = kind === 'burst' ? burstOn(r, p, scale) : strikeOn(r, p, kind === 'heavy' ? RT.rHeavy : RT.rStrike, { scale });
        if (d.broke) p.broken = RT.brokenSec;
        p.lastHit = rt.clock;
        Stage.hit('hero', d.shown, d);
        let msg = (res === 'good' ? 'Esquiva parcial: recibes ' : 'Recibes ') + `<b>${d.shown}</b>${d.wasBroken ? ' en el Núcleo' : ' en la Coraza'}${d.blocked ? ' (bloqueado)' : ''}.`;
        if (d.broke) msg += breakMsg(p, 'Ren');
        if (kind === 'heavy' && B.rule === 'fuego') { p.burnT = RT.burnSec; msg += ' Te quema.'; }
        if (B.sig === 'brasas') { Stage.fx('brasas', 'hero'); p.burnT = RT.burnSec; r.kai = Math.min(100, r.kai + 10); msg += ' ♛ <b>Brasas</b>: te quema y gana Kai.'; B.stats.sigHits = (B.stats.sigHits || 0) + 1; }
        log(msg);
      }
      if (rt.combo > 0 && !r.stun) { rt.combo--; rt.next = 0.2; } else rt.next = rand(...rt.style.think);
      rtAfterHit();
    });
  }

  function rtThink() {
    const { p, r } = B, rt = B.rt, w = rt.style.w;
    const smart = B.rival.ai || 0.5;
    if (B.sig === 'doble' && rt.clock - rt.lastDouble > 7) {
      rt.lastDouble = rt.clock; Stage.fx('doble', 'rival'); B.stats.sigHits = (B.stats.sigHits || 0) + 1;
      log('♛ <b>Doble trueno:</b> ¡Voltio ataca dos veces!'); rt.combo = 1; return rtRivalAttack('strike', 0.55);
    }
    if (r.kai >= RULES.burstCost && Math.random() < 0.55 + 0.3 * smart * (p.broken ? 1 : 0)) return rtRivalAttack('burst');
    const opts = { strike: w.strike, heavy: r.kai >= RULES.kickCost ? w.heavy * (p.broken ? 1 + smart : 1) : 0, guard: w.guard * (p.charging ? 0.2 : 1) * (r.broken ? 1 + smart : 1), charge: r.kai < 80 ? w.charge * (p.guard ? 1.5 : 1) : 0 };
    if (B.rule === 'tormenta' && rt.boltT < 2.2) opts.guard += 6 * smart;
    let x = Math.random() * Object.values(opts).reduce((a, b) => a + b, 0), pick = 'strike';
    for (const [k, v] of Object.entries(opts)) { if ((x -= v) <= 0) { pick = k; break; } }
    if (pick === 'guard') { r.guard = true; rt.rGuardT = rand(1.0, 1.8); Stage.guard('rival'); if (B.sig === 'muro') Stage.fx('muroGuard', 'rival'); return; }
    if (pick === 'charge') { r.charging = true; rt.rChargeT = rand(1.0, 1.6); Stage.charge('rival'); return; }
    rt.combo = pick === 'strike' ? Math.floor(Math.random() * rt.style.combo) : 0;
    rtRivalAttack(pick);
  }

  // ---- Bucle ----
  function rtAfterHit() { renderBattle(); rtCheck(); }
  async function rtCheck() {
    const { p, r } = B, rt = B.rt;
    if (rt.ended) return;
    if (p.nucleo > 0 && r.nucleo > 0 && rt.time > 0) return;
    rt.ended = true;
    if (r.act) { r.act.ring.cancel(); r.act = null; }
    B.turn = Math.round(rt.clock);
    if (p.nucleo <= 0 || r.nucleo <= 0) { checkEnd(); return; }
    // Fin por tiempo
    const pr = p.nucleo / p.nucleoMax, rr = r.nucleo / r.nucleoMax;
    const won = B.mod === 'limite' ? false : pr > rr;
    rtBanner('¡TIEMPO!', won ? 'Ganas por más Núcleo' : B.mod === 'limite' ? 'No lo venciste a tiempo' : 'Tu rival conserva más Núcleo');
    log(`⏱ <b>¡Tiempo!</b> Tu Núcleo ${Math.round(pr * 100)}% · rival ${Math.round(rr * 100)}%.`);
    Stage.ko(won ? 'rival' : 'hero');
    await wait(1500);
    showResult(won, won ? '' : 'tiempo');
  }

  function rtTick(now) {
    if (!B || !B.rt || B.rt.ended) return;
    const rt = B.rt, { p, r } = B;
    const dt = Math.min(0.1, (now - rt.last) / 1000); rt.last = now;
    if (!rt.paused) {
      rt.clock += dt; rt.time -= dt;
      for (const k in rt.cd) rt.cd[k] = Math.max(0, rt.cd[k] - dt);
      ['fast', 'dmgX', 'slowTut'].forEach((k) => { if (rt[k] > 0) rt[k] -= dt; });
      p.counterT = Math.max(0, (p.counterT || 0) - dt);
      // Kai
      if (!p.guard) p.kai = Math.min(100, p.kai + (RT.kaiRegen + (p.charging ? (B.rule === 'acero' ? RT.chargeRate / 2 : RT.chargeRate) : 0)) * dt);
      if (!r.guard && !r.act) r.kai = Math.min(100, r.kai + (RT.kaiRegen + (r.charging ? RT.chargeRate : 0)) * dt);
      if (p.guard && (rt.guardFx -= dt) <= 0) { Stage.guard('hero'); rt.guardFx = 0.7; }
      if (p.charging) { if (p.kai >= 100) { p.charging = false; p.chargeEnd = rt.clock; } else if ((rt.chargeFx -= dt) <= 0) { Stage.charge('hero'); rt.chargeFx = 0.9; } }
      // Coraza, quemaduras y regla del escenario
      for (const f of [p, r]) {
        if (f.broken > 0) { f.broken -= dt; if (f.broken <= 0) { f.broken = 0; f.coraza = RULES.rebuild; } }
        else if (rt.clock - (f.lastHit || 0) > RT.regenDelay) f.coraza = Math.min(f.corazaMax, f.coraza + RT.regenRate * dt);
        if (f.burnT > 0) { f.burnT -= dt; f.nucleo -= RT.burnDps * dt; }
        if (B.rule === 'sol' && !f.broken) { f.coraza -= RT.solDrain * dt; if (f.coraza <= 0) { f.coraza = 0; f.broken = RT.brokenSec; if (f === p) B.stats.pBrokeTurn = B.stats.pBrokeTurn || 1; } }
      }
      if (rt.solFx !== undefined && (rt.solFx -= dt) <= 0) { Stage.fx('heat'); rt.solFx = 3; }
      if (B.rule === 'tormenta') {
        rt.boltT -= dt;
        if (!rt.boltWarned && rt.boltT <= 2) { rt.boltWarned = true; log('⚡ El cielo se carga: <b>ponte en Guardia</b> para recibir el rayo (+30 Kai).'); }
        if (rt.boltT <= 0) {
          const lucky = [p, r].filter((f) => f.guard);
          lucky.forEach((f) => { f.kai = Math.min(100, f.kai + 30); Stage.fx('bolt', f === p ? 'hero' : 'rival'); });
          if (!lucky.length) Stage.fx('boltMiss');
          log(lucky.length ? `⚡ Cae el rayo: +30 Kai a ${lucky.map((f) => (f === p ? 'Ren' : B.rival.name)).join(' y ')}.` : '⚡ Cae el rayo, pero nadie estaba en Guardia.');
          rt.boltT = RT.boltEvery; rt.boltWarned = false;
        }
      }
      // Suceso aleatorio
      if (!rt.eventDone && rt.time <= rt.eventAt) {
        rt.eventDone = true; rt.event.run(p, r);
        rtBanner(rt.event.name, rt.event.desc); log(`✦ <b>${rt.event.name}:</b> ${rt.event.desc}`);
        if (window.Sfx) Sfx.play('levelup');
      }
      // Rival
      if (r.stun > 0) { r.stun -= dt; r.guard = false; r.charging = false; }
      else if (!r.act) {
        if (r.guard && (rt.rGuardT -= dt) <= 0) r.guard = false;
        if (r.charging && (rt.rChargeT -= dt) <= 0) r.charging = false;
        if (!r.guard && !r.charging && (rt.next -= dt * (rt.fast > 0 ? 1.4 : 1)) <= 0) { rt.next = rand(...rt.style.think); rtThink(); }
      }
      // Marcador
      const s = Math.max(0, Math.ceil(rt.time));
      $('turn-banner').textContent = `⏱ ${s}`;
      $('turn-banner').classList.toggle('enemy', s <= 10);
      if ((rt.ui -= dt) <= 0) { rt.ui = 0.08; renderBattle(); rtCooldowns(); }
      if (p.nucleo <= 0 || r.nucleo <= 0 || rt.time <= 0) rtCheck();
    }
    requestAnimationFrame(rtTick);
  }
  function rtCooldowns() {
    const rt = B.rt;
    const total = { strike: RT.strikeCd, kick: RT.kickCd, potion: RT.potionCd };
    document.querySelectorAll('.cmd').forEach((b) => {
      const a = b.dataset.act;
      b.style.setProperty('--cd', total[a] ? (rt.cd[a] / total[a]) * 100 + '%' : '0%');
      b.classList.toggle('held', (a === 'guard' && B.p.guard) || (a === 'charge' && B.p.charging));
    });
    if (B.r.act || B.r.stun) return;
    if (B.r.guard) { $('r-status').textContent = 'GUARDIA'; }
  }

  async function rtIntro() {
    if (P.tutR) return;
    B.tut = { seen: {} };
    await coach('<b>MODO RITMO:</b> aquí no hay turnos. <b>Golpe</b> y <b>Patada</b> se recargan solos; <b>Guardia</b> y <b>Cargar</b> se <b>mantienen pulsados</b>. Tienes <b>60 segundos</b>.');
    await coach('Cuando el rival vaya a atacar verás un <b>anillo</b>: <b>toca el escenario</b> al cerrarse para esquivar (y castigar ×1,5), mantén <b>Guardia</b>, o <b>interrúmpelo con una Patada</b>.');
    B.tut = null; P.tutR = true; save(); glow(null);
  }

  function rtStart() {
    const rt = B.rt = {
      time: B.mod === 'limite' ? 40 : RT.time, clock: 0, last: performance.now(), cd: { strike: 0, kick: 0, potion: 0 },
      style: styleFor(B.rival), next: 1.2, combo: 0, ended: false, paused: false, ui: 0,
      boltT: RT.boltEvery, lastDouble: 0, fast: 0, dmgX: 0, guardFx: 0, chargeFx: 0, slowTut: P.wins < 1 ? 12 : 0,
      event: EVENTS[Math.floor(Math.random() * EVENTS.length)],
    };
    rt.eventAt = rt.time * rand(0.4, 0.55);
    $('charge-cost').textContent = 'MANTÉN';
    $('guard-info').textContent = 'MANTÉN · ' + (B.rule === 'acero' ? '−80%' : '−60%') + ' daño';
    if (B.rule === 'sol') rt.solFx = 1;
    B.p.lastHit = B.r.lastHit = 0;
    B.r.nucleo = B.r.nucleoMax = Math.round(B.r.nucleoMax * RT.rNucleo);
    $('turn-banner').classList.remove('enemy');
    log(`<b>${B.rival.name}</b> · estilo <b>${rt.style.name}</b>. ¡Lucha!`);
    rtBanner('¡LUCHA!', `${rt.time} segundos · estilo ${rt.style.name.toLowerCase()}`);
    busy = false;
    renderBattle();
    requestAnimationFrame(rtTick);
  }

  // Botones en modo ritmo: al pulsar (no al soltar); Guardia y Cargar mientras se mantienen
  if (RITMO) {
    document.querySelectorAll('.cmd').forEach((b) => {
      const a = b.dataset.act;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); rtPress(a); });
      if (a === 'guard' || a === 'charge') ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b.addEventListener(ev, () => rtRelease(a)));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    const info = { strike: `${RT.strike} daño · +${RT.strikeKai} Kai · ${RT.strikeCd}s`, kick: `${RT.kick} daño · interrumpe`, charge: 'MANTÉN · +Kai, +25% daño', guard: 'MANTÉN · −60% daño', ultimate: '35 · 50 al Núcleo si hay ruptura' };
    document.querySelectorAll('.cmd').forEach((b) => { const i = b.querySelector('.cmd-info'); if (info[b.dataset.act] && i && b.dataset.act !== 'potion') i.textContent = info[b.dataset.act]; });
    $('charge-cost').textContent = 'MANTÉN';
    const tl = document.querySelector('#res-turns'); if (tl && tl.previousElementSibling) tl.previousElementSibling.textContent = 'SEGUNDOS';
    document.body.classList.add('ritmo');
    const RR = { sol: 'El calor desgasta sin parar la Coraza de ambos.', acero: 'La Guardia para el 80% del daño, pero Cargar rinde la mitad.', tormenta: 'Cada 10 segundos cae un rayo: +30 Kai a quien esté en Guardia.', fuego: 'La Patada deja quemadura y el Estallido hace +30%.' };
    SCHOOLS.forEach((sc) => { if (RR[sc.id]) sc.rule = RR[sc.id]; });
    SIGS.doble.desc = 'Cada 7 segundos ataca dos veces seguidas.'; SIGS.doble.tip = 'Voltio lanza un doble ataque cada 7 segundos: mantén la Guardia cuando lo anuncie.';
    SIGS.espejismo.desc = 'Si acabas de cargar Kai, esquiva tu siguiente ataque.';
    SIGS.muro.tip = 'No golpees al Guardián mientras está en Guardia: carga Kai o espera a que la baje.';
    MODS.limite.desc = 'Tienes 40 segundos para vencer o pierdes.';
  }

  // ---------- Diálogo del maestro (3 frases, toca para avanzar) ----------
  function showDialog(rival) {
    return new Promise((resolve) => {
      const A = window.ASSETS || {};
      const box = $('dialog');
      box.style.setProperty('--c', rival.look.aura);
      let i = 0;
      const render = () => {
        const [who, text] = rival.lines[i];
        const isRen = who === 'ren';
        $('dlg-name').textContent = isRen ? 'REN' : rival.name.toUpperCase();
        $('dlg-text').textContent = text;
        const art = isRen ? HERO_LOOK.art : rival.look.art;
        $('dlg-portrait').style.backgroundImage = `url("${A[art + '-retrato'] || A[art] || ''}")`;
        $('dlg-portrait').classList.toggle('flip', !isRen);
        $('dlg-hint').textContent = i === rival.lines.length - 1 ? 'Toca para luchar' : 'Toca para continuar';
      };
      const close = () => { box.removeEventListener('click', next); $('dlg-skip').removeEventListener('click', skip); box.classList.add('hidden'); resolve(); };
      const next = () => { if (window.Sfx) Sfx.play('ui'); i++; if (i >= rival.lines.length) close(); else render(); };
      const skip = (e) => { e.stopPropagation(); close(); };
      render();
      box.classList.remove('hidden');
      box.addEventListener('click', next);
      $('dlg-skip').addEventListener('click', skip);
    });
  }

  // ---------- QTE: esquiva con anillo ----------
  function dodgeQTE(dur) {
    return new Promise((resolve) => {
      const box = $('dodge-qte'), ring = $('dodge-shrink');
      box.classList.remove('hidden', 'result-good', 'result-bad');
      ring.classList.remove('go');
      void ring.offsetWidth;
      ring.style.setProperty('--dur', dur + 'ms');
      ring.classList.add('go');
      const t0 = performance.now();
      let done = false;
      const finish = (res) => {
        if (done) return; done = true;
        box.removeEventListener('pointerdown', onTap);
        box.classList.add(res === 'miss' ? 'result-bad' : 'result-good');
        setTimeout(() => { box.classList.add('hidden'); resolve(res); }, 220);
      };
      const onTap = (e) => {
        e.preventDefault();
        const t = (performance.now() - t0) / dur; // 0..1
        if (t >= 0.82 && t <= 1.12) finish('perfect');
        else if (t >= 0.6) finish('good');
        else finish('miss');
      };
      box.addEventListener('pointerdown', onTap);
      setTimeout(() => finish('miss'), dur * 1.15);
    });
  }

  // ---------- QTE: Choque de Núcleos (5 s de toques; solo el ganador hace daño) ----------
  function clash() {
    return new Promise((resolve) => {
      const box = $('clash-qte');
      box.classList.remove('hidden');
      Stage.beamStart();
      const DURATION = 5000;
      const tapPower = (0.02 + 0.0008 * (P.level - 1)) * (1 + 0.1 * P.dojo.nucleo);
      const hold = !!P.hold;
      let holding = false;
      $('clash-tap').textContent = hold ? 'MANTÉN PULSADO' : 'TOCA SIN PARAR';
      const rivalPush = B.rival.clash;
      let pos = 0.5; // 0 = junto al héroe (pierdes), 1 = junto al rival (ganas)
      let last = performance.now();
      const t0 = last;
      let ended = false;

      const onTap = (e) => { e.preventDefault(); if (hold) holding = true; else { pos += tapPower; if (window.Sfx) Sfx.play('tap'); } };
      const onUp = () => { holding = false; };
      box.addEventListener('pointerdown', onTap);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);

      const tick = (now) => {
        if (ended) return;
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        pos -= rivalPush * dt * (0.8 + Math.random() * 0.4);
        if (holding) pos += tapPower * 6.5 * dt; // equivale a ~6,5 toques por segundo
        pos = clamp(pos, 0, 1);
        Stage.beamSet(pos);
        $('clash-fill').style.width = pos * 100 + '%';
        $('clash-marker').style.left = pos * 100 + '%';
        $('clash-time').style.width = Math.max(0, 1 - (now - t0) / DURATION) * 100 + '%';
        if (pos >= 1 || pos <= 0 || now - t0 >= DURATION) return end();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      async function end() {
        ended = true;
        box.removeEventListener('pointerdown', onTap);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        box.classList.add('hidden');
        Stage.beamEnd();
        const { p, r } = B;
        if (pos >= 0.5) {
          const d = burstOn(p, r);
          Stage.hit('rival', d.shown, { crit: true });
          log(`¡Ganas el Choque de Núcleos! Tu Estallido impacta: <b>${d.shown}</b>${where(d)}.` + (d.broke ? breakMsg(r, 'tu rival') : ''));
        } else {
          const d = burstOn(r, p);
          Stage.hit('hero', d.shown, { crit: true });
          log(`Pierdes el Choque de Núcleos y recibes <b>${d.shown}</b>${where(d)}.` + (d.broke ? breakMsg(p, 'Ren') : ''));
        }
        renderBattle();
        await wait(600);
        resolve();
      }
    });
  }

  // ---------- Fin de combate ----------
  async function checkEnd() {
    const { p, r } = B;
    if (r.nucleo > 0 && p.nucleo > 0) return false;
    const won = r.nucleo <= 0 && p.nucleo > 0;
    Stage.ko(won ? 'rival' : 'hero');
    log(won ? `¡El Núcleo de ${B.rival.name} se apaga!` : 'Tu Núcleo se vacía…');
    await wait(1300);
    showResult(won);
    return true;
  }

  // Consejo concreto tras una derrota (GDD: «tu Núcleo se vació en el turno X…»)
  function defeatTip(reason) {
    const s = B.stats;
    if (reason === 'tiempo' && RITMO && B.mod !== 'limite') return 'Se acabó el tiempo con menos Núcleo que tu rival. Rompe antes su Coraza con Patadas y castiga mientras esté rota; esquivar a tiempo te da golpes ×1,5.';
    if (reason === 'tiempo') return 'En Contrarreloj no hay tiempo para defenderse: rompe pronto la Coraza con Patadas y remata con el Estallido.';
    if (B.sig && (s.sigHits || 0) >= 2) return SIGS[B.sig].tip;
    if (reason === 'abandono') return 'Abandonar cuenta como derrota. Si vas mal, usa Guardia y un Parche para recomponer la Coraza.';
    if (s.chargedHit >= 2) return `Te golpearon ${s.chargedHit} veces mientras cargabas (+25% de daño). Carga solo cuando el rival esté aturdido o en Guardia.`;
    if (s.pBrokeTurn && s.pBrokeTurn <= 6) return `Tu Coraza se rompió en el turno ${s.pBrokeTurn}. Cuando baje de 30, usa un Parche o ponte en Guardia.`;
    if (!s.rBroken) return 'Nunca llegaste a romper su Coraza: encadena Golpes y Patadas para provocar la Ruptura y castigar su Núcleo ×1,5.';
    if (!s.bursts) return 'No lanzaste ningún Estallido. Con 100 Kai haces 50 al Núcleo si su Coraza está rota.';
    if (B.rule === 'tormenta' && !s.guards) return 'En el Valle del Trueno, ponte en Guardia en los turnos múltiplos de 3: el rayo te da +30 Kai.';
    return 'Esquiva cuando el anillo se cierre: una esquiva perfecta anula el golpe y te da +15 Kai.';
  }

  function showResult(won, reason) {
    if (B.rt) { B.turn = Math.round(B.rt.clock); B.rt.ended = true; if (B.r.act) { B.r.act.ring.cancel(); B.r.act = null; } $('dodge-qte').classList.add('hidden'); }
    const rv = B.rival;
    const exp = won ? rv.exp + B.perfect * 10 : Math.round(rv.exp * 0.25);
    const gold = won ? rv.gold : 0;
    const before = P.level;
    const firstWin = won && !rv.tower && !P.beaten.includes(rv.id);
    P.exp += exp; P.gold += gold;
    if (won) { P.wins++; if (firstWin) P.beaten.push(rv.id); }
    if (won && rv.tower) P.tower = Math.max(P.tower, rv.floor);
    if (B.tut) { P.tut = true; B.tut = null; }
    glow(null);
    while (P.exp >= expNeeded(P.level)) { P.exp -= expNeeded(P.level); P.level++; }
    save();

    const title = $('res-title');
    title.textContent = won ? '¡VICTORIA!' : 'DERROTA';
    title.classList.toggle('lose', !won);
    const si = rv.tower ? -1 : SCHOOLS.findIndex((s) => s.master === rv.id);
    const nextSchool = si >= 0 ? SCHOOLS[si + 1] : null;
    const unlock = !firstWin ? '' : rv.master
      ? (nextSchool ? ` Se abre la ${nextSchool.school}: ${nextSchool.name}.` : ' ¡Has superado las cuatro escuelas!')
      : (SCHOOLS.some((s) => s.disciples.includes(rv.id) && s.disciples.every((id) => P.beaten.includes(id))) ? ' El maestro de la escuela acepta tu desafío.' : '');
    $('res-sub').textContent = won && rv.tower
      ? (rv.floor >= 30 ? '¡Has conquistado la Torre de las Escuelas!' : `Superas el piso ${rv.floor}. El piso ${rv.floor + 1} te espera.`)
      : won ? `Has vencido a ${rv.name}.` + unlock
      : `${rv.name} ha sido superior.`;
    const tip = $('res-tip');
    tip.classList.toggle('hidden', won);
    tip.innerHTML = won ? '' : '<b>Consejo:</b> ' + defeatTip(reason);
    $('res-exp').textContent = '+' + exp;
    $('res-gold').textContent = '+' + gold;
    $('res-turns').textContent = B.turn;
    $('res-dodges').textContent = B.perfect;
    $('res-level').textContent = P.level;
    $('res-exp-txt').textContent = `${P.exp} / ${expNeeded(P.level)} EXP`;
    $('res-expbar').style.width = '0%';
    setTimeout(() => { $('res-expbar').style.width = (P.exp / expNeeded(P.level)) * 100 + '%'; }, 200);
    const lu = $('res-levelup');
    lu.classList.toggle('hidden', P.level === before);
    if (P.level !== before) {
      const a = heroStats(before), b = heroStats(P.level);
      lu.innerHTML = `¡SUBES AL NIVEL ${P.level}!<small>Núcleo ${a.nucleo} → <b>${b.nucleo}</b> · Fuerza ${Math.round(a.mult * 100)}% → <b>${Math.round(b.mult * 100)}%</b> · Rango ${rankOf(P.level)}</small>`;
    }
    $('btn-retry').textContent = rv.tower && won ? (rv.floor >= 30 ? 'REPETIR PISO 30' : 'SIGUIENTE PISO') : won ? 'COMBATIR DE NUEVO' : 'REVANCHA';
    $('btn-hub').textContent = rv.tower ? 'VOLVER A LA TORRE' : 'VOLVER AL MAPA';
    Prueba.fight(rv, won, reason);
    lastWon = won;
    busy = true;
    show('screen-result');
    if (window.Sfx) { Sfx.play(won ? 'win' : 'lose'); if (P.level !== before) Sfx.play('levelup'); }
  }

  // ---------- Prueba con jugadores (encuesta + registro local; se envía a mano o a la base del enlace) ----------
  const Prueba = (() => {
    const KEY = RITMO ? 'ruptura_prueba_ritmo' : 'ruptura_prueba_v1';
    const VERSION = RITMO ? '2.0' : '1.6';
    const SURVEY_AT = (n) => n === 1 || n === 3 || n % 5 === 0;
    let T;
    let dbRef = null;
    try { T = JSON.parse(localStorage.getItem(KEY)); } catch (e) { T = null; }
    if (!T || !Array.isArray(T.f)) T = { id: Math.random().toString(36).slice(2, 8), v: VERSION, t0: Date.now(), ses: 0, lastAt: 0, f: [], s: [], cur: null };
    // Nueva sesión si han pasado más de 30 minutos desde la última actividad
    if (Date.now() - (T.lastAt || 0) > 30 * 60 * 1000) T.ses++;
    // Un combate empezado y no terminado = cerró el juego a mitad
    if (T.cur) { T.f.push({ r: T.cur, w: 0, t: 0, x: 'cerrado', re: 0, lv: P.level, m: mins() }); T.cur = null; }
    T.v = VERSION;
    persist();

    function mins() { return Math.round((Date.now() - T.t0) / 60000); }
    function persist() {
      T.lastAt = Date.now();
      if (T.f.length > 300) T.f = T.f.slice(-300);
      try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* sin almacenamiento */ }
      if (dbRef) dbRef.set(Object.assign({}, T, { nivel: P.level, torre: P.tower, vencidos: P.beaten.slice() })).catch(() => {});
    }
    const tag = (rv) => rv.tower ? 'T' + rv.floor : rv.id;
    function start(rv) { T.cur = tag(rv); persist(); }
    function fight(rv, won, reason) {
      T.cur = null;
      T.f.push({ r: tag(rv), w: won ? 1 : 0, t: B.turn, x: reason || '', re: B.retry ? 1 : 0, lv: P.level, m: mins() });
      persist();
      const n = T.f.filter((e) => e.x !== 'cerrado').length;
      openSurvey(SURVEY_AT(n) ? n : 0);
    }

    // Encuesta de 3 preguntas en la pantalla de resultado
    let ans = null;
    function openSurvey(n) {
      const box = $('survey');
      box.classList.toggle('hidden', !n);
      document.querySelector('#screen-result .result-body').classList.toggle('with-survey', !!n);
      if (!n) return;
      ans = { n, a: [0, 0, 0] };
      box.querySelectorAll('.q').forEach((q) => { q.classList.remove('hidden'); q.querySelectorAll('button').forEach((b) => b.classList.remove('on')); });
      const th = box.querySelector('.thanks'); if (th) th.remove();
      $('survey-skip').classList.remove('hidden');
    }
    $('survey').querySelectorAll('.q').forEach((q) => q.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (!ans) return;
      q.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      ans.a[+q.dataset.q] = +b.dataset.v;
      if (ans.a.every(Boolean)) {
        T.s.push({ n: ans.n, d: ans.a[0], f: ans.a[1], s: ans.a[2], m: mins() });
        ans = null; persist();
        const box = $('survey');
        box.querySelectorAll('.q').forEach((x) => x.classList.add('hidden'));
        $('survey-skip').classList.add('hidden');
        const p = document.createElement('p'); p.className = 'thanks';
        p.textContent = '¡Gracias! Cuando termines, pulsa «Enviar mis resultados» en el mapa.';
        box.appendChild(p);
      }
    })));
    $('survey-skip').addEventListener('click', () => { ans = null; $('survey').classList.add('hidden'); document.querySelector('#screen-result .result-body').classList.remove('with-survey'); });

    // Informe en texto: lo lee una persona y lo puede analizar Claude
    const NAMES = Object.fromEntries(RIVALS.map((r) => [r.id, r.name]));
    const nm = (r) => r[0] === 'T' && /^T\d+$/.test(r) ? 'Torre piso ' + r.slice(1) : (NAMES[r] || r);
    const L3 = [['Poco', 'Normal', 'Mucho'], ['Fácil', 'Justa', 'Difícil'], ['No', 'Quizá', 'Sí']];
    function reportText() {
      const done = T.f.filter((e) => e.x !== 'cerrado');
      const wins = done.filter((e) => e.w).length;
      const last = T.f[T.f.length - 1];
      const tries = {};
      done.forEach((e) => { if (!e.w) tries[e.r] = (tries[e.r] || 0) + 1; });
      const hard = Object.entries(tries).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r, k]) => `${nm(r)} ×${k}`).join(', ') || 'ninguna';
      const lines = [
        `RUPTURA KAI · prueba v${T.v} · jugador ${T.id}`,
        `Tiempo desde el inicio: ${mins()} min · Sesiones: ${T.ses}`,
        `Combates terminados: ${done.length} (victorias ${wins}, derrotas ${done.length - wins}) · Nivel ${P.level} · Torre: piso ${P.tower}`,
        `Maestros vencidos: ${P.beaten.filter((id) => (rivalById(id) || {}).master).map((id) => NAMES[id]).join(', ') || 'ninguno'}`,
        `Derrotas por rival: ${hard}`,
        `Abandonos: ${done.filter((e) => e.x === 'abandono').length} · Cerró a mitad de combate: ${T.f.filter((e) => e.x === 'cerrado').length}`,
        `Último combate: ${!last ? 'ninguno' : last.x === 'cerrado' ? `cerró el juego a mitad, contra ${nm(last.r)}` : `${last.w ? 'victoria' : 'derrota'} contra ${nm(last.r)}${last.x && !last.w ? ' (' + last.x + ')' : ''}`}`,
        'Opiniones: ' + (T.s.length ? T.s.map((o) => `[tras ${o.n}] diversión ${L3[0][o.d - 1]}, dificultad ${L3[1][o.f - 1]}, seguir ${L3[2][o.s - 1]}`).join(' · ') : 'ninguna'),
        '#RK ' + JSON.stringify({ id: T.id, v: T.v, ses: T.ses, lv: P.level, tw: P.tower, b: P.beaten, f: T.f.map((e) => [e.r, e.w, e.t, e.x, e.re, e.m]), s: T.s.map((o) => [o.n, o.d, o.f, o.s]) }),
      ];
      return lines.join('\n');
    }
    function openReport() {
      const txt = reportText();
      $('report-text').value = txt;
      $('report-msg').textContent = '';
      $('report-wa').href = 'https://wa.me/?text=' + encodeURIComponent(txt);
      $('report-share').classList.toggle('hidden', !navigator.share);
      $('report').classList.remove('hidden');
    }
    $('btn-report').addEventListener('click', openReport);
    $('report-close').addEventListener('click', () => $('report').classList.add('hidden'));
    $('report-share').addEventListener('click', async () => {
      try { await navigator.share({ title: 'Ruptura Kai · mis resultados', text: $('report-text').value }); }
      catch (e) { if (e && e.name !== 'AbortError') $('report-msg').textContent = 'No se pudo compartir. Usa WhatsApp o Copiar.'; }
    });
    $('report-copy').addEventListener('click', async () => {
      const ta = $('report-text');
      let ok = false;
      try { await navigator.clipboard.writeText(ta.value); ok = true; } catch (e) {
        try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      }
      $('report-msg').textContent = ok ? 'Copiado. Pégalo en un mensaje.' : 'Selecciona el texto y cópialo a mano.';
    });

    // Si el juego se abre desde el enlace de Claude con sesión iniciada, se guarda también en la base del enlace
    async function connect() {
      try {
        if (!window.claude || !window.claude.use) return false;
        const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
        if (!db || !user) return true;
        const uid = await user.id();
        if (!uid) return true;
        dbRef = db.doc('pruebas/' + uid);
        persist();
      } catch (e) { /* sin base: queda el envío manual */ }
      return true;
    }
    (async () => { for (let i = 0; i < 5; i++) { if (await connect()) return; await wait(1000); } })();

    return { start, fight, reportText, data: () => T };
  })();

  // ---------- Eventos ----------
  if (!RITMO) document.querySelectorAll('.cmd').forEach((b) => b.addEventListener('click', () => playerAct(b.dataset.act)));
  let lastWon = false;
  $('btn-retry').addEventListener('click', () => {
    const rv = B.rival;
    if (rv.tower && lastWon) startBattle(towerRival(Math.min(30, rv.floor + 1)));
    else startBattle(rv, { retry: true });
  });
  $('btn-hub').addEventListener('click', () => { if (B.rival.tower) openTower(); else { renderHub(); show('screen-hub'); } });
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { renderHub(); show('screen-hub'); }));
  $('btn-dojo').addEventListener('click', openDojo);
  $('btn-tower').addEventListener('click', openTower);
  $('opt-hold').addEventListener('change', (e) => { P.hold = e.target.checked; save(); });

  // ---------- Dojo ----------
  function openDojo() {
    $('dojo-gold').textContent = P.gold.toLocaleString('es-ES');
    const list = $('dojo-list');
    list.innerHTML = '';
    DOJO.forEach((t) => {
      const n = P.dojo[t.id];
      const cost = DOJO_COST[n];
      const c = document.createElement('div');
      c.className = 'dojo-card';
      c.style.setProperty('--c', t.color);
      c.innerHTML = `<h3>${t.name}</h3><div class="pips">${[0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</div>` +
        `<p>${n ? 'Ahora: ' + t.desc(n) : 'Sin entrenar.'}${n < 3 ? '<br>Siguiente rango: ' + t.desc(n + 1) : ''}</p>`;
      const b = document.createElement('button');
      b.className = 'dojo-buy';
      b.dataset.dojo = t.id;
      b.textContent = n >= 3 ? 'RANGO MÁXIMO' : P.gold >= cost ? `ENTRENAR · ${cost} ORO` : `FALTAN ${cost - P.gold} DE ORO`;
      b.disabled = n >= 3 || P.gold < cost;
      b.addEventListener('click', () => { if (P.gold < cost || n >= 3) return; P.gold -= cost; P.dojo[t.id]++; save(); openDojo(); });
      c.appendChild(b);
      list.appendChild(c);
    });
    show('screen-dojo');
  }

  // ---------- Torre de las Escuelas: 30 pisos, el escenario cambia cada 5 ----------
  const TOWER_STAGES = ['dunas', 'norte', 'trueno', 'templo'];
  function towerRival(floor) {
    const block = Math.floor((floor - 1) / 5);
    const bg = TOWER_STAGES[block % 4];
    const school = SCHOOLS.find((s) => s.bg === bg);
    const boss = floor % 5 === 0;
    const base = boss ? rivalById(school.master) : RIVALS.filter((r) => !r.master)[(floor - 1) % 3];
    const mod = boss || floor === 1 ? '' : MOD_ORDER[(floor - 2 - Math.floor((floor - 1) / 5)) % MOD_ORDER.length];
    return {
      sig: boss ? base.sig : '', mod,
      id: 'torre-' + floor, tower: true, floor, master: false,
      name: base.name, title: `Piso ${floor}`,
      nucleo: Math.round((60 + 5 * floor) * (boss ? 1.2 : 1)), mult: +(0.75 + 0.025 * floor).toFixed(3),
      ai: Math.min(0.9, 0.3 + 0.02 * floor), clash: Math.min(0.15, 0.07 + 0.0025 * floor),
      exp: 30 + 8 * floor, gold: 100 + 30 * floor, bg, look: base.look,
    };
  }
  function openTower() {
    const next = Math.min(30, P.tower + 1);
    const rv = towerRival(next);
    const school = SCHOOLS.find((s) => s.bg === rv.bg);
    const A = window.ASSETS || {};
    $('tower-best').textContent = P.tower;
    const box = $('tower-next');
    box.innerHTML =
      `<small class="tag">${P.tower >= 30 ? 'TORRE CONQUISTADA' : 'SIGUIENTE PISO'}</small>` +
      `<h3>PISO ${next} · ${rv.name.toUpperCase()}${next % 5 === 0 ? ' ♛' : ''}</h3>` +
      `<p class="rule"><b>${school.name}:</b> ${school.rule}</p>` +
      (rv.sig ? `<p class="rule"><b>♛ ${SIGS[rv.sig].name}:</b> ${SIGS[rv.sig].desc}</p>` : rv.mod ? `<p class="rule"><b>⚑ ${MODS[rv.mod].name}:</b> ${MODS[rv.mod].desc}</p>` : '');
    const go = document.createElement('button');
    go.className = 'btn-primary';
    go.id = 'btn-climb';
    go.textContent = `SUBIR AL PISO ${next}`;
    go.addEventListener('click', () => startBattle(rv));
    box.appendChild(go);
    const grid = $('tower-grid');
    grid.innerHTML = '';
    for (let f = 30; f >= 1; f--) {
      const s = document.createElement('span');
      const sc = SCHOOLS.find((x) => x.bg === TOWER_STAGES[Math.floor((f - 1) / 5) % 4]);
      s.style.setProperty('--c', sc.color);
      s.className = (f <= P.tower ? 'done' : '') + (f === next && P.tower < 30 ? ' next' : '') + (f % 5 === 0 ? ' boss' : '');
      s.textContent = f;
      grid.appendChild(s);
    }
    show('screen-tower');
  }
  // Confirmación en dos toques (los diálogos del navegador no siempre están disponibles)
  function twoTap(btn, question, action) {
    const label = btn.textContent;
    let armed = false, timer = null;
    btn.addEventListener('click', () => {
      if (!armed) {
        armed = true; btn.textContent = question + ' Toca otra vez para confirmar';
        timer = setTimeout(() => { armed = false; btn.textContent = label; }, 3000);
        return;
      }
      clearTimeout(timer); armed = false; btn.textContent = label; action();
    });
  }
  twoTap($('btn-flee'), '¿Abandonar? Cuenta como derrota.', () => { if (busy) return; B.p.nucleo = 0; showResult(false, 'abandono'); });
  twoTap($('btn-reset'), '¿Borrar el progreso?', () => { P = defaults(); save(); renderHub(); });
  document.querySelectorAll('[data-mute]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); if (window.Sfx) Sfx.setMuted(!Sfx.muted); }));
  if (window.Sfx) Sfx.setMuted(Sfx.muted);
  if (window.Sfx) Sfx.music('hub');
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Gancho para pruebas automatizadas
  window.__game = { towerRival, get state() { return B; }, get save() { return P; }, act: playerAct, render: () => renderBattle(), get busy() { return busy; }, prueba: Prueba };

  const stageReady = Stage.init('stage');
  renderHub();
})();
