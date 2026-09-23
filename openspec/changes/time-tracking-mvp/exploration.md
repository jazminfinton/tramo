# Exploration: time-tracking-mvp

> Output of the `sdd-explore` phase (revision 2, 2026-09-23), persisted by the orchestrator. The explorer couldn't write files.
> Revision 2 includes the owner's late constraints: custom controls on native primitives, no UI libraries, multi-theme persistence, and grain reuse.
> Input: `discovery.md`. Read both before the proposal.
>
> **Orchestrator notes:**
> - Owner answers to the open decisions below are recorded in `discovery.md`, section "Decisions after exploration". That section **wins** over any recommendation here.
> - Hosting: the owner chose **Vercel Hobby (free) for now**. They consider it a hobby project to try the idea. That overrides the Pro recommendation below. Design implications: the Hobby limits apply (Active CPU 4 h/month, 1M function invocations/month, cron at most once a day), so keep server polling minimal.

## 1. Executive summary

- **Mirror Fragua's stack almost entirely:** Next 16, React 19, pnpm, Tailwind v4, Prisma 7 + Neon, self-hosted Better Auth, Vitest/Playwright, and an ESLint flat config. It's proven in production and owned by the same team. Deviate only where tracking-horas' requirements really differ: roles, charts, drag and drop, custom controls, and theming.
- **Don't adopt Better Auth's organization, invitation, or admin plugins.** They model one membership level and an accept-first invitation flow. tracking-horas needs two levels (workspace and project) and invites that are active right away. Hand-rolled tables (Fragua's own pattern) fit better than fighting the plugins' shape.
- **Vercel Hobby is a real compliance risk, not a shortcut.** *(The owner accepted this risk for now; see the notes above.)*
- **Given the "no UI library" and "no native-styled controls" decisions:** drop Recharts, keep charts as hand-rolled SVG, and treat dnd-kit as the one explicitly justified behavior-only exception (WCAG 2.5.7 plus keyboard support is a hard requirement).
- **Theming is simpler than in Fragua.** The palette/theme preference is stored in the database and a cookie (not `localStorage`), so the root layout can read the cookie on the server. Fragua's inline pre-hydration script isn't needed.

## 2. Fragua conventions to mirror or avoid

**Mirror:**

- **Stack pins:** Next 16.3.4, React 19.2.8, strict TypeScript, pnpm, and Tailwind v4 CSS-first (`@theme`, no `tailwind.config`).
- **Folder ladder:**
  - `app/` holds routing only.
  - `features/<feature>/{components/, actions.ts, queries.ts, schema.ts, <domain>.ts}` holds each feature.
  - `components/global` is app chrome; `components/common` is domain-free.
  - `lib/` is cross-cutting and never mentions a business entity.
  - No feature imports another feature.
- **Auth:**
  - Self-hosted Better Auth, Google only, with `nextCookies()` last in `plugins`.
  - `databaseHooks` for domain logic.
  - A single data access layer (`lib/dal.ts`) is the only access gate.
  - `disableCookieCache: true` for any read that makes a security decision.
- **ORM and database:** Prisma 7 (custom `generated/prisma` output) with `@prisma/adapter-neon`, a global-singleton client for dev hot-reload, and `uuid(7)` ids.
- **Mutations:**
  - One Zod schema per feature, shared by client and server.
  - The `ActionResult` contract (`lib/form.ts`).
  - The access check is the first line of every action.
  - Expected failures return a result; bugs throw.
  - Multi-row writes go in a `$transaction`.
- **Testing:**
  - Vitest (`node` by default, `happy-dom` opt-in per file) for pure logic, schemas, and the DAL.
  - Playwright for routing and auth. Async Server Components can't be tested with Vitest.
  - Sessions are seeded through Better Auth's own internal adapter, with a replicated signed cookie.
  - e2e hygiene: reserved-TLD emails, prefixed markers, and teardown by marker.
- **Lint:** ESLint flat config on `eslint-config-next`, with explicit ignores for `generated/` and Playwright artifacts.
- **Deployment:** confirmed that Fragua has no `vercel.json` and no `Dockerfile`. It's a plain git-connected, zero-config Vercel deploy.
- **Custom controls:**
  - No UI library.
  - Components are built on unstyled native primitives (`<dialog>` with `showModal()`, popover style).
  - They follow WAI-ARIA APG patterns. `components/common/dropdown.tsx` is the house reference.
- **Confirmed reusable as-is:**
  - `scripts/build-noise.mjs`, `public/noise-dark.avif`, and `public/noise-light.avif`.
  - `@utility grain` and `@utility grain-overlay`, both defined in `app/globals.css` and already used in production (e.g., `confirm-dialog.tsx` uses `className="panel grain p-8"`).

**Deliberately not copying:**

- Better Auth's organization, admin, and invitation plugins. Fragua doesn't use them either, and they fit this app's role model worse than hand-rolled tables (see B).
- Fragua's `localStorage` plus inline-script theme mechanism. This app's preference lives in the database and a cookie, which the server can read, so a plain server-side cookie read is simpler and better (see K).
- Any themed chart component library. Fragua has zero chart dependencies on purpose; keep it that way (see G).
- Mocking Prisma in every database test. This app's aggregation and unique-index logic is SQL-shaped and should run against real Postgres semantics (PGlite), not mocks (see J).

## 3. Topics B-K

### B. Auth

| Option | Pros | Cons |
| --- | --- | --- |
| **Fragua's pattern: self-hosted Better Auth with custom role and membership tables** | Proven in production. Full control over the two-level roles. Active-on-invite and pending approval map directly onto a `status` field | Invitation matching and approval CRUD are hand-rolled (both simple, the same shape as Fragua's admin panel) |
| Better Auth with organization/admin/invitation plugins | Less schema to design for "workspace" | The invitation plugin's accept flow doesn't match "active on first sign-in". Project-level roles still need custom tables, so access has two sources of truth |
| Auth.js (NextAuth) v5 | Works on Next 16, universal `auth()` | Still on the npm **beta** tag as of September 2026 (`next-auth@latest` is v4). Next 16's `middleware.ts` → `proxy.ts` rename is a fresh wrinkle. No in-house track record |

