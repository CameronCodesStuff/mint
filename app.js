/* ============================================================
   MINT v3 — pastel kawaii edition. Vanilla JS, no deps.
   New in v3: kawaii procedural critters (bunny/cat/bee/bear/
   dragon/owl/fox/duck/monster), trading-card layout with
   ornate frames + epithets, hero banner, featured row, and
   market search/filters. Payments/economy unchanged from v2.
   ============================================================ */

'use strict';

/* ---------- config ---------- */

const RARITIES = {
  common:    { label: 'Common',    color: 'var(--r-common)',    value: 1.2,  mult: 1.0 },
  rare:      { label: 'Rare',      color: 'var(--r-rare)',      value: 4,    mult: 1.25 },
  epic:      { label: 'Epic',      color: 'var(--r-epic)',      value: 12,   mult: 1.6 },
  legendary: { label: 'Legendary', color: 'var(--r-legendary)', value: 45,   mult: 2.1 },
  mythic:    { label: 'Mythic',    color: 'var(--r-mythic)',    value: 180,  mult: 3.0 },
};

const PACKS = {
  standard: { name: 'Standard Pack', price: 4.99, cards: 3,
              odds: { common: 62, rare: 26, epic: 9, legendary: 2.5, mythic: 0.5 } },
  premium:  { name: 'Premium Pack',  price: 9.99, cards: 5,
              odds: { common: 42, rare: 32, epic: 16, legendary: 7.5, mythic: 2.5 } },
};

const SPECIES = [
  { id: 'bunny',   label: 'Bunny',   hue: 338, names: ['Pippa','Clover','Mochi','Thistle','Poppy','Nimble'] },
  { id: 'cat',     label: 'Cat',     hue: 252, names: ['Cosmo','Miso','Willow','Pudding','Sable','Biscuit'] },
  { id: 'bee',     label: 'Bee',     hue: 46,  names: ['Bea','Bumble','Honey','Zuzu','Amber','Pip'] },
  { id: 'bear',    label: 'Bear',    hue: 26,  names: ['Barnaby','Maple','Bruno','Cocoa','Humphrey','Tedwin'] },
  { id: 'dragon',  label: 'Dragon',  hue: 268, names: ['Stella','Ember','Onyx','Wyn','Sorrel','Nimbus'] },
  { id: 'owl',     label: 'Owl',     hue: 210, names: ['Oliver','Athena','Barley','Echo','Sage','Merlin'] },
  { id: 'fox',     label: 'Fox',     hue: 22,  names: ['Luno','Rusty','Fennel','Vixen','Cinnamon','Reva'] },
  { id: 'duck',    label: 'Duck',    hue: 190, names: ['Dodo','Puddle','Quincy','Marina','Bobber','Splash'] },
  { id: 'monster', label: 'Monster', hue: 145, names: ['Milo','Grub','Wiggles','Fern','Boop','Ziggy'] },
];

const EPITHETS = {
  adj:   ['Gentle','Sleepy','Brave','Dreamy','Sparkly','Curious','Cozy','Merry','Playful','Quiet'],
  role:  ['Blossom Hopper','Stargazer','Honey Gatherer','Dream Weaver','Cloud Watcher','Moon Guardian','Meadow Pixie','Wave Rider','Keeper of Secrets','Little Wanderer'],
  place: ['the Meadow','the Nebula Woods','the Lavender Fields','the Whispering Pines','the Starry Void','the Sugar Coast','the Moonlit Library','the Misty Reef','the Clover Hills','the Twilight Grove'],
};

const BURST_COLORS = ['#7cb8f7', '#b48be8', '#f2799f', '#e5b345', '#8fd7b0', '#fcd9c4'];
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
const sPick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

/* ---------- storage (swap for Firestore later) ---------- */

const Store = {
  KEY: 'mint_v3',
  mem: null,
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch { return this.mem; } },
  save(s) { this.mem = s; try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch {} },
};

