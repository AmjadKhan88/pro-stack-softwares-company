# Design reference notes

All six files are owner-supplied Atelier mockups (Tailwind v4 via CDN, Roboto). They are **inspiration for a design system, not code to ship**. Brand names and sample data are replaced with Pro Stack Creations.

## Shared tokens (extracted)

- Neutrals "bone": 50 #FBF9F5, 100 #F3EFE7, 200 #E9E3D7, 300 #D8CFBF, 400 #BCB2A0
- Ink: 300 #A8A296, 400 #8A8478, 500 #6A655B, 700 #3B3A33, 900 #1C1D18, 950 #121310
- Ember (primary accent): 400 #EF7A4C, 500 #DE5527, 600 #BC411A
- Pine (success / client accent): 400 #4A8471, 500 #2F6353, 600 #234B3F
- Ochre (warning): 400 #D2A24A, 500 #B7832B
- Font: Roboto only. Tabular numerals for figures. Tight heading tracking (-0.02em).
- Shapes: 8-12px controls, 12-16px cards, hairline borders (bone-300 at ~70%), soft large-blur shadows, 4px ember focus halo (`ring-4 ring-ember-500/10`).

## Per file

| File                    | Use for                                 | Take                                                                                                               | Do not copy / change                                                                |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| admin side dashboard    | `/admin` shell and overview             | Dark ink sidebar with grouped nav + badges, stat cards with sparklines, table with status pills, activity timeline | Fake revenue/client data; hard-coded SVG chart (use real data later); 9-10px labels |
| client side dashboard   | `/portal` shell and overview            | Light sidebar, project hero + progress, "waiting for you" approvals, milestone stepper, messages, file cards       | Invoices/payments blocks (deferred); named people; fixed dates                      |
| sidebars designs        | Navigation decisions                    | #01 Ink Editorial for admin; #02 Paper Studio for portal; #08 expand-on-hover as optional collapsed mode           | Upgrade/plan cards, storage meter (no such features)                                |
| Form & input components | Form kit                                | Field anatomy (label above, hint below, error replaces hint), states, dropzone, switches, chips, segmented control | Custom-drawn controls lacking keyboard/ARIA: rebuild on Radix with real semantics   |
| Toast notifications     | sonner theme + inline banners           | Anatomy (icon, title, desc, one primary action, timer bar), timings (success 4s, error 6-8s), pause on hover       | Fake progress bars; toast for form errors (keep inline)                             |
| Chatbot & AI assistants | Later support/intake widget (post-core) | Message bubble rhythm, states                                                                                      | Not in Phases 1-8; AI features are separate scope                                   |

## Gaps the references do not cover (we must design)

- Dark theme for every surface (references are light-first)
- Public marketing site (hero, services, case-study pages, footer)
- Mobile navigation drawer, tablet layouts
- Focus-visible styles on all controls, reduced-motion handling
- Minimum 12px UI text and checked contrast of ink-400/ink-300 on bone backgrounds
