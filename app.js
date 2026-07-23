import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection as fsCollection,
  query, where, orderBy, limit, onSnapshot, runTransaction, getDocs, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getDatabase, ref as rtdbRef, set as rtdbSet, get as rtdbGet } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDiQG0C67cNYawqao2nAHYuTFkXmPnA_Fs",
  authDomain: "mint-2f84d.firebaseapp.com",
  databaseURL: "https://mint-2f84d-default-rtdb.firebaseio.com",
  projectId: "mint-2f84d",
  storageBucket: "mint-2f84d.firebasestorage.app",
  messagingSenderId: "972508330792",
  appId: "1:972508330792:web:618f87301da07406b86e1d",
  measurementId: "G-9TF6899XH1"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const rtdb = getDatabase(fbApp);
let FBUser = null;                 // firebase auth user
let Me = null;                     // { uid, username }
const Avatars = {};                // uid -> dataURL cache

/* ============================================================
   MINT v5 — vanilla JS, no deps.
   New in v5:
   • Brutal rarity: nerfed odds + per-rarity supply caps
     (mythic = 12 per species, ever). Sold-out tiers fall back.
   • Live economy: per-rarity indexes + per-species demand mods
     move every 8s from random walk + real demand events (buys
     push up, mints push down). Bot listings reprice live; your
     listings sell probabilistically vs live fair value.
   • Trend UI: MINT Index + sparkline + per-rarity trend chips,
     ▲/▼ deltas on listing prices.
   • Richer kawaii art: gradient shading, per-species backdrop
     motifs (wreath/honeycomb/moon/waves/clock…), paws.
   ============================================================ */

'use strict';

/* ---------- config ---------- */

const RARITIES = {
  common:    { label: 'Common',    color: 'var(--r-common)',    value: 1.2,   mult: 1.0 },
  rare:      { label: 'Rare',      color: 'var(--r-rare)',      value: 6,     mult: 1.25 },
  epic:      { label: 'Epic',      color: 'var(--r-epic)',      value: 24,    mult: 1.6 },
  legendary: { label: 'Legendary', color: 'var(--r-legendary)', value: 120,   mult: 2.1 },
  mythic:    { label: 'Mythic',    color: 'var(--r-mythic)',    value: 650,   mult: 3.0 },
  celestial: { label: 'Celestial', color: 'var(--r-celestial)', value: 5000,  mult: 4.0 },
  eternal:   { label: 'Eternal',   color: 'var(--r-eternal)',   value: 30000, mult: 5.0 },
};

/* per-species supply caps per rarity — scarcity is the product */
const SUPPLY = { common: 500, rare: 200, epic: 75, legendary: 25, mythic: 12, celestial: 3, eternal: 1 };

const PACKS = {
  standard: { name: 'Standard Pack', price: 4.99, cards: 3,
              odds: { common: 86, rare: 11.489, epic: 2, legendary: 0.4, mythic: 0.1, celestial: 0.01, eternal: 0.001 } },
  premium:  { name: 'Premium Pack',  price: 9.99, cards: 5,
              odds: { common: 70, rare: 21.456, epic: 6.5, legendary: 1.6, mythic: 0.4, celestial: 0.04, eternal: 0.004 } },
  ultra:    { name: 'Ultra Pack',    price: 49.99, cards: 12,
              odds: { common: 52, rare: 28, epic: 14, legendary: 4.2, mythic: 1.4, celestial: 0.35, eternal: 0.05 } },
  mega:     { name: 'Mega Pack',     price: 99.99, cards: 25,
              odds: { common: 38, rare: 30, epic: 20, legendary: 8, mythic: 3, celestial: 0.85, eternal: 0.15 } },
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
const STATS = ['power', 'speed', 'defense', 'luck'];
const TICK_MS = 8000;

/* ---------- utils ---------- */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const money = n => '$' + n.toFixed(2);
const round2 = n => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

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

/* ---------- storage ---------- */

const Store = {
  KEY: 'mint_v8_anon',
  mem: null,
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || null; } catch { return this.mem; } },
  save(s) { this.mem = s; try { localStorage.setItem(this.KEY, JSON.stringify(s)); } catch {} },
};

let S = Store.load() || {
  balance: 0,
  mints: {},           // `${species}:${rarity}` -> count
  collection: [],
  market: [],          // bot listings carry markup + lastPrice; yours carry fixed price
  activity: [],
  economy: null,
};
if (!S.economy) {
  S.economy = {
    r: {}, sp: Object.fromEntries(SPECIES.map(s => [s.id, 1])),
    drift: {}, spDrift: Object.fromEntries(SPECIES.map(s => [s.id, 0])),
    hist: [100],
  };
}
// migration: ensure every rarity tier has index + drift entries
for (const k of Object.keys(RARITIES)) {
  if (S.economy.r[k] == null) S.economy.r[k] = 1;
  if (S.economy.drift[k] == null) S.economy.drift[k] = 0;
}
let cloudTimer = null, applyingRemote = false;
function scheduleCloudSave() {
  if (!FBUser || applyingRemote) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    try {
      const portfolio = round2(S.collection.reduce((sum, c) => sum + fairValue(c), 0));
      await setDoc(doc(db, 'users', FBUser.uid), {
        username: Me?.username || 'collector',
        usernameLower: (Me?.username || 'collector').toLowerCase(),
        balance: S.balance,
        collection: S.collection,
        accountValue: round2(S.balance + portfolio),
        updatedAt: Date.now(),
      }, { merge: true });
    } catch (e) { console.warn('cloud save failed', e); }
  }, 900);
}
const persist = () => { Store.save(S); scheduleCloudSave(); };

/* ---------- economy ---------- */

function mintedCount(speciesId, rarity) { return S.mints[`${speciesId}:${rarity}`] || 0; }

function scarcityFactor(c) {
  const minted = mintedCount(c.species, c.rarity);
  const cap = SUPPLY[c.rarity];
  return 1 + Math.pow(minted / cap, 2) * 1.5; // near-sellout tiers command a premium
}

function fairValue(c) {
  const e = S.economy;
  return round2(RARITIES[c.rarity].value * e.r[c.rarity] * e.sp[c.species] * scarcityFactor(c));
}

function bumpDemand(c, amt) {
  S.economy.drift[c.rarity] = clamp(S.economy.drift[c.rarity] + amt, -0.06, 0.09);
  S.economy.spDrift[c.species] = clamp(S.economy.spDrift[c.species] + amt * 1.3, -0.08, 0.12);
}

function compositeIndex() {
  const e = S.economy;
  const vals = Object.keys(RARITIES).map(k => e.r[k]);
  return 100 * vals.reduce((a, b) => a + b, 0) / vals.length;
}

function economyTick() {
  if (!FBUser) return;
  const e = S.economy;
  for (const k of Object.keys(RARITIES)) {
    e.r[k] = clamp(e.r[k] * (1 + (Math.random() - 0.5) * 0.022 + e.drift[k]), 0.55, 3.2);
    e.drift[k] *= 0.7;
  }
  for (const s of SPECIES) {
    e.sp[s.id] = clamp(e.sp[s.id] * (1 + (Math.random() - 0.5) * 0.014 + e.spDrift[s.id]), 0.7, 1.9);
    e.spDrift[s.id] *= 0.7;
  }
  e.hist.push(compositeIndex());
  if (e.hist.length > 48) e.hist.shift();

  // bot listings float with the market
  for (const l of S.market) {
    if (!l.bot) continue;
    l.lastPrice = l.price;
    l.price = round2(fairValue(l.creature) * l.markup);
  }

  // your live listings: probabilistic sales vs live fair value
  for (const l of [...S.market]) {
    if (!isMine(l)) continue;
    const ratio = l.price / fairValue(l.creature);
    const p = ratio <= 1 ? 0.5 : ratio <= 1.15 ? 0.3 : ratio <= 1.4 ? 0.12 : ratio <= 1.6 ? 0.05 : 0;
    if (Math.random() < p) botBuyMyListing(l);
  }

  renderMarket(); renderFeatured(); renderIndex(); renderWalletPage(); renderWallet();
  persist();
}
setInterval(economyTick, TICK_MS);

/* ---------- minting (supply-capped) ---------- */

function rollRarity(odds) {
  let roll = Math.random() * 100;
  for (const [rarity, weight] of Object.entries(odds)) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return 'common';
}

const RARITY_ORDER = ['eternal', 'celestial', 'mythic', 'legendary', 'epic', 'rare', 'common'];

function mintCreature(rarity) {
  // find a species with supply left at this tier; otherwise fall back down the tiers
  let tierIdx = RARITY_ORDER.indexOf(rarity);
  let sp = null;
  while (tierIdx < RARITY_ORDER.length) {
    const tier = RARITY_ORDER[tierIdx];
    const open = SPECIES.filter(s => mintedCount(s.id, tier) < SUPPLY[tier]);
    if (open.length) { rarity = tier; sp = pick(open); break; }
    tierIdx++;
  }
  if (!sp) { rarity = 'common'; sp = pick(SPECIES); } // unreachable in practice

  const key = `${sp.id}:${rarity}`;
  S.mints[key] = (S.mints[key] || 0) + 1;
  const mult = RARITIES[rarity].mult;
  const stats = {};
  for (const st of STATS) stats[st] = Math.min(100, Math.round(rand(20, 60) * mult));
  const seed = rand(1, 2 ** 31);
  const rng = seededRng(seed ^ 0x9e37);
  bumpDemand({ rarity, species: sp.id }, -0.004); // new supply softens price a touch
  return {
    id: uid(),
    species: sp.id,
    name: sPick(rng, sp.names),
    epithet: `The ${sPick(rng, EPITHETS.adj)} ${sPick(rng, EPITHETS.role)} of ${sPick(rng, EPITHETS.place)}`,
    rarity,
    serial: S.mints[key],
    seed,
    stats,
    mintedAt: Date.now(),
  };
}

/* ---------- kawaii procedural SVG art (v2 of the generator) ---------- */

