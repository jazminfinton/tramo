# Discovery: time-tracking-mvp

> Product discovery captured on 2026-09-22 through a question-and-answer session with the product owner.
> This is the input for exploration, proposal, specs, and design. Decisions marked **Decided** come from the owner. Items marked **Open** still need a decision.

## Problem

Three siblings run several projects in parallel. They don't know where their time goes, or exactly how many hours each person works per week.

## Goal

A minimalist, orderly web app to track time per person, per project, and per task. It must answer:

- How many hours did each person work this week?
- Where did our time go (by project and by task)?

**Decided:** it's for visibility only. No billing, no hourly rates, no invoicing, no clients.

**Decided:** they build it in-house instead of using Toggl Track or Clockify because they want it fully custom and plan to keep evolving it.

## Users and roles

- 3 siblings, all admins. More people may join later.
- 1 observer who can see hours but never tracks time.

**Decided: two-level role model** (fixed roles, no per-user permission checkboxes):

| Level | Role | Can do |
| --- | --- | --- |
| Workspace | Admin | Everything: invite and approve people, create and archive projects, assign project roles, see all data |
| Workspace | Member | Access only the projects they're assigned to |
| Project | Tracker | Track time in the project and see the project's metrics |
| Project | Viewer | See the project's metrics (read-only, never tracks) |

- The observer is not a special user type. It's a Viewer on the projects it's assigned to.
- **Decided:** the data model has a Workspace entity from day 1, even if there's only one workspace at launch.
- **Decided:** admins assign people to projects in an admin panel by dragging users onto projects. When a user is dropped, a role is chosen.

## Access

- Sign-in with Google only.
- **Decided: both entry paths.**
  1. **Invitation:** an admin adds a Google email with a preset role. On first Google sign-in, that account is active right away.
  2. **Request access:** anyone can sign in with Google and ends up `pending` until an admin approves them (and assigns roles).
- **Security rule:** a pending (or rejected) user sees nothing. This must be enforced on the server on every request, not just hidden in the UI.

## Visibility

**Decided: transparency per project.**

- Everyone assigned to a project (Tracker or Viewer) sees every member's hours in that project.
- Nobody sees data for projects they aren't assigned to.
- Admins see everything.

## Time tracking

- **Decided: floating mini-timer** through the Document Picture-in-Picture API. It's an always-on-top window opened from the web app, with no install.
  - Browser support (verified in MDN browser-compat-data, 2026-09-22): Chrome 116+, Edge (same as Chrome), and Firefox 151+ on desktop. No support in Safari or any mobile browser. Use feature detection and fall back to the in-page timer.
  - Constraints: HTTPS only, opened from a user gesture, one window per tab, closes when the opener tab closes, no navigation inside it, and the site can't set its position.
- **Decided: the server is the source of truth.** The running entry stores `startedAt`. Elapsed time is always `now - startedAt`, never a client-side counter. Closing the window or tab never stops or loses time. A timer started on the phone can be stopped on the computer.
- **Business rule:** at most one running timer per user. Starting a new one stops the previous one.
- Play, pause, and resume at will.
  - **Decided (2026-09-24):** pausing is a real pause. The clock stops where it is and resuming goes on from there; a separate "finish" ends the task and takes the clock back to zero. Blocks stay the truth (a pause still closes the running block, a resume opens a new one); a per-person `TimerSession` only remembers the task and the seconds it added up.
  - **Decided:** the clock reads in solid blocks, hours / minutes / seconds, each named below (like a flip clock); the floating window stands upright unless it's very flat.
- Each entry has who, project, a free-text task description, start, and end.
  - **Decided:** the task description is free text, with autocomplete from the user's own past descriptions (per project). This keeps "fix login" and "Fix Login" from splitting the metrics.
- **Decided (v1): manual entry and editing.** People can add or fix time when they forgot the timer. Manually created or edited entries are flagged, so the metrics stay honest.
- **Decided (v1): forgotten-timer alert.** When a timer has run for 8 hours, the app warns the user and asks them to confirm or fix it.

