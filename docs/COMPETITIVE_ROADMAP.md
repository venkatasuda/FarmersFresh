# Farmers Fresh — Competitive Feature Roadmap

*How we stack up against Zepto, Swiggy Instamart, Blinkit, BigBasket, and the German chains (Kaufland, Lidl Plus) — and what to build next to compete and win.*

Researched July 2026. This is a working roadmap, not a spec — priorities are a recommendation, not a rule.

---

## 1. Where we already match (or beat) them

Before chasing new features, it's worth seeing how much is already done. Farmers Fresh already has, live:

- **Full storefront** — catalogue, departments, search with autocomplete, wishlist, reviews & ratings, promo banners, offers/deals zone.
- **Checkout** — COD **and** prepaid (UPI / card via a payment gateway, money verified before the order is processed), coupons, loyalty-point redemption, saved addresses.
- **Loyalty** — a points program (1 point per ₹100), a scannable **QR loyalty card** used both online and at the counter — the same model Lidl Plus and Kaufland Card run on.
- **Retention** — subscriptions ("subscribe & save"), buy-it-again, recommendations, back-in-stock alerts, abandoned-cart reminders, win-back for lapsed customers.
- **Order lifecycle** — real-time order tracking, digital receipts (on-screen + emailed), returns & refunds to points.
- **Notifications** — email + SMS + WhatsApp + web push, all through one outbox.
- **Operations** — counter POS with credit ledger (khata), delivery/rider screen, live staff order board, stock ledger, demand insights, an owner business dashboard, and a settings screen (delivery fees, GSTIN, contacts).
- **Platform** — installable PWA, error monitoring, row-level security throughout.

That is already at or beyond feature parity with most of what these apps expose to a customer. The gaps below are the *edges* they've pushed to — plus a few places we can beat them.

---

## 2. The gaps — what they have that we don't (yet)

Grouped by theme, with a rough value/effort read.

### A. Speed & delivery experience

| Feature | Who does it | Value | Effort |
|---|---|---|---|
| **Live rider tracking on a map + live ETA** | Zepto, Instamart, Blinkit | High | High |
| **Delivery slots / express vs scheduled** | BigBasket, Instamart | Medium | Medium |
| **Add items to an order after placing** (short window) | Zepto, Instamart | Medium | Medium |
| **Tip the rider + rate the delivery** | All q-commerce | Low | Low |
| **Map-pin / GPS address selection** | All q-commerce | Medium | Medium |

