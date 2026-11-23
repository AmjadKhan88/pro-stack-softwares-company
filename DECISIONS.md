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

## ADR-010 — Client tenancy: one organization per client account

- A client account belongs to exactly one organization (unique index on the membership's userId).
- Client-facing code obtains the organization id only from `requireClientContext()` (derived from the signed-in account) and scopes every query to it. Ids from URLs or forms are never trusted for tenancy.
- Clients can only be invited into an organization, and staff cannot be. If linking fails at invitation acceptance, the account is linked on first portal visit from the accepted invitation.
- Multiple organizations per user can be added later by relaxing the unique index and adding an organization switcher.

## ADR-011 — Deliverable review is a state machine with an append-only history

- Each deliverable has a review state (not submitted, in review, changes requested, approved). Staff submit/withdraw; only the client approves or requests changes; approved is final and also marks the deliverable delivered.
- Every step is written to a review-event history (shown to both sides, names only) and to the audit log, in the same transaction as the state change.
- The client action derives the organization from the signed-in account and loads the deliverable through the organization-scoped project filter, so another organization's deliverable is indistinguishable from a missing one.
- File attachments are deferred to Phase 6 (Cloudinary); messaging to Phase 7.

## ADR-012 — Project access: role scope plus team assignment

- projectAccessScope(role) is "all" (read.all roles), "assigned" (read.assigned roles) or "none". Developers have scope "assigned": they can read a project only if a ProjectMember record exists for them.
- Every staff page about one project calls requireProjectAccess(id); lists use visibleProjectIds(user). Failures are 404, never 403, so project ids can't be probed.
- Access needs BOTH the role's scope and the membership; changing someone's role makes old assignments inert.
- Team changes need projects.manage, are audited in the same transaction, and removal stays possible on closed projects.
- Menu visibility (filterNavForRole) is presentation only; the server enforces every page and action.

## ADR-013 — Account administration only through our own screens

- The Better Auth admin plugin's raw HTTP endpoints (/api/auth/admin/*) are closed with a before-hook. Account changes (role, disable/enable) happen only through our server actions, which apply our rules first (pure, tested functions) and then change the user record, delete sessions / project assignments and write the audit record in ONE native MongoDB transaction.
- Rules: only owner/admin; nobody changes their own role or status; owners are protected (admins can never touch them; the last active owner can't be changed by anyone); admins can't touch or grant admin; ownership is never granted here; client accounts never switch to or from staff roles.
- Disabling uses Better Auth's own `banned` flag and deletes all sessions immediately. Moving to a role that can't be on project teams removes team memberships.
- Linking an existing client account to an organization needs clients.manage and is audited; one organization per account.

## ADR-014 — Dashboards are role-scoped summaries over the same access rules as the lists

- dashboardSections(role) (pure, tested) decides which numbers a role gets; each is built from data that role may open elsewhere. A developer's project numbers use visibleProjectIds(), the same rule as the project list.
- The client overview starts from the organization on the signed-in account and re-derives deliverables from that organization's projects.
- Client project requests create a lead already linked to the client's organization (source "client-portal", requestedBy set from the session), rate-limited to 5 per person per day, with the lead, history note and audit entry in one transaction.
- Clients see requests in plain wording (Received / In review / Accepted / Closed), never the internal pipeline.
- Demo data is marked isDemo, named "[Demo] ...", uses @demo.invalid accounts, requires typing the database name, and refuses to run in production or with indexing enabled.

## ADR-015 — Content is edited as drafts and published as snapshots

- ContentEntry holds an editable draft and a separate published snapshot. Public pages read only the snapshot, through "use cache" functions tagged per content type; publishing/unpublishing call updateTag() in the server action so the website refreshes immediately.
- A save increments draftVersion; saves, restores and publishes carry the version the editor saw, so a stale window can't overwrite a colleague or publish unreviewed text.
- Saving allows incomplete drafts; publishing runs validateForPublish(). Case-study outcomes are published only with an explicit "these are real" confirmation, and rendering re-checks the flag.
- The live address (publishedSlug) changes only on publish; changing it creates a permanent redirect pointing at the entry, so renames never chain. Unpublishing removes the page.
- Content is plain text and lists, never HTML. Public mapping is defensive: malformed stored data is skipped, not rendered broken.
- Lifecycle: draft, published, archived. No hard deletes. Archive only from draft.
- Real published content replaces sample content per type; sample content is never shown once NEXT_PUBLIC_ALLOW_INDEXING=true.
- next build reads published content from MongoDB (the build needs the database).
- Audited: create, publish, unpublish, archive, unarchive, revision restore. Every save is in the revision history with who and when.

## ADR-016 — Media: server-chosen names, server-verified uploads, public library

- Uploads follow: authenticate + authorize (content.edit) + rate limit -> validate declared type/extension/size -> create a one-use, 20-minute ticket bound to the uploader with a SERVER-chosen random public id (psc/site/<24 hex>) -> signed (SHA-256) direct browser upload -> the server asks Cloudinary's Admin API what was actually stored and verifies type, format, size, dimensions, name and cloud -> only then records the asset. A failed check deletes the file from Cloudinary.
- The browser never supplies a URL or public id as proof of anything; the database record is built from Cloudinary's own answer. The API secret never leaves the server.
- Allowed: JPEG, PNG, WebP, <= 5 MB, 100-6000 px. SVG is excluded (scriptable).
- Content references images by asset id; public pages resolve them at render time inside the cached read (tagged "media"), so alt-text changes and archiving apply without republishing. Images in use cannot be archived. Nothing is hard-deleted.
- Next.js image optimization is allowed only for this cloud's /image/upload path (images.remotePatterns). A report-only CSP already lists api.cloudinary.com and res.cloudinary.com; enforcement and nonces are Phase 8.
- The library is public delivery. Confidential client files use private, signed delivery (Part 6D).
- Share images are delivered as 1200x630 cropped transformations; a page's own image is used when no share image is set.

## ADR-017 — Pages and articles are typed blocks; rich text is a tiny safe language

- Articles and pages are lists of up to 40 blocks of five types (rich text, image, process steps, technology list, call to action), validated strictly on save and for completeness on publish. No raw HTML, scripts or embeds. Testimonials/team/logos/metrics are deferred until real content exists.
- Rich text is parsed by our own small parser into plain data and drawn as React elements, so nothing can become markup. Links are limited to this site, https, mailto and tel; unsafe addresses keep the words and lose the link. Covered by parser, renderer and hostile-input tests.
- FAQ entries are content entries with a private random address and an order number; real entries replace sample ones; FAQ structured data comes only from real entries.
- Pages live at top-level addresses; addresses the site already uses are refused, except "about" and "process", where a published page replaces the built-in one.
- Template text marks unfinished parts as [[placeholders]]; any article, page or FAQ containing one cannot be published. Privacy and Terms are generated as DRAFT templates from what the platform actually does, never published automatically, and need legal review.
- The footer links to Privacy, Terms and Insights only when those pages exist. Insights has no sample content.
- Redirect lookups use one cached map per content type, so guessed addresses can't fill the cache.
- The editor's fields are rebuilt whenever the saved content changes, so restoring a version can never leave stale text behind.

## ADR-018 — Project files are private, authorized on every download, and proxied
- Files are uploaded straight to Cloudinary as type "authenticated" (no public address), under server-chosen random names (psc/files/<24 hex>), using one-use 20-minute tickets bound to the uploader, with the same server-side verification as the media library plus a check that the stored file really is private. Failures are deleted.
- Allowed: PDF, PNG, JPEG, WebP, <= 10 MB. Office files and archives are excluded (macros, executables, unverifiable behaviour).
- Staff with projects.manage upload and manage; files are hidden from clients by default and shown explicitly (audited). Hiding a deliverable hides its files.
- Every download goes through /api/files/<id>, which decides on EVERY request: clients need their own organization (from the account), an active, visible file, and a visible deliverable if attached; staff need project read access (developers: assigned). A refused file is indistinguishable from a missing one (404); signed-out is 401.
- Only after that does the server request a signed Cloudinary link valid for 60 seconds, fetch the file itself and stream it with the original name and Content-Disposition: attachment. No Cloudinary address ever reaches a browser, so a copied link can't be shared. Downloads are rate-limited and logged.
- The SEO overview is a pure, tested checklist over the published snapshots (descriptions, titles, sharing images, noindex, duplicates), linking to the editors.