## Views and metrics (v1)

- **Weekly view:** a grid of days by projects, with totals per person.
- **Metrics (all decided for v1):**
  - Hours per person (week and month)
  - Hours per project (week and total)
  - Top tasks by time within a project
  - Week-over-week evolution (per person or per project)

## Other v1 features

- **Archive projects** instead of deleting them, so history is kept.

## Later (out of scope for v1)

- Weekly summary email
- Hour goals per project
- CSV export

## Non-goals

- Screenshots, activity monitoring, or any kind of surveillance. The goal is visibility, not control.
- Billing, rates, invoices, clients.

## Platform

- **Decided:** mobile is supported, including tracking (mobile-first responsive UI). The floating mini-window is desktop-only; on mobile the timer lives in the page.

## UI language

- **Decided:** Spanish UI, ready for translation from day 1. All UI copy lives in message files, not inline in components.

## Visual design reference: Fragua

**Decided:** the aesthetic must be similar to the owner's other project, Fragua (`C:\Users\corbo\Desktop\AIMBIT\Fragua\fragua`, read-only reference), but with a different color palette.

Fragua's design language (extracted 2026-09-22):

- **Stack:** Next 16.3.4, React 19.2.8, pnpm, and Tailwind v4 CSS-first. All tokens live in `app/globals.css` (`@theme`). No `tailwind.config`.
- **No UI component library** (no shadcn, no Radix), no `cn()`/clsx, and no animation library. Components are hand-built (`components/common/`, `components/global/`, `features/*/components/`).
- **Icons:** lucide-react, with a global `stroke-width: 1.5`.
- **Theming:** dark by default, plus a warm "paper" light theme through `data-theme` on `<html>` and an inline pre-hydration script. No next-themes.
- **Elevation by luminance, not borders.** The ladder is ground → surface → raised → tile. Hairlines are 1px box-shadows, and real shadows are used only on floating elements.
- **Baked film grain:** AVIF noise tiles (`scripts/build-noise.mjs`) applied on most surfaces.
- **One accent, used sparingly,** through semantic tokens (`accent`, `on-accent`). `warn` stays a different hue from `accent`.
- **Typography:** IBM Plex Sans for body and IBM Plex Mono for display, nav, buttons, and labels. Weights 400 and 500 only.
- **Radii:** tile 8px, panel 16px, pill 32px. A floating pill navbar, and a collapsible admin sidebar driven by a DOM attribute.
- **Motion:** CSS only. The signature easing is `cubic-bezier(0.22, 1, 0.36, 1)`, with a `motion-reduce` guard everywhere.
- **Design doc:** `.agents/context/styles.md` (in Spanish; cites WCAG 2.2, IBM Carbon, Radix Colors, Refactoring UI). Companion standards live in `.agents/standars/` (native controls, loading states, mutations).

Additions this app needs that Fragua doesn't have:

- `tabular-nums` and mono digits for timers and metrics.
- A chart style designed from scratch. Fragua has no charts: `@visx` appears only as a transitive dependency.

**Decided:** reuse Fragua's grain as-is. Copy `scripts/build-noise.mjs`, the generated `public/noise-dark.avif` and `public/noise-light.avif`, and the `grain` / `grain-overlay` utilities. The noise has dark and light variants, so it works with every theme.

### Themes

**Decided:** the app ships several themes and each user picks their own. There are 8 palettes, each with a dark and a light mode: it launched with 4 (Salvia, Índigo, Lima, Ámbar), and the owner asked for more options, a grey one among them, which added Cielo, Orquídea, Coral and Grafito (the grey one). The picker shows them in hue order.

- The preference is stored in the user's account, so it follows them across devices. It's also mirrored in a cookie so the server renders the right theme with no flash.
- Theme state lives on `<html>` as `data-palette="lima|salvia|cielo|indigo|orquidea|coral|ambar|grafito"` plus `data-theme="dark|light"`. This mirrors Fragua's attribute-plus-pre-hydration-script approach.
- Every palette climbs one lightness ladder, measured in OKLCH on the first four, so a palette changes hue, never contrast. A unit test holds every palette to WCAG AA.
- Default for new users: Lima, dark (it was Salvia until the first week of use).
- The theme picker is itself a custom control: an accessible radio group of swatches.

