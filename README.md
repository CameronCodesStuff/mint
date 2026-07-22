# MINT — Own the unreal

Premium creature-collector marketplace prototype. Vanilla JS, zero dependencies,
no build step, GitHub Pages ready.

## Run it

Open `index.html`, or push the folder to a repo with Pages enabled.
State lives in `localStorage` (key `mint_v1`). Reset with
`localStorage.removeItem('mint_v1')`.

## The economy — real money only

- **No free currency.** No daily claims, no airdrops, no burn rewards. Balance
  starts at $0.00 and only grows when your listings sell.
- **Packs** are paid purchases: Standard $4.99 (3 specimens), Premium $9.99
  (5 specimens, 3× Legendary odds). Buying opens an Apple Pay-style payment
  sheet: order summary → card on file → Pay → processing spinner → checkmark.
- **Market** purchases also run through the payment sheet. Your own listings can
  be delisted; fairly priced listings get bought by simulated collectors after
  15–50s (window must stay open), crediting your balance.
- **Withdraw** transfers your balance to a mock bank account.

## Wiring real payments (Stripe)

The payment layer is isolated in the `PaySheet` object in `app.js`. To go live:

1. `PaySheet.charge()` → POST to a Cloudflare Worker that creates a Stripe
   Checkout Session or PaymentIntent (you already run this exact pattern for
   Misty Pro subscriptions).
2. **Fulfil on the webhook, never on the client.** The Worker's
   `checkout.session.completed` handler mints the pack server-side (Admin SDK,
   Firestore transaction, increment species counters for serials) and writes to
   `users/{uid}/collection`. The client just listens for the doc to appear.
3. Marketplace: escrow via Firestore transactions in the Worker — remove
   listing, record seller proceeds, transfer creature, all atomically. Seller
   payouts at scale = Stripe Connect.
4. Keep an `orders/{sessionId}` doc to make webhook fulfilment idempotent.

## Compliance note

Selling randomized packs for real money is loot-box territory — check the rules
for each market you sell in (some countries require odds disclosure, which the
Shop page already includes; a few restrict paid loot boxes outright).

## Tuning

Prices, odds, rarity values, supply cap, and species all live in the config
block at the top of `app.js`.

## v2 additions

- **Deposits**: "Add funds" opens a sheet with preset chips ($10/$25/$50/$100)
  or a custom amount, charged via the payment sheet. Checkout is balance-aware:
  if your MINT balance covers a purchase it pays from balance (rainbow chip in
  the sheet), otherwise it falls back to the card.
- **Pack opening**: staged sequence — pulsing gem, tap to crack (flash + 18-way
  particle burst), cards enter with a staggered rise, flip on tap with a
  rarity-colored flash ring, confetti burst for Legendary/Mythic, plus a
  "Reveal all" button that flips the rest in sequence.
- **Sell sheet**: replaces the prompt() — specimen preview, fair value / rarity
  floor / recent sales cells, − / + price stepper, and a live badge (Priced to
  sell / Fair / Above market). Better prices sell faster to simulated buyers.
- **Cards**: rarity-tinted art tiles, 3D pointer tilt with a holographic light
  that follows the cursor, serial pill, power bar, drop-shadow art, and a
  holo sheen on Mythics.

## v3 — pastel kawaii edition

- **Look**: pastel storefront modeled on the mock — header nav (Shop / Collection /
  Market / Activity), pastel gradient "Welcome to MINT!" hero with bobbing critters,
  Featured Collection row, sprout-leaf MINT logo, Baloo 2 rounded display type.
  Apple components stay: frosted header, pill buttons, payment/deposit/sell sheets.
