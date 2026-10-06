# Storefront — setup and seeding

## 1. Run the migration

Supabase SQL Editor → run `supabase/migrations/0003_storefront.sql`.

## 2. Turn the shop on

```sql
update public.organizations
   set storefront_enabled = true, slug = 'farmersfresh'
 where name = 'Farmers Fresh';
```

Until this runs, the catalogue is empty by design — `prod_public_read` only
exposes products belonging to a storefront-enabled org.

## 3. Add product photos

Put JPGs in `public/products/`. Name them after the slug:

```
public/products/leg.jpg
public/products/chops.jpg
public/products/mince.jpg
public/products/whole.jpg
public/products/shoulder.jpg
public/products/offal.jpg
```

**Where to get them, for now:**

- [Unsplash — mutton](https://unsplash.com/s/photos/mutton) ·
  [raw meat](https://unsplash.com/s/photos/raw-meat) ·
  [butcher](https://unsplash.com/s/photos/butcher)
- [Pexels — raw chicken](https://www.pexels.com/search/raw%20chicken/) ·
  [minced meat](https://www.pexels.com/search/minced%20meat/)

Both are free for commercial use with no attribution required. Download at
roughly 1600 px wide — `next/image` resizes and converts to WebP, so anything
larger is wasted bytes.

**Replace these with your own photos before you advertise.** Real photos of
your actual cuts on your actual trays outsell stock imagery in food, because
the customer is buying trust. Generic supermarket photos quietly signal that
you're not showing your real goods.

A product with no photo renders a clean "photo soon" placeholder — it will not
break, and it is more honest than someone else's meat.

## 4. Publish the catalogue

```sql
-- Give every cut a URL slug
update public.products
   set slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
 where org_id = (select id from public.organizations where name = 'Farmers Fresh');

-- Then price, describe and publish each one
update public.products set
  sale_price   = 850,
  category     = 'Mutton',
  description  = 'Bone-in leg, cleaned and cut to size. Never frozen.',
  image_path   = '/products/leg.jpg',
  is_published = true
where slug = 'leg';
```

A product **cannot** be published without a slug and a price — the
`products_publishable` check constraint rejects it. That's on purpose: a
listing with no price is a support call waiting to happen.

Repeat for each cut, then reload `/`.

## How the money is kept honest

The browser never sends prices. `place_order` receives product ids and
quantities, looks the prices up itself, recalculates the subtotal and the
delivery fee, and writes the result. A customer editing the page can change
what they see; they cannot change what they are charged.

Weights are `numeric(12,3)` and money is `numeric(12,2)` — both arrive from
PostgREST as **strings**, because a JS float can't hold every decimal exactly.
`lib/shop.ts` converts them deliberately. Never do arithmetic on a raw value
from Supabase.

## Privacy: orders are write-only to the public

There is deliberately **no `anon` SELECT policy on `orders`**. Anyone can place
one; nobody anonymous can read one back. Without this, changing the order
number in a URL would walk your entire customer list — names, phone numbers,
home addresses.

This is why the confirmation page takes the order number from the redirect
rather than looking it up.

## Stock (migration 0004)

Stock is a **ledger**, not a quantity column. Every change is an immutable row
in `stock_movements` saying how much, why, and who. On-hand is the sum.

A single `quantity` cell that gets updated is unauditable — when it's wrong,
and in a meat shop it will be, there's no way to learn why. `stock_items` from
migration 0001 is **deprecated**; nothing writes to it.

**Add stock:**

```sql
select public.record_stock(
  '<store-location-id>', '<product-id>', 25, 'production', 'Morning cut'
);
```

Valid reasons: `production`, `purchase`, `waste`, `adjustment`, `stock_count`,
`transfer_in`, `transfer_out`. Stock cannot be driven below zero by hand — if
it tries, the count is wrong and a person should look.

**See what's on hand:**

```sql
select product_name, quantity from public.stock_on_hand;
```

### Orders reserve stock at placement

Not at confirmation. The gap between a customer pressing the button and staff
seeing the order is exactly when a second customer would oversell the same cut.
The ledger rows are locked `for update` during the check, so two simultaneous
customers cannot both pass on the same last kilo.

Cancelling through `cancel_order()` puts the meat back. **This is why staff
must cancel through the order queue, never by setting `status = 'cancelled'`
by hand** — a bare status change would leave that stock permanently invisible.

Verified working: 20 kg on hand → 100 kg order refused → 5 kg order accepted →
15 kg → cancel → back to 20 kg.

## What's still missing

Honest list, so nothing surprises you in front of a customer:

1. **No notification.** Nobody is told an order arrived — staff must reload
   `/dashboard/orders`. A WhatsApp or SMS hook to the shop phone is the next
   practical step, and the most valuable one.
2. **No POS.** Walk-in counter sales don't draw down the same stock, so the
   ledger drifts from reality the moment you sell to someone in person. Until
   Bit 3 exists, the online availability is only right if online is your only
   channel.
3. **No delivery area check.** Any address is accepted, including ones you
   can't reach. A PIN-code allow-list is needed.
4. **No rate limiting.** `place_order` is callable by anyone. Pay-on-delivery
   means fake orders cost you a phone call, not money — but they now also
   *reserve real stock*, so a bored person could make you look sold out.
   Worth closing before you advertise.
5. **Prices are placeholders.** ₹750–900/kg was my guess, not your costing.
   Set real prices before anyone sees the site.