Token structure mirrors Fragua. All palettes pass WCAG AA (4.5:1) for ink, ink-muted, and ink-dim on surface and raised, for accent on ground and surface, for on-accent on accent, and for warn on surface, in both modes. Neutrals are tinted toward each accent hue, Radix-style.

| Token | Salvia dark | Salvia light | Indigo dark | Indigo light | Lima dark | Lima light | Ámbar dark | Ámbar light |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ground | #141816 | #edf0ea | #15151c | #edecf3 | #161713 | #efefe6 | #181612 | #f0ece3 |
| surface | #1e2320 | #f5f7f3 | #1f1f28 | #f5f5f9 | #20211c | #f6f6f0 | #22201b | #f7f4ee |
| raised | #282e2a | #ffffff | #292933 | #ffffff | #2a2b25 | #ffffff | #2c2a24 | #ffffff |
| tile | #3f4641 | #dfe5dd | #41414e | #e0dfea | #43443c | #e2e2d6 | #46433b | #e6e0d4 |
| ink | #f3f6f4 | #1a1f1c | #f4f4fb | #1b1b25 | #f7f7f0 | #1c1d17 | #faf7f0 | #1f1c16 |
| ink-muted | #a1aaa4 | #535e57 | #a5a5b3 | #565566 | #a7a89c | #595a4f | #aba69b | #5e584d |
| ink-dim | #939c96 | #626d66 | #9696a5 | #666577 | #98998d | #686a5e | #9c978c | #6e685c |
| accent | #5ee0a0 | #19754e | #9092ff | #4b44d6 | #c5ef5a | #44710b | #ffb547 | #95560a |
| on-accent | #0c1510 | #ffffff | #13132a | #ffffff | #171a0c | #ffffff | #1c1405 | #ffffff |
| warn | #e5a83c | #8a5a0f | #e5a83c | #8a5a0f | #ff9a62 | #a4481a | #ff7b6b | #b3362a |

## Custom controls

**Decided: 100% custom look, built on top of unstyled native primitives.**

- No browser-styled controls anywhere: no native `<select>`, `<input type="date|time|datetime-local|number|range|color|file|checkbox|radio">`, no `title` tooltips, and no `alert()`, `confirm()`, or `prompt()`. Each of these is replaced by a hand-built component: listbox/select, combobox (task autocomplete), date picker, time/duration input, checkbox, radio group, switch, tooltip, confirmation dialog, toast, and menu.
- Unstyled native primitives ARE allowed underneath and are preferred for their built-in accessibility: `<dialog>` (modals and sheets, with focus management and Escape), the Popover API (menus, listboxes, tooltips), and semantic elements (`button`, `form`, text `input`, `label`) restyled completely. Fragua already does this for its mobile nav sheet.
- Scrollbars are styled with CSS (`scrollbar-color`, `scrollbar-width`).
- Every custom control follows the matching WAI-ARIA Authoring Practices pattern (keyboard, roles and states, focus, screen reader labels) and works with touch on mobile. Fragua's `components/common/dropdown.tsx` is the reference. Each control gets tests for its keyboard and pointer interactions.
- There's no UI component library (as in Fragua). A behavior-only helper library needs an explicit justification in the design.

## Process

- SDD in interactive mode. Artifact store: openspec. Delivery strategy: single-pr. A `size:exception` must be recorded before apply.
- Strict TDD is intended. There's no test runner yet, so the first apply batch sets it up.
- The project isn't a git repo yet. Ask the owner before running `git init`.

## Decisions after exploration (2026-09-23)

These override any recommendation in `exploration.md` that conflicts with them.

**Owner answers:**

