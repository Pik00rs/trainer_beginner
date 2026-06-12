/* ============================================================
   app.js — interface du trainer (4 modes)
   ============================================================ */
;(function () {
  'use strict';
  const P = window.Poker;
  const N_QUESTIONS = 20;

  const $app = document.getElementById('app');
  const $hud = document.getElementById('hud');

  let BANK = null;
  let state = null; // { mode, questions, idx, got, max, results[], perType{} }

  const MODES = {
    m1: {
      key: 'm1', num: '1', title: 'Identifier',
      desc: 'Une main de 5 cartes. Nomme la combinaison.',
      gen: b => P.genMode1Exercise(b, N_QUESTIONS)
    },
    m2: {
      key: 'm2', num: '2', title: 'Duel',
      desc: 'Deux mains de 5 cartes. Nomme chacune, puis désigne la gagnante.',
      gen: b => P.genMode2Exercise(b, N_QUESTIONS)
    },
    m3: {
      key: 'm3', num: '3', title: 'Meilleure main',
      desc: '2 cartes en main + board de 5. Sélectionne tes 5 meilleures cartes et nomme la main.',
      gen: b => P.genMode3Exercise(b, N_QUESTIONS)
    },
    m4: {
      key: 'm4', num: '4', title: 'Showdown',
      desc: '2 joueurs, 1 board. Nomme la main de chacun et le vainqueur.',
      gen: b => P.genMode4Exercise(b, N_QUESTIONS)
    }
  };

  /* ---------- Petits helpers DOM ---------- */
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };

  function cardNode(card, i) {
    const red = card.s === 'h' || card.s === 'd';
    const d = el('button', 'card' + (red ? ' red' : ''));
    d.type = 'button';
    d.style.setProperty('--i', i);
    d.dataset.key = P.cardStr(card);
    const r = P.rankDisplay(card.r);
    d.appendChild(el('span', 'cr' + (card.r === 10 ? ' ten' : ''), r));
    d.appendChild(el('span', 'cs', SUIT_GLYPH[card.s]));
    return d;
  }

  function cardRow(cards, startIndex) {
    const row = el('div', 'cards');
    cards.forEach((c, i) => row.appendChild(cardNode(c, (startIndex || 0) + i)));
    return row;
  }

  function sectionLabel(txt) { return el('div', 'slabel', txt); }

  function typeSelect() {
    const s = el('select', 'tsel');
    const o0 = document.createElement('option');
    o0.value = ''; o0.disabled = true; o0.selected = true;
    o0.textContent = '— Combinaison —';
    s.appendChild(o0);
    P.TYPE_KEYS.forEach(k => {
      const o = document.createElement('option');
      o.value = k; o.textContent = P.TYPE_LABELS[k];
      s.appendChild(o);
    });
    return s;
  }

  function segControl(options, onChange) {
    const wrap = el('div', 'seg');
    let value = null;
    options.forEach(opt => {
      const b = el('button', 'segbtn', opt.label);
      b.type = 'button';
      b.dataset.v = opt.v;
      b.onclick = () => {
        if (wrap.classList.contains('locked')) return;
        value = opt.v;
        wrap.querySelectorAll('.segbtn').forEach(x => x.classList.toggle('on', x === b));
        if (onChange) onChange(value);
      };
      wrap.appendChild(b);
    });
    wrap.getValue = () => value;
    wrap.lock = () => wrap.classList.add('locked');
    return wrap;
  }

  /* ---------- HUD + progression ---------- */
  function updateHud() {
    if (!state) { $hud.innerHTML = ''; return; }
    $hud.innerHTML = '';
    const m = MODES[state.mode];
    $hud.appendChild(el('span', 'hud-mode', 'Mode ' + m.num + ' · ' + m.title));
    $hud.appendChild(el('span', 'hud-score', state.got + '<i>/' + state.max + ' pts</i>'));
    const quit = el('button', 'hud-quit', 'Quitter');
    quit.type = 'button';
    quit.onclick = renderMenu;
    $hud.appendChild(quit);
  }

  function progressStrip() {
    const strip = el('div', 'progress');
    for (let i = 0; i < state.questions.length; i++) {
      const p = el('span', 'pip');
      if (state.results[i]) p.classList.add(state.results[i], 'done');
      else if (i === state.idx) p.classList.add('cur');
      strip.appendChild(p);
    }
    return strip;
  }

  function addType(typeKey, ok) {
    const s = state.perType[typeKey] || (state.perType[typeKey] = { ok: 0, tot: 0 });
    s.tot++;
    if (ok) s.ok++;
  }

  /* ---------- Menu ---------- */
  function renderMenu() {
    state = null;
    updateHud();
    $app.innerHTML = '';
    const wrap = el('div', 'menu');
    Object.values(MODES).forEach(m => {
      const c = el('button', 'modecard');
      c.type = 'button';
      c.appendChild(el('span', 'mc-num', m.num));
      const body = el('span', 'mc-body');
      body.appendChild(el('span', 'mc-title', m.title));
      body.appendChild(el('span', 'mc-desc', m.desc));
      c.appendChild(body);
      c.appendChild(el('span', 'mc-meta', N_QUESTIONS + '<i>questions</i>'));
      c.onclick = () => startMode(m.key);
      wrap.appendChild(c);
    });
    $app.appendChild(wrap);
  }

  function startMode(key) {
    $app.innerHTML = '';
    $app.appendChild(el('div', 'loading', 'Distribution des cartes…'));
    setTimeout(() => {
      const questions = MODES[key].gen(BANK); // tout l'exo est généré ici, d'un bloc
      state = { mode: key, questions, idx: 0, got: 0, max: 0, results: [], perType: {} };
      renderQuestion();
    }, 40);
  }

  /* ---------- Question ---------- */
  function renderQuestion() {
    updateHud();
    const q = state.questions[state.idx];
    $app.innerHTML = '';
    $app.appendChild(progressStrip());
    const box = el('div', 'qbox');
    box.appendChild(el('div', 'qnum', 'Question ' + (state.idx + 1) + ' / ' + state.questions.length));
    if (state.mode === 'm1') buildM1(box, q);
    if (state.mode === 'm2') buildM2(box, q);
    if (state.mode === 'm3') buildM3(box, q);
    if (state.mode === 'm4') buildM4(box, q);
    $app.appendChild(box);
  }

  function finishQuestion(box, partsOk, partsMax, lines) {
    state.got += partsOk;
    state.max += partsMax;
    const result = partsOk === partsMax ? 'ok' : (partsOk === 0 ? 'ko' : 'part');
    state.results[state.idx] = result;
    updateHud();
    // rafraîchit la bande de progression
    const old = $app.querySelector('.progress');
    if (old) old.replaceWith(progressStrip());

    const fb = el('div', 'feedback ' + result);
    fb.appendChild(el('div', 'fb-head', result === 'ok' ? 'Correct' : (result === 'part' ? 'Partiel' : 'Raté')));
    lines.forEach(l => fb.appendChild(el('div', 'fb-line', l)));
    box.appendChild(fb);

    const last = state.idx === state.questions.length - 1;
    const next = el('button', 'btn primary', last ? 'Résultats' : 'Suivant');
    next.type = 'button';
    next.onclick = () => {
      state.idx++;
      if (last) renderEnd(); else renderQuestion();
    };
    box.appendChild(next);
    next.focus();
  }

  const MARK_OK = '<b class="y">✓</b>';
  const MARK_KO = '<b class="n">✗</b>';

  /* ---------- Mode 1 ---------- */
  function buildM1(box, q) {
    box.appendChild(el('div', 'prompt', 'Quelle est cette combinaison ?'));
    box.appendChild(cardRow(q.cards));
    const grid = el('div', 'typegrid');
    P.TYPE_KEYS.forEach(k => {
      const b = el('button', 'tbtn', P.TYPE_LABELS[k]);
      b.type = 'button';
      b.dataset.k = k;
      b.onclick = () => {
        const ok = k === q.answer;
        addType(q.answer, ok);
        grid.querySelectorAll('.tbtn').forEach(x => {
          x.disabled = true;
          if (x.dataset.k === q.answer) x.classList.add('good');
          else if (x.dataset.k === k) x.classList.add('bad');
        });
        const ev = P.evaluate5(q.cards);
        finishQuestion(box, ok ? 1 : 0, 1,
          [(ok ? MARK_OK : MARK_KO) + ' ' + P.describe(ev.value)]);
      };
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  /* ---------- Mode 2 ---------- */
  function buildM2(box, q) {
    box.appendChild(el('div', 'prompt', 'Nomme chaque main, puis désigne la gagnante.'));

    const selA = typeSelect(), selB = typeSelect();
    const blockA = el('div', 'hand');
    blockA.appendChild(sectionLabel('Main A'));
    blockA.appendChild(cardRow(q.A, 0));
    blockA.appendChild(selA);
    const blockB = el('div', 'hand');
    blockB.appendChild(sectionLabel('Main B'));
    blockB.appendChild(cardRow(q.B, 5));
    blockB.appendChild(selB);
    box.appendChild(blockA);
    box.appendChild(blockB);

    box.appendChild(sectionLabel('Main gagnante'));
    const seg = segControl([
      { v: 'A', label: 'Main A' },
      { v: 'tie', label: 'Égalité' },
      { v: 'B', label: 'Main B' }
    ], refresh);
    box.appendChild(seg);

    const valider = el('button', 'btn primary', 'Valider');
    valider.type = 'button';
    valider.disabled = true;
    box.appendChild(valider);

    function refresh() {
      valider.disabled = !(selA.value && selB.value && seg.getValue());
    }
    selA.onchange = refresh;
    selB.onchange = refresh;

    valider.onclick = () => {
      const okA = selA.value === q.ansA;
      const okB = selB.value === q.ansB;
      const okW = seg.getValue() === q.winner;
      addType(q.ansA, okA);
      addType(q.ansB, okB);
      selA.disabled = selB.disabled = true;
      seg.lock();
      valider.remove();
      const wLabel = { A: 'Main A', B: 'Main B', tie: 'Égalité' }[q.winner];
      finishQuestion(box, (okA ? 1 : 0) + (okB ? 1 : 0) + (okW ? 1 : 0), 3, [
        (okA ? MARK_OK : MARK_KO) + ' Main A — ' + P.describe(q.evA),
        (okB ? MARK_OK : MARK_KO) + ' Main B — ' + P.describe(q.evB),
        (okW ? MARK_OK : MARK_KO) + ' Gagnante — ' + wLabel
      ]);
    };
  }

  /* ---------- Mode 3 ---------- */
  function buildM3(box, q) {
    box.appendChild(el('div', 'prompt', 'Sélectionne les 5 cartes de ta meilleure main, puis nomme-la.'));

    const byKey = {};
    q.hole.concat(q.board).forEach(c => { byKey[P.cardStr(c)] = c; });
    const selected = new Set();
    let locked = false;

    const blockH = el('div', 'hand');
    blockH.appendChild(sectionLabel('Ta main'));
    const rowH = cardRow(q.hole, 0);
    blockH.appendChild(rowH);
    const blockB = el('div', 'hand');
    blockB.appendChild(sectionLabel('Board'));
    const rowB = cardRow(q.board, 2);
    blockB.appendChild(rowB);
    box.appendChild(blockH);
    box.appendChild(blockB);

    const counter = el('div', 'counter', '0 / 5 cartes');
    box.appendChild(counter);

    const sel = typeSelect();
    box.appendChild(sel);

    const valider = el('button', 'btn primary', 'Valider');
    valider.type = 'button';
    valider.disabled = true;
    box.appendChild(valider);

    function refresh() {
      counter.innerHTML = selected.size + ' / 5 cartes';
      valider.disabled = !(selected.size === 5 && sel.value);
    }
    sel.onchange = refresh;

    box.querySelectorAll('.card').forEach(cn => {
      cn.classList.add('pickable');
      cn.onclick = () => {
        if (locked) return;
        const k = cn.dataset.key;
        if (selected.has(k)) { selected.delete(k); cn.classList.remove('sel'); }
        else if (selected.size < 5) { selected.add(k); cn.classList.add('sel'); }
        refresh();
      };
    });

    valider.onclick = () => {
      locked = true;
      const five = Array.from(selected).map(k => byKey[k]);
      const evUser = P.evaluate5(five);
      const selOk = P.cmpValue(evUser.value, q.best.value) === 0; // toute sélection de valeur égale est acceptée
      const nameOk = sel.value === q.answer;
      addType(q.answer, nameOk);
      sel.disabled = true;
      valider.remove();
      // entoure la meilleure main calculée
      const bestKeys = new Set(q.best.cards.map(P.cardStr));
      box.querySelectorAll('.card').forEach(cn => {
        cn.classList.remove('pickable');
        if (bestKeys.has(cn.dataset.key)) cn.classList.add('best');
      });
      finishQuestion(box, (selOk ? 1 : 0) + (nameOk ? 1 : 0), 2, [
        (selOk ? MARK_OK : MARK_KO) + ' Sélection' + (selOk ? '' : ' — la meilleure main est entourée'),
        (nameOk ? MARK_OK : MARK_KO) + ' Combinaison — ' + P.describe(q.best.value)
      ]);
    };
  }

  /* ---------- Mode 4 ---------- */
  function buildM4(box, q) {
    box.appendChild(el('div', 'prompt', 'Nomme la meilleure main de chaque joueur, puis le vainqueur.'));

    const blockBoard = el('div', 'hand');
    blockBoard.appendChild(sectionLabel('Board'));
    blockBoard.appendChild(cardRow(q.board, 0));
    box.appendChild(blockBoard);

    const sel1 = typeSelect(), sel2 = typeSelect();
    const block1 = el('div', 'hand');
    block1.appendChild(sectionLabel('Joueur 1'));
    block1.appendChild(cardRow(q.hole1, 5));
    block1.appendChild(sel1);
    const block2 = el('div', 'hand');
    block2.appendChild(sectionLabel('Joueur 2'));
    block2.appendChild(cardRow(q.hole2, 7));
    block2.appendChild(sel2);
    box.appendChild(block1);
    box.appendChild(block2);

    box.appendChild(sectionLabel('Vainqueur'));
    const seg = segControl([
      { v: 'P1', label: 'Joueur 1' },
      { v: 'tie', label: 'Égalité' },
      { v: 'P2', label: 'Joueur 2' }
    ], refresh);
    box.appendChild(seg);

    const valider = el('button', 'btn primary', 'Valider');
    valider.type = 'button';
    valider.disabled = true;
    box.appendChild(valider);

    function refresh() {
      valider.disabled = !(sel1.value && sel2.value && seg.getValue());
    }
    sel1.onchange = refresh;
    sel2.onchange = refresh;

    valider.onclick = () => {
      const ok1 = sel1.value === q.ans1;
      const ok2 = sel2.value === q.ans2;
      const okW = seg.getValue() === q.winner;
      addType(q.ans1, ok1);
      addType(q.ans2, ok2);
      sel1.disabled = sel2.disabled = true;
      seg.lock();
      valider.remove();
      const wLabel = { P1: 'Joueur 1', P2: 'Joueur 2', tie: 'Égalité' }[q.winner];
      finishQuestion(box, (ok1 ? 1 : 0) + (ok2 ? 1 : 0) + (okW ? 1 : 0), 3, [
        (ok1 ? MARK_OK : MARK_KO) + ' Joueur 1 — ' + P.describe(q.best1.value),
        (ok2 ? MARK_OK : MARK_KO) + ' Joueur 2 — ' + P.describe(q.best2.value),
        (okW ? MARK_OK : MARK_KO) + ' Vainqueur — ' + wLabel
      ]);
    };
  }

  /* ---------- Fin d'exercice ---------- */
  function renderEnd() {
    updateHud();
    $app.innerHTML = '';
    $app.appendChild(progressStrip());
    const box = el('div', 'endbox');
    const pct = state.max ? Math.round(100 * state.got / state.max) : 0;
    box.appendChild(el('div', 'score-big', state.got + '<span class="of">/' + state.max + '</span>'));
    box.appendChild(el('div', 'score-pct', pct + ' %'));

    const tbl = el('table', 'stats');
    tbl.innerHTML = '<tr><th>Combinaison</th><th>Réussite</th></tr>';
    P.TYPE_KEYS.forEach(k => {
      const s = state.perType[k];
      if (!s) return;
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + P.TYPE_LABELS[k] + '</td><td>' + s.ok + ' / ' + s.tot + '</td>';
      if (s.ok < s.tot) tr.classList.add('weak');
      tbl.appendChild(tr);
    });
    box.appendChild(el('div', 'slabel', 'Par combinaison'));
    box.appendChild(tbl);

    const row = el('div', 'endbtns');
    const again = el('button', 'btn primary', 'Rejouer');
    again.type = 'button';
    const mode = state.mode;
    again.onclick = () => startMode(mode);
    const menu = el('button', 'btn', 'Menu');
    menu.type = 'button';
    menu.onclick = renderMenu;
    row.appendChild(again);
    row.appendChild(menu);
    box.appendChild(row);
    $app.appendChild(box);
  }

  /* ---------- Boot ---------- */
  fetch('combos.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(b => { BANK = b; renderMenu(); })
    .catch(() => {
      $app.innerHTML = '';
      $app.appendChild(el('div', 'loaderr',
        'Impossible de charger <b>combos.json</b>.<br>' +
        'Lance le jeu via un serveur local (WAMP) ou GitHub Pages — pas en ouvrant le fichier directement (file://).'));
    });
})();
