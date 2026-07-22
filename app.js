/* ============================================================
   MINT v2 — vanilla JS, no deps, no build step.
   New in v2: deposits + balance-aware checkout, staged pack
   opening (gem crack -> particle burst -> staggered flips ->
   rarity flash/confetti), a proper sell sheet with pricing
   guidance, and tilt/holo specimen cards.
   ============================================================ */

'use strict';

/* ---------- config ---------- */

const RARITIES = {
  common:    { label: 'Common',    color: 'var(--r-common)',    hex: '#8e8e93', value: 1.2,  mult: 1.0 },
  rare:      { label: 'Rare',      color: 'var(--r-rare)',      hex: '#0a84ff', value: 4,    mult: 1.25 },
  epic:      { label: 'Epic',      color: 'var(--r-epic)',      hex: '#bf5af2', value: 12,   mult: 1.6 },
  legendary: { label: 'Legendary', color: 'var(--r-legendary)', hex: '#d4a017', value: 45,   mult: 2.1 },
  mythic:    { label: 'Mythic',    color: 'var(--r-mythic)',    hex: '#ff375f', value: 180,  mult: 3.0 },
};

const PACKS = {
  standard: { name: 'Standard Pack', price: 4.99, cards: 3,
              odds: { common: 62, rare: 26, epic: 9, legendary: 2.5, mythic: 0.5 } },
  premium:  { name: 'Premium Pack',  price: 9.99, cards: 5,
              odds: { common: 42, rare: 32, epic: 16, legendary: 7.5, mythic: 2.5 } },
};

const SPECIES = [
  { id: 'voltrix',   name: 'Voltrix',   body: 'diamond', hue: 210 },
  { id: 'glitchling',name: 'Glitchling',body: 'ghost',   hue: 275 },
  { id: 'pyrobyte',  name: 'Pyrobyte',  body: 'spike',   hue: 350 },
  { id: 'aquanode',  name: 'Aquanode',  body: 'blob',    hue: 195 },
  { id: 'nullfang',  name: 'Nullfang',  body: 'spike',   hue: 290 },
  { id: 'chromaw',   name: 'Chromaw',   body: 'hex',     hue: 155 },
  { id: 'hexapawn',  name: 'Hexapawn',  body: 'hex',     hue: 42  },
  { id: 'synthume',  name: 'Synthume',  body: 'ghost',   hue: 320 },
  { id: 'datadrake', name: 'Datadrake', body: 'diamond', hue: 18  },
  { id: 'wispbit',   name: 'Wispbit',   body: 'blob',    hue: 100 },
  { id: 'cachecat',  name: 'Cachecat',  body: 'blob',    hue: 235 },
  { id: 'ionmaw',    name: 'Ionmaw',    body: 'spike',   hue: 130 },
];

const PREFIXES = ['Nova','Glitch','Hyper','Zero','Vapor','Chrome','Static','Pulse','Aurora','Volt','Umbra','Flux'];
const BURST_COLORS = ['#0a84ff', '#bf5af2', '#ff375f', '#d4a017', '#34c759', '#5ac8fa'];
const MAX_SUPPLY = 500;
const STATS = ['power', 'speed', 'defense', 'luck'];

/* ---------- utils ---------- */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = n => '$' + n.toFixed(2);
const round2 = n => Math.round(n * 100) / 100;

function seededRng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- storage (swap for Firestore later) ---------- */

const Store = {
  KEY: 'mint_v2',
  mem: null,
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch { return this.mem; } },
  save(s) { this.mem = s; try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch {} },
};

let S = Store.load() || {
  balance: 0,          // deposits + sale proceeds — nothing is free
  mints: {},
  collection: [],
  market: [],
  activity: [],
};
const persist = () => Store.save(S);

/* ---------- minting ---------- */

function rollRarity(odds) {
  let roll = Math.random() * 100;
  for (const [rarity, weight] of Object.entries(odds)) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return 'common';
}