| Topic | Decision |
| --- | --- |
| Stack | As proposed in exploration.md section 4: Next 16, React 19, strict TypeScript, pnpm, Tailwind v4, self-hosted Better Auth (Google) with hand-rolled Workspace/Project role tables, Prisma 7 + Neon, next-intl without a locale prefix, date-fns + @date-fns/tz, hand-rolled SVG charts, Vitest + PGlite, and Playwright |
| Hosting | **Vercel Hobby (free) for now.** The owner treats it as a hobby project to try the idea. Upgrading to Pro later is a plan change, not a code change. Design within Hobby limits: Active CPU 4 h/month, 1M invocations/month, cron at most once a day. Keep server polling minimal |
| Drag and drop | **dnd-kit**, the one justified behavior-only dependency. Every drag action also has a single-pointer alternative (tap a user chip to open a custom project and role picker), per WCAG 2.5.7 |
| Forgotten-timer threshold | **8 hours** |
| Editing past entries | **No time limit.** Everyone can edit their own entries anytime, and admins can edit anyone's. Every manual creation or edit is flagged |
| Manual time input | **Time selectors** (changed from a smart free-text field after the first week of use: typing "18:00 o 1h30" didn't convince the owner). Start and end are picked from lists on a quarter-hour grid, like a calendar; each end option shows the resulting duration, an end before the start means the next day, and changing the start keeps the duration. Typing still jumps to a time ("930", "18"). The server keeps parsing "HH:MM", so the contract didn't change |
| Multiple workspaces | **Allowed by the data model from day 1.** A user can belong to several workspaces. The workspace switcher UI stays hidden until a user has more than one |

**Defaults set by the orchestrator** (the owner can correct them during the proposal review):

| Topic | Default |
| --- | --- |
| Forgotten-timer channel | An in-app prompt on load and focus. No email and no cron |
| Entries crossing midnight or a week boundary | The whole entry counts toward the day and week it started |
| Cross-device sync | Refetch on focus and `visibilitychange`, plus light polling only while a running timer is visible |
| Rejected users | They can request access again later, and the admin sees a new pending request |
| Pause/resume model | Separate closed time entries, one per segment. A Postgres partial unique index enforces one running timer per user |
| Week and time zone | Weeks start on Monday (ISO). Each user has an IANA time zone, default `America/Argentina/Buenos_Aires`. Aggregation happens in SQL with `AT TIME ZONE` |

## Brand and look (decided 2026-09-24)

- **Name: Tramo.** Tagline: *Tu trabajo, tramo a tramo.* Each block of work is a *tramo*, and the UI calls them so. Chosen from four candidates (Temple, Tramo, Destajo, Concreto); Lapso and Gnomon were dropped because time-tracking apps already use them.
- **Logo:** Lucide's hourglass on a hexagon of the theme's accent, so it changes with the palette. The hexagon is Fragua's badge (pointy-top, corner fillets of r = 0.32 R), at the owner's request, so the two marks read as one family; the hourglass takes `on-accent`, since white would vanish on a light accent like Lima's. The favicon is the same drawing per theme (`/brand-icon/<palette>-<mode>`, versioned so a new drawing beats a year of caching), and follows the theme live.
- **Brutalist type, soft shapes** (owner's request, with award-winning references: the Awwwards brutalism collection and its honorable mentions such as *Brutalism* by MAGWAI and *Brutally Human* by BeCurious, plus the owner's reference of number posters). The brutalism lives in the typography only. A first pass also squared every corner, drew a 1px rule on every panel and gave floating things hard offset shadows; the owner rejected it, so the shapes went back to Fragua's soft system: rounded radii, luminance instead of borders, soft shadows, the floating pill navbar.
  - Poster numbers: Big Shoulders (ultra-condensed, heavy) for titles and the big numbers. The clock's digits are stretched to 125% of their height, in rounded tiles of the accent.
  - Geist (Vercel's typeface) for everything else, replacing IBM Plex: the owner found Plex Mono's typewriter look dated and asked for something modern and technical. Geist is today's default for technical interfaces, in the Swiss tradition, and has tabular figures for numbers that must align.
  - The timer's buttons wear the logo's hexagon.
