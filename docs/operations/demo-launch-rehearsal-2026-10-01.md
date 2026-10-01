# Hosted demo launch rehearsal — 1 October 2026

The owner confirmed project `bjevoybwufubtprkxbvb` contains demo data.
PR #9 is merged at `7711bfa8`; both main-branch CI runs passed and Vercel
automatically deployed that revision to `farmersfresh.vercel.app`.

## Completed checks

- Hosted backend COD: three synthetic orders, one fulfilled through confirmed,
  packed, out-for-delivery and delivered; two cancelled. Repeating cancellation
  released stock once. Catalogue price plus delivery fee was authoritative.
- Staff could fulfill their assigned store's order. Another store's order was
  hidden by RLS, and both status/cancellation RPCs returned authorization errors.
  Anonymous staff actions were denied. Stock ended at 19 and 20 units; three
  order-placement audit records were present.
- Synthetic organization `c0c5c1a3-b513-4a43-b839-83305dc33a26` is hidden from
  the storefront, and its two accounts are banned. Append-only order/stock/event
  evidence remains. Messaging provider keys were absent before this rehearsal.
- Hosted Auth and image checks passed on the secured preview. A synthetic image
  was downloaded, removed, restored and downloaded again; SHA-256 bytes matched.
  Upload authorization and invalid-image rejection also passed. The temporary
  account, organization and file were removed.
- An owned temporary Vercel alias routed to a known-good deployment, then a
  candidate. A deliberately unauthenticated/unconfigured metrics check failed
  closed. Routing back restored login and catalogue HTTP 200 in **29.1 seconds**.
  The temporary alias was removed; existing live aliases were unchanged.
- The owner approved expanding the demo service-role and monitoring secrets from
  the preview branch to encrypted production-scope server settings. The merged
  revision was redeployed as `farmers-fresh-csek769as-venkatasudas-projects.vercel.app`.
  On `farmersfresh.vercel.app`, metrics returned **200** with the token and **401**
  without it; login and catalogue returned **200**. This is still a demo release.

## Repeat safely

`scripts/ci/verify-demo-orders.mjs --confirmed-demo` takes demo CLI API-key JSON
on stdin and refuses configured outbound notification providers. It only targets
the approved project and retains ledger evidence in a hidden synthetic organization.

`scripts/ci/verify-demo-auth.mjs <secured-preview-url>` also takes keys on stdin.
It restores only its synthetic object; it does not touch existing customer files.

`scripts/ci/verify-demo-rollback.mjs <good-deployment> <candidate-deployment>`
accepts existing Farmers Fresh team deployment URLs and uses a new temporary alias.
Reports are written to ignored `reports/`; credentials never appear in them.

## Remaining acceptance

These checks exercise hosted backend rules and application routing. Actual staff
must still complete the UI/delivery/reconciliation rehearsal. Image byte recovery
in the same project does not prove off-site backups, a replacement database,
Vault/auth key recovery or storage-wide restoration. The routing drill does not
reverse migrations or prove recovery of corrupted business data.

Next: provide a persistent monitoring host and an alert recipient/provider. Real notification
delivery needs configured providers and selected test recipients. Razorpay
capture/refund acceptance needs an account; COD remains the launch path meanwhile.
Hosted peak-traffic measurement and isolated disaster recovery remain pending.
