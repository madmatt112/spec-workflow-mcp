# Codebase context — dashboard-visual-refresh

Paths are relative to the code root `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh`. `FE` = `src/dashboard_frontend/src`.

## Entry and shell frame
- src/dashboard_frontend/index.html:1-13 — the page shell, one `#root`.
- src/dashboard_frontend/vite.config.ts:11-48 — Vite config with the React and Tailwind v4 plugins; build out to `dist`.
- FE/main.tsx:1-21 — entry; imports `fonts.css`, `tailwind.css`, `theme.css` in that order (lines 5-7).
- FE/modules/app/App.tsx:16-33 — `Shell`: sidebar plus `main` with gutters `px-4 sm:px-6`, the routes `/`, `/runs`, `/runs/:projectId`, `/specs`, `/usage`, `/deferrals`, catch-all to `/`.
- FE/modules/shell/PageLayout.tsx:9-28 — `PageLayout`, list plus panel; panel beside the list from Tailwind `xl`, stacked below it otherwise; panel width `xl:w-96`.
- FE/modules/shell/PageLayout.tsx:31-33 — `ScrollBox`, a wide table scrolls inside its own box.

## Sidebar, settings, shared primitives
- FE/modules/shell/Sidebar.tsx:15-38 — `NavRow`, a nav link with its count pill.
- FE/modules/shell/Sidebar.tsx:40-105 — `SidebarContent`: title, disconnected marker, five nav rows, project switches, the gear.
- FE/modules/shell/Sidebar.tsx:107-148 — `Sidebar`: desktop aside `lg:w-64`, mobile top bar below `lg`, drawer with a `bg-black/50` scrim (line 136).
- FE/modules/shell/Gear.tsx:11-134 — settings popover: theme toggle (67-72), density radios (74-98), notifications, version.
- FE/modules/shell/ShellProvider.tsx:140-143 — sets `--row-h` to `32px` (compact) or `36px` (comfortable) on the root element.
- FE/modules/shell/primitives.tsx:12-59 — `Group`, a collapsible section with persisted state.
- FE/modules/shell/primitives.tsx:69-102 — `Chips`, filter chips; active chip uses a `#2563eb` fallback and `text-white` (line 91).
- FE/modules/shell/primitives.tsx:106-134 — `SearchBox`; focus ring uses a `#2563eb` fallback (line 131).
- FE/modules/shell/primitives.tsx:138-174 — `Pager`.
- FE/modules/shell/primitives.tsx:178-203 — `Row`, height `var(--row-h)`, selected and hover background `--surface-hover`.

## Theme and tokens
- FE/modules/theme/theme.css:7-140 — `:root`: spacing, type, radius, shadow, motion scales and the light colour tokens, plus alias and legacy names (120-139).
- FE/modules/theme/theme.css:145-221 — `.dark`: the dark colour and shadow tokens.
- FE/modules/theme/theme.css:227-240 — base `html`, `body` styles.
- FE/modules/theme/theme.css:246-505 — component classes from removed pages (`.app-header`, `.nav`, `.panel`, `.task`, `.markdown-content`, others); a class-use probe found none of the tested names in a tsx `className`.
- FE/modules/theme/theme.css:511-612 — `.hljs` syntax colours as literal hex, light and dark.
- FE/modules/theme/tailwind.css:1-8 — Tailwind import, typography plugin, `dark` variant on `.dark`, `color-scheme: light dark` on `:root` for both themes.
- FE/modules/theme/tailwind.css:15-464 — unlayered component classes (`.btn*`, `.card`, `.status-badge*`, `.input`, `.modal-*`, `.table-*`, `.kanban-*`); the class-use probe found none in a tsx `className`; `.btn` and `.btn-danger` carry literal `#ffffff` and `#b91c1c` (44, 108, 116).
- FE/modules/theme/tailwind.css:297-308 — unlayered `.gap-N` and `.p-N` that share names with Tailwind utilities the pages use, so they override them.
- FE/modules/theme/theme.css:440-446 — unlayered `.font-mono` and `.tabular-nums`, same names as Tailwind utilities the pages use.
- FE/modules/theme/ThemeProvider.tsx:13-30 — theme state, default `dark`, stored under `localStorage` key `theme`, toggles `.dark` on `html`.
- FE/assets/fonts/fonts.css:1-74 — bundled `@font-face` rules: Inter 400/500/600/700, JetBrains Mono 400/500/700.
- node_modules/tailwindcss/theme.css:279-283 — Tailwind 4.1.18 default breakpoints sm 40rem, md 48rem, lg 64rem, xl 80rem, 2xl 96rem.
- node_modules/tailwindcss/theme.css:299-303 — Tailwind default `--text-xs`, `--text-sm`, `--text-base` (.75rem, .875rem, 1rem); `theme.css` redefines the same names (11px, 12px, 14px).
- probe (vite build to scratch, 2026-10-28) — the built stylesheet carries both `--text-sm:.875rem` (Tailwind `@layer theme`) and `--text-sm: 12px` (unlayered `theme.css`), the same for `--radius-md`; `.text-sm` compiles to `font-size:var(--text-sm)`.