function motifFor(spId, rng, line, hue) {
  const soft = `hsl(${hue} 60% 78%)`;
  switch (spId) {
    case 'bunny': { // floral wreath
      let f = '';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        const x = 60 + Math.cos(a) * 45, y = 64 + Math.sin(a) * 45;
        const col = i % 2 ? '#f7a8bc' : '#fbe9b7';
        f += `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})" opacity=".85">
          <circle r="3.4" fill="${col}"/><circle r="1.4" fill="#fff"/>
          <circle cx="4.5" r="2" fill="#c9ecd9"/></g>`;
      }
      return f;
    }
    case 'bee': { // honeycomb corners
      const hex = (x, y, s, o) => `<path d="M${x},${y - s} l${s * .87},${s * .5} v${s} l-${s * .87},${s * .5} l-${s * .87},-${s * .5} v-${s} Z" fill="none" stroke="#e5b345" stroke-width="1.6" opacity="${o}"/>`;
      return hex(24, 26, 9, .8) + hex(40, 20, 7, .55) + hex(96, 96, 9, .8) + hex(82, 102, 7, .55);
    }
    case 'bear': // crescent moon + stars
      return `<path d="M88 22 a13 13 0 1 0 8 22 a10.5 10.5 0 1 1 -8 -22 Z" fill="#fbe9b7" stroke="#e5b345" stroke-width="1.4" opacity=".9"/>
              <text x="22" y="32" font-size="10" fill="#e5b345" opacity=".85">✦</text>
              <text x="30" y="98" font-size="8" fill="#e5b345" opacity=".7">✦</text>`;
    case 'duck': // waves
      return `<path d="M8 100 q10 -8 20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="#7cc6e8" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>
              <path d="M14 110 q10 -7 20 0 t20 0 t20 0 t20 0" fill="none" stroke="#a5dcf0" stroke-width="2" opacity=".6" stroke-linecap="round"/>`;
    case 'owl': { // clock ring
      let ticks = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x1 = 60 + Math.cos(a) * 46, y1 = 64 + Math.sin(a) * 46;
        const x2 = 60 + Math.cos(a) * 50, y2 = 64 + Math.sin(a) * 50;
        ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c8a86a" stroke-width="${i % 3 ? 1.2 : 2.2}" opacity=".8"/>`;
      }
      return `<circle cx="60" cy="64" r="48" fill="none" stroke="#c8a86a" stroke-width="1.2" opacity=".55"/>` + ticks;
    }
    case 'dragon': // starfield swirl
      return `<text x="18" y="30" font-size="11" fill="#b48be8" opacity=".9">✦</text>
              <text x="94" y="24" font-size="8" fill="#7cb8f7" opacity=".8">✦</text>
              <text x="100" y="90" font-size="10" fill="#f2799f" opacity=".8">✦</text>
              <path d="M20 96 q8 -10 20 -6" fill="none" stroke="#b48be8" stroke-width="1.6" opacity=".5" stroke-linecap="round"/>`;
    case 'fox': // clouds
      return `<g fill="#fff" opacity=".85"><ellipse cx="26" cy="30" rx="11" ry="6"/><ellipse cx="35" cy="27" rx="8" ry="5"/></g>
              <g fill="#fff" opacity=".7"><ellipse cx="94" cy="98" rx="10" ry="5.5"/><ellipse cx="86" cy="95" rx="7" ry="4.5"/></g>`;
    case 'monster': { // leaf ring
      let l = '';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const x = 60 + Math.cos(a) * 46, y = 64 + Math.sin(a) * 46;
        l += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="4.5" ry="2.2" fill="#8fd7b0" opacity=".8" transform="rotate(${(a * 57 + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
      return l;
    }
    default: // cat — sparkles + tiny moon
      return `<text x="20" y="34" font-size="10" fill="${soft}" opacity=".9">✦</text>
              <text x="96" y="30" font-size="8" fill="${soft}" opacity=".8">✧</text>
              <text x="98" y="100" font-size="9" fill="${soft}" opacity=".8">✦</text>`;
  }
}

