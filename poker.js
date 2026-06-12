/* ============================================================
   poker.js — cœur logique (évaluateur + générateurs des 4 modes)
   Fonctionne en navigateur (window.Poker) et en Node (require).
   ============================================================ */
;(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Poker = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- Constantes ---------- */
  const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  const SUITS = ['s', 'h', 'd', 'c'];
  const RANK_CHARS = { 2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'T',11:'J',12:'Q',13:'K',14:'A' };
  const CHAR_TO_RANK = {};
  Object.keys(RANK_CHARS).forEach(r => { CHAR_TO_RANK[RANK_CHARS[r]] = +r; });

  // Ordre = force croissante. L'index sert de catégorie (0..8).
  const TYPE_KEYS = ['hauteur','paire','deux_paires','brelan','quinte','couleur','full','carre','quinte_flush'];
  const TYPE_LABELS = {
    hauteur: 'Hauteur',
    paire: '1 Paire',
    deux_paires: '2 Paires',
    brelan: 'Brelan',
    quinte: 'Straight',
    couleur: 'Flush',
    full: 'Full',
    carre: 'Carré',
    quinte_flush: 'Straight Flush'
  };
  const CAT_OF = {};
  TYPE_KEYS.forEach((k, i) => { CAT_OF[k] = i; });

  /* ---------- Cartes ---------- */
  function parseCard(str) { return { r: CHAR_TO_RANK[str[0]], s: str[1] }; }
  function cardStr(c) { return RANK_CHARS[c.r] + c.s; }
  function rankDisplay(r) { return r === 10 ? '10' : RANK_CHARS[r]; }
  function fullDeck() {
    const d = [];
    for (const r of RANKS) for (const s of SUITS) d.push({ r, s });
    return d;
  }
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function comboKey(strs) { return strs.slice().sort().join(','); }

  /* ---------- Évaluateur 5 cartes ----------
     Retourne { cat, value } où value = [cat, tiebreak...]
     comparables lexicographiquement. */
  const _cnt = new Int8Array(15);
  function evaluate5(cards) {
    _cnt.fill(0);
    let flush = true;
    const s0 = cards[0].s;
    for (let i = 0; i < 5; i++) {
      _cnt[cards[i].r]++;
      if (cards[i].s !== s0) flush = false;
    }
    let quad = 0, trip = 0, p1 = 0, p2 = 0, nUniq = 0, hi = 0, lo = 15;
    const singles = [];
    for (let r = 14; r >= 2; r--) {
      const k = _cnt[r];
      if (!k) continue;
      nUniq++;
      if (r > hi) hi = r;
      if (r < lo) lo = r;
      if (k === 4) quad = r;
      else if (k === 3) trip = r;
      else if (k === 2) { if (!p1) p1 = r; else p2 = r; }
      else singles.push(r);
    }
    let stHigh = 0;
    if (nUniq === 5) {
      if (hi - lo === 4) stHigh = hi;
      else if (_cnt[14] && _cnt[5] && _cnt[4] && _cnt[3] && _cnt[2]) stHigh = 5; // roue A-2-3-4-5
    }
    let cat, tb;
    if (flush && stHigh)                 { cat = 8; tb = [stHigh]; }
    else if (quad)                       { cat = 7; tb = [quad, singles[0]]; }
    else if (trip && p1)                 { cat = 6; tb = [trip, p1]; }
    else if (flush)                      { cat = 5; tb = singles; }
    else if (stHigh)                     { cat = 4; tb = [stHigh]; }
    else if (trip)                       { cat = 3; tb = [trip, singles[0], singles[1]]; }
    else if (p2)                         { cat = 2; tb = [p1, p2, singles[0]]; }
    else if (p1)                         { cat = 1; tb = [p1, singles[0], singles[1], singles[2]]; }
    else                                 { cat = 0; tb = singles; }
    return { cat, value: [cat].concat(tb) };
  }

  function cmpValue(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  }

  /* ---------- Meilleure main parmi 7 cartes ---------- */
  const COMBOS_5_OF_7 = (function () {
    const res = [];
    for (let a = 0; a < 7; a++)
      for (let b = a + 1; b < 7; b++)
        for (let c = b + 1; c < 7; c++)
          for (let d = c + 1; d < 7; d++)
            for (let e = d + 1; e < 7; e++)
              res.push([a, b, c, d, e]);
    return res; // 21 combinaisons
  })();

  function best7(cards7) {
    let best = null, bestCards = null;
    for (let i = 0; i < COMBOS_5_OF_7.length; i++) {
      const idx = COMBOS_5_OF_7[i];
      const five = [cards7[idx[0]], cards7[idx[1]], cards7[idx[2]], cards7[idx[3]], cards7[idx[4]]];
      const ev = evaluate5(five);
      if (!best || cmpValue(ev.value, best.value) > 0) { best = ev; bestCards = five; }
    }
    return { cat: best.cat, value: best.value, cards: bestCards };
  }

  /* ---------- Description FR d'une valeur ---------- */
  const RN = { 14: 'As', 13: 'Roi', 12: 'Dame', 11: 'Valet' };
  function rn(r) { return RN[r] || String(r); }
  function rnp(r) { return RN[r] ? (r === 14 ? 'As' : RN[r] + 's') : String(r); }
  function describe(value) {
    const c = value[0];
    switch (c) {
      case 0: return 'Hauteur ' + rn(value[1]);
      case 1: return '1 Paire (' + rnp(value[1]) + ')';
      case 2: return '2 Paires (' + rnp(value[1]) + ' & ' + rnp(value[2]) + ')';
      case 3: return 'Brelan (' + rnp(value[1]) + ')';
      case 4: return 'Straight (hauteur ' + rn(value[1]) + ')';
      case 5: return 'Flush (hauteur ' + rn(value[1]) + ')';
      case 6: return 'Full (' + rnp(value[1]) + ' / ' + rnp(value[2]) + ')';
      case 7: return 'Carré (' + rnp(value[1]) + ')';
      case 8: return value[1] === 14 ? 'Straight Flush Royale' : 'Straight Flush (hauteur ' + rn(value[1]) + ')';
    }
    return '';
  }

  /* ---------- Picker pondéré avec décroissance ----------
     Chaque type tiré voit son poids multiplié par `decay`.
     À chaque tirage, tous les poids remontent doucement vers 1
     (`recover`) pour ne pas bloquer un type définitivement. */
  function TypePicker(opts) {
    opts = opts || {};
    this.decay = opts.decay != null ? opts.decay : 0.35;
    this.recover = opts.recover != null ? opts.recover : 0.18;
    this.w = {};
    for (const k of TYPE_KEYS) this.w[k] = 1;
  }
  TypePicker.prototype.pick = function (allowed) {
    const keys = (allowed && allowed.length) ? allowed.filter(k => CAT_OF[k] != null) : TYPE_KEYS;
    let tot = 0;
    for (const k of keys) tot += this.w[k];
    let x = Math.random() * tot;
    let chosen = keys[keys.length - 1];
    for (const k of keys) { x -= this.w[k]; if (x < 0) { chosen = k; break; } }
    for (const k of TYPE_KEYS) this.w[k] += (1 - this.w[k]) * this.recover;
    this.w[chosen] = Math.max(0.02, this.w[chosen] * this.decay);
    return chosen;
  };

  /* ---------- Accès à la banque (combos.json) ----------
     Lecture seule : on retourne {cards, key} sans marquer la
     combinaison comme utilisée — c'est l'appelant qui ajoute la
     clé à `used` une fois la question validée. */
  function chooseFromBank(bank, type, used, avoid) {
    const list = bank.types[type];
    const order = shuffled(list);
    for (const combo of order) {
      const k = comboKey(combo);
      if (used.has(k)) continue;
      if (avoid && combo.some(cs => avoid.has(cs))) continue;
      return { cards: combo.map(parseCard), key: k };
    }
    // Banque épuisée pour ce type (impossible sur 20 questions) :
    // on tolère la réutilisation plutôt que de planter.
    for (const combo of order) {
      if (avoid && combo.some(cs => avoid.has(cs))) continue;
      return { cards: combo.map(parseCard), key: comboKey(combo) };
    }
    return { cards: order[0].map(parseCard), key: comboKey(order[0]) };
  }

  /* ============================================================
     MODE 1 — Identifier la combinaison
     ============================================================ */
  function genMode1Exercise(bank, n) {
    n = n || 20;
    const picker = new TypePicker();
    const used = new Set();
    const qs = [];
    for (let i = 0; i < n; i++) {
      const t = picker.pick();
      const pick = chooseFromBank(bank, t, used);
      used.add(pick.key);
      qs.push({ cards: shuffled(pick.cards), answer: t });
    }
    return qs;
  }

  /* ============================================================
     MODE 2 — Duel de deux mains de 5 cartes
     ============================================================ */
  // Types pour lesquels une égalité avec cartes disjointes est
  // possible (brelan/full/carré : impossible — pas assez de cartes
  // de même rang dans le deck).
  const TIEABLE = ['hauteur', 'paire', 'deux_paires', 'quinte', 'couleur', 'quinte_flush'];

  const SUIT_PERMS = (function () {
    function perms(a) {
      if (a.length <= 1) return [a];
      const out = [];
      for (let i = 0; i < a.length; i++) {
        const rest = a.slice(0, i).concat(a.slice(i + 1));
        for (const p of perms(rest)) out.push([a[i]].concat(p));
      }
      return out;
    }
    return perms(SUITS)
      .map(p => ({ s: p[0], h: p[1], d: p[2], c: p[3] }))
      .filter(m => !(m.s === 's' && m.h === 'h' && m.d === 'd' && m.c === 'c'));
  })();

  // Construit une main de même valeur, sans aucune carte commune,
  // en permutant les couleurs. Retourne null si impossible.
  function tieVariant(cardsA) {
    const taken = new Set(cardsA.map(cardStr));
    const evA = evaluate5(cardsA).value;
    for (const perm of shuffled(SUIT_PERMS)) {
      const B = cardsA.map(c => ({ r: c.r, s: perm[c.s] }));
      if (B.some(c => taken.has(cardStr(c)))) continue;
      if (cmpValue(evaluate5(B).value, evA) === 0) return B;
    }
    return null;
  }

  function genMode2Exercise(bank, n, tieP) {
    n = n || 20;
    tieP = tieP != null ? tieP : 0.13;
    const picker = new TypePicker();
    const used = new Set();
    const qs = [];
    for (let i = 0; i < n; i++) {
      const tA = picker.pick();
      const pickA = chooseFromBank(bank, tA, used);
      used.add(pickA.key);
      const A = pickA.cards;

      let B = null;
      if (Math.random() < tieP && TIEABLE.indexOf(tA) !== -1) {
        B = tieVariant(A);
        if (B) used.add(comboKey(B.map(cardStr)));
      }
      if (!B) {
        const tB = picker.pick();
        const avoid = new Set(A.map(cardStr)); // jamais 2x la même carte physique à l'écran
        const pickB = chooseFromBank(bank, tB, used, avoid);
        used.add(pickB.key);
        B = pickB.cards;
      }

      const evA = evaluate5(A), evB = evaluate5(B);
      const c = cmpValue(evA.value, evB.value);
      qs.push({
        A: shuffled(A), B: shuffled(B),
        ansA: TYPE_KEYS[evA.cat], ansB: TYPE_KEYS[evB.cat],
        evA: evA.value, evB: evB.value,
        winner: c > 0 ? 'A' : (c < 0 ? 'B' : 'tie')
      });
    }
    return qs;
  }

  /* ============================================================
     MODE 3 — Meilleure main sur 2 cartes + board de 5
     Génération inversée : type cible -> combo de la banque ->
     répartition main/board -> remplissage aléatoire -> on garde
     uniquement si la meilleure main des 7 cartes est TOUJOURS du
     type cible (l'évaluateur fait foi).
     ============================================================ */
  function weightedSplit() {
    // Nombre de cartes du combo cible placées dans la main du joueur.
    const x = Math.random();
    if (x < 0.50) return 2;
    if (x < 0.85) return 1;
    return 0; // « jouer le board » : ça arrive en vrai, c'est formateur
  }

  function genMode3Question(picker, bank, used) {
    for (let outer = 0; outer < 40; outer++) {
      const t = picker.pick();
      const target = CAT_OF[t];
      for (let ctry = 0; ctry < 12; ctry++) {
        const pick = chooseFromBank(bank, t, used);
        const combo = shuffled(pick.cards);
        const split = weightedSplit();
        const holeFromCombo = combo.slice(0, split);
        const boardFromCombo = combo.slice(split);
        const comboSet = new Set(combo.map(cardStr));
        const rest = fullDeck().filter(c => !comboSet.has(cardStr(c)));

        for (let f = 0; f < 60; f++) {
          const d = shuffled(rest);
          const needHole = 2 - holeFromCombo.length;
          const needBoard = 5 - boardFromCombo.length;
          const hole = holeFromCombo.concat(d.slice(0, needHole));
          const board = boardFromCombo.concat(d.slice(needHole, needHole + needBoard));
          const best = best7(hole.concat(board));
          if (best.cat === target) {
            used.add(pick.key);
            return {
              hole: shuffled(hole),
              board: shuffled(board),
              best: best,
              answer: TYPE_KEYS[best.cat]
            };
          }
        }
      }
    }
    // Filet de sécurité (ne devrait jamais arriver) : full random.
    const deck = shuffled(fullDeck());
    const hole = deck.slice(0, 2), board = deck.slice(2, 7);
    const best = best7(hole.concat(board));
    return { hole, board, best, answer: TYPE_KEYS[best.cat] };
  }

  function genMode3Exercise(bank, n) {
    n = n || 20;
    const picker = new TypePicker();
    const used = new Set();
    const qs = [];
    for (let i = 0; i < n; i++) qs.push(genMode3Question(picker, bank, used));
    return qs;
  }

  /* ============================================================
     MODE 4 — Showdown 2 joueurs
     Joueur 1 : logique du mode 3.
     Joueur 2 : on échantillonne des mains possibles parmi les 45
     cartes restantes, on les classe par type de main finale, puis
     on choisit le type avec le picker (donc distribution contrôlée
     aussi côté J2). Un tirage « égalité » force de temps en temps
     une main de valeur strictement identique à J1.
     ============================================================ */
  function genMode4Question(picker, bank, used, tieP) {
    tieP = tieP != null ? tieP : 0.10;
    const p1 = genMode3Question(picker, bank, used);
    const taken = new Set(p1.hole.concat(p1.board).map(cardStr));
    const remain = fullDeck().filter(c => !taken.has(cardStr(c))); // 45 cartes

    const pairs = [];
    for (let i = 0; i < remain.length; i++)
      for (let j = i + 1; j < remain.length; j++)
        pairs.push([remain[i], remain[j]]);

    const sampled = shuffled(pairs).slice(0, 420);
    const buckets = {};
    const evals = [];
    for (const h2 of sampled) {
      const b = best7([h2[0], h2[1]].concat(p1.board));
      const e = { h2, b };
      evals.push(e);
      (buckets[b.cat] = buckets[b.cat] || []).push(e);
    }

    let chosen = null;
    if (Math.random() < tieP) {
      const ties = evals.filter(e => cmpValue(e.b.value, p1.best.value) === 0);
      if (ties.length) chosen = sample(ties);
    }
    if (!chosen) {
      const avail = Object.keys(buckets).map(c => TYPE_KEYS[+c]);
      const t2 = picker.pick(avail);
      chosen = sample(buckets[CAT_OF[t2]]);
    }

    const c = cmpValue(p1.best.value, chosen.b.value);
    return {
      board: p1.board,
      hole1: p1.hole,
      hole2: shuffled(chosen.h2),
      best1: p1.best,
      best2: chosen.b,
      ans1: TYPE_KEYS[p1.best.cat],
      ans2: TYPE_KEYS[chosen.b.cat],
      winner: c > 0 ? 'P1' : (c < 0 ? 'P2' : 'tie')
    };
  }

  function genMode4Exercise(bank, n, tieP) {
    n = n || 20;
    const picker = new TypePicker();
    const used = new Set();
    const qs = [];
    for (let i = 0; i < n; i++) qs.push(genMode4Question(picker, bank, used, tieP));
    return qs;
  }

  /* ---------- Export ---------- */
  return {
    RANKS, SUITS, TYPE_KEYS, TYPE_LABELS, CAT_OF,
    parseCard, cardStr, rankDisplay, fullDeck, shuffled, sample, comboKey,
    evaluate5, cmpValue, best7, describe,
    TypePicker, chooseFromBank, tieVariant,
    genMode1Exercise, genMode2Exercise, genMode3Exercise, genMode4Exercise,
    genMode3Question, genMode4Question
  };
});