- **Cards**: trading-card layout matching the reference — pastel background tinted
  per species, ornate double frame, MINT wordmark header, circular vignette with the
  critter portrait, name banner + italic epithet ("The Gentle Blossom Hopper of the
  Meadow"), serial + rarity footer. Legendary cards get a gold frame; Mythic cards
  get an animated rainbow frame + sheen.
- **Critters**: the SVG generator now draws original kawaii animals — bunny, cat,
  bee, bear, dragon, owl, fox, duck, monster — with sparkle eyes, blush, per-species
  ears/features, seeded accessories (flower/star/bow) and rarity flourishes.
- **Market**: search box + species filter.

## v4 additions

- **Wallet page**: rainbow gradient MINT Cash card with big balance + Add funds /
  Withdraw on the card, stat tiles (portfolio at fair value, listed value, sales
  earned vs spent all-time), payment method rows (card + payout bank), and a
  Recent activity preview. Tapping the header balance chip opens it.
- **Mobile**: iOS-style frosted bottom tab bar with icons (Shop / Market / Wallet /
  Cards / Activity) + safe-area insets; header slims to logo + balance; hero stacks
  with a critter strip; Featured becomes a swipeable snap carousel; 2-up card grid
  with tighter type; packs stack; sheets cap at 88dvh and scroll; search stretches;
  tilt/holo disabled on touch; ≥44px touch targets throughout.

## v5 — scarcity & living economy

- **Rarity nerf**: Standard pack odds now 86 / 11.5 / 2 / 0.4 / 0.1 (Premium
  70 / 21.5 / 6.5 / 1.6 / 0.4). Mythics are ~1-in-1000 cards from a Standard pack.
- **Tiered supply caps** per species: Common 500 · Rare 200 · Epic 75 ·
  Legendary 25 · Mythic 12 — ever. Sold-out tiers fall back to the next tier at
  mint. Cards show "N left" / "SOLD OUT" badges; the detail view shows remaining.
- **Rarity presentation**: Rare = silver-blue foil, Epic = amethyst foil +
  sparkle field, Legendary = gold filigree corners + pulsing gold glow,
  Mythic = animated rainbow frame + prismatic sliding overlay + glow cycle.
  Legendary pulls flash the reveal screen gold; Mythic pulls flash prismatic.
- **Living market**: every 8s the economy ticks — per-rarity indexes and
  per-species demand modifiers random-walk plus drift from real events (your
  buys push prices up, fresh mints soften them, near-sellout tiers carry a
  scarcity premium). Bot listings reprice live with ▲/▼ deltas; your listings
  sell probabilistically against live fair value each tick. The Market shows a
  MINT Index with sparkline and per-rarity trend chips; the Wallet portfolio is
  marked to live value.
- **Art v2**: radial-gradient shading, per-species backdrop motifs (floral
  wreath, honeycomb, crescent moon, clock ring, waves, clouds, leaf ring,
  starfields), and little paws for the bust look.

## v6 additions

- **Withdrawals gated**: both withdraw buttons read "Withdraw · Coming soon" and
  show a friendly toast instead of the payout sheet.
- **Celestial & Eternal tiers**: Celestial — 1-in-10,000 Standard odds
  (1-in-2,500 Premium), 3 per species, aurora teal/violet animated frame with
  drifting starlight and its own reveal flash. Eternal — 1-in-100,000 Standard
  odds (1-in-25,000 Premium), a true one-of-one per species, rendered as an
  obsidian card with gilded type, gold-dust sparkle, living shimmer, an extended
  black-and-gold reveal sequence, and a toast announcing the 1/1. Odds under 1%
  display as "1 in N" in the odds table. Bots never list either tier — packs are
  the only source.
- **Favicon**: the MINT sprig — green two-leaf sprout in a white emblem circle on the pastel gradient tile (matches the header logo and pack seal).
  favicon-32.png, apple-touch-icon.png).

## v7 — auto-open hype & branding