function mintCreature(rarity) {
  const sp = pick(SPECIES);
  S.mints[sp.id] = (S.mints[sp.id] || 0) + 1;
  const mult = RARITIES[rarity].mult;
  const stats = {};
  for (const st of STATS) stats[st] = Math.min(100, Math.round(rand(20, 60) * mult));
  return {
    id: uid(),
    species: sp.id,
    name: `${pick(PREFIXES)} ${sp.name}`,
    rarity,
    serial: Math.min(S.mints[sp.id], MAX_SUPPLY),
    seed: rand(1, 2 ** 31),
    stats,
    mintedAt: Date.now(),
  };
}

/* ---------- procedural SVG art ---------- */

function svgFor(c) {
  const sp = SPECIES.find(s => s.id === c.species);
  const rng = seededRng(c.seed);
  const hue = (sp.hue + Math.floor(rng() * 40) - 20 + 360) % 360;
  const main = `hsl(${hue} 75% 55%)`;
  const deep = `hsl(${hue} 70% 42%)`;
  const cx = 60, cy = 62, r = 30 + rng() * 8;
  let body = '';

  if (sp.body === 'blob') {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = r * (0.85 + rng() * 0.3);
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    body = `<polygon points="${pts.join(' ')}" fill="${main}" stroke="${deep}" stroke-width="2" stroke-linejoin="round"/>`;
  } else if (sp.body === 'hex') {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    }
    body = `<polygon points="${pts.join(' ')}" fill="${main}" stroke="${deep}" stroke-width="2"/>`;
  } else if (sp.body === 'diamond') {
    body = `<polygon points="${cx},${cy - r} ${cx + r * 0.8},${cy} ${cx},${cy + r} ${cx - r * 0.8},${cy}" fill="${main}" stroke="${deep}" stroke-width="2"/>`;
  } else if (sp.body === 'spike') {
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * 1.15 : r * 0.7;
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    body = `<polygon points="${pts.join(' ')}" fill="${main}" stroke="${deep}" stroke-width="2" stroke-linejoin="round"/>`;
  } else { // ghost
    body = `<path d="M${cx - r},${cy + r * 0.8} V${cy - r * 0.4} A${r},${r} 0 0 1 ${cx + r},${cy - r * 0.4} V${cy + r * 0.8}
      l-${r * 0.33},-${r * 0.25} l-${r * 0.33},${r * 0.25} l-${r * 0.33},-${r * 0.25} l-${r * 0.33},${r * 0.25} l-${r * 0.34},-${r * 0.25} Z"
      fill="${main}" stroke="${deep}" stroke-width="2" stroke-linejoin="round"/>`;
  }

  const nEyes = 1 + Math.floor(rng() * 3);
  let eyes = '';
  for (let i = 0; i < nEyes; i++) {
    const ex = cx + (i - (nEyes - 1) / 2) * 12;
    const ey = cy - 5 + rng() * 4;
    eyes += `<circle cx="${ex}" cy="${ey}" r="5" fill="#1d1d1f"/>
             <circle cx="${ex + 1.5}" cy="${ey - 1.5}" r="1.8" fill="#fff"/>`;
  }

  let extra = '';
  if (['epic', 'legendary', 'mythic'].includes(c.rarity)) {
    extra = `<line x1="${cx - 12}" y1="${cy - r}" x2="${cx - 18}" y2="${cy - r - 14}" stroke="${deep}" stroke-width="2.5" stroke-linecap="round"/>
             <line x1="${cx + 12}" y1="${cy - r}" x2="${cx + 18}" y2="${cy - r - 14}" stroke="${deep}" stroke-width="2.5" stroke-linecap="round"/>
             <circle cx="${cx - 18}" cy="${cy - r - 15}" r="3" fill="${main}"/>
             <circle cx="${cx + 18}" cy="${cy - r - 15}" r="3" fill="${main}"/>`;
  }

  let aura = '';
  if (['legendary', 'mythic'].includes(c.rarity)) {
    const auraColor = c.rarity === 'mythic' ? 'url(#mg)' : '#d4a017';
    aura = `<circle cx="${cx}" cy="${cy}" r="${r + 13}" fill="none" stroke="${auraColor}" stroke-width="1.8" stroke-dasharray="6 5" opacity=".85">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="10s" repeatCount="indefinite"/>
    </circle>`;
  }

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="art" role="img" aria-label="${c.name}">
    <defs>
      <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0a84ff"/><stop offset=".5" stop-color="#bf5af2"/><stop offset="1" stop-color="#ff375f"/>
      </linearGradient>
    </defs>
    ${aura}${body}${eyes}${extra}
  </svg>`;
}

/* ---------- payment sheet ---------- */
/* Balance-aware: if allowBalance and S.balance covers the total,
   the sheet charges MINT Balance instead of the card.
   Real integration: swap charge() for a POST to your Cloudflare
   Worker -> Stripe PaymentIntent; fulfil on the webhook only. */

const PaySheet = {
  onSuccess: null,
  usingBalance: false,
  total: 0,
  open(lines, total, onSuccess, { allowBalance = true } = {}) {
    this.onSuccess = onSuccess;
    this.total = total;
    this.usingBalance = allowBalance && S.balance >= total - 0.001;
    $('#payBody').innerHTML =
      lines.map(l => `<div class="pay-line"><strong>${l.name}</strong><span>${money(l.price)}</span></div>`).join('') +
      `<div class="pay-line total"><span>Total</span><span>${money(total)}</span></div>`;
    const chip = $('#payMethodChip');
    if (this.usingBalance) {
      chip.classList.add('balance');
      $('#payMethodName').textContent = 'MINT Balance';
      $('#payMethodSub').textContent = `${money(S.balance)} available`;
    } else {
      chip.classList.remove('balance');
      $('#payMethodName').textContent = 'MINT Card';
      $('#payMethodSub').textContent = 'Visa ···· 4242';
    }
    $('#payConfirm').textContent = `Pay ${money(total)}`;
    $('#payProcessing').classList.remove('on');
    $('#paySpinner').style.display = '';
    $('#payCheck').classList.remove('on');
    $('#payScrim').classList.add('open');
  },
  charge() {
    $('#payProcessing').classList.add('on');
    $('#payStatus').textContent = 'Processing';
    setTimeout(() => {
      if (this.usingBalance) S.balance = round2(S.balance - this.total);
      $('#paySpinner').style.display = 'none';
      $('#payCheck').classList.add('on');
      $('#payStatus').textContent = 'Done';
      setTimeout(() => {
        $('#payScrim').classList.remove('open');
        const cb = this.onSuccess; this.onSuccess = null;
        if (cb) cb(this.usingBalance);
      }, 850);
    }, 1200);
  },
};

$('#payConfirm').addEventListener('click', () => PaySheet.charge());
$('#payCancel').addEventListener('click', () => $('#payScrim').classList.remove('open'));

/* ---------- deposits ---------- */

$('#depositBtn').addEventListener('click', () => $('#depositScrim').classList.add('open'));

$('#amountChips').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  $$('.chip').forEach(c => c.classList.toggle('active', c === chip));
  $('#customAmt').value = chip.dataset.amt;
});

$('#customAmt').addEventListener('input', () => $$('.chip').forEach(c => c.classList.remove('active')));

$('#depositContinue').addEventListener('click', () => {
  const amt = round2(parseFloat($('#customAmt').value));
  if (!amt || amt < 1) return toast('Enter an amount of at least $1');
  if (amt > 500) return toast('Deposits are capped at $500');
  $('#depositScrim').classList.remove('open');
  PaySheet.open([{ name: 'Add funds to MINT balance', price: amt }], amt, () => {
    S.balance = round2(S.balance + amt);
    log('＋', 'Deposit', 'Card ···· 4242', amt);
    toast(`${money(amt)} added to your balance`);
    renderAll();
  }, { allowBalance: false });
});

/* ---------- activity ---------- */

function log(icon, title, sub, amt) {
  S.activity.unshift({ icon, title, sub, amt, t: Date.now() });
  if (S.activity.length > 60) S.activity.length = 60;
}

/* ---------- rendering ---------- */

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function renderWallet() {
  $('#balance').textContent = money(S.balance);
  $('#withdrawBtn').disabled = S.balance < 0.01;
  $('#collCount').textContent = S.collection.length;
}

function monCardHTML(c, actions) {
  const r = RARITIES[c.rarity];
  const mythic = c.rarity === 'mythic' ? ' mythic-sheen' : '';
  return `<article class="mon-card${mythic}" style="--rc:${r.color}" data-tilt data-id="${c.id}">
    <div class="art-tile">
      <span class="rpill">${r.label}</span>
      <span class="serial-pill">No. ${String(c.serial).padStart(3, '0')}</span>
      ${svgFor(c)}
      <div class="holo"></div>
    </div>
    <div class="mon-body">
      <h3>${c.name}</h3>
      <div class="pwr-row"><small>PWR</small><div class="pwr-bar"><div class="pwr-fill" style="width:${c.stats.power}%"></div></div><b>${c.stats.power}</b></div>
      <div class="actions">${actions}</div>
    </div>
  </article>`;
}

function renderCollection() {
  const sort = $('#sortSel').value;
  const order = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
  const list = [...S.collection].sort((a, b) =>
    sort === 'rarity' ? order[a.rarity] - order[b.rarity] :
    sort === 'power'  ? b.stats.power - a.stats.power :
    b.mintedAt - a.mintedAt);
  $('#collectionGrid').innerHTML = list.map(c => monCardHTML(c, `
    <button class="btn btn-quiet" data-act="view" data-id="${c.id}">View</button>
    <button class="btn btn-dark" data-act="sell" data-id="${c.id}">Sell</button>
  `)).join('');
}

function renderMarket() {
  $('#marketGrid').innerHTML = S.market.map(l => monCardHTML(l.creature, l.seller === 'you'
    ? `<button class="btn btn-quiet" data-act="delist" data-lid="${l.id}">Delist · ${money(l.price)}</button>`
    : `<button class="btn btn-dark" data-act="buy" data-lid="${l.id}"><span class="pay-mark"></span>&nbsp;${money(l.price)}</button>`
  )).join('');
  const others = S.market.filter(l => l.seller !== 'you');
  const floor = others.length ? Math.min(...others.map(l => l.price)) : 0;
  $('#marketStats').textContent = `${S.market.length} listings · floor ${money(floor)}`;
}

function renderActivity() {
  $('#activityList').innerHTML = S.activity.map(e => `
    <div class="act-row">
      <div class="act-icon">${e.icon}</div>
      <div class="act-main"><strong>${e.title}</strong><span>${e.sub} · ${new Date(e.t).toLocaleString('en-NZ', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</span></div>
      <span class="act-amt ${e.amt > 0 ? 'pos' : ''}">${e.amt > 0 ? '+' : e.amt < 0 ? '−' : ''}${e.amt ? money(Math.abs(e.amt)) : ''}</span>
    </div>`).join('') || '<div class="act-empty">No activity yet. Your deposits, purchases and sales appear here.</div>';
}

function renderOdds() {
  $('#oddsTable').innerHTML = Object.keys(RARITIES).map(k =>
    `<span><i style="background:${RARITIES[k].color}"></i>${RARITIES[k].label} <small>${PACKS.standard.odds[k]}% / ${PACKS.premium.odds[k]}%</small></span>`).join('');
}

function renderAll() {
  renderWallet(); renderCollection(); renderMarket(); renderActivity();
  persist();
}

/* ---------- tilt / holo on specimen cards ---------- */

document.addEventListener('pointermove', e => {
  const card = e.target.closest('[data-tilt]');
  if (!card) return;
  const b = card.getBoundingClientRect();
  const px = (e.clientX - b.left) / b.width;
  const py = (e.clientY - b.top) / b.height;
  card.style.setProperty('--rx', ((px - 0.5) * 10).toFixed(2) + 'deg');
  card.style.setProperty('--ry', ((0.5 - py) * 10).toFixed(2) + 'deg');
  const holo = card.querySelector('.holo');
  if (holo) {
    holo.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    holo.style.setProperty('--my', (py * 100).toFixed(1) + '%');
  }
});
document.addEventListener('pointerout', e => {
  const card = e.target.closest('[data-tilt]');
  if (card && !card.contains(e.relatedTarget)) {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  }
});

/* ---------- pack opening v2 ---------- */

let pendingPack = null;

function buyPack(key) {
  const pack = PACKS[key];
  PaySheet.open(
    [{ name: `MINT · ${pack.name}`, price: pack.price }],
    pack.price,
    (usedBalance) => {
      pendingPack = Array.from({ length: pack.cards }, () => mintCreature(rollRarity(pack.odds)));
      log('◆', pack.name, usedBalance ? 'MINT Balance' : 'Card ···· 4242', -pack.price);
      persist();
      openRevealIntro();
    }
  );
}

function openRevealIntro() {
  $('#revealScrim').classList.add('open');
  $('#openIntro').style.display = '';
  $('#revealStage').classList.remove('on');
  const wrap = $('#openGemWrap');
  wrap.classList.remove('cracking');
  // seed burst particles
  $('#gemBurst').innerHTML = Array.from({ length: 18 }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = 90 + Math.random() * 130;
    return `<i style="--c:${pick(BURST_COLORS)};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px"></i>`;
  }).join('');
  wrap.onclick = () => {
    wrap.classList.add('cracking');
    wrap.onclick = null;
    setTimeout(showReveal, 700);
  };
}

function confettiHTML() {
  return `<span class="confetti">${Array.from({ length: 16 }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 90;
    return `<i style="--c:${pick(BURST_COLORS)};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px"></i>`;
  }).join('')}</span>`;
}

function showReveal() {
  $('#openIntro').style.display = 'none';
  $('#revealStage').classList.add('on');
  $('#revealRow').innerHTML = pendingPack.map((c, i) => {
    const r = RARITIES[c.rarity];
    const epicplus = ['epic', 'legendary', 'mythic'].includes(c.rarity) ? ' epicplus' : '';
    return `<div class="reveal-card${epicplus}" data-i="${i}" style="--rc:${r.color};--d:${(i * 0.09).toFixed(2)}s">
      <div class="reveal-inner">
        <div class="reveal-face reveal-back"><div class="gem"></div></div>
        <div class="reveal-face reveal-front">
          ${svgFor(c)}<h4>${c.name}</h4><span class="rname">${r.label} · No. ${c.serial}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  $$('.reveal-card').forEach(card => card.addEventListener('click', () => flipCard(card), { once: true }));
}

