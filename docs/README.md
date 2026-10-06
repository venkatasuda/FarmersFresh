# Farmers Fresh documentation — start here

Use this page to find the main document for each topic. Code being present does
not mean a provider is configured or a workflow has passed launch acceptance.

## Folder map

```text
docs/
  README.md               Start here
  product/                PRD and current launch tasks
  design/                 Brand and UI rules
  features/               Storefront and visual-search guides
  architecture/           Application structure, data model and decisions
  engineering/            CI and development verification procedures
  operations/             Deployment, security, payments, monitoring and recovery
  archive/
    planning/             Earlier prompts, comparisons and architecture notes
    evidence/             Dated rehearsals and their original validation logs
```

## Main references

| Question | Read |
| --- | --- |
| What are we building, and what must work before launch? | [Product requirements](product/PRD.md) |
| What should we do next? | [Launch tasks](product/TASKS.md) |
| Who may use each staff feature? | [Staff hierarchy and permissions](product/STAFF_ACCESS.md) |
| How does the application work? | [Architecture overview](architecture/overview.md) |
| Where does code belong? | [Module boundaries](architecture/boundaries.md) |
| What rules must developers follow? | [Project rules](../AGENTS.md) |
| What should the interface look like? | [Brand and UI rules](design/BRAND.md) |
| Why were architecture choices made? | [Architecture decisions](architecture/decisions/0001-modular-full-stack.md) |
| How do I run the project? | [Project README](../README.md) |

## Operating and releasing the application

- [Deployment](operations/deployment.md) and [production CI](engineering/production-ci.md).
- [Security](operations/security.md) and [payment setup and acceptance](operations/payments.md).
- [Monitoring](operations/monitoring.md) and [backup/recovery](operations/recovery.md).
- [Staff workflows](operations/staff-workflows.md) and [capacity verification](operations/performance.md).
- [PWA operations](operations/pwa.md).

## Supporting material

The [backend model](architecture/data-model.md) describes inventory primitives;
the architecture overview remains the main application reference.
[Storefront setup](features/storefront.md)
and [visual search](features/visual-search.md) provide narrower feature context. Early
setup instructions must be checked against the current deployment guide and
complete migration chain before use.

[Build prompt](archive/planning/build-prompt.md), [company-side research](archive/planning/company-side-systems.md)
and [competitive roadmap](archive/planning/competitive-roadmap.md)
contain ideas and historical planning, not verified release status.
[Engineering validation](archive/evidence/validation-2026-09-18.md) and dated rehearsal reports
record evidence from specific runs; check current CI before releasing.
See the [archive guide](archive/README.md) for the dated evidence and logs.

## Keeping this useful

Update the PRD when product scope changes, TASKS when acceptance or blockers
change, and the relevant runbook when an operating procedure changes. Link to
existing rules and architecture instead of copying them into Rules.md or
Architecture.md. Record durable technical decisions in the decisions directory;
keep passwords, API keys, customer data and temporary chat history out of docs.
