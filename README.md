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
- **Favicon**: kawaii bunny + sprout on a pastel gradient tile (favicon.svg,
  favicon-32.png, apple-touch-icon.png).