function svgFor(c) {
  const sp = SPECIES.find(s => s.id === c.species);
  const rng = seededRng(c.seed);
  const hue = (sp.hue + Math.floor(rng() * 18) - 9 + 360) % 360;
  const gid = 'g' + (c.seed % 100000);
  const fillTop = `hsl(${hue} 74% 88%)`;
  const fillBot = `hsl(${hue} 62% 78%)`;
  const line = `hsl(${hue} 42% 58%)`;
  const dark = `hsl(${hue} 45% 46%)`;
  const inner = `hsl(${hue} 82% 93%)`;
  const cx = 60, cy = 64, r = 29;
  const st = `stroke="${line}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
  const headFill = `url(#${gid})`;

  let ears = '', face = '', extras = '';

  switch (sp.id) {
    case 'bunny':
      ears = `<ellipse cx="${cx - 13}" cy="${cy - r - 12}" rx="8" ry="20" fill="${headFill}" ${st} transform="rotate(-10 ${cx - 13} ${cy - r - 12})"/>
              <ellipse cx="${cx + 13}" cy="${cy - r - 12}" rx="8" ry="20" fill="${headFill}" ${st} transform="rotate(10 ${cx + 13} ${cy - r - 12})"/>
              <ellipse cx="${cx - 13}" cy="${cy - r - 10}" rx="4" ry="13" fill="${inner}" transform="rotate(-10 ${cx - 13} ${cy - r - 10})"/>
              <ellipse cx="${cx + 13}" cy="${cy - r - 10}" rx="4" ry="13" fill="${inner}" transform="rotate(10 ${cx + 13} ${cy - r - 10})"/>`;
      break;
    case 'cat':
      ears = `<path d="M${cx - 26},${cy - r + 8} L${cx - 22},${cy - r - 16} L${cx - 8},${cy - r + 2} Z" fill="${headFill}" ${st}/>
              <path d="M${cx + 26},${cy - r + 8} L${cx + 22},${cy - r - 16} L${cx + 8},${cy - r + 2} Z" fill="${headFill}" ${st}/>
              <path d="M${cx - 22},${cy - r + 5} L${cx - 20},${cy - r - 8} L${cx - 12},${cy - r + 2} Z" fill="${inner}"/>
              <path d="M${cx + 22},${cy - r + 5} L${cx + 20},${cy - r - 8} L${cx + 12},${cy - r + 2} Z" fill="${inner}"/>`;
      face = `<line x1="${cx - 33}" y1="${cy + 4}" x2="${cx - 43}" y2="${cy + 2}" ${st}/>
              <line x1="${cx - 33}" y1="${cy + 10}" x2="${cx - 43}" y2="${cy + 12}" ${st}/>
              <line x1="${cx + 33}" y1="${cy + 4}" x2="${cx + 43}" y2="${cy + 2}" ${st}/>
              <line x1="${cx + 33}" y1="${cy + 10}" x2="${cx + 43}" y2="${cy + 12}" ${st}/>`;
      break;
    case 'bear':
      ears = `<circle cx="${cx - 20}" cy="${cy - r + 2}" r="10" fill="${headFill}" ${st}/>
              <circle cx="${cx + 20}" cy="${cy - r + 2}" r="10" fill="${headFill}" ${st}/>
              <circle cx="${cx - 20}" cy="${cy - r + 2}" r="5" fill="${inner}"/>
              <circle cx="${cx + 20}" cy="${cy - r + 2}" r="5" fill="${inner}"/>`;
      face = `<ellipse cx="${cx}" cy="${cy + 12}" rx="10" ry="7" fill="${inner}"/>
              <ellipse cx="${cx}" cy="${cy + 9}" rx="3.4" ry="2.6" fill="${dark}"/>`;
      break;
    case 'fox':
      ears = `<path d="M${cx - 28},${cy - r + 10} L${cx - 24},${cy - r - 18} L${cx - 6},${cy - r + 2} Z" fill="${headFill}" ${st}/>
              <path d="M${cx + 28},${cy - r + 10} L${cx + 24},${cy - r - 18} L${cx + 6},${cy - r + 2} Z" fill="${headFill}" ${st}/>
              <path d="M${cx - 25},${cy - r + 8} L${cx - 22.5},${cy - r - 11} L${cx - 12},${cy - r + 3} Z" fill="${inner}"/>
              <path d="M${cx + 25},${cy - r + 8} L${cx + 22.5},${cy - r - 11} L${cx + 12},${cy - r + 3} Z" fill="${inner}"/>`;
      face = `<path d="M${cx - 22},${cy + 8} Q${cx},${cy + 30} ${cx + 22},${cy + 8} Q${cx},${cy + 20} ${cx - 22},${cy + 8} Z" fill="#fff8f0" opacity=".9"/>
              <ellipse cx="${cx}" cy="${cy + 12}" rx="3.2" ry="2.6" fill="${dark}"/>`;
      break;
    case 'owl':
      ears = `<path d="M${cx - 24},${cy - r + 6} L${cx - 18},${cy - r - 12} L${cx - 8},${cy - r + 1} Z" fill="${headFill}" ${st}/>
              <path d="M${cx + 24},${cy - r + 6} L${cx + 18},${cy - r - 12} L${cx + 8},${cy - r + 1} Z" fill="${headFill}" ${st}/>`;
      face = `<circle cx="${cx - 11}" cy="${cy - 2}" r="11" fill="#fff" opacity=".93"/>
              <circle cx="${cx + 11}" cy="${cy - 2}" r="11" fill="#fff" opacity=".93"/>
              <path d="M${cx - 4},${cy + 8} L${cx + 4},${cy + 8} L${cx},${cy + 15} Z" fill="${dark}"/>`;
      break;
    case 'bee':
      ears = `<line x1="${cx - 9}" y1="${cy - r}" x2="${cx - 15}" y2="${cy - r - 15}" ${st}/>
              <line x1="${cx + 9}" y1="${cy - r}" x2="${cx + 15}" y2="${cy - r - 15}" ${st}/>
              <circle cx="${cx - 15}" cy="${cy - r - 17}" r="4" fill="${dark}"/>
              <circle cx="${cx + 15}" cy="${cy - r - 17}" r="4" fill="${dark}"/>`;
      extras = `<ellipse cx="${cx - 35}" cy="${cy - 6}" rx="10" ry="15" fill="#fff" opacity=".75" transform="rotate(-24 ${cx - 35} ${cy - 6})"/>
                <ellipse cx="${cx + 35}" cy="${cy - 6}" rx="10" ry="15" fill="#fff" opacity=".75" transform="rotate(24 ${cx + 35} ${cy - 6})"/>
                <path d="M${cx - 27},${cy + 15} Q${cx},${cy + 27} ${cx + 27},${cy + 15}" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round" opacity=".5"/>`;
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
      ears = `<circle cx="${cx - 16}" cy="${cy - r + 1}" r="7" fill="${headFill}" ${st}/>
              <circle cx="${cx}" cy="${cy - r - 4}" r="7" fill="${headFill}" ${st}/>
              <circle cx="${cx + 16}" cy="${cy - r + 1}" r="7" fill="${headFill}" ${st}/>`;
      face = `<path d="M${cx - 3},${cy + 13} L${cx + 3},${cy + 13} L${cx},${cy + 18} Z" fill="#fff" stroke="${line}" stroke-width="1.5"/>`;
      break;
  }

  // tiny paws peeking under the chin (bust look, like the reference cards)
  const paws = ['bee', 'duck', 'dragon'].includes(sp.id) ? '' :
    `<circle cx="${cx - 12}" cy="${cy + r - 2}" r="5.5" fill="${headFill}" ${st}/>
     <circle cx="${cx + 12}" cy="${cy + r - 2}" r="5.5" fill="${headFill}" ${st}/>`;

  const eyeY = cy - 2;
  const eyes = `
    <circle cx="${cx - 11}" cy="${eyeY}" r="4.6" fill="#3d3a43"/>
    <circle cx="${cx + 11}" cy="${eyeY}" r="4.6" fill="#3d3a43"/>
    <circle cx="${cx - 9.6}" cy="${eyeY - 1.6}" r="1.7" fill="#fff"/>
    <circle cx="${cx + 12.4}" cy="${eyeY - 1.6}" r="1.7" fill="#fff"/>
    <circle cx="${cx - 12.2}" cy="${eyeY + 1.8}" r=".9" fill="#fff"/>
    <circle cx="${cx + 9.8}" cy="${eyeY + 1.8}" r=".9" fill="#fff"/>`;
  const blush = `
    <ellipse cx="${cx - 20}" cy="${cy + 7}" rx="5.5" ry="3.4" fill="#f7a8bc" opacity=".55"/>
    <ellipse cx="${cx + 20}" cy="${cy + 7}" rx="5.5" ry="3.4" fill="#f7a8bc" opacity=".55"/>`;
  const smile = ['duck', 'owl', 'monster', 'bear', 'fox'].includes(sp.id) ? '' :
    `<path d="M${cx - 5},${cy + 9} Q${cx},${cy + 13} ${cx + 5},${cy + 9}" fill="none" stroke="${dark}" stroke-width="2" stroke-linecap="round"/>`;

  const acc = Math.floor(rng() * 4);
  let accessory = '';
  if (acc === 1) accessory = `<circle cx="${cx + 24}" cy="${cy - r + 6}" r="4.5" fill="#f7a8bc"/><circle cx="${cx + 24}" cy="${cy - r + 6}" r="1.8" fill="#fbe9b7"/>`;
  if (acc === 2) accessory = `<path d="M${cx - 27},${cy - r + 4} l2.2,4.6 5,.6 -3.7,3.4 1,4.9 -4.5,-2.5 -4.5,2.5 1,-4.9 -3.7,-3.4 5,-.6 Z" fill="#fbe9b7" stroke="#e5b345" stroke-width="1"/>`;
  if (acc === 3) accessory = `<path d="M${cx - 6},${cy - r - 3} q-6,-6 -10,0 q4,6 10,0 Z M${cx - 6},${cy - r - 3} q6,-6 10,0 q-4,6 -10,0 Z" fill="#f7a8bc" stroke="#e786a3" stroke-width="1.2"/><circle cx="${cx - 6}" cy="${cy - r - 3}" r="2" fill="#fff"/>`;

  let flair = '';
  if (['legendary', 'mythic', 'celestial', 'eternal'].includes(c.rarity)) {
    const ring = c.rarity === 'legendary' ? '#e5b345' : c.rarity === 'mythic' ? 'url(#rainbow)' :
                 c.rarity === 'celestial' ? '#5ce1e6' : '#f4d58d';
    flair = `<circle cx="${cx}" cy="${cy}" r="52" fill="none" stroke="${ring}" stroke-width="1.8" stroke-dasharray="5 6" opacity=".85">
      <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="12s" repeatCount="indefinite"/>
    </circle>`;
  }

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" class="art" role="img" aria-label="${c.name} the ${sp.label}">
    <defs>
      <radialGradient id="${gid}" cx=".5" cy=".38" r=".75">
        <stop offset="0" stop-color="${fillTop}"/><stop offset="1" stop-color="${fillBot}"/>
      </radialGradient>
      <linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7cb8f7"/><stop offset=".33" stop-color="#b48be8"/><stop offset=".66" stop-color="#f2799f"/><stop offset="1" stop-color="#e5b345"/>
      </linearGradient>
    </defs>
    ${motifFor(sp.id, rng, line, hue)}${flair}${ears}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${headFill}" ${st}/>
    ${paws}${extras}${face}${eyes}${blush}${smile}${accessory}
  </svg>`;
}

function cardVars(c) {
  const sp = SPECIES.find(s => s.id === c.species);
  return `--rc:${RARITIES[c.rarity].color};--pastel:hsl(${sp.hue} 72% 93%);--frame:hsl(${sp.hue} 46% 72%)`;
}

/* ---------- pack art ---------- */

function packSVG(kind) {
  const premium = kind === 'premium';
  const bodyFill = premium ? 'url(#pkDark)' : 'url(#pkMint)';
  const crimp = premium ? '#c9a227' : '#8fd7b0';
  const emblemBg = premium ? '#2e2745' : '#ffffff';
  const label = premium ? '#f4d58d' : '#3aa572';
  if (kind === 'ultra') return packSVGTier(kind, 'url(#pkUltra)', '#b48be8', '#1a1428', '#e0c6f7', 8);
  if (kind === 'mega')  return packSVGTier(kind, 'url(#pkMega)',  '#f2799f', '#1c0f18', '#fcd9e6', 10);
  const foil = premium
    ? `<path d="M14 34 L106 96 L106 116 L14 54 Z" fill="url(#pkRainbow)" opacity=".55"/>
       <path d="M14 60 L106 122 L106 132 L14 70 Z" fill="url(#pkRainbow)" opacity=".3"/>`
    : `<path d="M14 40 L106 92 L106 104 L14 52 Z" fill="#ffffff" opacity=".28"/>`;
  const star = premium ? `<text x="92" y="34" font-size="13" fill="#f4d58d">✦</text><text x="20" y="140" font-size="9" fill="#f4d58d" opacity=".8">✦</text>`
                       : `<text x="92" y="34" font-size="11" fill="#ffffff" opacity=".9">✦</text>`;
  const zig = (y, flip) => {
    let d = `M14 ${y}`;
    for (let x = 14; x < 106; x += 8) d += ` L${x + 4} ${y + (flip ? 6 : -6)} L${x + 8} ${y}`;
    return d;
  };
  return `<svg viewBox="0 0 120 168" xmlns="http://www.w3.org/2000/svg" class="pack-svg" aria-hidden="true">
    <defs>
      <linearGradient id="pkMint" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#bfe9d4"/><stop offset=".55" stop-color="#a8d8f0"/><stop offset="1" stop-color="#cfd4f5"/>
      </linearGradient>
      <linearGradient id="pkDark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2a2440"/><stop offset=".6" stop-color="#1c1830"/><stop offset="1" stop-color="#241f38"/>
      </linearGradient>
      <linearGradient id="pkRainbow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7cb8f7"/><stop offset=".33" stop-color="#b48be8"/><stop offset=".66" stop-color="#f2799f"/><stop offset="1" stop-color="#e5b345"/>
      </linearGradient>
    </defs>
    <path d="${zig(14, true)} L106 14 L106 8 L14 8 Z" fill="${crimp}"/>
    <rect x="14" y="14" width="92" height="132" rx="8" fill="${bodyFill}"/>
    ${foil}
    <path d="${zig(152, false)} L106 152 L106 158 L14 158 Z" fill="${crimp}"/>
    <rect x="14" y="146" width="92" height="6" fill="${crimp}"/>
    ${star}
    <circle cx="60" cy="76" r="25" fill="${emblemBg}" stroke="${crimp}" stroke-width="2.5"/>
    <g transform="translate(60,76) scale(1.7) translate(-12,-13)">
      <path d="M12 22c0-5.5 0-8.5 0-10" fill="none" stroke="#3aa572" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 12C12 6.5 15.5 3.5 20 3.5 20 9 16.5 12 12 12Z" fill="#4cbf87"/>
      <path d="M12 12C12 6.5 8.5 3.5 4 3.5 4 9 7.5 12 12 12Z" fill="#6fd6a3"/>
    </g>
    <text x="60" y="126" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="15" letter-spacing="4" fill="${label}">MINT</text>
    <text x="60" y="139" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="700" font-size="7" letter-spacing="2" fill="${label}" opacity=".75">${premium ? '5 CARDS' : '3 CARDS'}</text>
  </svg>`;
}

function packSVGTier(kind, bodyGrad, accent, emblemBg, textCol, count) {
  const zig = (y, flip) => {
    let d = `M14 ${y}`;
    for (let x = 14; x < 106; x += 8) d += ` L${x + 4} ${y + (flip ? 6 : -6)} L${x + 8} ${y}`;
    return d;
  };
  const title = kind === 'ultra' ? 'ULTRA' : 'MEGA';
  const foils = kind === 'mega'
    ? `<path d="M14 30 L106 90 L106 106 L14 46 Z" fill="url(#pkRainbow)" opacity=".6"/>
       <path d="M14 52 L106 112 L106 122 L14 62 Z" fill="url(#pkRainbow)" opacity=".35"/>
       <path d="M14 74 L106 134 L106 142 L14 82 Z" fill="url(#pkRainbow)" opacity=".2"/>`
    : `<path d="M14 34 L106 94 L106 110 L14 50 Z" fill="url(#pkRainbow)" opacity=".55"/>
       <path d="M14 58 L106 118 L106 128 L14 68 Z" fill="url(#pkRainbow)" opacity=".3"/>`;
  return `<svg viewBox="0 0 120 168" xmlns="http://www.w3.org/2000/svg" class="pack-svg" aria-hidden="true">
    <defs>
      <linearGradient id="pkUltra" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2e1f46"/><stop offset=".5" stop-color="#1c1530"/><stop offset="1" stop-color="#2a1840"/>
      </linearGradient>
      <linearGradient id="pkMega" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#2c0a1a"/><stop offset=".5" stop-color="#1c0f18"/><stop offset="1" stop-color="#2c1020"/>
      </linearGradient>
      <linearGradient id="pkRainbow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7cb8f7"/><stop offset=".33" stop-color="#b48be8"/><stop offset=".66" stop-color="#f2799f"/><stop offset="1" stop-color="#e5b345"/>
      </linearGradient>
    </defs>
    <path d="${zig(14, true)} L106 14 L106 8 L14 8 Z" fill="${accent}"/>
    <rect x="14" y="14" width="92" height="132" rx="8" fill="${bodyGrad}"/>
    ${foils}
    <path d="${zig(152, false)} L106 152 L106 158 L14 158 Z" fill="${accent}"/>
    <rect x="14" y="146" width="92" height="6" fill="${accent}"/>
    <text x="92" y="34" font-size="13" fill="${accent}" opacity=".9">✦</text>
    <text x="20" y="140" font-size="9" fill="${accent}" opacity=".8">✦</text>
    <text x="17" y="32" font-size="7" fill="${accent}" opacity=".75">✦</text>
    <circle cx="60" cy="76" r="25" fill="${emblemBg}" stroke="${accent}" stroke-width="2.5"/>
    <g transform="translate(60,76) scale(1.7) translate(-12,-13)">
      <path d="M12 22c0-5.5 0-8.5 0-10" fill="none" stroke="#3aa572" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 12C12 6.5 15.5 3.5 20 3.5 20 9 16.5 12 12 12Z" fill="#4cbf87"/>
      <path d="M12 12C12 6.5 8.5 3.5 4 3.5 4 9 7.5 12 12 12Z" fill="#6fd6a3"/>
    </g>
    <text x="60" y="118" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="10" letter-spacing="5" fill="${textCol}">${title}</text>
    <text x="60" y="126" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="14" letter-spacing="4" fill="${textCol}">MINT</text>
    <text x="60" y="139" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="700" font-size="7" letter-spacing="2" fill="${textCol}" opacity=".75">${count} CARDS</text>
  </svg>`;
}

/* ---------- tiny sound engine (WebAudio, no assets) ---------- */

const Sfx = {
  ctx: null,
  get() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
    return this.ctx;
  },
  tone(freq, t0, dur, vol = 0.12, type = 'sine') {
    const ctx = this.get(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
  },
  rip() { // filtered noise burst
    const ctx = this.get(); if (!ctx) return;
    const len = 0.35, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.22;
    s.connect(f).connect(g).connect(ctx.destination); s.start();
  },
  reveal(rarity) {
    const seqs = {
      common:    [[523, .12]],
      rare:      [[523, .1], [659, .16]],
      epic:      [[523, .09], [659, .09], [784, .2]],
      legendary: [[523, .09], [659, .09], [784, .09], [1047, .3]],
      mythic:    [[392, .1], [523, .1], [659, .1], [784, .1], [1047, .38]],
      celestial: [[440, .1], [554, .1], [659, .1], [880, .12], [1109, .4]],
      eternal:   [[262, .18], [330, .14], [392, .14], [523, .16], [659, .16], [1047, .55]],
    };
    (seqs[rarity] || seqs.common).forEach(([f, d], i) => {
      this.tone(f, i * 0.09, d, 0.13, 'triangle');
      if (['legendary','mythic','celestial','eternal'].includes(rarity)) this.tone(f / 2, i * 0.09, d, 0.06, 'sine');
    });
    if (rarity === 'eternal') this.tone(65, 0, 1.2, 0.16, 'sine');
  },
};

/* ---------- payment sheet (balance-aware) ---------- */

const PaySheet = {
  onSuccess: null, usingBalance: false, total: 0,
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

/* ---------- deposits & withdraw ---------- */

function openDeposit() { $('#depositScrim').classList.add('open'); }
$('#depositBtn').addEventListener('click', openDeposit);
$('#walletDeposit').addEventListener('click', openDeposit);

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

function openWithdraw() {
  toast('Withdrawals are coming soon — your balance is safe here for now');
}
$('#withdrawBtn').addEventListener('click', openWithdraw);
$('#walletWithdraw').addEventListener('click', openWithdraw);

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
  $('#collCount').textContent = S.collection.length;
}

function supplyBadge(c) {
  const minted = mintedCount(c.species, c.rarity);
  const cap = SUPPLY[c.rarity];
  const left = cap - minted;
  if (left <= 0) return `<span class="sold-out">Sold out</span>`;
  if (left <= cap * 0.2) return `<span class="low-supply">${left} left</span>`;
  return '';
}

function monCardHTML(c, actions) {
  const r = RARITIES[c.rarity];
  const cls = ['mon-card', `frame-${c.rarity}`, c.rarity === 'mythic' ? 'mythic-sheen' : ''].join(' ');
  const orn = ['legendary', 'mythic', 'celestial', 'eternal'].includes(c.rarity)
    ? '<i class="orn tl"></i><i class="orn tr"></i><i class="orn bl"></i><i class="orn br"></i>' : '';
  return `<article class="${cls}" style="${cardVars(c)}" data-tilt data-id="${c.id}">
    <div class="card-face">
      ${orn}
      <div class="card-mint">MINT</div>
      <div class="card-vignette">${svgFor(c)}</div>
      <div class="card-name">${c.name}</div>
      <div class="card-epithet">${c.epithet}</div>
      <div class="card-foot">
        <span>No. ${String(c.serial).padStart(3, '0')} / ${SUPPLY[c.rarity]} ${supplyBadge(c)}</span>
        <span class="rpill" style="--rc:${r.color}">◆ ${r.label}</span>
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

function priceDelta(l) {
  if (isMine(l) || !l.lastPrice || l.lastPrice === l.price) return '';
  const up = l.price > l.lastPrice;
  return `<i class="pd ${up ? 'up' : 'down'}">${up ? '▲' : '▼'}</i>`;
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

const isMine = l => l.sellerUid && FBUser && l.sellerUid === FBUser.uid;

function renderMarket() {
  const visible = S.market.filter(marketFilters);
  $('#marketGrid').innerHTML = visible.map(l => monCardHTML(l.creature, isMine(l)
    ? `<button class="btn btn-quiet" data-act="delist" data-lid="${l.id}">Delist · ${money(l.price)}</button>`
    : `<button class="btn btn-dark" data-act="buy" data-lid="${l.id}">${priceDelta(l)}&nbsp;${money(l.price)}</button>`
  )).join('');
  const others = S.market.filter(l => !isMine(l));
  const floor = others.length ? Math.min(...others.map(l => l.price)) : 0;
  $('#marketStats').textContent = `${visible.length} of ${S.market.length} listings · floor ${money(floor)}`;
}

function renderFeatured() {
  const featured = S.market.filter(l => !isMine(l)).slice(0, 5);
  $('#featuredGrid').innerHTML = featured.map(l => monCardHTML(l.creature, `
    <button class="btn btn-quiet" data-act="view" data-id="${l.creature.id}">View</button>
    <button class="btn btn-dark" data-act="buy" data-lid="${l.id}">${money(l.price)}</button>
  `)).join('');
}

function renderIndex() {
  const e = S.economy;
  const now = compositeIndex();
  const back = e.hist[Math.max(0, e.hist.length - 11)];
  const chg = ((now - back) / back) * 100;
  $('#indexValue').textContent = now.toFixed(1);
  const chgEl = $('#indexChange');
  chgEl.textContent = `${chg >= 0 ? '▲' : '▼'} ${Math.abs(chg).toFixed(1)}%`;
  chgEl.className = 'chg ' + (chg >= 0 ? 'up' : 'down');
  // sparkline
  const h = e.hist;
  const min = Math.min(...h), max = Math.max(...h), span = (max - min) || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1 || 1)) * 120},${28 - ((v - min) / span) * 24 - 2}`).join(' ');
  $('#sparkline').innerHTML = `<polyline points="${pts}" fill="none" stroke="${chg >= 0 ? '#4cbf87' : '#ef6a6a'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  // rarity trend chips
  $('#trendStrip').innerHTML = Object.keys(RARITIES).map(k => {
    const idx = e.r[k];
    const dir = idx >= 1 ? 'up' : 'down';
    return `<span class="trend-chip"><i style="background:${RARITIES[k].color}"></i>${RARITIES[k].label}
      <b class="${dir}">${(idx * 100).toFixed(0)}</b></span>`;
  }).join('');
}