- **Auto-opening packs**: no taps needed. Payment clears → the actual pack art
  wiggles, charges with a white glow, and bursts (with a WebAudio rip sound) →
  cards deal in face-down → each card auto-flips in sequence. Before every flip
  the card levitates and pulses in its rarity colour (the anticipation beat) —
  Commons flip fast, Eternals make you wait 3 agonising seconds with a spinning
  gem. Flips fire escalating chimes (per-rarity arpeggios, synthesised live, no
  audio files), value tags (+$X) pop off each card, a Pack Value counter ticks up,
  epic+ pulls shake the whole row, and top tiers still flash the screen. Ends
  with a verdict banner (INSANE PULL / Great pack! / …), best-pull callout,
  value-vs-price multiplier, and an "Open another · $9.99" button that banks
  your cards and rolls straight into the next payment sheet. Tap the cards
  mid-sequence to fast-forward 4×.
- **Logo**: proper mint sprig (stem + two leaves with vein details) in the
  header, matching the favicon.
- **Pack icons**: real booster-pack illustrations — crimped foil edges, MINT
  sprig emblem seal, wordmark, card count. Standard = pastel foil wrapper;
  Premium = midnight wrapper with rainbow foil bands and gold crimps. Same art
  is what bursts open in the reveal.

## v7.2 — mobile reveal overhaul

- The pack reveal is now a full-height app screen on phones: sticky Pack Value
  header, a scrollable 2-up card grid in the middle, and a frosted action bar
  pinned to the bottom (with safe-area padding) so "Add to collection" and
  "Open another" are always reachable. Each card auto-scrolls into view as it
  charges, so flips never happen off-screen.
- Typography unjammed: epithets clamp to two tidy lines everywhere, card faces
  got rebalanced padding/sizes on small screens, footers wrap instead of
  colliding, and the detail modal scrolls within 90dvh.

## v7.3 — mobile spotlight reveal

On phones, packs now open one BIG card at a time: each card appears centre-stage
at ~76vw, does its rarity charge-glow, flips with full-size type (22px name,
readable epithet), holds for a rarity-scaled beat, then shrinks away into a
horizontal tray of opened cards above the action bar. The desktop grid flow is
unchanged. Tap the spotlight to fast-forward.

## v8 — accounts, trading & leaderboards (Firebase)

**What's new**
- Animated auth screen: frosted glass card over floating critters, Sign in /
  Create account tabs with a sliding pill, inline validation with shake-on-error,
  loading states, Google one-tap and email/password (Firebase Auth).
- Accounts: user docs in Firestore (`users/{uid}`) hold username, balance,
  collection and a computed accountValue; local play state syncs up (debounced)
  and down (live snapshot — trades update you in real time).
- Profiles: gradient banner keyed to the username, big avatar with upload
  (client-resized to 96px JPEG, stored as base64 in RTDB `avatars/{uid}`),
  collector-since date, stat tiles, and a showcase of their 6 best cards.
  Tap any player on a leaderboard to visit their profile.
- Trading: "Propose trade" from any profile — pick cards from both collections,
  add cash on either side, live value summary, send. Incoming offers hit the
  bell badge instantly; accepting runs a Firestore transaction that verifies
  both sides still own everything, swaps cards, and settles the cash.
- Leaderboards: Richest cash and Richest accounts (cash + live collection
  value), top 10 with medals, avatars and staggered entrance animations.
- The market is now real: your listings are Firestore docs other players can
  buy (seller gets credited in a transaction); bot listings still fill the
  gaps and follow the live economy.

**Firebase console setup (one-time)**
1. Authentication → Sign-in method → enable **Email/Password** and **Google**.
2. Firestore → create database → rules for the prototype:
   `allow read, write: if request.auth != null;`
3. Realtime Database → create → rules: `{ "rules": { "avatars": { ".read": true, "$uid": { ".write": "auth.uid === $uid" } } } }`
4. Add your GitHub Pages domain under Authentication → Authorized domains.

**Security reality check**: everything runs client-side, so a motivated user
can edit their own balance. Fine for a prototype among friends; before real
money, route balance changes through a Cloudflare Worker with the Admin SDK
and lock Firestore rules down to read-only for money fields.
