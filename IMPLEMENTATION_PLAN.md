# Pro Stack Creations — Implementation Plan (Phase 0)

Status: Phase 0 complete (audit + plan). No application code exists yet.

## 1. Repository inventory

- Workspace: **empty folder** (confirmed by owner). No package.json, lockfile, README, configs, env files or existing components.
- Risks from an empty start: none destructive. Main risk is picking incompatible versions, handled in section 2.
- Design inputs (read-only): 6 Atelier-branded HTML mockups + master prompt. See `design-references/REFERENCE_NOTES.md`.

## 2. Stack summary (verified against official docs, Oct 2026)

| Layer         | Choice                                                                                             | Why / source                                                                                            | Needed                |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------- |
| Framework     | Next.js **16.x** (App Router, Active LTS). Pin the exact version `create-next-app@latest` resolves | Next 15 hits end-of-life 21 Oct 2026; start on 16                                                       | Phase 1               |
| Runtime       | Node.js 20+ (24 LTS recommended)                                                                   | Mongoose 9 and Next 16 need modern Node                                                                 | Phase 1               |
| Styling       | Tailwind CSS v4 + CSS variable tokens                                                              | Matches the mockups (already Tailwind v4)                                                               | Phase 1               |
| UI primitives | shadcn/ui (Radix), lucide-react                                                                    | Project-owned components                                                                                | Phase 1               |
| Font          | Roboto via `next/font/google`                                                                      | Self-hosted at build; mockups use a CDN link, we will not                                               | Phase 1               |
| Theme         | next-themes (light/dark/system)                                                                    | Hydration-safe                                                                                          | Phase 1               |
| Toasts        | sonner, restyled to the toast reference                                                            |                                                                                                         | Phase 1               |
| Database      | **MongoDB Atlas**                                                                                  | Owner requirement                                                                                       | Phase 1 (client only) |
| ODM           | **Mongoose 9.x** + Zod                                                                             | Prisma 7 does not support MongoDB yet; Prisma 6.19 would need a later migration (see DECISIONS ADR-001) | Phase 1 foundation    |
| Auth          | Better Auth + MongoDB adapter (`@better-auth/mongo-adapter`)                                       | Adapter exists; pass the MongoClient to enable transactions                                             | Phase 3               |
| Validation    | zod, react-hook-form, @hookform/resolvers                                                          |                                                                                                         | Phase 1-2             |
| Media         | Cloudinary                                                                                         | Signed uploads                                                                                          | Phase 6               |
| Email         | Resend + React Email                                                                               |                                                                                                         | Phase 3/4             |
| Realtime      | socket.io in separate `apps/realtime`                                                              | Needs a persistent host                                                                                 | Phase 7               |
| Tests         | Vitest + RTL, Playwright                                                                           |                                                                                                         | Phase 1 / 3+          |
| Logging       | Pino with redaction                                                                                |                                                                                                         | Phase 1               |
| Motion        | `motion` only where it adds value                                                                  | CSS transitions first                                                                                   | Later                 |
| Not now       | Redis/Upstash, TanStack Query/Table, Recharts, dnd-kit, Sentry                                     | Added when a feature needs them                                                                         | Later                 |

Rate limiting before Redis: a MongoDB-backed limiter (TTL index) is enough for Phase 2 contact form on a single region.

## 3. Route map

As in master prompt section 7. Order of delivery: public (Phase 2) -> auth (3) -> portal/admin foundations (4-5) -> CMS (6) -> realtime (7). Invoices/payments routes are **excluded** (ADR-007).

## 4. Initial data model (MongoDB)

Collections, grouped by phase. IDs are ObjectId; all docs have `createdAt`, `updatedAt` (UTC); business-critical docs have `archivedAt` (soft delete).

- **Auth (Better Auth-managed):** user, session, account, verification, twoFactor.
- **Phase 2:** `leads` (referenceCode, name, email, company?, projectType, budgetRange?, timeframe?, message, status, source, ipHash, createdAt), `rateLimits` (key, count, expiresAt TTL), `services`, `caseStudies`, `faqItems`, `siteSettings`.
- **Phase 4:** `organizations` (members embedded as `[{userId, role}]`), `leadActivities`, `proposals` (items embedded), `projects` (`organizationId`, memberIds), `milestones`, `deliverables` (reviews embedded), `auditLogs`.
- **Phase 6:** `pages` (blocks embedded, typed), `pageRevisions`, `blogPosts`, `mediaAssets`, `slugRedirects`, `teamMembers`, `testimonials`.
- **Phase 7:** `notifications` (recipientId, type, entityRef, readAt, dedupeKey), `notificationPreferences`, `conversations`, `messages`, `outbox`.

Modelling rules for MongoDB (no foreign-key enforcement):