function renderActivity() {
  $('#activityList').innerHTML = S.activity.map(e => `
    <div class="act-row">
      <div class="act-icon">${e.icon}</div>
      <div class="act-main"><strong>${e.title}</strong><span>${e.sub} · ${new Date(e.t).toLocaleString('en-NZ', { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' })}</span></div>
      <span class="act-amt ${e.amt > 0 ? 'pos' : ''}">${e.amt > 0 ? '+' : e.amt < 0 ? '−' : ''}${e.amt ? money(Math.abs(e.amt)) : ''}</span>
    </div>`).join('') || '<div class="act-empty">No activity yet. Your deposits, purchases and sales appear here.</div>';
}

function oddsLabel(pct) {
  if (pct >= 1) return pct + '%';
  return '1 in ' + Math.round(100 / pct).toLocaleString('en-NZ');
}
function renderOdds() {
  $('#oddsTable').innerHTML = Object.keys(RARITIES).map(k =>
    `<span><i style="background:${RARITIES[k].color}"></i>${RARITIES[k].label} <small>${oddsLabel(PACKS.standard.odds[k])} / ${oddsLabel(PACKS.premium.odds[k])}</small></span>`).join('');
  $('#supplyNote').innerHTML = Object.keys(SUPPLY).map(k =>
    `<span style="color:${RARITIES[k].color}">${RARITIES[k].label}: <b>${SUPPLY[k]}</b>/species</span>`).join(' · ');
}

function renderHero() {
  const sample = ids => ids.map((id, i) => {
    const sp = SPECIES.find(s => s.id === id);
    return svgFor({ species: id, seed: 1000 + i * 7, rarity: 'common', name: sp.label });
  }).join('');
  $('#heroLeft').innerHTML = sample(['bunny', 'cat', 'bee', 'monster']);
  $('#heroRight').innerHTML = sample(['bear', 'dragon', 'fox', 'owl']);
}

