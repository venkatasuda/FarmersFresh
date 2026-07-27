# Build prompt — "Farmers Fresh" grocery + own-farm meat platform

*Paste everything below into the other AI builder. It describes, in plain language, the full app to build — so you can compare what it produces against what we already have.*

---

Build me a complete online grocery shopping platform for a business called **Farmers Fresh**. It's an Indian grocery store that also raises and sells its own fresh meat (chicken, mutton, eggs). It should compete, feature for feature, with apps like Zepto, Swiggy Instamart, BigBasket, and the German supermarket apps (Kaufland, Lidl Plus). Theme: clean, professional, green-and-white, mobile-first. It must be fast, secure, and never lose or double-charge an order.

There are two sides: a **customer shopping app** and a **staff/owner back office**. Build both.

## Customer shopping app

**Browsing and search**
- Browse products by department (vegetables, fruits, rice & dal, spices, dairy, meat & eggs, etc.).
- Search with instant suggestions as you type.
- Product pages with photos, price, pack size, description, and star ratings & reviews from customers.
- A wishlist / favourites list.
- Promo banners on the home page, and a "This week's deals / offers" page with the biggest discounts first.
- "Recently viewed" and product recommendations ("goes well with this", "picked for you").

**Cart and checkout**
- Add to cart (supports both loose items sold by weight and packaged items).
- Checkout with delivery address (save multiple addresses).
- Two ways to pay: **Cash on delivery**, and **pay online now** (UPI / debit / credit card) — and the order is only confirmed after the money is actually received and verified. Online payment must go through a proper payment gateway; never store card details yourself.
- Apply coupon / promo codes.
- Delivery fee is free over a set amount, otherwise a flat fee — and the shop owner can change those numbers.
- After ordering: an order confirmation and a digital receipt (viewable on screen, printable, and emailed).

**Accounts and loyalty**
- Customer sign-up and login with email + password (email confirmation).
- A **loyalty points** program: earn 1 point for every ₹100 spent; 1 point = ₹1 off. Points can be spent at checkout.
- A **scannable QR loyalty card** on the account page that staff can scan at the physical counter to give/redeem points in store (like Lidl Plus / Kaufland Card).
- A **paid membership ("Pass")**: customers pay a fee to get free delivery on every order plus an extra discount on everything.
- Refer-a-friend: share a code, both get bonus points.
- "Scratch card" reward after each delivered order that reveals bonus points (a fun surprise).

**After ordering**
- **Live order tracking**: a status timeline, and when it's out for delivery, show the **rider moving on a live map with an estimated arrival time**.
- Reorder past items ("buy it again").
- **Subscriptions**: "subscribe & save" to get an item (e.g., milk, eggs) delivered daily / weekly / monthly automatically.
- **Back-in-stock alerts**: tap "notify me" on a sold-out item and get told when it returns.
- **Report an issue / return** on a delivered order; if approved, refund goes back as loyalty points.

**Notifications**
- Order updates and offers by email, SMS, WhatsApp, and **push notifications** (so it works even when the app is closed).
- The app should be **installable on the phone like a real app** (works offline for browsing, shows an app icon).

## Staff / owner back office

- **Counter POS (point of sale)** for walk-in sales that draws from the same stock as the website, with cash / UPI / card, and the ability to scan a customer's loyalty QR to earn/redeem points.
- A **credit ledger (khata)** for regular customers who pay later.
- A **live order board** that shows new online orders in real time with a sound alert.
- A **delivery / rider screen**: riders claim a delivery, navigate, and share their live location + set an ETA for the customer's map.
- **Stock management** with a running ledger, and low-stock warnings.
- A **business dashboard**: today's sales (online + counter), best-selling products, lowest stock, loyalty and subscription stats, repeat-customer count.
- **Product / catalogue management**, coupon management, banner management, delivery-area (pincode) management.
- A **settings page** for the owner: shop name, support contact, delivery-fee rules, GST number and business address for receipts.
- **Returns queue** to approve/reject customer issues and refund to points.
- **Marketing tools**: automatically remind customers who left items in their cart, and win back customers who haven't ordered in a while.
- **Food-safety traceability (internal only)**: register source farms, log each stock batch with its farm, batch code and harvest/cut date, and a **recall lookup** that lists which customers received a given product between two dates (so they can be contacted). Customers do NOT see farm names — only a general "quality assured & fully traceable" note.

## Non-negotiables
- Multiple staff roles and strong security: customers can only see their own data; staff only their shop's data.
- Everything real-time where it matters (order board, tracking).
- Prices and stock are always recalculated on the server — the customer's device can never change what they're charged.
- No fake claims (no invented "trusted by 100,000 customers"); everything shown must be real.

Build this as a modern, production-ready web app. Show me the live app and let me place a test order end to end.