## Pages: literal colours and component sites
- FE/modules/shell/NowPage.tsx:88 — pill with `color-mix` on `--accent-primary` with `#2563eb` fallback.
- FE/modules/shell/NowPage.tsx:142 — error text on undefined `--accent-danger` with `#dc2626` fallback; same at 208, 248, 727.
- FE/modules/shell/NowPage.tsx:193 — primary action button, `#2563eb` fallback and `text-white`; same at 522.
- FE/modules/shell/RunsPage.tsx:127 — active filter `text-white`.
- FE/modules/shell/RunsPage.tsx:192-193 — paused and waiting pills, literal `#f59e0b` and Tailwind `amber-600`/`amber-400`.
- FE/modules/shell/RunsPage.tsx:306 — danger button `text-white`; primary at 412.
- FE/modules/shell/RunPage.tsx:305 — wait pill, literal `#f59e0b` and `amber-600`/`amber-400`.
- FE/modules/shell/RunPage.tsx:319 — live-now step log `pre`.
- FE/modules/shell/RunPage.tsx:453-457 — task status pill styles, `done` literal `#22c55e` and `green-600`/`green-400`.
- FE/modules/shell/RunPage.tsx:487 — task table; rounds 540, spawns 569, run setup 728.
- FE/modules/shell/RunPage.tsx:640-653 — ledger and activity tabs (`role="tablist"`, `role="tab"`).
- FE/modules/shell/RunPage.tsx:660-698 — `LogView`: filter input, follow switch, scrolling `pre`.
- FE/modules/shell/SpecsPage.tsx:32-33 — spec status pills, `#2563eb` fallback and literal `#22c55e`/`green-*`; deferral pills 233-234.
- FE/modules/shell/SpecsPage.tsx:297 — spec runs table; phases table 328.
- FE/modules/shell/DeferralsPage.tsx:49-50 — deferral status pills, same literals.
- FE/modules/shell/pause.ts:48 — paused-age text class, `amber-600`/`amber-400`.
- FE/modules/shell/UsagePage.tsx:50-58 — usage window bar, inline style on tokens.
- FE/modules/shell/UsageTrend.tsx:13 — `SERIES`, six literal hex chart colours; used inline at 98, 109, 116, 125.
- FE/modules/auth/LoginPanel.tsx:36-44 — sign-in dialog, `bg-black/50` scrim; button `text-white` at 65.

## Tests and checks
- e2e/worktree-shell.spec.ts:204-212 — nav links in fixed order.
- e2e/worktree-shell.spec.ts:242-256 — density radio switches a row between 36 and 32 px.
- e2e/worktree-shell.spec.ts:296-308 — at 1000 px the panel stacks below the list.
- e2e/worktree-shell.spec.ts:391-410 — no page scrolls sideways at 1000 and 375 px.
- playwright.worktree.config.ts:18-71 — worktree e2e config, Chromium, screenshots on (38), dashboard 5084, frontend 5184.
- vitest.config.ts:8-9 — unit tests are `src/**/*.test.ts`; `src/dashboard_frontend/**` excluded; no frontend unit tests exist.
- tsconfig.json:20 — `tsc` excludes `src/dashboard_frontend/**`.
- package.json:25-44 — scripts (`build`, `build:dashboard`, `test`, `test:e2e:worktree`).
- package.json:56-90 — dependencies; 91-108 devDependencies.

## References outside the frontend
- docs/mockups/sdd-dashboard-linear.html:8-18 — the Linear mock's light and dark colour tokens (accent `#5e6ad2` light, `#7170ff` dark; chart series s1-s4).
- docs/mockups/sdd-dashboard-linear.html:37 — mock frame 208 px sidebar, 360 px panel; row height 36 px at 105.
- docs/dashboard-redesign.md:258-259 — density open item, mock uses 36 px rows.
- src/watch/render.ts:12-19 — `--watch` terminal palette, ANSI basic colour codes.
- docs/controller-design.md:255 — overwatch HUD retired.