1. Embed what is always read together and bounded (proposal items, page blocks, deliverable reviews).
2. Reference what grows or is shared (projects -> organization, milestones -> project, messages -> conversation).
3. Referential integrity and ownership checks live in the service layer. Every client-facing query filters by `organizationId`/membership.
4. Unique indexes: `leads.referenceCode`, `services.slug`, `caseStudies.slug`, `pages.slug`, `slugRedirects.from`. Compound indexes added per query.
5. Multi-document transitions (proposal accepted -> project created -> audit log) use Mongo transactions, which **require Atlas (replica set)**.

## 5. Roles and permissions matrix

| Capability                      | Visitor | Client        | Support  | Content mgr | Developer | Project mgr | Admin         | Owner   |
| ------------------------------- | ------- | ------------- | -------- | ----------- | --------- | ----------- | ------------- | ------- |
| View public content             | Y       | Y             | Y        | Y           | Y         | Y           | Y             | Y       |
| Submit inquiry                  | Y       | Y             | -        | -           | -         | -           | -             | -       |
| Own org projects/files/messages | -       | own org only  | -        | -           | -         | -           | all           | all     |
| Leads: read/triage              | -       | -             | Y        | -           | -         | Y           | Y             | Y       |
| Proposals: create/send          | -       | respond (own) | -        | -           | -         | Y           | Y             | Y       |
| Projects: manage                | -       | view own      | read     | -           | assigned  | Y           | Y             | Y       |
| Content/SEO: edit               | -       | -             | -        | Y           | -         | -           | Y             | Y       |
| Content: publish                | -       | -             | -        | Y           | -         | -           | Y             | Y       |
| Users/roles                     | -       | -             | -        | -           | -         | -           | Y (not owner) | Y       |
| Settings, audit logs            | -       | -             | -        | -           | -         | -           | Y             | Y       |
| 2FA required                    | -       | optional      | optional | optional    | optional  | optional    | **yes**       | **yes** |

Default deny. Policies live in `server/policies/` and are called by every service and action.

## 6. Deployment diagram

```
Browser
  |-- HTTPS --> Next.js web app (public site + /portal + /admin + server actions)
  |                 |-- MongoDB Atlas (replica set, backups, least-privilege user)
  |                 |-- Cloudinary (signed uploads, private delivery for client files)
  |                 |-- Resend (email, via outbox)
  |-- WSS ----> apps/realtime (Socket.IO, persistent Node host)   [Phase 7]
                    |-- verifies session token, reads Atlas for room membership
```

Hosting: web app can go on Vercel or any Node host; realtime service must go on a host with long-lived connections (Railway, Render, Fly.io, VPS). Independent deploys.

## 7. Phase backlog and acceptance criteria

**Phase 1 — Foundation and design system.** Next 16 + TS strict + Tailwind v4; ESLint, Prettier, `tsc --noEmit`, Vitest, `next build`; Roboto via next/font; tokens from the Atelier palette plus a designed dark theme; components: Button, Input, Textarea, Select, Checkbox, Radio, Switch, Dialog, Tabs, Badge/StatusPill, Card, Table, EmptyState, ErrorState, Skeleton, PageHeader, FormField, ThemeSwitcher, toast; three shells (public header/footer, portal light sidebar, admin dark sidebar) with mobile drawer navigation; `not-found`, `loading`, `error`; `lib/env.ts` (zod), Pino logger, Mongo client singleton (no models yet). _Accept:_ lint, type-check, test, build all pass; shell/theme render test passes; no theme flash; keyboard-navigable shells; zero secrets in repo.

**Phase 2 — Public site + SEO.** Home, services, work + case study, about, process, FAQ, contact. Contact form validated, persisted, rate-limited, reference code shown. Metadata, sitemap, robots, JSON-LD. Demo content labelled. _Accept:_ Lighthouse >= 90 (a11y/SEO), form tests, private paths noindex and absent from sitemap.

**Phase 3 — Auth.** Better Auth, verify/reset, sessions, invitations, owner bootstrap CLI, admin 2FA, policy helpers. _Accept:_ tests prove visitor/client/admin boundaries and cross-client isolation.

**Phase 4 — CRM/proposals/projects.** Leads pipeline, organizations, proposals, conversion in a transaction, milestones, deliverables, audit logs. _Accept:_ invalid transitions rejected; audit entries written.

**Phase 5 — Portal + admin operations.** Dashboards, tables with search/filter/pagination, deliverable review, user/role admin. _Accept:_ end-to-end flows on seeded demo data.

**Phase 6 — CMS/media/SEO.** Typed block editor, drafts, revisions, Cloudinary signed uploads, slug redirects, revalidation. _Accept:_ content manager publishes a case study with no code change; malformed blocks do not crash public pages.

**Phase 7 — Notifications/messages/realtime.** Durable notifications first, then messages, then Socket.IO service. _Accept:_ unauthorized joins rejected; app works with realtime offline.

**Phase 8 — Hardening.** CSP/headers, E2E + security regression, a11y audit, backup/restore runbook, deployment workflows, error tracking, docs. _Accept:_ clean prod build, documented test report.
