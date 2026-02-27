# Next.js + MDX Migration Plan

> **Status:** Draft / Feasibility Study
> **Scope:** Migrate the Ren's Courses site from BlazorStatic (.NET 9) to Next.js with MDX for Static Site Generation (SSG).

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Migration Plan](#3-migration-plan)
4. [Component-by-Component Mapping](#4-component-by-component-mapping)
5. [Potential Issues & Risks](#5-potential-issues--risks)
6. [Feasibility Assessment](#6-feasibility-assessment)
7. [Open Questions](#7-open-questions)

---

## 1. Current Architecture Summary

| Layer | Technology | Details |
|---|---|---|
| **Framework** | BlazorStatic 1.0.0-beta.14 | .NET 9, Razor components, SSG at build time via `dotnet run` |
| **Styling** | Tailwind CSS v4 | `@tailwindcss/cli` builds `app.css`, typography plugin, custom theme variables |
| **Content** | Markdown + YAML frontmatter | 4 content types: Materials, Projects, Bookings, CalendarEvents |
| **Client JS** | Vanilla JS | `site.js` (orchestrator), `calendar.js`, `theme.js`, `code-features.js`, `scroll-button.js`, `toc.js`, `service-worker.js` |
| **Syntax Highlighting** | Prism.js (CDN) | Loaded from CDN with language packs (Python, NASM, Bash, C#, etc.) |
| **Services** | C# singletons | `HolidaysProvider` (external API + fallback), `CourseContentProvider` (term-aware filtering), `FrontmatterStatusService`, `ThemeService` (JS interop), `BuildTimeProvider` (frozen time) |
| **Deployment** | GitHub Actions → GitHub Pages + Netlify | Dual-target builds (different `<base href>`), HTML minification, hourly CRON rebuilds |
| **Extras** | PWA (service worker), RSS feeds (Python script), cal.com bookings | |

### Content Types & Frontmatter Schemas

**Materials** (`Content/Materials/*.md`):
```yaml
title: string
subtitle: string
lead: string
published: date
tags: [string]
authors: [{name, gitHubUserName, nickname}]
downloadLink: string (optional)
deadline: date (optional)
progressReportDates: [date] (optional)
defenseDates: [date] (optional)
```

**Projects** (`Content/Projects/**/*.md`):
```yaml
title: string
published: date
tags: [string]
authors: [{name, gitHubUserName, nickname}]
abstract: string
docs: string (optional)
repository: string (optional)
thumbnail: string (optional)
schoolYear: string
```

**Bookings** (`Content/Bookings/*.md`):
```yaml
name: string
calendar: string (URL)
desc: string
tags: [string]
```

**Calendar Events** (`Content/Events/*.md`):
```yaml
title: string
dates: [date]
tooltip: string
eventType: Holiday | Release | Deadline | Progress | Defense | Custom
url: string (optional)
cssClass: string (optional)
```

---

## 2. Proposed Architecture

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 14+ (App Router) | Industry-standard React SSG, excellent MDX support, huge ecosystem |
| **Content** | MDX via `@next/mdx` or Contentlayer/Velite | Direct MDX rendering with frontmatter via `gray-matter` |
| **Styling** | Tailwind CSS v4 | Reuse existing Tailwind config and utility classes (minimal changes) |
| **Syntax Highlighting** | `rehype-pretty-code` + Shiki | Build-time highlighting, no CDN dependency, better theme support |
| **Deployment** | `next export` → GitHub Pages + Netlify | Same dual-deploy pattern via GitHub Actions |
| **PWA** | `next-pwa` or `@ducanh2912/next-pwa` | Drop-in service worker support |

---

## 3. Migration Plan

### Phase 0: Preparation
- [ ] Set up a new Next.js 14+ project with TypeScript alongside the existing codebase (or in a separate branch).
- [ ] Configure Tailwind CSS v4 in the Next.js project, reusing existing CSS variables and theme tokens from `Styles/app.css`.
- [ ] Set up MDX processing pipeline (`@next/mdx` or a content SDK like Contentlayer/Velite).
- [ ] Configure `gray-matter` for YAML frontmatter parsing.
- [ ] Define TypeScript interfaces for all 4 frontmatter schemas (Materials, Projects, Bookings, CalendarEvents).

### Phase 1: Content Layer
- [ ] Migrate all `Content/Materials/*.md` files to MDX (rename `.md` → `.mdx`, or configure MDX to accept `.md`).
- [ ] Migrate `Content/Projects/**/*.md`, `Content/Bookings/*.md`, `Content/Events/*.md`.
- [ ] Build content utility functions to replace C# services:
  - `getCourseContent()` → replaces `CourseContentProvider` (term-aware filtering, tag extraction).
  - `getHolidays()` → replaces `HolidaysProvider` (API fetch at build time via `getStaticProps`/`generateStaticParams`).
  - `getFrontmatterStatus()` → replaces `FrontmatterStatusService` (deadline logic).
  - `getBuildTime()` → replaces `BuildTimeProvider` (frozen timestamp from env var).

### Phase 2: Pages & Components
- [ ] Convert `Components/Layout/MainLayout.razor` → `app/layout.tsx` (root layout).
- [ ] Convert `Components/Layout/NavMenu.razor` → `components/NavMenu.tsx` (navbar with scroll-hide, hamburger, theme toggle).
- [ ] Convert `Components/Pages/Blog.razor` → `app/articles/[slug]/page.tsx` (individual article pages with TOC sidebar).
- [ ] Convert `Components/Pages/Materials.razor` → `app/materials/page.tsx` and `app/materials/[tag]/page.tsx` (tag catalog + filtered list).
- [ ] Convert `Components/Pages/Calendar.razor` → `app/calendar/page.tsx` (interactive calendar with event sources).
- [ ] Convert `Components/Pages/Bookings.razor` → `app/bookings/page.tsx` (booking card grid).
- [ ] Convert `Components/Pages/Projects.razor` → `app/projects/page.tsx` and `app/projects/[tag]/page.tsx`.
- [ ] Convert shared components:
  - `CatalogsList.razor` → `components/CatalogsList.tsx` (generic tag cloud).
  - `PostsList.razor` → `components/PostsList.tsx` (course material cards).
  - `ProjectsList.razor` → `components/ProjectsList.tsx` (expandable project details).
  - `ThemeSwitcher.razor` → `components/ThemeSwitcher.tsx` (theme selection).

### Phase 3: Interactive Features (Client Components)
- [ ] Port `calendar.js` logic into a React `CalendarView` client component (filtering, month navigation, popover).
- [ ] Port `theme.js` → React context + localStorage (theme persistence, Prism theme switching or migrate to Shiki).
- [ ] Port `code-features.js` → MDX `<pre>` component with copy button (or use `rehype-pretty-code`).
- [ ] Port `toc.js` → React `TableOfContents` client component with IntersectionObserver for scroll-spy.
- [ ] Port `scroll-button.js` → React `ScrollToTop` client component.
- [ ] Port or replace `service-worker.js` → `next-pwa` plugin.

### Phase 4: Build & Deploy
- [ ] Configure `next.config.js` with `output: 'export'` for full static export.
- [ ] Handle dual base path: environment variable for `basePath` (`/Ren-s-Courses` for GitHub Pages, `/` for Netlify).
- [ ] Port RSS feed generation: either use a Next.js RSS plugin or keep the Python `generate_feed.py` script.
- [ ] Update GitHub Actions workflow:
  - Replace `dotnet run` with `npm run build && npx next export`.
  - Keep the dual-deploy pattern (two builds with different `basePath`).
  - Keep the frozen time (`STATIC_GEN_TIME`) and term dates (`TERM_START`, `TERM_END`) as env vars.
  - Keep CRON rebuild schedule.
- [ ] Configure HTML minification (Next.js minifies by default, but verify).
- [ ] Verify `_redirects` / `_headers` for Netlify if needed.

### Phase 5: Validation & Cleanup
- [ ] Visual regression testing: compare old and new site output page-by-page.
- [ ] Verify all interactive features: calendar filtering, month navigation, theme switching, TOC scroll-spy, copy buttons.
- [ ] Verify PWA install functionality.
- [ ] Verify RSS feeds are generated correctly.
- [ ] Remove .NET project files (`*.csproj`, `*.sln`, `Program.cs`, `Components/`, `Models/`, `Services/`, `Properties/`).
- [ ] Update `README.md` with new build instructions (`npm run dev`, `npm run build`).

---

## 4. Component-by-Component Mapping

| BlazorStatic (Current) | Next.js (Proposed) | Complexity | Notes |
|---|---|---|---|
| `App.razor` | `app/layout.tsx` + `app/page.tsx` | Low | Head metadata, fonts, scripts move to `layout.tsx` |
| `MainLayout.razor` | `app/layout.tsx` | Low | Flex layout, footer |
| `NavMenu.razor` | `components/NavMenu.tsx` | Medium | Scroll-hide JS → React `useEffect` + `useState` |
| `Blog.razor` | `app/articles/[slug]/page.tsx` | Medium | MDX rendering, TOC sidebar, responsive layout |
| `Materials.razor` | `app/materials/[[...tag]]/page.tsx` | Low | Tag cloud + filtered list |
| `Calendar.razor` | `app/calendar/page.tsx` | **High** | Complex: 3 event sources, grid layout, popover, filtering, responsive |
| `Bookings.razor` | `app/bookings/page.tsx` | Low | Simple card grid |
| `Projects.razor` | `app/projects/[[...tag]]/page.tsx` | Low | Tag cloud + expandable cards |
| `CatalogsList.razor` | `components/CatalogsList.tsx` | Low | Generic tag cloud (TypeScript generics) |
| `PostsList.razor` | `components/PostsList.tsx` | Low | Card grid with status badges |
| `ProjectsList.razor` | `components/ProjectsList.tsx` | Low | `<details>` cards |
| `ThemeSwitcher.razor` | `components/ThemeSwitcher.tsx` | Low | `useState` + localStorage |
| `CourseFrontMatter.cs` | `types/materials.ts` | Low | TypeScript interface |
| `CalendarEventFrontmatter.cs` | `types/calendar.ts` | Low | TypeScript interface |
| `BookingFrontmatter.cs` | `types/bookings.ts` | Low | TypeScript interface |
| `ProjectFrontMatter.cs` | `types/projects.ts` | Low | TypeScript interface |
| `CourseContentProvider.cs` | `lib/content.ts` | Medium | Term-aware filtering, `fs` + `gray-matter` at build time |
| `HolidaysProvider.cs` | `lib/holidays.ts` | Medium | API fetch at build time, fallback holidays logic |
| `FrontmatterStatusService.cs` | `lib/status.ts` | Low | Pure date comparison logic |
| `BuildTimeProvider.cs` | `lib/buildTime.ts` | Low | `process.env.STATIC_GEN_TIME` |
| `ThemeService.cs` | React Context / `useTheme` hook | Low | Direct localStorage, no C#-JS bridge needed |
| `calendar.js` | Client component | **High** | Complex DOM manipulation → React state management |
| `theme.js` | `useTheme` hook | Low | Simpler without Blazor JS interop |
| `code-features.js` | MDX component / rehype plugin | Medium | Replace Prism CDN with build-time Shiki |
| `toc.js` | `components/TableOfContents.tsx` | Medium | IntersectionObserver in React |
| `scroll-button.js` | `components/ScrollToTop.tsx` | Low | Simple scroll listener |
| `service-worker.js` | `next-pwa` plugin | Low | Plugin handles generation |
| `generate_feed.py` | `lib/rss.ts` or keep Python script | Low | Can use `feed` npm package or keep existing |
| `build-and-publish.yml` | Updated workflow | Medium | Replace `dotnet` steps with `npm`/`npx` steps |

---

## 5. Potential Issues & Risks

### 5.1 High-Risk: Calendar Component Complexity
The `Calendar.razor` component is the most complex piece (~450 lines). It:
- Merges 3 event sources (holidays API, custom events, frontmatter-derived dates).
- Renders a full month grid with overflow handling ("+X more" popover).
- Has tag-based filtering and month navigation.
- Uses two completely different layouts (grid for desktop, list for mobile).

**Risk:** This is a significant rewrite. The vanilla JS in `calendar.js` does heavy DOM manipulation (popover positioning, cell expansion) that must be converted to React state management.

**Mitigation:** Build the calendar as an isolated client component first. Consider using a headless calendar library (e.g., `react-day-picker`) for the grid layout, or build from scratch with CSS Grid.

### 5.2 Medium-Risk: Holidays API at Build Time
`HolidaysProvider` fetches Philippine holidays from the Nager.Date API at runtime during SSG. In Next.js, this would happen during `getStaticProps` / `generateStaticParams`.

**Risk:** Build failures if the API is down during `next build`. The current C# code has a 5-second timeout with a fallback to calculated holidays.

**Mitigation:** Keep the same pattern: try-catch with `fetch()` + timeout in a server-side utility, fallback to hardcoded holidays. This is straightforward to port.

### 5.3 Medium-Risk: Frozen Build Time & Term Dates
The site uses `BuildTimeProvider` (reads `STATIC_GEN_TIME`, `TERM_START`, `TERM_END` from environment variables) to freeze the "current time" across the entire build. This ensures consistent deadline status, filtering, and calendar rendering.

**Risk:** In Next.js, `process.env` values are available at build time, but care must be taken to ensure they are evaluated once and reused consistently, not re-evaluated per page.

**Mitigation:** Create a shared `lib/buildTime.ts` that reads and caches these values. Use `Date` objects initialized once at module level.

### 5.4 Medium-Risk: Dual Base Path Deployment
The current workflow builds twice: once with `<base href="/">` (Netlify) and once with `<base href="/Ren-s-Courses/">` (GitHub Pages). In Next.js, this is controlled by `basePath` in `next.config.js`.

**Risk:** Need two separate `next build` runs with different `basePath` values, or a single build with asset prefix handling.

**Mitigation:** Use an environment variable (e.g., `NEXT_PUBLIC_BASE_PATH`) to set `basePath` in `next.config.js`. The workflow runs `next build` twice, just like today.

### 5.5 Low-Risk: Prism.js → Shiki Migration
Currently, syntax highlighting is done client-side via Prism.js loaded from CDN. The `code-features.js` adds copy buttons and language labels.

**Risk:** Switching to `rehype-pretty-code` (Shiki) means build-time highlighting. Must ensure all current languages are supported (Python, NASM, Bash, C#, Java, Kotlin, etc.). NASM support may need a custom grammar.

**Mitigation:** Shiki supports all these languages except possibly NASM. Check Shiki's language list. Alternatively, keep Prism.js as a client-side script if Shiki lacks NASM support.

### 5.6 Low-Risk: RSS Feed Generation
Currently handled by a standalone Python script (`.github/utils/generate_feed.py`).

**Risk:** Minimal. Can either keep the Python script as-is in the workflow, or port it to a Node.js script using the `feed` npm package.

**Mitigation:** Keep the Python script initially. Port later if desired.

### 5.7 Low-Risk: PWA / Service Worker
Currently a custom `service-worker.js` with network-first caching.

**Risk:** Minimal. `next-pwa` or `@ducanh2912/next-pwa` provides equivalent functionality out of the box.

**Mitigation:** Use the `next-pwa` plugin. Verify offline behavior matches expectations.

### 5.8 Low-Risk: Tailwind CSS v4 Compatibility
The site uses Tailwind CSS v4 with custom theme tokens (CSS variables for colors). Tailwind v4 is already well-supported in Next.js.

**Risk:** Minimal. The existing `Styles/app.css` and theme variable approach should transfer directly.

**Mitigation:** Copy `app.css` into the Next.js project. Update the Tailwind build to use `@tailwindcss/postcss` (already a dependency).

### 5.9 Content Files Are Already Markdown
All content is standard Markdown with YAML frontmatter. No Blazor-specific syntax is used in content files.

**Risk:** None. Files can be used as-is. Renaming to `.mdx` is optional (Next.js MDX can process `.md` files).

---

## 6. Feasibility Assessment

### Verdict: ✅ Feasible, with moderate effort

| Criterion | Assessment |
|---|---|
| **Content compatibility** | ✅ Excellent — all content is standard Markdown + YAML frontmatter, no conversion needed |
| **Styling compatibility** | ✅ Excellent — Tailwind v4 transfers directly, CSS variables are framework-agnostic |
| **Component complexity** | ⚠️ Moderate — most components are straightforward, **Calendar is the main challenge** |
| **Service logic portability** | ✅ Good — all C# services are pure logic (date math, filtering, API calls) easily portable to TypeScript |
| **Interactive JS portability** | ⚠️ Moderate — vanilla JS DOM manipulation must be converted to React patterns |
| **Build/Deploy compatibility** | ✅ Good — `next export` produces the same static HTML output as BlazorStatic |
| **Ecosystem maturity** | ✅ Excellent — Next.js + MDX is a proven, well-documented stack |

### Estimated Effort

| Phase | Estimated Time |
|---|---|
| Phase 0: Setup | 1–2 days |
| Phase 1: Content layer | 1–2 days |
| Phase 2: Pages & components | 3–5 days |
| Phase 3: Interactive features | 2–3 days (mostly Calendar) |
| Phase 4: Build & deploy | 1–2 days |
| Phase 5: Validation & cleanup | 1–2 days |
| **Total** | **~9–16 days** |

### Why Migrate?

| Advantage | Details |
|---|---|
| **Larger ecosystem** | React/Next.js has a vastly larger package ecosystem than Blazor |
| **Developer familiarity** | TypeScript/React skills are more common than C#/Blazor in web development |
| **Better MDX support** | MDX allows embedding React components directly in Markdown content |
| **Faster iteration** | Hot reload, better DX tooling, faster builds |
| **No .NET dependency** | Eliminates the need for .NET SDK in CI/CD, simplifying the build pipeline |
| **Future-proof** | Next.js is actively maintained with strong community support |

### Why Stay?

| Advantage | Details |
|---|---|
| **Working system** | The current site is fast, functional, and deployed |
| **No bugs to fix** | Migration introduces risk of new bugs for zero immediate user-facing benefit |
| **BlazorStatic maturity** | If BlazorStatic reaches 1.0 stable, it may resolve current beta limitations |
| **C# type safety** | Strongly-typed frontmatter models and DI are already well-established |
| **Migration cost** | ~2 weeks of effort that could be spent on new features instead |

---

## 7. Open Questions

1. **Content SDK choice:** Use `@next/mdx` (built-in, simpler) or Contentlayer/Velite (typed content, more features)? Contentlayer is unmaintained; Velite is the spiritual successor.
2. **NASM syntax highlighting:** Does Shiki support NASM assembly? If not, keep Prism.js or find a Shiki grammar.
3. **Calendar approach:** Build from scratch or use a headless calendar library? The current calendar is highly custom.
4. **Monorepo or clean start?** Migrate in-place (risk of mixing .NET and Node.js configs) or start fresh in a new branch/repo?
5. **Incremental migration?** Is it possible/desirable to migrate page-by-page, or is a big-bang switch more practical given the shared layout and services?
6. **Booking system:** The current cal.com integration is just external links. No changes needed, but verify link generation.
7. **RSS feed strategy:** Keep the Python script or port to Node.js? The Python script works fine and is independent of the main build.
