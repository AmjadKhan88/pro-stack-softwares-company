# Decisions

## ADR-001 — MongoDB with Mongoose (not Prisma, not PostgreSQL)

- **Context:** Owner requires MongoDB. Master prompt assumed PostgreSQL + Prisma. Prisma ORM 7 does not support MongoDB yet; Prisma docs say to stay on 6.19.
- **Decision:** Use MongoDB Atlas with **Mongoose 9.x**, validated by Zod at the boundary. Models stay in `features/<domain>/models`, accessed only through services.
- **Trade-offs:** Loses Prisma's relational constraints (replaced by service-layer checks and indexes). Avoids building on a Prisma line that will need a second migration. Mongoose 9 needs Node 20+.
- **Revisit:** if Prisma ships stable MongoDB support in v7 and we want its tooling.

## ADR-002 — Better Auth with MongoDB adapter

- Official MongoDB adapter exists; no schema migration needed. We pass the `MongoClient` so transactions are enabled. Verify exact package/version at install (Phase 3) and record it.
- Fallback if blocked: Auth.js with the MongoDB adapter.

## ADR-003 — Atlas required (not a standalone local mongod)

- Transactions need a replica set. Atlas free/shared tiers provide this and give automated backups. Local dev can use Atlas too, or a single-node replica set via Docker.

## ADR-004 — Visual language comes from the supplied references

- Use the bone/ink/ember/pine/ochre palette instead of the prompt's blue/teal suggestion (the prompt allows adjusting to your references).
- References are light-first; **we will design a dark theme** and raise the smallest text (mockups use 9-10px) to a 12px minimum for body UI, to meet readability and WCAG contrast.

## ADR-005 — Branding

- All "Atelier / Nova Ventures / Meridian / Yara" etc. are mock data and are replaced with **Pro Stack Creations**. No fake clients, numbers or testimonials ship; demo content is labelled and removable.

## ADR-006 — Invoices and payments deferred

- Shown in the client mockup but out of scope per the prompt. No sidebar entries until separately scoped.

## ADR-007 — Rate limiting without Redis (initially)

- MongoDB TTL-backed limiter for contact/login in early phases. Move to Redis/Upstash only if multi-region or throughput requires.

## ADR-008 — Phase 1 delivery mechanism

- I cannot touch your local folder from chat. Phase 1 will be built and verified (lint, type-check, test, build) in my sandbox and delivered as a zip to extract into your empty folder. Alternative: you run the scaffold commands I give and paste results.

## Open questions for the owner

1. Domain name and hosting preference (Vercel vs VPS)?
2. Services list and positioning (see CONTENT_NEEDED.md).
3. Will clients self-register, or invitation-only? (Recommendation: invitation-only.)

## ADR-009 — Phase 2 content is typed demo data behind a repository

- Content lives in `src/features/content/demo-data.ts`, accessed only through `repository.ts`. Phase 6 replaces the internals with MongoDB; pages do not change.
- All records carry `isDemo: true`. Sample case studies must not contain outcomes (enforced by a test). Sample detail pages are `noindex`.