function flipCard(card) {
  if (card.classList.contains('flipped')) return;
  card.classList.add('flipped');
  const c = pendingPack[+card.dataset.i];
  card.insertAdjacentHTML('beforeend', '<span class="flash"></span>');
  if (['legendary', 'mythic'].includes(c.rarity)) {
    card.insertAdjacentHTML('beforeend', confettiHTML());
  }
}

$('#revealAll').addEventListener('click', () => {
  $$('.reveal-card:not(.flipped)').forEach((card, i) =>
    setTimeout(() => flipCard(card), i * 220));
});

$('#revealDone').addEventListener('click', () => {
  if (!pendingPack) return;
  S.collection.push(...pendingPack);
  const best = pendingPack.reduce((a, b) => RARITIES[b.rarity].value > RARITIES[a.rarity].value ? b : a);
  toast(`${pendingPack.length} specimens minted — best pull: ${best.name} (${RARITIES[best.rarity].label})`);
  pendingPack = null;
  $('#revealScrim').classList.remove('open');
  renderAll();
});

/* ---------- market ---------- */

function fairValue(c) { return RARITIES[c.rarity].value; }

function rarityFloor(rarity) {
  const prices = S.market.filter(l => l.seller !== 'you' && l.creature.rarity === rarity).map(l => l.price);
  return prices.length ? Math.min(...prices) : round2(RARITIES[rarity].value * 1.2);
}

