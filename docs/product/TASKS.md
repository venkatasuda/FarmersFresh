# Farmers Fresh launch tasks

Updated 6 October 2026 from recorded session evidence. This is the main launch
list. Recheck current CI and hosted configuration before marking any task done.

## Next, in priority order

| Priority | Task | Acceptance / current blocker |
| --- | --- | --- |
| 1 | Finish encrypted off-site backups | Private B2 bucket created; restricted key creation did not execute because automatic approval review hit a usage limit. Connect encrypted database and Storage object backups, retain the decryption password separately, verify a downloaded restore and agree retention/cost limits. |
| 2 | Resolve recovery PR release blocker | PR #13 remains unmerged in the last recorded check. Its dependency gate found the unpatched braces advisory GHSA-vfj7-8cjw-p6xm through Next.js ESLint tooling. Recheck upstream and CI; do not silently weaken the gate. |
| 3 | Rehearse hosted recovery and rollback | Restore to an isolated replacement environment with outbound jobs disabled; compare records, files, login and permissions. Record measured recovery time and agreed data-loss target. |
| 4 | Complete human staff acceptance | Follow the staff runbook for COD orders, POS, delivery, returns, reconciliation and store permissions. Record results and fix failures. |
| 5 | Verify realistic hosted capacity | Agree expected simultaneous users and orders/minute, then measure hot products and competing order workflows in an isolated environment. |
| 6 | Provide continuous monitoring | Local Docker monitoring depends on the computer staying awake and Docker running. Verify the chosen always-on arrangement and alert delivery before relying on it for launch. |
| 7 | Review, merge and deploy accepted changes | Pass current release gates, review the final PR and repeat hosted smoke checks after deployment. |

## Recorded evidence already available

- Monitoring portal code merged in PR #12; owner/manager data is scoped by organization and store.
- Resend order email delivered to the approved test inbox; monitoring SMTP replacement-key delivery also passed.
- Local recovery rehearsal restored 1,912 records across 91 tables and verified row hashes, sequences, owner login and a synthetic image copy. This does not prove a full hosted/off-site restore.
- Local CI includes database permission/concurrency checks and a COD write-load baseline; hosted peak acceptance remains open.
- Razorpay integration code exists; provider payment and refund acceptance remain pending.

## Staff access development

Follow the [staff permission matrix](STAFF_ACCESS.md). First reconcile existing
manager/accountant database permissions with owner-only page guards. Then add
the minimum store roles, approval workflows and scoped dashboards, with direct
RPC and cross-store denial tests. Executive titles must not automatically grant
the owner flag. The hierarchy document defines requirements, not completed access.

## Later activation

- Create the Razorpay account, configure test credentials and complete the [payment acceptance](../operations/payments.md) checklist before enabling online payments. COD launch can proceed without it once the other launch gates pass.
- Configure and verify additional notification providers only when those channels enter launch scope.
- Prioritize feature expansion from customer demand after reliable daily operations are established.

## Evidence and ownership

Use [recovery](../operations/recovery.md), [staff workflows](../operations/staff-workflows.md),
[performance](../operations/performance.md) and [monitoring](../operations/monitoring.md)
for execution steps. Record the date and result when completing a task; retain
sanitized evidence and assign an operational owner. Never put credentials or
private backup contents in this file.