function renderWalletPage() {
  $('#walletBalance').textContent = money(S.balance);
  const portfolio = round2(S.collection.reduce((sum, c) => sum + fairValue(c), 0));
  const myListings = S.market.filter(l => isMine(l));
  const listedValue = round2(myListings.reduce((sum, l) => sum + l.price, 0));
  const spent = round2(S.activity.filter(e => e.amt < 0 && e.title !== 'Withdrawal').reduce((s, e) => s - e.amt, 0));
  const earned = round2(S.activity.filter(e => e.amt > 0 && e.title !== 'Deposit').reduce((s, e) => s + e.amt, 0));
  $('#walletStats').innerHTML = `
    <div class="wstat"><small>Portfolio</small><b>${money(portfolio)}</b><span>${S.collection.length} card${S.collection.length === 1 ? '' : 's'} at live value</span></div>
    <div class="wstat"><small>Listed</small><b>${money(listedValue)}</b><span>${myListings.length} on the market</span></div>
    <div class="wstat"><small>Sales earned</small><b>${money(earned)}</b><span>${money(spent)} spent all-time</span></div>`;
  $('#walletRecent').innerHTML = S.activity.slice(0, 5).map(e => `
    <div class="act-row">
      <div class="act-icon">${e.icon}</div>
      <div class="act-main"><strong>${e.title}</strong><span>${e.sub}</span></div>
      <span class="act-amt ${e.amt > 0 ? 'pos' : ''}">${e.amt > 0 ? '+' : e.amt < 0 ? '−' : ''}${e.amt ? money(Math.abs(e.amt)) : ''}</span>
    </div>`).join('') || '<div class="act-empty">No activity yet</div>';
}

function renderAll() {
  renderWallet(); renderCollection(); renderMarket(); renderFeatured(); renderActivity(); renderWalletPage(); renderIndex();
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

/* ---------- pack opening: auto-reveal hype sequence ---------- */

let pendingPack = null;
let lastPackKey = null;
let speedMult = 1;
const sleep = ms => new Promise(res => setTimeout(res, ms * speedMult));

const CHARGE_MS = { common: 420, rare: 620, epic: 1000, legendary: 1500, mythic: 2100, celestial: 2400, eternal: 3000 };

function confettiHTML() {
  return `<span class="confetti">${Array.from({ length: 16 }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = 70 + Math.random() * 90;
    return `<i style="--c:${pick(BURST_COLORS)};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px"></i>`;
  }).join('')}</span>`;
}

function buyPack(key) {
  const pack = PACKS[key];
  PaySheet.open(
    [{ name: `MINT · ${pack.name}`, price: pack.price }],
    pack.price,
    (usedBalance) => {
      lastPackKey = key;
      pendingPack = Array.from({ length: pack.cards }, () => mintCreature(rollRarity(pack.odds)));
      log('◆', pack.name, usedBalance ? 'MINT Balance' : 'Card ···· 4242', -pack.price);
      persist();
      runOpenSequence(key);
    }
  );
}

async function runOpenSequence(packKey) {
  speedMult = 1;
  $('#revealScrim').classList.add('open');
  $('#openIntro').style.display = '';
  $('#revealStage').classList.remove('on');
  $('#revealSummary').innerHTML = '';
  $('#revealDone').disabled = true;
  $('#openAnother').disabled = true;
  $('#packValueNum').textContent = '$0.00';

  $('#spotlight').innerHTML = '';
  $('#openedTray').innerHTML = '';
  $('#revealStage').classList.remove('spot-mode');

  const wrap = $('#openPackWrap');
  wrap.classList.remove('bursting');
  $('#openPackArt').innerHTML = packSVG(packKey);
  $('#openHint').textContent = 'Opening…';
  $('#gemBurst').innerHTML = Array.from({ length: 22 }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = 100 + Math.random() * 140;
    return `<i style="--c:${pick(BURST_COLORS)};--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px"></i>`;
  }).join('');

  await sleep(1050);            // pack wiggles + charges
  Sfx.rip();
  wrap.classList.add('bursting');
  await sleep(560);
  autoReveal();
}

const isMobile = () => matchMedia('(max-width:760px)').matches;

function revealCardHTML(c, i, extraStyle = '') {
  const r = RARITIES[c.rarity];
  return `<div class="reveal-card" data-i="${i}" style="${cardVars(c)};${extraStyle}">
    <div class="reveal-inner">
      <div class="reveal-face reveal-back"><div class="gem"></div></div>
      <div class="reveal-face reveal-front frame-${c.rarity}">
        <div class="card-mint">MINT</div>
        <div class="card-vignette">${svgFor(c)}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-epithet">${c.epithet}</div>
        <span class="rname">◆ ${r.label} · No. ${c.serial} / ${SUPPLY[c.rarity]}</span>
      </div>
    </div>
  </div>`;
}

const HOLD_MS = { common: 700, rare: 850, epic: 1150, legendary: 1450, mythic: 1850, celestial: 2000, eternal: 2600 };

async function runMobileSpotlight() {
  $('#openIntro').style.display = 'none';
  const stage = $('#revealStage');
  stage.classList.add('on', 'spot-mode');
  const spot = $('#spotlight');
  spot.onclick = () => { speedMult = 0.25; };
  let total = 0;
  await sleep(250);
  for (let i = 0; i < pendingPack.length; i++) {
    const c = pendingPack[i];
    spot.innerHTML = revealCardHTML(c, i);
    const card = spot.querySelector('.reveal-card');
    await sleep(220);
    card.classList.add('charging');
    if (!['common', 'rare'].includes(c.rarity)) card.classList.add('big-charge');
    await sleep(CHARGE_MS[c.rarity]);
    card.classList.remove('charging', 'big-charge');
    flipCard(card, c);
    total = round2(total + fairValue(c));
    animateValue(total);
    await sleep(HOLD_MS[c.rarity]);
    card.classList.add('to-tray');
    await sleep(340);
    $('#openedTray').insertAdjacentHTML('beforeend',
      `<div class="tray-card" style="${cardVars(c)}">${svgFor(c)}</div>`);
    spot.innerHTML = '';
  }
  finishReveal(total);
}

