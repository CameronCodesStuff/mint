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