let S = Store.load() || {
  balance: 0,
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
  const seed = rand(1, 2 ** 31);
  const rng = seededRng(seed ^ 0x9e37);
  return {
    id: uid(),
    species: sp.id,
    name: sPick(rng, sp.names),
    epithet: `The ${sPick(rng, EPITHETS.adj)} ${sPick(rng, EPITHETS.role)} of ${sPick(rng, EPITHETS.place)}`,
    rarity,
    serial: Math.min(S.mints[sp.id], MAX_SUPPLY),
    seed,
    stats,
    mintedAt: Date.now(),
  };
}

/* ---------- kawaii procedural SVG art ---------- */

function svgFor(c, size = '') {
  const sp = SPECIES.find(s => s.id === c.species);
  const rng = seededRng(c.seed);
  const hue = (sp.hue + Math.floor(rng() * 18) - 9 + 360) % 360;
  const fill = `hsl(${hue} 68% 84%)`;
  const line = `hsl(${hue} 42% 60%)`;
  const dark = `hsl(${hue} 45% 48%)`;
  const inner = `hsl(${hue} 80% 92%)`;
  const cx = 60, cy = 66, r = 30;
  const st = `stroke="${line}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"`;

  let ears = '', face = '', extras = '';

  switch (sp.id) {
    case 'bunny':
      ears = `<ellipse cx="${cx - 13}" cy="${cy - r - 12}" rx="8" ry="20" fill="${fill}" ${st} transform="rotate(-10 ${cx - 13} ${cy - r - 12})"/>
              <ellipse cx="${cx + 13}" cy="${cy - r - 12}" rx="8" ry="20" fill="${fill}" ${st} transform="rotate(10 ${cx + 13} ${cy - r - 12})"/>
              <ellipse cx="${cx - 13}" cy="${cy - r - 10}" rx="4" ry="13" fill="${inner}" transform="rotate(-10 ${cx - 13} ${cy - r - 10})"/>
              <ellipse cx="${cx + 13}" cy="${cy - r - 10}" rx="4" ry="13" fill="${inner}" transform="rotate(10 ${cx + 13} ${cy - r - 10})"/>`;
      break;
    case 'cat':
      ears = `<path d="M${cx - 26},${cy - r + 8} L${cx - 22},${cy - r - 16} L${cx - 8},${cy - r + 2} Z" fill="${fill}" ${st}/>
              <path d="M${cx + 26},${cy - r + 8} L${cx + 22},${cy - r - 16} L${cx + 8},${cy - r + 2} Z" fill="${fill}" ${st}/>
              <path d="M${cx - 22},${cy - r + 5} L${cx - 20},${cy - r - 8} L${cx - 12},${cy - r + 2} Z" fill="${inner}"/>
              <path d="M${cx + 22},${cy - r + 5} L${cx + 20},${cy - r - 8} L${cx + 12},${cy - r + 2} Z" fill="${inner}"/>`;
      face = `<line x1="${cx - 34}" y1="${cy + 4}" x2="${cx - 44}" y2="${cy + 2}" ${st}/>
              <line x1="${cx - 34}" y1="${cy + 10}" x2="${cx - 44}" y2="${cy + 12}" ${st}/>
              <line x1="${cx + 34}" y1="${cy + 4}" x2="${cx + 44}" y2="${cy + 2}" ${st}/>
              <line x1="${cx + 34}" y1="${cy + 10}" x2="${cx + 44}" y2="${cy + 12}" ${st}/>`;
      break;
    case 'bear':
      ears = `<circle cx="${cx - 20}" cy="${cy - r + 2}" r="10" fill="${fill}" ${st}/>
              <circle cx="${cx + 20}" cy="${cy - r + 2}" r="10" fill="${fill}" ${st}/>
              <circle cx="${cx - 20}" cy="${cy - r + 2}" r="5" fill="${inner}"/>
              <circle cx="${cx + 20}" cy="${cy - r + 2}" r="5" fill="${inner}"/>`;
      face = `<ellipse cx="${cx}" cy="${cy + 12}" rx="10" ry="7" fill="${inner}"/>
              <ellipse cx="${cx}" cy="${cy + 9}" rx="3.4" ry="2.6" fill="${dark}"/>`;
      break;
    case 'fox':
      ears = `<path d="M${cx - 28},${cy - r + 10} L${cx - 24},${cy - r - 18} L${cx - 6},${cy - r + 2} Z" fill="${fill}" ${st}/>
              <path d="M${cx + 28},${cy - r + 10} L${cx + 24},${cy - r - 18} L${cx + 6},${cy - r + 2} Z" fill="${fill}" ${st}/>`;
      face = `<path d="M${cx - 22},${cy + 8} Q${cx},${cy + 30} ${cx + 22},${cy + 8} Q${cx},${cy + 20} ${cx - 22},${cy + 8} Z" fill="#fff8f0" opacity=".9"/>
              <ellipse cx="${cx}" cy="${cy + 12}" rx="3.2" ry="2.6" fill="${dark}"/>`;
      break;
    case 'owl':
      ears = `<path d="M${cx - 24},${cy - r + 6} L${cx - 18},${cy - r - 12} L${cx - 8},${cy - r + 1} Z" fill="${fill}" ${st}/>
              <path d="M${cx + 24},${cy - r + 6} L${cx + 18},${cy - r - 12} L${cx + 8},${cy - r + 1} Z" fill="${fill}" ${st}/>`;
      face = `<circle cx="${cx - 11}" cy="${cy - 2}" r="11" fill="#fff" opacity=".92"/>
              <circle cx="${cx + 11}" cy="${cy - 2}" r="11" fill="#fff" opacity=".92"/>
              <path d="M${cx - 4},${cy + 8} L${cx + 4},${cy + 8} L${cx},${cy + 15} Z" fill="${dark}"/>`;
      break;
    case 'bee':
      ears = `<line x1="${cx - 9}" y1="${cy - r}" x2="${cx - 15}" y2="${cy - r - 15}" ${st}/>
              <line x1="${cx + 9}" y1="${cy - r}" x2="${cx + 15}" y2="${cy - r - 15}" ${st}/>
              <circle cx="${cx - 15}" cy="${cy - r - 17}" r="4" fill="${dark}"/>
              <circle cx="${cx + 15}" cy="${cy - r - 17}" r="4" fill="${dark}"/>`;
      extras = `<ellipse cx="${cx - 36}" cy="${cy - 6}" rx="10" ry="15" fill="#fff" opacity=".7" transform="rotate(-24 ${cx - 36} ${cy - 6})"/>
                <ellipse cx="${cx + 36}" cy="${cy - 6}" rx="10" ry="15" fill="#fff" opacity=".7" transform="rotate(24 ${cx + 36} ${cy - 6})"/>
                <path d="M${cx - 28},${cy + 14} Q${cx},${cy + 26} ${cx + 28},${cy + 14}" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
      break;
    case 'dragon':
      ears = `<path d="M${cx - 16},${cy - r + 2} L${cx - 20},${cy - r - 14} L${cx - 6},${cy - r - 2} Z" fill="${inner}" ${st}/>
              <path d="M${cx + 16},${cy - r + 2} L${cx + 20},${cy - r - 14} L${cx + 6},${cy - r - 2} Z" fill="${inner}" ${st}/>
              <path d="M${cx - 4},${cy - r - 2} L${cx},${cy - r - 12} L${cx + 4},${cy - r - 2} Z" fill="${inner}" ${st}/>`;
      face = `<circle cx="${cx - 24}" cy="${cy + 10}" r="3" fill="${inner}" stroke="${line}" stroke-width="1.5"/>
              <circle cx="${cx + 24}" cy="${cy + 10}" r="3" fill="${inner}" stroke="${line}" stroke-width="1.5"/>`;
      break;
    case 'duck':
      ears = `<path d="M${cx - 2},${cy - r - 2} Q${cx + 2},${cy - r - 14} ${cx + 10},${cy - r - 8}" fill="none" ${st}/>`;
      face = `<ellipse cx="${cx}" cy="${cy + 10}" rx="11" ry="6.5" fill="#f5b355" stroke="#d9953a" stroke-width="2"/>`;
      break;
    case 'monster':
      ears = `<circle cx="${cx - 16}" cy="${cy - r + 1}" r="7" fill="${fill}" ${st}/>
              <circle cx="${cx}" cy="${cy - r - 4}" r="7" fill="${fill}" ${st}/>
              <circle cx="${cx + 16}" cy="${cy - r + 1}" r="7" fill="${fill}" ${st}/>`;
      face = `<path d="M${cx - 3},${cy + 13} L${cx + 3},${cy + 13} L${cx},${cy + 18} Z" fill="#fff" stroke="${line}" stroke-width="1.5"/>`;
      break;
  }

  // eyes + blush + smile (duck/bear/fox/owl draw their own nose/beak)
  const eyeY = cy - 2;
  const sparkleEyes = `
    <circle cx="${cx - 11}" cy="${eyeY}" r="4.6" fill="#3d3a43"/>
    <circle cx="${cx + 11}" cy="${eyeY}" r="4.6" fill="#3d3a43"/>
    <circle cx="${cx - 9.6}" cy="${eyeY - 1.6}" r="1.7" fill="#fff"/>
    <circle cx="${cx + 12.4}" cy="${eyeY - 1.6}" r="1.7" fill="#fff"/>
    <circle cx="${cx - 12.2}" cy="${eyeY + 1.8}" r=".9" fill="#fff"/>
    <circle cx="${cx + 9.8}" cy="${eyeY + 1.8}" r=".9" fill="#fff"/>`;
  const blush = `
    <ellipse cx="${cx - 20}" cy="${cy + 7}" rx="5.5" ry="3.4" fill="#f7a8bc" opacity=".55"/>
    <ellipse cx="${cx + 20}" cy="${cy + 7}" rx="5.5" ry="3.4" fill="#f7a8bc" opacity=".55"/>`;
  const smile = ['duck', 'owl', 'monster'].includes(sp.id) ? '' :
    `<path d="M${cx - 5},${cy + 9} Q${cx},${cy + 13} ${cx + 5},${cy + 9}" fill="none" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`;

  // seeded accessory
  const acc = Math.floor(rng() * 4);
  let accessory = '';
  if (acc === 1) accessory = `<circle cx="${cx + 24}" cy="${cy - r + 6}" r="4.5" fill="#f7a8bc"/><circle cx="${cx + 24}" cy="${cy - r + 6}" r="1.8" fill="#fbe9b7"/>`;
  if (acc === 2) accessory = `<path d="M${cx - 27},${cy - r + 4} l2.2,4.6 5,.6 -3.7,3.4 1,4.9 -4.5,-2.5 -4.5,2.5 1,-4.9 -3.7,-3.4 5,-.6 Z" fill="#fbe9b7" stroke="#e5b345" stroke-width="1"/>`;
  if (acc === 3) accessory = `<path d="M${cx - 6},${cy - r - 3} q-6,-6 -10,0 q4,6 10,0 Z M${cx - 6},${cy - r - 3} q6,-6 10,0 q-4,6 -10,0 Z" fill="#f7a8bc" stroke="#e786a3" stroke-width="1.2"/><circle cx="${cx - 6}" cy="${cy - r - 3}" r="2" fill="#fff"/>`;

  // rarity flourishes
  let flair = '';
  if (['epic', 'legendary', 'mythic'].includes(c.rarity)) {
    flair += `<text x="18" y="30" font-size="11" opacity=".8">✦</text><text x="92" y="26" font-size="9" opacity=".7">✦</text><text x="98" y="96" font-size="10" opacity=".7">✦</text>`;
  }
  if (['legendary', 'mythic'].includes(c.rarity)) {
    const ring = c.rarity === 'mythic' ? 'url(#rainbow)' : '#e5b345';
    flair += `<circle cx="${cx}" cy="${cy}" r="46" fill="none" stroke="${ring}" stroke-width="1.6" stroke-dasharray="5 6" opacity=".8">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="12s" repeatCount="indefinite"/>
    </circle>`;
  }

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="art ${size}" role="img" aria-label="${c.name} the ${sp.label}">
    <defs><linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7cb8f7"/><stop offset=".33" stop-color="#b48be8"/><stop offset=".66" stop-color="#f2799f"/><stop offset="1" stop-color="#e5b345"/>
    </linearGradient></defs>
    ${flair}${ears}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${st}/>
    ${extras}${face}${sparkleEyes}${blush}${smile}${accessory}
  </svg>`;
}

/* card frame colors derived from species hue */
function cardVars(c) {
  const sp = SPECIES.find(s => s.id === c.species);
  return `--rc:${RARITIES[c.rarity].color};--pastel:hsl(${sp.hue} 72% 93%);--frame:hsl(${sp.hue} 46% 72%)`;
}

/* ---------- payment sheet (balance-aware) ---------- */
/* Real integration: swap charge() for a POST to your Cloudflare
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
  const cls = [
    'mon-card',
    c.rarity === 'legendary' ? 'frame-legendary' : '',
    c.rarity === 'mythic' ? 'frame-mythic mythic-sheen' : '',
  ].join(' ');
  return `<article class="${cls}" style="${cardVars(c)}" data-tilt data-id="${c.id}">
    <div class="card-face">
      <div class="card-mint">MINT</div>
      <div class="card-vignette">${svgFor(c)}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-epithet">${c.epithet}</div>
      <div class="card-foot">
        <span>No. ${String(c.serial).padStart(3, '0')} / ${MAX_SUPPLY}</span>
        <span class="rpill" style="--rc:${r.color}">${r.label}</span>
      </div>
      <div class="holo"></div>
    </div>
    <div class="actions">${actions}</div>
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

function marketFilters(l) {
  const q = ($('#marketSearch').value || '').trim().toLowerCase();
  const spF = $('#speciesFilter').value;
  if (spF && l.creature.species !== spF) return false;
  if (q) {
    const sp = SPECIES.find(s => s.id === l.creature.species);
    const hay = `${l.creature.name} ${l.creature.epithet} ${sp.label} ${l.creature.rarity}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function renderMarket() {
  const visible = S.market.filter(marketFilters);
  $('#marketGrid').innerHTML = visible.map(l => monCardHTML(l.creature, l.seller === 'you'
    ? `<button class="btn btn-quiet" data-act="delist" data-lid="${l.id}">Delist · ${money(l.price)}</button>`
    : `<button class="btn btn-dark" data-act="buy" data-lid="${l.id}"><span class="pay-mark"></span>&nbsp;${money(l.price)}</button>`
  )).join('');
  const others = S.market.filter(l => l.seller !== 'you');
  const floor = others.length ? Math.min(...others.map(l => l.price)) : 0;
  $('#marketStats').textContent = `${visible.length} of ${S.market.length} listings · floor ${money(floor)}`;
}

function renderFeatured() {
  const featured = S.market.filter(l => l.seller !== 'you').slice(0, 5);
  $('#featuredGrid').innerHTML = featured.map(l => monCardHTML(l.creature, `
    <button class="btn btn-quiet" data-act="view" data-id="${l.creature.id}">View</button>
    <button class="btn btn-dark" data-act="buy" data-lid="${l.id}">${money(l.price)}</button>
  `)).join('');
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

function renderHero() {
  const sample = ids => ids.map((id, i) => {
    const sp = SPECIES.find(s => s.id === id);
    return svgFor({ species: id, seed: 1000 + i * 7, rarity: 'common', name: sp.label });
  }).join('');
  $('#heroLeft').innerHTML = sample(['bunny', 'cat', 'bee', 'monster']);
  $('#heroRight').innerHTML = sample(['bear', 'dragon', 'fox', 'owl']);
}

function renderAll() {
  renderWallet(); renderCollection(); renderMarket(); renderFeatured(); renderActivity();
  persist();
}

/* ---------- tilt / holo ---------- */

document.addEventListener('pointermove', e => {
  const card = e.target.closest('[data-tilt]');
  if (!card) return;
  const b = card.getBoundingClientRect();
  const px = (e.clientX - b.left) / b.width;
  const py = (e.clientY - b.top) / b.height;
  card.style.setProperty('--rx', ((px - 0.5) * 9).toFixed(2) + 'deg');
  card.style.setProperty('--ry', ((0.5 - py) * 9).toFixed(2) + 'deg');
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

/* ---------- pack opening ---------- */

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
    return `<div class="reveal-card${epicplus}" data-i="${i}" style="${cardVars(c)};--d:${(i * 0.09).toFixed(2)}s">
      <div class="reveal-inner">
        <div class="reveal-face reveal-back"><div class="gem"></div></div>
        <div class="reveal-face reveal-front">
          <div class="card-mint">MINT</div>
          <div class="card-vignette">${svgFor(c)}</div>
          <div class="card-name">${c.name}</div>
          <div class="card-epithet">${c.epithet}</div>
          <span class="rname">${r.label} · No. ${c.serial}</span>
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
  if (['legendary', 'mythic'].includes(c.rarity)) card.insertAdjacentHTML('beforeend', confettiHTML());
}

$('#revealAll').addEventListener('click', () => {
  $$('.reveal-card:not(.flipped)').forEach((card, i) => setTimeout(() => flipCard(card), i * 220));
});

$('#revealDone').addEventListener('click', () => {
  if (!pendingPack) return;
  S.collection.push(...pendingPack);
  const best = pendingPack.reduce((a, b) => RARITIES[b.rarity].value > RARITIES[a.rarity].value ? b : a);
  toast(`${pendingPack.length} critters minted — best pull: ${best.name} (${RARITIES[best.rarity].label})`);
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
    <div class="mini-vignette" style="${cardVars(c)}">${svgFor(c)}</div>
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
  const card = $('#detailCard');
  card.style.cssText = cardVars(c);
  card.innerHTML = `
    <button class="close-x" data-act="closeDetail" aria-label="Close">✕</button>
    <div class="card-mint">MINT</div>
    <div class="card-vignette">${svgFor(c)}</div>
    <h3>${c.name}</h3>
    <div class="card-epithet">${c.epithet}</div>
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

function switchTab(name) {
  $$('.nav-link').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  window.scrollTo({ top: 0 });
}

document.addEventListener('click', e => {
  const closer = e.target.closest('[data-close]');
  if (closer) return $('#' + closer.dataset.close).classList.remove('open');
  const t = e.target.closest('[data-act],[data-tab],[data-pack],[data-scroll]');
  if (!t) {
    if (e.target.id === 'detailScrim') $('#detailScrim').classList.remove('open');
    return;
  }
  if (t.dataset.tab) return switchTab(t.dataset.tab);
  if (t.dataset.scroll) return document.getElementById(t.dataset.scroll)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
$('#marketSearch').addEventListener('input', renderMarket);
$('#speciesFilter').addEventListener('change', renderMarket);

/* ---------- boot ---------- */

$('#speciesFilter').insertAdjacentHTML('beforeend',
  SPECIES.map(sp => `<option value="${sp.id}">${sp.label}</option>`).join(''));
seedMarket();
renderOdds();
renderHero();
renderAll();