function autoReveal() {
  if (isMobile()) return runMobileSpotlight();
  $('#openIntro').style.display = 'none';
  const stage = $('#revealStage');
  stage.classList.add('on');
  $('#revealRow').innerHTML = pendingPack.map((c, i) => {
    const r = RARITIES[c.rarity];
    return `<div class="reveal-card" data-i="${i}" style="${cardVars(c)};--d:${(i * 0.09).toFixed(2)}s">
      <div class="reveal-inner">
        <div class="reveal-face reveal-back"><div class="gem"></div></div>
        <div class="reveal-face reveal-front frame-${c.rarity}">
          <div class="card-mint">MINT</div>
          <div class="card-vignette">${svgFor(c)}</div>
          <div class="card-name">${c.name}</div>
          <div class="card-epithet">${c.epithet}</div>
          <span class="rname">◆ ${r.label} · No. ${c.serial} / ${SUPPLY[c.rarity]}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  // tap anywhere in the row to fast-forward the drama
  $('#revealRow').onclick = () => { speedMult = 0.25; };
  runFlipSequence();
}

async function runFlipSequence() {
  let total = 0;
  const cards = $$('.reveal-card');
  await sleep(500 + pendingPack.length * 90);
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const c = pendingPack[i];
    card.classList.add('charging');            // rarity pre-glow: the "something's coming" beat
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (!['common', 'rare'].includes(c.rarity)) card.classList.add('big-charge');
    await sleep(CHARGE_MS[c.rarity]);
    card.classList.remove('charging', 'big-charge');
    flipCard(card, c);
    total = round2(total + fairValue(c));
    animateValue(total);
    await sleep(520);
  }
  finishReveal(total);
}

let valueAnim = null;
function animateValue(target) {
  cancelAnimationFrame(valueAnim);
  const el = $('#packValueNum');
  const from = parseFloat(el.textContent.replace('$', '')) || 0;
  const t0 = performance.now(), dur = 420;
  const step = now => {
    const p = Math.min(1, (now - t0) / dur);
    el.textContent = money(from + (target - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) valueAnim = requestAnimationFrame(step);
  };
  valueAnim = requestAnimationFrame(step);
}

function flipCard(card, c) {
  if (card.classList.contains('flipped')) return;
  const r = c.rarity;
  card.classList.add('flipped');
  if (!['common', 'rare'].includes(r)) card.classList.add('epicplus');
  card.insertAdjacentHTML('beforeend', '<span class="flash"></span>');
  card.insertAdjacentHTML('beforeend', `<span class="value-tag">+${money(fairValue(c))}</span>`);
  Sfx.reveal(r);
  if (['epic', 'legendary', 'mythic', 'celestial', 'eternal'].includes(r)) {
    card.insertAdjacentHTML('beforeend', confettiHTML());
    $('#revealRow').classList.add('shake');
    setTimeout(() => $('#revealRow').classList.remove('shake'), 500);
  }
  const fx = { legendary: 'goldglow', mythic: 'prism', celestial: 'aurora', eternal: 'eternalflash' }[r];
  if (fx) {
    $('#revealScrim').classList.add(fx);
    setTimeout(() => $('#revealScrim').classList.remove('goldglow', 'prism', 'aurora', 'eternalflash'), r === 'eternal' ? 2600 : 1400);
    if (r === 'eternal') toast('AN ETERNAL. One of one. It will never exist again.');
  }
}

function finishReveal(total) {
  const pack = PACKS[lastPackKey];
  const best = pendingPack.reduce((a, b) => RARITIES[b.rarity].value > RARITIES[a.rarity].value ? b : a);
  const mult = total / pack.price;
  const vibe = mult >= 3 ? 'INSANE PULL' : mult >= 1.5 ? 'Great pack!' : mult >= 0.8 ? 'Solid pack' : 'Better luck next pack';
  $('#revealSummary').innerHTML = `
    <div class="sum-line"><span class="sum-vibe">${vibe}</span></div>
    <div class="sum-line">Best pull: <b style="color:${RARITIES[best.rarity].color}">${best.name}</b> · ${RARITIES[best.rarity].label}</div>
    <div class="sum-line dim">Pack value ${money(total)} · you paid ${money(pack.price)} (${mult.toFixed(1)}×)</div>`;
  $('#revealDone').disabled = false;
  const again = $('#openAnother');
  again.disabled = false;
  again.textContent = `Open another · ${money(pack.price)}`;
}

function bankPack() {
  if (!pendingPack) return;
  S.collection.push(...pendingPack);
  const best = pendingPack.reduce((a, b) => RARITIES[b.rarity].value > RARITIES[a.rarity].value ? b : a);
  toast(`${pendingPack.length} critters minted — best pull: ${best.name} (${RARITIES[best.rarity].label})`);
  pendingPack = null;
  renderAll();
}

$('#revealDone').addEventListener('click', () => {
  bankPack();
  $('#revealScrim').classList.remove('open');
});

$('#openAnother').addEventListener('click', () => {
  bankPack();
  $('#revealScrim').classList.remove('open');
  buyPack(lastPackKey);
});

/* ---------- market ---------- */

function rarityFloor(rarity) {
  const prices = S.market.filter(l => !isMine(l) && l.creature.rarity === rarity).map(l => l.price);
  return prices.length ? Math.min(...prices) : round2(RARITIES[rarity].value * S.economy.r[rarity] * 1.15);
}

function seedMarket() {
  const bots = ['aria.k', 'no1collector', 'vault_9', 'kiwi.mints'];
  while (S.market.filter(l => l.bot).length < 8) {
    const rarity = rollRarity({ common: 46, rare: 33, epic: 15, legendary: 5, mythic: 1 });
    const c = mintCreature(rarity);
    const markup = 1.05 + Math.random() * 0.55;
    S.market.push({
      id: uid(), creature: c, markup, bot: true,
      price: round2(fairValue(c) * markup),
      lastPrice: null,
      seller: pick(bots),
    });
  }
}

function buyListing(lid) {
  const l = S.market.find(x => x.id === lid);
  if (!l || isMine(l)) return;
  const isCloud = !!l.docId;
  PaySheet.open(
    [{ name: `${l.creature.name} · from @${l.seller}`, price: l.price }],
    l.price,
    async (usedBalance) => {
      if (isCloud) {
        // Real player listing: Firestore transaction
        // 1. Delete the listing doc
        // 2. Credit the seller's balance
        // 3. Add the card to buyer's collection
        // 4. Remove the card from seller's collection
        try {
          await runTransaction(db, async tx => {
            const lRef = doc(db, 'market', l.docId);
            const lSnap = await tx.get(lRef);
            if (!lSnap.exists()) throw new Error('gone');
            const listingData = lSnap.data();

            // credit seller
            const sellerRef = doc(db, 'users', listingData.sellerUid);
            const sellerSnap = await tx.get(sellerRef);

            // update buyer (me)
            const buyerRef = doc(db, 'users', FBUser.uid);
            const buyerSnap = await tx.get(buyerRef);
            if (!buyerSnap.exists()) throw new Error('account missing');

            const buyerData = buyerSnap.data();
            const newBuyerBal = round2((buyerData.balance || 0) - listingData.price);
            if (newBuyerBal < -0.01) throw new Error('insufficient');
            const newBuyerColl = [...(buyerData.collection || []), listingData.creature];

            tx.delete(lRef);
            tx.update(buyerRef, {
              collection: newBuyerColl,
              balance: newBuyerBal,
              updatedAt: Date.now()
            });
            if (sellerSnap.exists()) {
              tx.update(sellerRef, {
                balance: round2((sellerSnap.data().balance || 0) + listingData.price),
                updatedAt: Date.now()
              });
            }
          });
        } catch (e) {
          if (e.message === 'gone') toast('Too slow — that card was already bought');
          else if (e.message === 'insufficient') toast('Not enough balance for this purchase');
          else toast('Purchase failed — try again');
          return;
        }
        // Local state will update via watchMyDoc snapshot — but also do it optimistically
        S.market = S.market.filter(x => x.id !== l.id);
        bumpDemand(l.creature, 0.03);
        log('⇄', `Bought ${l.creature.name}`, `From @${l.seller}`, -l.price);
        toast(`${l.creature.name} is yours!`);
      } else {
        // Bot listing: local only
        S.market = S.market.filter(x => x.id !== l.id);
        S.collection.push(l.creature);
        bumpDemand(l.creature, 0.03);
        log('⇄', `Bought ${l.creature.name}`, usedBalance ? 'MINT Balance' : `From @${l.seller}`, -l.price);
        toast(`${l.creature.name} is yours!`);
        seedMarket();
      }
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
      <span>${r.label} · No. ${String(c.serial).padStart(3, '0')} / ${SUPPLY[c.rarity]}</span>
    </div>`;
  $('#sellGuide').innerHTML = `
    <div class="guide-cell"><small>Live value</small><b>${money(fair)}</b></div>
    <div class="guide-cell"><small>${r.label} floor</small><b>${money(floor)}</b></div>
    <div class="guide-cell"><small>Supply left</small><b>${SUPPLY[c.rarity] - mintedCount(c.species, c.rarity)}</b></div>`;
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
    ratio <= 1.15 ? 'Priced to sell — high demand at this price' :
    ratio <= 1.6  ? 'Fair price — may take a while' :
                    'Above market — unlikely to sell unless the index climbs';
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

$('#sellConfirm').addEventListener('click', async () => {
  const c = Sell.creature;
  const price = round2(parseFloat($('#sellPrice').value));
  if (!c || !price || price < 0.5) return toast('Set a price of at least $0.50');
  const i = S.collection.findIndex(x => x.id === c.id);
  if (i === -1) return;
  S.collection.splice(i, 1);
  try {
    await addDoc(fsCollection(db, 'market'), {
      creature: c, price, sellerUid: FBUser.uid, sellerName: Me.username, createdAt: Date.now(),
    });
  } catch (e) {
    S.collection.push(c);
    return toast('Could not list right now — try again');
  }
  log('▤', `Listed ${c.name}`, `Asking ${money(price)}`, 0);
  toast(`${c.name} listed at ${money(price)}`);
  Sell.creature = null;
  $('#sellScrim').classList.remove('open');
  renderAll();
});

async function delist(lid) {
  const l = S.market.find(x => x.id === lid && isMine(x));
  if (!l) return;
  try { await deleteDoc(doc(db, 'market', l.docId)); } catch { return toast('Could not delist — try again'); }
  S.collection.push(l.creature);
  S.market = S.market.filter(x => x.id !== lid);
  toast(`${l.creature.name} returned to your collection`);
  renderAll();
}

async function botBuyMyListing(l) {
  try { await deleteDoc(doc(db, 'market', l.docId)); } catch { return; }
  S.market = S.market.filter(x => x.id !== l.id);
  S.balance = round2(S.balance + l.price);
  bumpDemand(l.creature, 0.02);
  log('✓', `Sold ${l.creature.name}`, `To @${pick(['aria.k','vault_9','no1collector','kiwi.mints'])}`, l.price);
  toast(`${l.creature.name} sold for ${money(l.price)}`);
  renderAll();
}

/* ---------- detail modal ---------- */

function openDetail(id) {
  const c = S.collection.find(x => x.id === id) || S.market.find(l => l.creature.id === id)?.creature;
  if (!c) return;
  const r = RARITIES[c.rarity];
  const card = $('#detailCard');
  card.style.cssText = cardVars(c);
  card.className = `detail-card frame-${c.rarity}`;
  const left = SUPPLY[c.rarity] - mintedCount(c.species, c.rarity);
  card.innerHTML = `
    <button class="close-x" data-act="closeDetail" aria-label="Close">✕</button>
    <div class="card-mint">MINT</div>
    <div class="card-vignette">${svgFor(c)}</div>
    <h3>${c.name}</h3>
    <div class="card-epithet">${c.epithet}</div>
    <p class="serial">◆ ${r.label} · No. ${String(c.serial).padStart(3, '0')} / ${SUPPLY[c.rarity]} · ${left <= 0 ? 'tier sold out' : left + ' left to mint'}</p>
    <p class="serial live-val">Live value ${money(fairValue(c))}</p>
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
  $$('.nav-link, .tab-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  window.scrollTo({ top: 0 });
}
document.querySelector('.balance-chip').addEventListener('click', () => switchTab('wallet'));

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

/* ============================================================
   ACCOUNTS · PROFILES · TRADING · LEADERBOARDS  (Firebase)
   ============================================================ */

/* ---------- avatars (RTDB, base64) ---------- */

function defaultAvatar(name) {
  let h = 0; for (const ch of (name || 'mint')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initial = (name || 'M')[0].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="32" fill="hsl(${h} 70% 84%)"/>
    <circle cx="32" cy="30" r="15" fill="#fff" opacity=".92"/>
    <text x="32" y="37" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="19" fill="hsl(${h} 45% 45%)">${initial}</text>
    <ellipse cx="22" cy="34" rx="3.4" ry="2" fill="#f7a8bc" opacity=".7"/>
    <ellipse cx="42" cy="34" rx="3.4" ry="2" fill="#f7a8bc" opacity=".7"/>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

async function getAvatar(uidKey, name) {
  if (Avatars[uidKey]) return Avatars[uidKey];
  try {
    const snap = await rtdbGet(rtdbRef(rtdb, 'avatars/' + uidKey));
    if (snap.exists()) { Avatars[uidKey] = snap.val(); return Avatars[uidKey]; }
  } catch {}
  Avatars[uidKey] = defaultAvatar(name);
  return Avatars[uidKey];
}

function fillAvatar(imgEl, uidKey, name) {
  imgEl.src = Avatars[uidKey] || defaultAvatar(name);
  getAvatar(uidKey, name).then(url => { imgEl.src = url; });
}

$('#avatarEdit').addEventListener('click', () => $('#avatarFile').click());
$('#avatarFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = async () => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const ctx = cv.getContext('2d');
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
    const url = cv.toDataURL('image/jpeg', 0.82);
    try {
      await rtdbSet(rtdbRef(rtdb, 'avatars/' + FBUser.uid), url);
      Avatars[FBUser.uid] = url;
      fillAvatar($('#profileAvatar'), FBUser.uid, Me.username);
      fillAvatar($('#accountAvatar'), FBUser.uid, Me.username);
      toast('Looking great — photo updated');
    } catch { toast('Could not save the photo — try a smaller image'); }
  };
  img.src = URL.createObjectURL(file);
  e.target.value = '';
});

/* ---------- profiles ---------- */

let viewingProfile = null; // { uid, username, balance, collection, accountValue, createdAt }

function renderHeaderAccount() {
  $('#accountName').textContent = Me?.username || '…';
  fillAvatar($('#accountAvatar'), FBUser.uid, Me?.username);
}

async function openProfile(uidKey) {
  let target;
  if (uidKey === FBUser.uid) {
    const portfolio = round2(S.collection.reduce((s, c) => s + fairValue(c), 0));
    target = { uid: uidKey, username: Me.username, balance: S.balance, collection: S.collection,
               accountValue: round2(S.balance + portfolio), createdAt: Me.createdAt };
  } else {
    const snap = await getDoc(doc(db, 'users', uidKey));
    if (!snap.exists()) return toast('Could not load that profile');
    target = { uid: uidKey, ...snap.data() };
  }
  viewingProfile = target;
  const own = uidKey === FBUser.uid;
  let hue = 0; for (const ch of target.username) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  $('#profileBanner').style.setProperty('--pfh', hue);
  fillAvatar($('#profileAvatar'), uidKey, target.username);
  $('#avatarEdit').hidden = !own;
  $('#profileName').textContent = target.username;
  const joined = target.createdAt ? new Date(target.createdAt).toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' }) : 'a while ago';
  $('#profileMeta').textContent = `Collector since ${joined}`;
  $('#profileActions').innerHTML = own
    ? `<button class="btn btn-quiet btn-sm" id="signOutBtn">Sign out</button>`
    : `<button class="btn btn-dark btn-sm" data-trade-uid="${uidKey}">⇄ Propose trade</button>`;
  if (own) $('#signOutBtn').addEventListener('click', () => signOut(auth));

  const coll = target.collection || [];
  const portfolio = round2(coll.reduce((s, c) => s + fairValue(c), 0));
  const best = coll.length ? coll.reduce((a, b) => RARITIES[b.rarity].value > RARITIES[a.rarity].value ? b : a) : null;
  $('#profileStats').innerHTML = `
    <div class="wstat"><small>Account value</small><b>${money(round2((target.balance || 0) + portfolio))}</b><span>cash + collection</span></div>
    <div class="wstat"><small>Cards</small><b>${coll.length}</b><span>${best ? 'best: ' + best.name : 'no cards yet'}</span></div>
    <div class="wstat"><small>Cash</small><b>${money(target.balance || 0)}</b><span>MINT balance</span></div>`;
  const order = { eternal: 0, celestial: 1, mythic: 2, legendary: 3, epic: 4, rare: 5, common: 6 };
  const showcase = [...coll].sort((a, b) => order[a.rarity] - order[b.rarity] || b.stats.power - a.stats.power).slice(0, 6);
  $('#showcaseTitle').textContent = own ? 'Your showcase' : `${target.username}'s showcase`;
  $('#profileShowcase').innerHTML = showcase.length
    ? showcase.map(c => monCardHTML(c, `<button class="btn btn-quiet" data-act="viewpf" data-id="${c.id}">View</button>`)).join('')
    : '<div class="act-empty">Nothing to show yet</div>';
  switchTab('profile');
}

$('#accountChip').addEventListener('click', () => openProfile(FBUser.uid));

/* ---------- leaderboards ---------- */

async function loadRanks() {
  const render = async (elId, field, rows) => {
    $('#' + elId).innerHTML = rows.length ? (await Promise.all(rows.map(async (u, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || `<b class="rank-n">${i + 1}</b>`;
      const av = await getAvatar(u.uid, u.username);
      return `<button class="board-row${u.uid === FBUser.uid ? ' me' : ''}" data-profile-uid="${u.uid}" style="--d:${i * 0.05}s">
        <span class="medal">${medal}</span>
        <img src="${av}" alt="">
        <span class="board-name">${u.username || 'collector'}</span>
        <b class="board-val">${money(u[field] || 0)}</b>
      </button>`;
    }))).join('') : '<div class="act-empty">No collectors yet — be the first!</div>';
  };
  try {
    const [cashSnap, valSnap] = await Promise.all([
      getDocs(query(fsCollection(db, 'users'), orderBy('balance', 'desc'), limit(10))),
      getDocs(query(fsCollection(db, 'users'), orderBy('accountValue', 'desc'), limit(10))),
    ]);
    const mapRows = snap => snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    await render('boardCash', 'balance', mapRows(cashSnap));
    await render('boardValue', 'accountValue', mapRows(valSnap));
  } catch (e) {
    console.warn(e);
    $('#boardCash').innerHTML = $('#boardValue').innerHTML = '<div class="act-empty">Could not load leaderboards</div>';
  }
}
$('#ranksRefresh').addEventListener('click', loadRanks);

/* ---------- trading ---------- */

const TradeDraft = { their: null, giveIds: new Set(), getIds: new Set() };

async function openTradeComposer(theirUid) {
  const snap = await getDoc(doc(db, 'users', theirUid));
  if (!snap.exists()) return toast('Could not load that collector');
  TradeDraft.their = { uid: theirUid, ...snap.data() };
  TradeDraft.giveIds.clear(); TradeDraft.getIds.clear();
  $('#tradeTheirName').textContent = TradeDraft.their.username;
  $('#tradeMyCash').value = 0; $('#tradeTheirCash').value = 0;
  renderTradePickers();
  $('#tradeScrim').classList.add('open');
}

function tradeMini(c, side) {
  return `<button class="pickcard" data-pick="${side}" data-id="${c.id}" style="${cardVars(c)}" title="${c.name}">
    ${svgFor(c)}<span>${c.name}</span></button>`;
}

function renderTradePickers() {
  $('#tradeMyCards').innerHTML = S.collection.length
    ? S.collection.map(c => tradeMini(c, 'give')).join('') : '<span class="pick-empty">No cards</span>';
  $('#tradeTheirCards').innerHTML = (TradeDraft.their.collection || []).length
    ? TradeDraft.their.collection.map(c => tradeMini(c, 'get')).join('') : '<span class="pick-empty">They have no cards</span>';
  syncTradeSelection();
}

function syncTradeSelection() {
  $$('#tradeMyCards .pickcard').forEach(b => b.classList.toggle('picked', TradeDraft.giveIds.has(b.dataset.id)));
  $$('#tradeTheirCards .pickcard').forEach(b => b.classList.toggle('picked', TradeDraft.getIds.has(b.dataset.id)));
  const gv = [...TradeDraft.giveIds].reduce((s, id) => s + fairValue(S.collection.find(c => c.id === id)), 0) + (parseFloat($('#tradeMyCash').value) || 0);
  const rv = [...TradeDraft.getIds].reduce((s, id) => s + fairValue(TradeDraft.their.collection.find(c => c.id === id)), 0) + (parseFloat($('#tradeTheirCash').value) || 0);
  $('#tradeSummary').innerHTML = `You give <b>${money(round2(gv))}</b> · you get <b>${money(round2(rv))}</b> in live value`;
}
$('#tradeMyCash').addEventListener('input', syncTradeSelection);
$('#tradeTheirCash').addEventListener('input', syncTradeSelection);

document.addEventListener('click', e => {
  const pk = e.target.closest('.pickcard');
  if (pk) {
    const set = pk.dataset.pick === 'give' ? TradeDraft.giveIds : TradeDraft.getIds;
    set.has(pk.dataset.id) ? set.delete(pk.dataset.id) : set.add(pk.dataset.id);
    syncTradeSelection();
    return;
  }
  const tb = e.target.closest('[data-trade-uid]');
  if (tb) return openTradeComposer(tb.dataset.tradeUid);
  const pr = e.target.closest('[data-profile-uid]');
  if (pr) return openProfile(pr.dataset.profileUid);
});

$('#tradeSend').addEventListener('click', async () => {
  const giveCash = round2(parseFloat($('#tradeMyCash').value) || 0);
  const getCash = round2(parseFloat($('#tradeTheirCash').value) || 0);
  if (giveCash > S.balance) return toast("You don't have enough cash for that");
  if (!TradeDraft.giveIds.size && !TradeDraft.getIds.size && giveCash <= 0 && getCash <= 0) return toast('Add some cards or cash to trade');
  try {
    await addDoc(fsCollection(db, 'trades'), {
      fromUid: FBUser.uid, fromName: Me.username,
      toUid: TradeDraft.their.uid, toName: TradeDraft.their.username,
      give: { cards: S.collection.filter(c => TradeDraft.giveIds.has(c.id)), cash: giveCash },
      get:  { cards: TradeDraft.their.collection.filter(c => TradeDraft.getIds.has(c.id)), cash: getCash },
      status: 'pending', t: Date.now(),
    });
    $('#tradeScrim').classList.remove('open');
    toast(`Trade offer sent to ${TradeDraft.their.username}`);
  } catch { toast('Could not send the trade — try again'); }
});

/* trades inbox */
let incomingTrades = [], outgoingTrades = [];

function watchTrades() {
  onSnapshot(query(fsCollection(db, 'trades'), where('toUid', '==', FBUser.uid), where('status', '==', 'pending')), snap => {
    incomingTrades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const badge = $('#tradesBadge');
    badge.hidden = incomingTrades.length === 0;
    badge.textContent = incomingTrades.length;
    if ($('#tradesScrim').classList.contains('open')) renderTradesList();
  });
  onSnapshot(query(fsCollection(db, 'trades'), where('fromUid', '==', FBUser.uid), where('status', '==', 'pending')), snap => {
    outgoingTrades = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if ($('#tradesScrim').classList.contains('open')) renderTradesList();
  });
}

function tradeRowHTML(t, dir) {
  const who = dir === 'in' ? t.fromName : t.toName;
  const mineSide = dir === 'in' ? t.get : t.give;   // what *I* hand over
  const theirsSide = dir === 'in' ? t.give : t.get; // what *I* receive
  const sum = side => [side.cards.length ? `${side.cards.length} card${side.cards.length > 1 ? 's' : ''}` : '', side.cash ? money(side.cash) : ''].filter(Boolean).join(' + ') || 'nothing';
  const cardsPreview = side => side.cards.slice(0, 4).map(c => `<span class="trade-thumb" style="${cardVars(c)}">${svgFor(c)}</span>`).join('');
  return `<div class="trade-row">
    <div class="trade-row-head"><b>${dir === 'in' ? 'From' : 'To'} @${who}</b><span>${new Date(t.t).toLocaleDateString('en-NZ')}</span></div>
    <div class="trade-row-body">
      <div>${cardsPreview(theirsSide)}<small>you get ${sum(theirsSide)}</small></div>
      <span class="trade-arrow">⇄</span>
      <div>${cardsPreview(mineSide)}<small>you give ${sum(mineSide)}</small></div>
    </div>
    <div class="trade-row-actions">${dir === 'in'
      ? `<button class="btn btn-mint btn-sm" data-trade-accept="${t.id}">Accept</button>
         <button class="btn btn-quiet btn-sm" data-trade-decline="${t.id}">Decline</button>`
      : `<button class="btn btn-quiet btn-sm" data-trade-decline="${t.id}">Cancel offer</button>`}</div>
  </div>`;
}

function renderTradesList() {
  const inc = incomingTrades.map(t => tradeRowHTML(t, 'in')).join('');
  const out = outgoingTrades.map(t => tradeRowHTML(t, 'out')).join('');
  $('#tradesList').innerHTML =
    `<h4 class="side-title">Incoming (${incomingTrades.length})</h4>${inc || '<div class="act-empty">No incoming offers</div>'}
     <h4 class="side-title" style="margin-top:14px">Sent (${outgoingTrades.length})</h4>${out || '<div class="act-empty">No open offers</div>'}`;
}

$('#tradesBell').addEventListener('click', () => { renderTradesList(); $('#tradesScrim').classList.add('open'); });

document.addEventListener('click', async e => {
  const acc = e.target.closest('[data-trade-accept]');
  const dec = e.target.closest('[data-trade-decline]');
  if (dec) {
    try { await updateDoc(doc(db, 'trades', dec.dataset.tradeDecline), { status: 'closed' }); toast('Offer closed'); } catch {}
    return;
  }
  if (!acc) return;
  const id = acc.dataset.tradeAccept;
  acc.disabled = true;
  acc.textContent = 'Processing…';
  try {
    await runTransaction(db, async tx => {
      const tRef = doc(db, 'trades', id);
      const tSnap = await tx.get(tRef);
      if (!tSnap.exists() || tSnap.data().status !== 'pending') throw new Error('gone');
      const t = tSnap.data();
      // t.fromUid = sender (the one who proposed), t.toUid = me (the one accepting)
      // t.give = what SENDER gives me, t.get = what SENDER wants from me
      const senderRef = doc(db, 'users', t.fromUid);
      const myRef = doc(db, 'users', t.toUid);
      const senderData = (await tx.get(senderRef)).data();
      const myData = (await tx.get(myRef)).data();
      if (!senderData || !myData) throw new Error('gone');

      const has = (coll, cards) => cards.every(c => (coll || []).some(x => x.id === c.id));
      // sender must still own what they offered
      if (!has(senderData.collection, t.give.cards)) throw new Error('items moved');
      // I must still own what they asked for
      if (!has(myData.collection, t.get.cards)) throw new Error('items moved');
      // cash checks
      if ((senderData.balance || 0) < t.give.cash) throw new Error('cash short');
      if ((myData.balance || 0) < t.get.cash) throw new Error('cash short');

      const giveIds = new Set(t.give.cards.map(c => c.id));
      const getIds = new Set(t.get.cards.map(c => c.id));

      // sender: remove give.cards, add get.cards, subtract give.cash, add get.cash
      const newSender = (senderData.collection || []).filter(c => !giveIds.has(c.id)).concat(t.get.cards);
      const senderBal = round2((senderData.balance || 0) - t.give.cash + t.get.cash);

      // me: remove get.cards, add give.cards, subtract get.cash, add give.cash
      const newMe = (myData.collection || []).filter(c => !getIds.has(c.id)).concat(t.give.cards);
      const myBal = round2((myData.balance || 0) - t.get.cash + t.give.cash);

      tx.update(senderRef, { collection: newSender, balance: senderBal, updatedAt: Date.now() });
      tx.update(myRef,     { collection: newMe,     balance: myBal,     updatedAt: Date.now() });
      tx.update(tRef, { status: 'accepted' });
    });
    Sfx.reveal('legendary');
    toast('Trade complete! Your collection has been updated');
    renderTradesList();
  } catch (err) {
    const msg = err.message === 'items moved' ? 'Trade failed — cards were already traded or sold'
              : err.message === 'cash short' ? 'Trade failed — not enough cash on one side'
              : 'Trade failed — try again';
    toast(msg);
    acc.disabled = false;
    acc.textContent = 'Accept';
  }
});

/* ---------- market snapshot (real listings merge with bots) ---------- */

function watchMarket() {
  onSnapshot(query(fsCollection(db, 'market'), orderBy('createdAt', 'desc'), limit(40)), snap => {
    const cloud = snap.docs.map(d => {
      const x = d.data();
      return { id: 'fs_' + d.id, docId: d.id, creature: x.creature, price: x.price,
               seller: x.sellerName, sellerUid: x.sellerUid };
    });
    S.market = cloud.concat(S.market.filter(l => l.bot));
    renderMarket(); renderFeatured(); renderWalletPage();
  });
}

/* ---------- own doc sync (trades change it remotely) ---------- */

function watchMyDoc() {
  onSnapshot(doc(db, 'users', FBUser.uid), snap => {
    if (!snap.exists()) return;
    const d = snap.data();
    applyingRemote = true;
    S.balance = d.balance ?? S.balance;
    S.collection = d.collection ?? S.collection;
    Store.save(S);
    applyingRemote = false;
    renderAll();
  });
}

/* ---------- auth screen ---------- */

let authMode = 'signin';

function setAuthMode(mode) {
  authMode = mode;
  $$('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  const pill = $('#authTabPill'), active = $('.auth-tab.active');
  pill.style.width = active.offsetWidth + 'px';
  pill.style.transform = `translateX(${active.offsetLeft - 4}px)`;
  $('#authName').hidden = mode !== 'signup';
  $('#authTitle').textContent = mode === 'signin' ? 'Welcome back' : 'Join MINT';
  $('#authSub').textContent = mode === 'signin' ? 'Sign in to your collection.' : 'Start collecting in seconds.';
  $('#authSubmitText').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  authError('');
}
$$('.auth-tab').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.mode)));

function authError(msg) {
  const el = $('#authError');
  el.hidden = !msg;
  el.textContent = msg;
  if (msg) {
    $('#authCard').classList.remove('shake-x');
    void $('#authCard').offsetWidth;
    $('#authCard').classList.add('shake-x');
  }
}

function authBusy(on) {
  $('#authSubmit').disabled = on;
  $('#authGoogle').disabled = on;
  $('#authSpin').hidden = !on;
}

const authErrMsg = e => ({
  'auth/invalid-credential': 'Wrong email or password',
  'auth/invalid-email': 'That email doesn\u2019t look right',
  'auth/email-already-in-use': 'That email already has an account — try signing in',
  'auth/weak-password': 'Password needs at least 6 characters',
  'auth/popup-closed-by-user': '',
}[e.code] ?? 'Something went wrong — try again');

$('#authSubmit').addEventListener('click', async () => {
  const email = $('#authEmail').value.trim();
  const pass = $('#authPass').value;
  const name = $('#authName').value.trim();
  if (!email || !pass) return authError('Fill in your email and password');
  if (authMode === 'signup' && name.length < 3) return authError('Pick a username (3+ characters)');
  authBusy(true);
  try {
    if (authMode === 'signup') {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  } catch (e) { authError(authErrMsg(e)); }
  authBusy(false);
});
$('#authPass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#authSubmit').click(); });

