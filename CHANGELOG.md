# Changelog

## Phase 1 — Engineering foundation and design system

- Next.js 16.4 (App Router, Cache Components), React 19, TypeScript strict, Tailwind CSS v4
- Roboto via next/font/google; light/dark/system theme (next-themes, no flash)
- Semantic design tokens from the supplied references, plus a designed dark theme
- UI kit: Button, Input/Textarea, FormField, StatusPill/Badge, Card, Table, EmptyState, ErrorState, Skeleton, PageHeader, Sheet drawer, toasts (sonner)
- Three shells: public (header/footer), client portal (light sidebar), admin (dark sidebar), with mobile drawer navigation
- Unbuilt routes render as disabled with a reason; portal/admin are noindex and show a "sign-in not available yet" notice
- Env validation (zod), pino logger with redaction, lazy Mongoose connection helper, /api/health
- Security headers; Vitest tests; ESLint + Prettier
