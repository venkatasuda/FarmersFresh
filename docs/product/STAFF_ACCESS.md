# Staff hierarchy and access requirements

Working requirements approved for planning on 6 October 2026. The target matrix
below is not implemented authorization. Current launch work is in [TASKS](TASKS.md).

## Organization

```text
Company owner / CEO
  Operations lead / regional manager
    Store manager
      Cashier
      Order fulfilment employee
      Inventory employee
      Delivery rider
  CFO / finance lead
    Accountant
  CMO / marketing lead
    Marketing employee
```

This describes reporting responsibility. Reporting to someone does not give
them that person's permissions. Job titles and access roles are separate: a
founder may hold several roles, while an employed CEO need not be the security
administrator. Regional access means an explicit set of assigned stores.

## Target permission matrix

An action absent from this table is denied until explicitly defined. All access
also requires a signed-in active staff account in the correct organization.

| Access role / typical title | Allowed work | Scope | Restricted work |
| --- | --- | --- | --- |
| Cashier | Create POS sales, issue receipts, record own cash closing | Assigned store and own shift | No refund approval, price administration, stock adjustment or company finance |
| Fulfilment / store employee | View relevant orders, confirm/pick/pack and request dispatch | Assigned store | No payment settlement, refund approval, staff access or unrestricted customer export |
| Inventory employee | Receive approved deliveries, record counts, report expiry and request wastage/adjustments | Assigned store | No purchase approval, ledger edits, arbitrary adjustment approval or finance reports |
| Delivery rider | View assigned delivery details and record delivery outcome | Assigned deliveries only | No other riders' orders, customer history, stock, reports or staff administration |
| Store manager | Manage store queues and assignments; approve store operational exceptions; view store performance | Assigned store(s) | No other stores, company security settings or self-granted access |
| Regional operations manager | Review operations and approve allowed exceptions across assigned stores | Explicit store assignments | No automatic organization-wide finance or security administration |
| Accountant | View scoped finance and reconciliation; prepare closing and exception reports | Assigned stores or explicitly granted company scope | No staff access, stock operations, payment status edits or automatic refund approval |
| Finance approver / CFO | Review company finance and approve refund/closing exceptions through controlled workflows | Explicit company finance scope | No service credentials, database administration or automatic operations privileges |
| Marketing / CMO | Manage approved campaigns, banners and offers; view aggregate customer insights | Company marketing scope | No payment, wallet or stock edits; no unrestricted personal-data exports |
| Executive viewer / CEO | View company operational and financial summaries | Company reporting scope | No automatic operational writes or security administration |
| Owner / access administrator | Assign approved access and scope; review company oversight and audit history | Own organization | No cross-organization access, audit deletion or manual provider-payment settlement |

Customer accounts remain separate and access only their own customer records.
Delivery details expose only the contact/address information needed for the
assigned job. Marketing reporting uses aggregates by default.

## Approval rules

- Employees submit stock-adjustment, wastage and cash-discrepancy requests;
  authorized managers approve them with a reason. Counts are observations, not
  permission to overwrite stock. Transfers require source and destination scope.
- Refund execution requires an explicit finance permission and authoritative
  database/provider checks. Staff cannot mark an uncaptured payment paid or a
  pending gateway refund complete.
- Permission grants require an authorized access administrator; staff cannot
  elevate themselves or give access beyond the administrator's scope.
- Record requester, approver, action, scope, reason and time in immutable audit
  events. Approvals must be idempotent and reject unauthorized direct RPC calls.
- Routine approved sales and packing need no second person. For exceptions
  requiring separate approval, reject self-approval; a solo owner needs an
  explicitly audited exception policy. Amount limits and owner overrides remain
  business decisions, not assumed values.

## Existing implementation and gaps

`memberships` currently allows `owner`, `manager`, `staff` and `accountant`,
attached to locations. `profiles.is_owner` separately identifies an owner.
The session loads organization and location memberships. There are no dedicated
cashier, inventory, executive, finance-approver or marketing access roles yet.

Several routes, including financials, purchasing, expiry and wastage, currently
require the owner flag. This conflicts with the intended delegation above.
The monitoring entry allows owners and store managers, but visibility is not
proof that every operation has the required database permission.

Do not assign an executive the owner flag just to unlock reports, or describe
current broad `staff` access as rider-only or cashier-only access.

## Implementation order and acceptance

1. Inventory the current page, query, RLS and RPC permissions for each existing
   role. Decide the initial store roles and permitted actions from this matrix.
2. Implement the smallest coherent database change for store staff, manager and
   accountant scope. Keep transactions and audit events in database functions;
   use forward migrations rather than editing the baseline.
3. Align server authorization, navigation and landing pages with those database
   permissions. Use one portal with role-specific views and visible store scope.
4. Test permitted actions plus denial across organizations, stores, assignments,
   direct URLs and direct RPCs. Include revocation and self-elevation attempts.
5. Add executive and marketing permissions only alongside their actual workflows;
   never provision broad owner access as a temporary substitute.

See [staff rehearsal](../operations/staff-workflows.md) for operational journeys
and [security](../operations/security.md) for existing security procedures.