function seedMarket() {
  const bots = ['aria.k', 'no1collector', 'vault_9', 'kiwi.mints'];
  while (S.market.filter(l => l.seller !== 'you').length < 8) {
    const rarity = rollRarity({ common: 30, rare: 32, epic: 22, legendary: 13, mythic: 3 });
    const c = mintCreature(rarity);
    S.market.push({
      id: uid(),
      creature: c,
      price: round2(fairValue(c) * (1.1 + Math.random() * 0.9)),
      seller: pick(bots),
    });
  }
}

function buyListing(lid) {
  const i = S.market.findIndex(l => l.id === lid);
  if (i === -1) return;
  const l = S.market[i];
  PaySheet.open(
    [{ name: `${l.creature.name} · from @${l.seller}`, price: l.price }],
    l.price,
    (usedBalance) => {
      S.market.splice(i, 1);
      S.collection.push(l.creature);
      log('⇄', `Bought ${l.creature.name}`, usedBalance ? 'MINT Balance' : `From @${l.seller}`, -l.price);
      toast(`${l.creature.name} is yours`);
      seedMarket();
      renderAll();
    }
  );
}

/* ---------- sell sheet ---------- */

const Sell = { creature: null };

function openSell(id) {
  const c = S.collection.find(x => x.id === id);
  if (!c) return;
  Sell.creature = c;
  const r = RARITIES[c.rarity];
  const fair = fairValue(c);
  const floor = rarityFloor(c.rarity);
  $('#sellPreview').innerHTML = `
    <div class="art" style="--rc:${r.color}">${svgFor(c)}</div>
    <div class="sp-text">
      <strong>${c.name}</strong>
      <span>${r.label} · No. ${String(c.serial).padStart(3, '0')} / ${MAX_SUPPLY}</span>
    </div>`;
  $('#sellGuide').innerHTML = `
    <div class="guide-cell"><small>Fair value</small><b>${money(fair)}</b></div>
    <div class="guide-cell"><small>${r.label} floor</small><b>${money(floor)}</b></div>
    <div class="guide-cell"><small>Recent sales</small><b>${money(round2(fair * (0.95 + Math.random() * 0.25)))}</b></div>`;
  $('#sellPrice').value = round2(Math.min(fair * 1.1, floor * 0.98)).toFixed(2);
  updateSellBadge();
  $('#sellScrim').classList.add('open');
}

