# ADR-0001: Modular full-stack application

**Status:** Accepted
**Date:** 2026-09-30
**Deciders:** Project owner, through approval of the architecture reorganization

## Context

Storefront providers wrapped staff pages, backend modules were flat, and large
routes mixed data loading with presentation. Server Actions also contained backend
implementation and shared types. The business already relies on PostgreSQL RPCs
and RLS, which must remain reusable by future clients.

## Decision

Keep one Next.js application and one transactional database. Organize frontend
features and backend modules by domain. Keep shared contracts browser-safe. Use
route groups for storefront and staff layouts, with one minimal root layout.
Keep Server Actions and HTTP routes as explicit entry points into server modules.

## Options considered

| Option | Benefit | Cost |
| --- | --- | --- |
| Modular full-stack application | Clear boundaries with the existing deployment | Boundaries need CI enforcement |
| Separate frontend/backend repositories | Independent deployments and ownership | New API/versioning/deployment work |
| Microservices | Independent scaling of individual services | Distributed transactions and more operations |

## Consequences

UI and backend work are easier to locate and shared types cannot bring server
dependencies into browser code. Additional domains fit the same structure.
Database transaction defects remain defects until fixed and tested in SQL.
Revisit separate deployments when a domain has a measured operational or team
ownership need; directory count is not a reason to introduce services.
