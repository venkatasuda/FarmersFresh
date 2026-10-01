# Module boundaries

| Layer | May depend on | Responsibility |
| --- | --- | --- |
| app | features, server, lib, components | Routes, metadata, parameter parsing, authorization and rendering |
| features | other features, lib, components; server in Server Components/actions | UI, browser state and Server Action entry points |
| server | server, lib, installed backend dependencies | Queries, operations, gateway adapters and privileged infrastructure |
| lib | lib and browser-safe dependencies | Shared contracts, pure helpers and browser Supabase client |
| components | components and lib | Shared presentation |

Every server module starts with `import "server-only"` except the proxy helper.
Client Components reach backend operations through explicit `"use server"`
adapters. Shared types belong in `lib/contracts/` or `lib/types.ts`; type-only
imports do not create a runtime dependency. Backend modules do not import features.

`npm run ci:boundaries` checks these constraints and protected-table writes.
Next.js compilation also rejects a client dependency on `server-only` modules.
The source checker is a lightweight check of explicit imports and write syntax;
it is not a replacement for database permissions or complete static analysis.

The payment order adapter retains one existing exception: attaching a Razorpay
order id with a conditional update. Settlement, stock and money still use database
functions. There is no blanket exemption for all API routes or payment code.

Add a domain folder when it owns actual operations. Keep a small domain in a few
files. Split queries and commands when that improves clarity; do not create empty
repositories, interfaces or packages in anticipation of future implementations.