$('#authGoogle').addEventListener('click', async () => {
  authBusy(true);
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { const m = authErrMsg(e); if (m) authError(m); }
  authBusy(false);
});

function paintAuthCritters() {
  const el = $('#authCritters');
  el.innerHTML = SPECIES.slice(0, 8).map((sp, i) =>
    `<span class="float-critter" style="--fx:${(i * 12.5 + 4)}%;--fd:${(i % 4) * 1.1}s;--ft:${9 + (i % 3) * 3}s">
      ${svgFor({ species: sp.id, seed: 2222 + i * 31, rarity: 'common', name: sp.label })}</span>`).join('');
}

/* ---------- lifecycle ---------- */

let uiBooted = false;

function bootUI() {
  if (uiBooted) return;
  uiBooted = true;
  $('#speciesFilter').insertAdjacentHTML('beforeend',
    SPECIES.map(sp => `<option value="${sp.id}">${sp.label}</option>`).join(''));
  $('#packArtStandard').innerHTML = packSVG('standard');
  $('#packArtPremium').innerHTML = packSVG('premium');
  renderOdds();
  renderHero();
}

async function ensureUserDoc(user) {
  const uRef = doc(db, 'users', user.uid);
  const snap = await getDoc(uRef);
  if (snap.exists()) return snap.data();
  const username = (user.displayName || user.email.split('@')[0]).slice(0, 20);
  const fresh = { username, usernameLower: username.toLowerCase(), balance: 0, collection: [],
                  accountValue: 0, createdAt: Date.now(), updatedAt: Date.now() };
  await setDoc(uRef, fresh);
  return fresh;
}

