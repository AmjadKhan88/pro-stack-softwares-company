# Pro Stack Creations

Public website + client portal + admin workspace. Built phase by phase; see `IMPLEMENTATION_PLAN.md`, `DECISIONS.md`, `ENVIRONMENT.md`.

**Status:** Phase 1 complete (foundation + design system). No database models, auth or business features yet.

## Requirements

Node.js 20.19+ (24 LTS recommended) and npm. A MongoDB Atlas cluster is needed from Phase 2.

## Setup

```bash
npm install
cp .env.example .env.local   # fill values later; Phase 1 runs without a database
npm run dev                  # http://localhost:3000
```

## Scripts

| Command                               | Purpose                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                         | dev server                                                          |
| `npm run lint` / `typecheck` / `test` | quality checks                                                      |
| `npm run format` / `format:check`     | Prettier                                                            |
| `npm run build`                       | production build (downloads Roboto from Google Fonts at build time) |
| `npm run validate`                    | lint + typecheck + test + build                                     |

## Structure

`src/app` routes (route groups: `(public)`, `(portal)`, `(admin)`), `src/components/{ui,shared,layout}`, `src/config`, `src/lib`, `src/server` (server-only code), `tests`.

## Important

- `/portal` and `/admin` are **placeholders with no authentication yet** (Phase 3). They show no data and are marked noindex. Do not deploy real data behind them before Phase 3.
- Next.js 16 differs from older versions; read `node_modules/next/dist/docs/` and `AGENTS.md` before changing framework code.
