# Staff launch rehearsal

Use synthetic customer accounts and Razorpay test mode. Record the order/sale
number and corresponding audit event for each step. A visible button is not
proof of permission: database tests separately enforce role and store boundaries.

The [staff hierarchy and permission matrix](../product/STAFF_ACCESS.md) defines
target delegation. Existing database role labels are listed below; several
manager/accountant routes still require the owner flag, so complete a route/RPC
audit before claiming the intended permissions are fully available.

| Existing role label | Intended responsibility | Target scope to verify |
| --- | --- | --- |
| Owner | Organization administration | Own organization |
| Manager | Catalogue, stock adjustment, orders, purchasing, delivery assignment, coupons | Assigned stores |
| Staff | Orders and delivery assignment | Assigned stores |
| Accountant | Financial reporting | Organization reporting |
| Customer | Own customer workflows | Own records |

## Orders and delivery

1. Place COD and paid test orders; find their numbers in `/dashboard/orders`.
   Check prices, delivery fee, discounts and reserved stock against the receipt.
2. Follow confirmed → packed → out for delivery → delivered. Assign through
   `/dashboard/deliveries`; the rider uses `/dashboard/delivery`. Verify the
   customer tracking page and timestamps after each transition.
3. Repeat a request after a simulated network timeout. The order must not
   duplicate, stock must not be released twice and money must not be credited twice.
4. Test a different store's order with a restricted staff account. Reads and
   writes must be denied by the database, including direct RPC calls.

## Returns and reconciliation

1. Submit a return through the customer workflow; review in `/dashboard/returns`.
   Approve or reject once, with a reason. Wallet points are credit, not a gateway
   cash refund; tell the customer which remedy was issued.
2. For a cancelled prepaid order, use **Refund original payment / check status**
   in `/dashboard/orders`. A pending submission is not completion; check again
   later and compare the final status with Razorpay's test dashboard. Signed
   refund webhooks also reconcile it. Repeated clicks reuse the request; a
   failed refund requires provider review. Never mark it refunded manually.
3. Compare provider captures/refunds with order totals and wallet/sale records in
   `/dashboard/financials`, `/dashboard/sales` and `/dashboard/credit`.
   Escalate unmatched payments, amount discrepancies and paid-after-cancel events.
4. POS and online/subscription purchases share stock. Confirm counter-sale stock
   and payments before promising delivery. Never work around an insufficient
   stock/credit rejection by editing ledger rows.

## Daily opening and closing

Opening: review pending refunds, stuck orders, failed/skipped notifications and
low stock; confirm the monitoring target is up. Review `/dashboard/stock`,
`/dashboard/expiry` and `/dashboard/wastage` before replenishing.

Closing: reconcile payments and cash, resolve outstanding delivery exceptions,
and confirm the latest backup completed. Assign an accountable person and a
response deadline to each unresolved incident. Rehearsal sign-off remains pending
until actual staff complete these steps and attach their test evidence.