**Recommendation:** Fragua's pattern. Model `Workspace`, `WorkspaceMember(role, status: active|pending|rejected)`, and `ProjectMember(role)` as our own tables.

- The key difference from Fragua's ban check: a pending user's session **must** be allowed to be created, so an admin has something to approve.
- Gate access in the DAL (`requireActiveMember()`, read fresh from the database with `disableCookieCache: true`), not in `session.create.before`.
- Match invitations by email at first sign-in.

Sources: [Better Auth Organization plugin](https://better-auth.com/docs/plugins/organization), [Better Auth Hooks](https://better-auth.com/docs/concepts/hooks), [Auth.js v5 migration guide](https://authjs.dev/getting-started/migrating-to-v5), [Auth.js v5 + Next 16, 2026](https://dev.to/huangyongshan46a11y/authjs-v5-with-nextjs-16-the-complete-authentication-guide-2026-2lg)

### C. Database, ORM, and hosting (costs verified in 2026)

- **ORM:** Prisma 7 with `@prisma/adapter-neon`, matching Fragua. Prisma 7 requires a driver adapter regardless.
- **Database:** Neon over Supabase.
  - Neon Free (100 CU-hours/month, 0.5 GB) suspends after 5 minutes idle and wakes up on the next request. That fits intermittent internal use.
  - Supabase Free (500 MB) pauses the whole project after **one week** idle and needs a manual restore from the dashboard.
  - Paid: Neon Launch is pay-as-you-go (~$0.106 per CU-hour plus $0.35 per GB, no minimum). Supabase Pro has a flat $25/month floor.
- **Hosting:** Vercel, matching Fragua's zero-config deploy. Hobby is contractually "non-commercial personal use only" ("financial gain of anyone involved in any part of the production of the project"). If Fragua already runs on a paid Pro team, adding this project costs **$0 extra**; otherwise it's $20/month.

| Host | ~Monthly, 3-10 users | Notes |
| --- | --- | --- |
| **Vercel** | $0 Hobby *(owner's choice for now)* / $0-20 Pro | Cron: once a day on Hobby, per minute on Pro. 300 s function timeout (can be extended) |
| Netlify Pro | $19 per user | Similar serverless model |
| Railway | ~$7-15 | Usage-based, no sleep, Postgres in the same place |
| Render | $25 | Flat price, always on, no cold starts |
| Cloudflare Workers + OpenNext | $5 | Supports Next 16. A newer path for this Prisma + Neon stack |
| VPS + Coolify (Hetzner) | ~$7-20 plus your ops time | Cheapest floor, but you own patching, backups, and TLS |

Sources: [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines), [Vercel Hobby Plan](https://vercel.com/docs/plans/hobby), [Vercel cron limits](https://steadycron.com/guides/vercel-cron-limits/), [Neon Pricing](https://neon.com/pricing), [Supabase Pricing 2026](https://uibakery.io/blog/supabase-pricing), [Railway Pricing 2026](https://dev.to/nayankyada/railway-pricing-2026-free-tier-limits-usage-costs-when-to-upgrade-1acm), [Cloudflare OpenNext + Next 16](https://opennext.js.org/cloudflare), [Coolify/Hetzner costs](https://theroadtoenterprise.com/blog/hetzner-coolify-vs-vercel-saas)

### D. Timer domain modeling

- **Pause/resume:** separate closed `TimeEntry` rows, one per segment, not segments embedded in one entry. Metrics need `SUM(end - start) GROUP BY`, which is trivial over rows and painful over JSON. A manual edit touches one row, not an array.
- **One running timer:** a Postgres partial unique index, `CREATE UNIQUE INDEX ... ON "TimeEntry"(user_id) WHERE ended_at IS NULL`, as the hard backstop. The action still stops the old timer and starts the new one in a single `$transaction`.
- **Cross-device sync:** refetch on `focus` and `visibilitychange`, plus light polling only while a timer is visible on screen.
  - SSE or realtime give instant consistency, but their cost is out of proportion for 3-10 users.
  - Vercel's serverless functions aren't a good host for long-lived SSE connections (duration billing and limits apply).
- **Forgotten-timer alert (v1):** check on the client when the user comes back. Evaluate `now - startedAt` on load and focus, and show a custom `<dialog>` prompt.
  - No cron or email needed, and it matches the decided v1 behavior exactly.
  - A scheduled email version is deferred along with the weekly summary email, which is already out of scope. Vercel Hobby's cron runs at most once a day anyway, which is too coarse for an 8-hour threshold.

Sources: [Vercel cron 100/project, all plans](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan)

### E. Document PiP with React 19

- Render with `window.documentPictureInPicture.requestWindow()`, then `createPortal(<TimerWidget/>, pipWindow.document.body)` from the same React tree. This is the pattern Spotify shipped.
- **Styles and fonts:** clone every stylesheet (`<link>` and `<style>`) into `pipWindow.document.head` when the window opens. Tailwind v4 compiles to a single stylesheet, so that's one clone, not per-utility copying. Re-declare or copy `FontFace` objects for the fonts.
- **Focus and keyboard:** it's a real top-level browsing context. Make sure the tab order is right and focus rings are visible on its controls. No manual focus trap is needed, because the OS window bounds it.
- **Testing:** reliable Playwright automation of the real PiP window couldn't be confirmed.
  - A `documentPictureInPicture` window is a real CDP target, but Puppeteer/CDP evidence shows that targets which aren't pages can return `null` from the standard page helpers.
  - **Recommendation:** don't automate the real PiP window. Cover the timer logic (elapsed time from `startedAt`, sync on focus) with Vitest and the in-page fallback with Playwright, since it behaves the same. Keep a short manual QA checklist per release.
- Feature-detect, and hide the pop-out button entirely when it isn't supported. There, the in-page timer is the primary experience, not a degraded one.

Sources: [MDN Document PiP API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API), [Chrome for Developers: Spotify's PiP miniplayer](https://developer.chrome.com/blog/spotify-picture-in-picture), [Puppeteer Target.asPage()](https://pptr.dev/api/puppeteer.target.aspage), [Puppeteer issue on non-page targets](https://github.com/puppeteer/puppeteer/issues/10613)

### F. Time handling

- Store `timestamptz` in UTC. Add `User.timezone` (IANA string, default `America/Argentina/Buenos_Aires`), used only for display and aggregation, never for storage.
- **Temporal vs date-fns:** Temporal reached ES2026 (Stage 4) in March 2026 and ships unflagged in Node 26 and current Chrome, Firefox, and Edge. But Safari still only has it in Technology Preview, and Node 26 is the bleeding-edge line, not yet the safe LTS default. **Recommendation:** `date-fns` + `@date-fns/tz` for v1, behind a thin internal date-utils module so a later switch to Temporal stays in one place.
- **Weekly aggregation:** `date_trunc('week', started_at AT TIME ZONE user_timezone)`. It's ISO and Monday-first by default, matching the decided week start. Do the conversion once, in SQL, not in app code.
- **Entries that cross midnight or a week boundary** need no special modeling (still one row). Only display and aggregation need a convention for which day or week a spanning entry counts toward. See the owner's decision.

Sources: [InfoQ: Node 26 Temporal](https://www.infoq.com/news/2026/07/nodejs-26-temporal/), [Node 26.0.0 release](https://nodejs.org/en/blog/release/v26.0.0)

### G. Charts (revised for "no UI library")

- Recharts is a themed component library. It brings its own DOM, Tooltip, and Legend, which are hard to re-skin fully under a hand-built token system. **Not recommended** under the explicit constraint.
- visx isn't a chart library. It's a set of unstyled D3-wrapper primitives (scales, path generators) with no rendering opinions, so it's compatible with "library-light".
- Hand-rolled SVG means writing the same scale math yourself: ~30-50 lines, and only linear and band scales are needed, with no curves or logs.

**Recommendation:** hand-rolled SVG for all three chart types (stacked weekly bars, top-tasks ranking, week-over-week trend). It gives full control over theming with CSS variables. Pair every chart with a visually hidden `<table>` of the same data for accessibility.

Reach for `@visx/scale` + `@visx/shape` (not `@visx/xychart`) only if the math really gets in the way. Fragua already carries `@visx/shape` as a transitive dependency, so it's a low-risk fallback, not a new commitment.

Sources: [LogRocket: React chart libraries 2026](https://blog.logrocket.com/best-react-chart-libraries-2026/), [visx vs Recharts bundle size](https://devpick.co/recharts-vs-visx-visx)

### H. Drag and drop

- **Native HTML5 DnD:** no touch support and no keyboard alternative. Ruled out, given the mobile and WCAG requirements.
- **dnd-kit vs pragmatic-drag-and-drop:** pragmatic is smaller (under 4 KB vs ~6 KB) and proven at Jira and Trello scale, but you assemble its keyboard support yourself from a "documented" accessibility approach. dnd-kit builds ARIA live-region announcements and a working `KeyboardSensor` into the core.

**Recommendation: dnd-kit.** It's explicitly justified as a behavior-only helper under the "no UI library" rule: it renders nothing, and we build the chips and drop targets ourselves.

- WCAG 2.5.7 is a hard requirement, and hand-rolling focus, announcements, and touch-vs-scroll behavior correctly is a known trap. That's exactly what the "explicit justification" exception is for.
- Whatever the library, every drop action also needs a single-pointer alternative: tap a chip to open a custom project picker dialog, so no interaction *requires* dragging.

Sources: [dnd-kit vs Pragmatic DnD, 2026](https://www.pkgpulse.com/guides/dnd-kit-vs-react-beautiful-dnd-vs-pragmatic-drag-drop-2026), [WCAG 2.5.7 Dragging Movements](https://www.digitala11y.com/understanding-sc-2-5-7-dragging-movements/)

### I. i18n

next-intl supports a fixed-locale "without i18n routing" setup on the App Router: no `[locale]` segment and no prefix at all.

**Recommendation:** use it without prefixes for v1 (Spanish only). The "ready to translate" requirement is already met by keeping copy in message files. Add `[locale]` / `localePrefix` routing only when a second language is actually scheduled. There's no reason to pay that structural cost now.

Sources: [next-intl routing configuration](https://next-intl.dev/docs/routing/configuration), [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router)

### J. Testing for Strict TDD

- **Split:** mirror Fragua. Vitest (`node` by default, `happy-dom` opt-in) and Playwright (`setup` → tests → `teardown`).
- **Database logic:** PGlite through `pglite-prisma-adapter`, which targets Prisma 7 specifically. It's an in-process WASM Postgres with real semantics and no Docker.
  - Use it for the partial unique index and the `date_trunc` / `AT TIME ZONE` logic too, since that logic is really SQL-shaped (unlike Fragua's DAL tests, which mock Prisma).
  - Keep a real Neon branch for Playwright e2e and a pre-merge smoke pass only. Testcontainers adds Docker-in-CI ceremony that PGlite already avoids.
- **Auth-protected flows:** copy Fragua's pattern exactly.
  - Seed through Better Auth's own internal adapter in a separate `tsx` process. Never import the ESM Prisma client from a CommonJS-transpiled Playwright spec.
  - Replicate the signed cookie.
  - Same e2e hygiene: reserved-TLD emails, prefixed markers, teardown by marker.
- **Document PiP:** as in E, don't automate the real window in e2e. Cover the logic and the fallback UI only, and QA the pop-out manually.

Sources: [pglite-prisma-adapter, npm](https://www.npmjs.com/package/pglite-prisma-adapter), [prisma-pglite-bridge](https://github.com/drudolf/prisma-pglite-bridge)

### K. Custom controls, manual-entry inputs, and theming (new owner decisions)

- **Confirmation and modal pattern:** Fragua's `components/common/confirm-dialog.tsx` (native `<dialog>` with `showModal()`) is reusable directly. It gives focus trapping, Escape, and an inert background for free, exactly the "prefer unstyled native primitives" decision, and it's already proven in production.
- **Date picker:** follow the WAI-ARIA "Date Picker Dialog" pattern. It starts on Monday.
  - A styled trigger `<button>` opens a panel (Popover API or `<dialog>`) with a `role="grid"` month calendar.
  - Keyboard: roving tabindex, arrow keys move between days, Home/End go to the start or end of the week, PageUp/PageDown change month, and Escape returns focus to the trigger.
  - The value travels through a hidden `<input type="hidden">` into `FormData`, the same contract as Fragua's `Dropdown`.
- **Time/duration entry:** this *extends* an existing Fragua rule. `native-controls.md` already says "anything that captures text stays native", and a time or duration value is text capture.
  - Use a restyled native `<input type="text" inputMode="numeric">` with a pure parse/format function. It accepts "14:30", "1h30", and "90m", and shows a normalized preview.
  - The same Zod schema validates it on client and server, with the schema test written first, per `testing.md`.
  - It's simpler and more mobile-friendly than a fully segmented ARIA spinbutton widget, and it adds no dependency.
- **Theme persistence (simpler than Fragua's, not a copy):**
  - Fragua needs its inline pre-hydration script because its theme lives in `localStorage`, which the server can't read.
  - This app stores the preference in the database and a cookie, and the server **can** read cookies. The root layout can `await cookies()` (a Next 16 Server Component) and put `data-palette` and `data-theme` directly on the server-rendered `<html>`. No flash, no script.
  - On change, a Server Action writes the database row and re-sets the cookie in one response. Mirror the attributes on `document.documentElement` optimistically on the client for instant feedback.
  - Tradeoff, accepted knowingly: reading cookies in the root layout makes the whole app dynamic (no static shell). That's a non-issue here, because every route is already per-user and authenticated.
- **Theme picker:** an accessible radio group of swatches (`role="radiogroup"` / `role="radio"`, arrow keys to move, Space or Enter to select). Same APG family as `Dropdown`, different visual.
- **New-dependency policy:**
  - dnd-kit (H) is the one justified exception.
  - `@visx/scale` + `@visx/shape` (G) is a conditional fallback.
  - Everything else is hand-built on `<dialog>`, Popover, and native semantics, with `dropdown.tsx` as the house reference: date picker, time input, listbox, combobox, tooltip, toast, menu, switch, checkbox, and radio.

## 4. Proposed stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework and UI | Next.js 16 App Router, React 19, strict TypeScript, pnpm | Matches Fragua |
| Styling | Tailwind v4 CSS-first (`@theme`), no `tailwind.config` | Matches Fragua; extends to tokens for 4 palettes |
| Auth | Self-hosted Better Auth (Google only, `nextCookies()`) with custom Workspace/Project role tables | Matches Fragua's pattern; the plugins don't fit the two-level role shape |
| ORM | Prisma 7 + `@prisma/adapter-neon` | Matches Fragua; Prisma 7 requires a driver adapter anyway |
| Database | Neon Postgres, Free then Launch | Matches Fragua; autosuspend fits intermittent use better than Supabase's week-long pause |
| Hosting | Vercel Hobby for now *(owner's choice)*; Pro if it becomes commercial | Zero-config Next.js deploy |
| Validation and mutations | Zod + the `ActionResult` contract, Server Actions per feature | Matches Fragua's `mutations.md` exactly |
| Charts | Hand-rolled SVG (plus `@visx/scale` / `shape` if needed) | "No UI library" rule; Recharts is a themed kit |
| Drag and drop | dnd-kit | The only justified behavior-only exception; built-in WCAG 2.5.7 and keyboard support |
| Date, time, and duration input | Hand-built Popover/`<dialog>` plus a parsed text `<input>` | "No native-styled controls"; extends Fragua's own text-capture-stays-native rule |
| Time library | date-fns + @date-fns/tz | Temporal isn't safe yet (Safari and the Node LTS gap, September 2026) |
| i18n | next-intl, routes without a locale prefix | Spanish only now; another language can be added later without changing URLs |
| Testing (unit) | Vitest + PGlite through `pglite-prisma-adapter` | Matches Fragua's Vitest setup; real Postgres semantics for SQL-heavy logic |
| Testing (e2e) | Playwright + session seeding through Better Auth's internal adapter | Matches Fragua exactly |
| Lint and format | ESLint flat config (`eslint-config-next`) | Matches Fragua |
| Theming | 4 palettes × dark/light, database + cookie, read on the server in the root layout | Extends Fragua's `data-theme` contract with a simpler mechanism (no inline script) |

## 5. Decisions that need the owner's input

*(The answers are recorded in discovery.md, "Decisions after exploration".)*

1. **Hosting and budget.** Answered: Vercel Hobby for now.
2. **Forgotten-timer alert channel for v1.** Recommended: (a) **an in-app prompt on load and focus, no email infrastructure**. Alternatives: (b) in-app now plus a scheduled email later, bundled with the deferred weekly summary; (c) a scheduled email from day one.
3. **Attribution of entries that cross midnight or a week boundary.** Recommended: (a) **attribute the whole entry to the day and week it started**, the simplest option. Alternative: (b) split the duration proportionally across days and weeks, which is more accurate but adds query complexity.
4. **How strong cross-device sync needs to be.** Recommended: (a) **refetch on focus and visibility plus light polling**, with no new infrastructure. Alternatives: (b) SSE, which is instant but awkward with Vercel's billing for long serverless connections; (c) a realtime service (Pusher, Ably, Supabase Realtime), which is instant and robust but a new paid dependency.
5. **Rejected users.** Recommended: (a) **they can request access again later, and the admin sees a fresh pending request**. Alternative: (b) rejection is final, and only a new invitation restores access.
6. **Input style for manual time entries.** Recommended: (a) **a free-text field with a parser and a live preview ("14:30", "1h30", "90m")**. Alternative: (b) a fully segmented ARIA spinbutton widget, which feels more like a native control but is more component work.
7. **Editing window for past entries.** Recommended: (a) **admins edit anything, anytime; Trackers edit only their own entries within the current and previous week**. Alternatives: (b) no time window, but edits older than N weeks need admin approval; (c) fully open, so Trackers edit their own past entries with no limit.

## 6. Risks and unknowns

- **Vercel's commercial-use classification is a judgment call, not a bright line.** Its example list (payments, ads, affiliate links) doesn't literally describe an internal tracker, but the general test ("financial gain of anyone involved in production") plausibly applies. *(The owner accepted Hobby for now.)*
- **Prisma 7 + the Neon adapter + the PGlite adapter is a fairly new combination** (`pglite-prisma-adapter` is at v0.7.x). Time-box a spike in the first apply batch (while setting up the test runner) to confirm that the partial unique index and the `date_trunc` / `AT TIME ZONE` queries actually work through it before committing the whole suite.
- **Document PiP has shipped precedent (Spotify), but no Fragua precedent and no confirmed Playwright automation path.** Budget real manual QA across Chrome, Edge, and Firefox; don't assume it works everywhere once written.
- **Popover and anchor positioning for the date picker and menus** need a concrete choice at design time: CSS anchor positioning vs manual placement. Cross-browser support for anchor positioning moves fast, so re-verify it then, not now.
- **The pending/request-access gate in the DAL (topic B) is a new security-critical pattern with no Fragua precedent.** Fragua only gates accounts that were already approved, by banning. Give it its own spec and test coverage, since it's the app's core access boundary.
- **Two-level roles plus per-project transparency mean every metrics query must filter by project membership,** not just the page gates. That's more surface than Fragua's single-level split, so centralize it once in the design phase.
- **Vercel Hobby limits** (Active CPU 4 h/month, 1M invocations/month): keep polling minimal and avoid chatty server calls.