function updateSellBadge() {
  if (!Sell.creature) return;
  const price = parseFloat($('#sellPrice').value) || 0;
  const ratio = price / fairValue(Sell.creature);
  const badge = $('#sellBadge');
  badge.className = 'sell-badge ' + (ratio <= 1.15 ? 'fast' : ratio <= 1.6 ? 'fair' : 'high');
  badge.textContent =
    ratio <= 1.15 ? 'Priced to sell — usually sells within minutes' :
    ratio <= 1.6  ? 'Fair price — may take a while' :
                    'Above market — unlikely to sell at this price';
}

$('#sellPrice').addEventListener('input', updateSellBadge);
$('#stepDown').addEventListener('click', () => {
  const el = $('#sellPrice');
  el.value = Math.max(0.5, round2((parseFloat(el.value) || 1) - 0.5)).toFixed(2);
  updateSellBadge();
});
$('#stepUp').addEventListener('click', () => {
  const el = $('#sellPrice');
  el.value = round2((parseFloat(el.value) || 0) + 0.5).toFixed(2);
  updateSellBadge();
});

$('#sellConfirm').addEventListener('click', () => {
  const c = Sell.creature;
  const price = round2(parseFloat($('#sellPrice').value));
  if (!c || !price || price < 0.5) return toast('Set a price of at least $0.50');
  const i = S.collection.findIndex(x => x.id === c.id);
  if (i === -1) return;
  S.collection.splice(i, 1);
  const listing = { id: uid(), creature: c, price, seller: 'you' };
  S.market.unshift(listing);
  log('▤', `Listed ${c.name}`, `Asking ${money(price)}`, 0);
  toast(`${c.name} listed at ${money(price)}`);
  Sell.creature = null;
  $('#sellScrim').classList.remove('open');
  scheduleBotBuy(listing);
  renderAll();
});