onAuthStateChanged(auth, async user => {
  FBUser = user;
  if (!user) {
    Me = null;
    $('#authScreen').classList.remove('leaving');
    $('#authScreen').style.display = '';
    paintAuthCritters();
    setAuthMode('signin');
    return;
  }
  try {
    const data = await ensureUserDoc(user);
    Me = { uid: user.uid, username: data.username, createdAt: data.createdAt };
    Store.KEY = 'mint_v8_' + user.uid;
    const local = Store.load();
    if (local) { S.economy = local.economy || S.economy; S.activity = local.activity || []; S.mints = local.mints || {}; }
    for (const k of Object.keys(RARITIES)) { if (S.economy.r[k] == null) S.economy.r[k] = 1; if (S.economy.drift[k] == null) S.economy.drift[k] = 0; }
    applyingRemote = true;
    S.balance = data.balance || 0;
    S.collection = data.collection || [];
    applyingRemote = false;
    S.market = S.market.filter(l => l.bot);
    bootUI();
    seedMarket();
    renderHeaderAccount();
    renderAll();
    watchMarket();
    watchMyDoc();
    watchTrades();
    loadRanks();
    const scr = $('#authScreen');
    scr.classList.add('leaving');
    setTimeout(() => { scr.style.display = 'none'; }, 650);
  } catch (e) {
    console.error(e);
    toast('Could not load your account — check your connection');
  }
});

/* ranks tab lazy refresh + profile view action */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab="ranks"]');
  if (t) loadRanks();
  const v = e.target.closest('[data-act="viewpf"]');
  if (v && viewingProfile) {
    const c = (viewingProfile.collection || []).find(x => x.id === v.dataset.id);
    if (c) {
      // temporarily view a card that may not be ours
      const orig = S.collection;
      if (!orig.some(x => x.id === c.id)) S.collection = orig.concat(c);
      openDetail(c.id);
      S.collection = orig;
    }
  }
});
