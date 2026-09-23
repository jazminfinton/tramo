<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project conventions

Follow these rules for every change. They're short on purpose. The reasoning lives in the product and technical records under `openspec/changes/time-tracking-mvp/` (`discovery.md` for what the product must do, `exploration.md` for why the stack looks like this).

## Before you write code

1. A new feature starts with its test. Write it, watch it fail, then implement.
2. Read the Next.js guide for the API you're about to use (see the block above).
3. Check the reference project, Fragua (`C:\Users\corbo\Desktop\AIMBIT\Fragua\fragua`, **read-only**). This app mirrors its conventions and design system.

## Structure

| Path | Rule |
| --- | --- |
| `app/` | Routing only. Pages import from features; they don't hold logic. |
| `features/<feature>/` | `components/`, `actions.ts` (Server Actions), `queries.ts` (server reads), `schema.ts`, domain logic. No feature imports another feature. |
| `components/common/` | Domain-free primitives. |
| `components/global/` | App chrome. |
| `lib/` | Cross-cutting helpers. Never mention a business entity here. |

## UI rules

- **Copy:** every UI string lives in `messages/es-AR.json` and is read through next-intl. No hardcoded text in components.
- **No UI component library** (no shadcn, Radix, MUI…), no `cn()`/clsx, no animation library.
- **No browser-styled controls.** Native `select`, date/time/number/range/color/file/checkbox/radio inputs, `title` tooltips and `alert/confirm/prompt` are replaced by our own components that follow the WAI-ARIA APG patterns (`components/common/radio-group.tsx` is the reference). Unstyled primitives are fine underneath: `<dialog>`, the Popover API, `button`, text `input`.
- **Tokens only:**
  - Use the semantic classes: `bg-ground`/`surface`/`raised`/`tile`, `text-ink`/`ink-muted`/`ink-dim`, `accent`, `on-accent`, `warn`. Never raw colors.
  - Surfaces separate by luminance, not borders.
  - `grain` goes on every surface.
- **Brutalist type, soft shapes (Tramo's identity):**
  - The brutalism lives in the type only: `poster` (Big Shoulders) for titles and big numbers. Everything else is Geist: `font-display` for nav, buttons and labels, the body for reading.
  - Shapes stay soft: the radius tokens, soft shadows, no rules and no hard offset shadows.
  - A number that ticks in the `poster` face goes in fixed `1ch` cells per digit (see `ClockTiles`): the face has no tabular figures.
  - The timer's buttons wear the logo's hexagon (`components/common/hex-button.tsx`). It's drawn, not masked, so its focus ring still shows.
- **Themes:** 8 palettes × dark/light, set by `data-palette` and `data-theme` on `<html>` (see `lib/theme.ts`). Any element carrying both attributes renders in that theme. A new palette climbs the same lightness ladder as the others; `lib/theme.test.ts` checks its contrast.
- **Numbers** that tick or get compared use the `digits` utility (tabular figures).
- **Icons:** lucide-react with the `icon` class. Never hand-tune stroke width, except in the logo mark (`components/global/logo.tsx`), which is a drawing, not an icon.
- **Motion:** use `ease-signature`, and pair every transition with `motion-reduce:transition-none`.

## Server rules

- Modules that must never reach the browser start with `import "server-only"`.
- Server Actions treat every argument as untrusted input and validate it first.
- Access checks live in one place, the data access layer (`lib/dal.ts`), and every page runs its own. Never guard anything in a layout: layouts don't re-render on client-side navigation. The `(app)` layout only reads the session to draw the app chrome.

## Tests

| Kind | Tool | Where |
| --- | --- | --- |
| Pure logic, schemas, DAL | Vitest (`pnpm test`) | Next to the code: `*.test.ts` |
| Pages, routing, auth flows | Playwright (`pnpm test:e2e`) | `e2e/` |

A file that needs a DOM opts in with `// @vitest-environment happy-dom`.

## Definition of done

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass.
- [ ] New UI copy is in `messages/`.
- [ ] New controls work with keyboard and touch.