function delist(lid) {
  const i = S.market.findIndex(l => l.id === lid && l.seller === 'you');
  if (i === -1) return;
  const l = S.market.splice(i, 1)[0];
  S.collection.push(l.creature);
  toast(`${l.creature.name} returned to your collection`);
  renderAll();
}

// Simulated demand: better prices sell faster (window must stay open)
function scheduleBotBuy(listing) {
  const ratio = listing.price / fairValue(listing.creature);
  if (ratio > 1.6) return;
  const delay = ratio <= 1.15 ? rand(8, 20) : ratio <= 1.4 ? rand(20, 45) : rand(45, 75);
  setTimeout(() => {
    const i = S.market.findIndex(l => l.id === listing.id);
    if (i === -1) return;
    S.market.splice(i, 1);
    S.balance = round2(S.balance + listing.price);
    log('✓', `Sold ${listing.creature.name}`, `To @${pick(['aria.k','vault_9','no1collector','kiwi.mints'])}`, listing.price);
    toast(`${listing.creature.name} sold for ${money(listing.price)}`);
    renderAll();
  }, delay * 1000);
}

/* ---------- withdraw ---------- */

$('#withdrawBtn').addEventListener('click', () => {
  const amt = S.balance;
  if (amt < 0.01) return;
  PaySheet.open([{ name: 'Transfer to bank ···· 8231', price: amt }], amt, () => {
    S.balance = 0;
    log('⤓', 'Withdrawal', 'To bank ···· 8231', -amt);
    toast(`${money(amt)} on its way to your bank`);
    renderAll();
  }, { allowBalance: false });
});