The single most visible gap is **live map tracking with a moving rider and a real ETA** — analysed from order volume, rider proximity, traffic. Ours is a status timeline; theirs is a moving dot on a map. ([Uber/q-commerce ETA](https://www.uber.com/de/blog/live-order-tracking))

### B. Membership & pricing

| Feature | Who does it | Value | Effort |
|---|---|---|---|
| **Paid membership ("Farmers Fresh Pass")** — free delivery + member prices | Zepto Pass, Swiggy One, BigBasket bbstar | **High** | Medium |
| **Personalised coupons** (tailored to buying habits) | Lidl Plus, Zepto | High | Medium |
| **Tiered loyalty** (silver/gold, better perks the more you spend) | Many | Medium | Medium |
| **Gift cards / gifting an order** | BigBasket, Amazon | Low | Medium |

A **paid membership** is the biggest retention lever the MNCs have. Zepto Pass gives 20% off + free delivery over ₹99; bbstar gives free delivery over ₹600 + priority slots. ([Zepto Pass](https://www.newsbytesapp.com/news/business/zeptos-super-saver-feature-gets-a-makeover/tldr), [bbstar](https://www.bigbasket.com/bbstar/))

### C. Engagement & gamification

| Feature | Who does it | Value | Effort |
|---|---|---|---|
| **Gamified rewards** — scratch cards, spin-to-win, mystery boxes, streaks | Lidl Plus, Zepto | High | Medium |
| **Voice search** (incl. Hindi / regional) | Zepto | Medium | Medium |
| **Multi-language / vernacular UI** | Most Indian apps | Medium | Medium |
| **Weekly flyer / digital leaflet ("Prospekt")** | Kaufland, Lidl | Low | Low |

Lidl Plus leans hard on games (Spin To Win, Mystery Boxes) on top of points. ([Lidl Plus](https://apps.apple.com/us/app/lidl-plus/id1238611143)) Our loyalty points are solid; gamification is the layer that makes people open the app daily.

### D. AI & personalisation

| Feature | Who does it | Value | Effort |
|---|---|---|---|
| **Smart refill / auto-replenish reminders** (AI predicts when you'll run out) | Zepto Smart Refill, BigBasket Smart Basket | High | Medium |
| **Fully personalised home feed** (products ranked per customer) | All | Medium | Medium |
| **Predictive/ML delivery ETA** | Blinkit, Zepto | Medium | High |

We have subscriptions + buy-it-again + a recommendation engine — the building blocks. The next step is **predicting** the refill and nudging proactively, and reordering the homepage per customer. ([Zepto Smart Refill](https://miracuves.com/blog/what-is-zepto-app-and-how-does-it-work/), [BigBasket Smart Basket](https://www.bigbasket.com/member/smart-basket/))

### E. Support & trust

| Feature | Who does it | Value | Effort |
|---|---|---|---|
| **In-app help / chat / order-level support** | All | High | Medium |
| **Instant refunds to wallet** | Zepto Wallet | Medium | Low |
| **Dietary / nutrition / allergen filters & labels** | International grocers | Medium | Medium (data) |

An in-app **help centre with order-level "something's wrong"** flows (beyond the returns form we built) is table stakes for trust at scale.

---

## 3. Where we can *beat* them — lean into the farm

The MNCs are aggregators. Farmers Fresh raises its own meat. That is an advantage no clone app can copy, and it should be a headline feature, not a footnote.

- **Farm-to-table traceability.** Each meat product shows *where it was raised and when it was cut* — a batch/harvest record on the product page and receipt. "This chicken: Farm A, processed 26 Jul, sold fresh." No dark-store competitor can say this.
- **Freshness guarantee & provenance story.** Photos and a short story per farm; a "cut this morning" badge that's real, not marketing.
- **Transparent sourcing / no middleman** as a persistent trust message (we already avoid fake claims — this is the honest version of a trust badge).
- **Sustainability** — plastic-light packaging, local sourcing radius, own-farm carbon story. Increasingly a purchase driver.

This is the moat. Match the MNCs on convenience; beat them on **trust and freshness**.

---

## 4. Recommended roadmap

### Now (highest value, reasonable effort)
1. **Farmers Fresh Pass** — paid membership: free delivery + member-only prices. Directly copies the MNCs' #1 retention tool and fits our subscriptions plumbing.
2. **Live rider tracking + ETA on a map** — the most visible "modern app" gap. Rider location → realtime → map + countdown.
3. **Gamified rewards** — scratch card / spin-to-win on top of the existing points ledger. Cheap dopamine, big daily-open lift.
4. **Farm traceability** — our unfair advantage; low-to-medium effort, high differentiation.

### Next
5. **Smart refill reminders** (predict repurchase from order history) + **personalised home feed**.
6. **In-app help centre** with order-level support beyond returns.
7. **Personalised coupons** targeted by buying habits.
8. **Tip & rate the rider**, **add-items-after-order** window.

### Later
9. **Map-pin address selection**, **delivery slots / express tier**.
10. **Voice search + multi-language**, **gift cards**, **tiered loyalty**, **dietary filters**.
11. **Instant wallet refunds**, **weekly digital flyer**.

---

## 5. Reality checks

- **10-minute delivery is an operations game, not a software one.** Blinkit/Zepto's speed comes from dark stores and dense rider networks, not app features. Don't chase "10 minutes" in code — chase reliable same-day and *honest* ETAs.
- **Everything customer-facing above rides infrastructure we already have** (realtime, the notification outbox, the points ledger, RLS). Most of these are extensions, not rebuilds.
- **Prioritise the membership + traceability combo.** One maximises repeat revenue; the other is the thing no competitor can copy. Together they're a sharper wedge than trying to out-feature Zepto on speed.

---

*Sources:* Zepto ([features](https://miracuves.com/blog/what-is-zepto-app-and-how-does-it-work/), [Super Saver / Pass](https://www.newsbytesapp.com/news/business/zeptos-super-saver-feature-gets-a-makeover/tldr)), Swiggy Instamart ([tracking](https://en.wikipedia.org/wiki/Swiggy)), BigBasket ([bbstar](https://www.bigbasket.com/bbstar/), [Smart Basket](https://www.bigbasket.com/member/smart-basket/)), Lidl Plus ([app](https://apps.apple.com/us/app/lidl-plus/id1238611143), [points change](https://www.teltarif.de/en/lidlplus-kundenprogramm-aenderung/news/103671.html)), Kaufland ([app](https://play.google.com/store/apps/details/Kaufland_App_Supermarket_Offers_Shopping_List?id=com.kaufland.Kaufland&hl=en_US)), q-commerce ETA/gamification ([Uber](https://www.uber.com/de/blog/live-order-tracking)).
