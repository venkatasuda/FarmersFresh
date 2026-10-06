# Farmers Fresh product requirements

Status: working launch scope, reviewed 6 October 2026. This document defines
requirements; [TASKS](TASKS.md) records remaining acceptance work.

## Purpose and users

Farmers Fresh serves an Indian grocery and own-farm meat business with online
shopping and store operations. Customers need dependable purchases and clear
order status. Owners, store managers, staff, riders and accountants need access
to the records and actions permitted by their role and location.

The [staff hierarchy and permission matrix](STAFF_ACCESS.md) defines target
responsibilities, store/company scope and approval boundaries. It distinguishes
existing roles from access still requiring implementation.

## Initial launch

Launch with cash on delivery. Enable online payments only after Razorpay
credentials and capture, webhook, cancellation and refund acceptance pass.

| Area | Required launch behavior |
| --- | --- |
| Catalogue | Customers see enabled products, accurate prices, availability and pack/weight information. |
| Checkout | The backend calculates totals, fees and discounts; insufficient stock is rejected; retries cannot duplicate the same purchase. |
| Customer accounts | Customers can sign in and access only their own addresses, orders and account records. |
| Order tracking | Customers see confirmed, packed, out-for-delivery and delivered progress in their account. A moving rider map is outside initial scope. |
| Store operations | Authorized staff process orders, assign delivery and handle POS stock without overselling shared inventory. |
| Returns and money | Staff record decisions and reconcile balances; wallet credit is clearly distinguished from an original-payment refund. |
| Notifications | Order email delivery is configured and tested. SMS, WhatsApp and other provider channels require separate acceptance before being promised. |
| Uploads | Only authorized uploads with allowed content and size reach storage; access follows the appropriate policies. |
| Monitoring | Operational failures are visible to permitted managers/owners and reach the agreed alert inbox. |
| Recovery | Encrypted off-site database and file backups can be restored and verified, with recovery instructions and independently retained decryption credentials. |

## Non-functional acceptance

- Enforce organization, store and customer boundaries in database RLS and RPCs.
- Keep stock, money and multi-step order changes transactional, with immutable audit events.
- Validate untrusted inputs, limit abuse and avoid exposing credentials or private error details.
- Rehearse order, delivery, cancellation, return and reconciliation workflows with staff.
- Measure realistic hosted traffic against an agreed peak; local CI load tests alone do not establish capacity.
- Pass release checks, record deployment rollback evidence and identify the person responsible for recovery.
- Agree maximum tolerable data loss and downtime before selecting the production backup schedule.

## Deferred work

Razorpay activation, additional messaging providers, live rider maps and advanced
automation can follow customer demand and verified operating capacity. Existing
membership, subscription and loyalty code needs its own workflow acceptance
before inclusion in advertised launch features.

## Definition of launch readiness

The owner accepts the completed COD workflow evidence, permissions, alerts,
backup/restore and release checks. Open blockers have an explicit resolution or
scope decision. Provider integration code and a passing build alone are not
launch acceptance. Refer to [launch tasks](TASKS.md) and the linked runbooks.