/* ---------- detail modal ---------- */

function openDetail(id) {
  const c = S.collection.find(x => x.id === id) || S.market.find(l => l.creature.id === id)?.creature;
  if (!c) return;
  const r = RARITIES[c.rarity];
  $('#detailCard').style.setProperty('--rc', r.color);
  $('#detailCard').innerHTML = `
    <button class="close-x" data-act="closeDetail" aria-label="Close">✕</button>
    ${svgFor(c)}
    <h3>${c.name}</h3>
    <p class="serial">${r.label} · No. ${String(c.serial).padStart(3, '0')} / ${MAX_SUPPLY} · minted ${new Date(c.mintedAt).toLocaleDateString('en-NZ')}</p>
    <div class="statbars">
      ${STATS.map(st => `
        <div class="statbar"><span>${st.toUpperCase().slice(0, 3)}</span>
        <div class="bar"><div class="fill" style="width:${c.stats[st]}%"></div></div>
        <span>${c.stats[st]}</span></div>`).join('')}
    </div>`;
  $('#detailScrim').classList.add('open');
}

/* ---------- tabs & global events ---------- */

function positionPill() {
  const active = $('.seg-btn.active');
  const pill = $('#segPill');
  pill.style.width = active.offsetWidth + 'px';
  pill.style.transform = `translateX(${active.offsetLeft - 3}px)`;
}

function switchTab(name) {
  $$('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  positionPill();
}

document.addEventListener('click', e => {
  const closer = e.target.closest('[data-close]');
  if (closer) return $('#' + closer.dataset.close).classList.remove('open');
  const t = e.target.closest('[data-act],[data-tab],[data-pack],[data-goto]');
  if (!t) {
    if (e.target.id === 'detailScrim') $('#detailScrim').classList.remove('open');
    return;
  }
  if (t.dataset.tab) return switchTab(t.dataset.tab);
  if (t.dataset.goto) return switchTab(t.dataset.goto);
  if (t.dataset.pack) return buyPack(t.dataset.pack);
  switch (t.dataset.act) {
    case 'view':   return openDetail(t.dataset.id);
    case 'sell':   return openSell(t.dataset.id);
    case 'buy':    return buyListing(t.dataset.lid);
    case 'delist': return delist(t.dataset.lid);
    case 'closeDetail': return $('#detailScrim').classList.remove('open');
  }
});

$('#sortSel').addEventListener('change', renderCollection);
window.addEventListener('resize', positionPill);

/* ---------- boot ---------- */

seedMarket();
renderOdds();
renderAll();
positionPill();
