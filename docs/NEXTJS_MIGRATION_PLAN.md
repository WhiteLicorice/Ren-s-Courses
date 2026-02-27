# Next.js + MDX Migration Plan

> **Status:** Approved — Ready for Implementation
> **Scope:** Migrate the Ren's Courses site from BlazorStatic (.NET 9) to Next.js with MDX for Static Site Generation (SSG).
> **Strategy:** Fresh branch, module-by-module incremental migration.

---

## Table of Contents

1. [Current Architecture Summary](#1-current-architecture-summary)
2. [Proposed Architecture](#2-proposed-architecture)
3. [Key Technology Decisions](#3-key-technology-decisions)
4. [Migration Plan](#4-migration-plan)
5. [Component-by-Component Mapping](#5-component-by-component-mapping)
6. [Potential Issues & Risks](#6-potential-issues--risks)
7. [Feasibility Assessment](#7-feasibility-assessment)

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
| **Content** | [Velite](https://github.com/zce/velite) v0.3+ | Type-safe data layer with Zod schemas, MDX/Markdown support, build-time processing; spiritual successor to Contentlayer |
| **Styling** | Tailwind CSS v4 | Reuse existing Tailwind config and utility classes (minimal changes) |
| **Syntax Highlighting** | `rehype-pretty-code` + Shiki + [custom NASM grammar](#31-content-sdk-velite) | Build-time highlighting, no CDN dependency, better theme support |
| **Calendar** | [TanStack Time](https://github.com/TanStack/time) | Headless calendar primitives for React, framework-agnostic, composable |
| **RSS** | [`feed`](https://github.com/jpmonette/feed) npm package (build-time) | Atomic RSS generation within `next build`, eliminating Python dependency |
| **Deployment** | `next export` → GitHub Pages + Netlify | Same dual-deploy pattern via GitHub Actions |
| **PWA** | `next-pwa` or `@ducanh2912/next-pwa` | Drop-in service worker support |

---

## 3. Key Technology Decisions

The following decisions resolve the open questions from the initial feasibility study.

### 3.1 Content SDK: Velite

**Decision:** Use **[Velite](https://github.com/zce/velite)** (v0.3.1, latest release Dec 2025) as the content SDK.

**Why Velite over `@next/mdx`:**
- **Zod-powered schemas** — Define frontmatter as Zod schemas with full TypeScript inference. This directly replaces the current C# `CourseFrontMatter`, `ProjectFrontMatter`, etc. model classes with equivalent type safety.
- **Collection-based** — Define `defineCollection()` for each content type (Materials, Projects, Bookings, CalendarEvents), mirroring the current `AddBlazorStaticContentService<T>()` registrations in `Program.cs`.
- **Built-in MDX + Markdown** — Supports both `.md` and `.mdx` files natively via `s.markdown()` and `s.mdx()` schema helpers.
- **Rehype/remark plugin support** — Integrates `rehype-pretty-code` for syntax highlighting directly in the Velite config.
- **Next.js integration** — Official Next.js example exists. Velite runs as a build-time plugin via `next.config.ts`, outputting typed JSON data to `.velite/` for import.
- **Active maintenance** — 740+ stars, last release Dec 2025, used by Chakra UI and Ark UI.

**Velite config sketch** (`velite.config.ts`):
```typescript
import { defineCollection, defineConfig, s } from 'velite'
import rehypePrettyCode from 'rehype-pretty-code'

const materials = defineCollection({
  name: 'Material',
  pattern: 'Materials/**/*.md',
  schema: s.object({
    title: s.string(),
    subtitle: s.string(),
    lead: s.string(),
    published: s.isodate(),
    tags: s.array(s.string()),
    authors: s.array(s.object({
      name: s.string(),
      gitHubUserName: s.string(),
      nickname: s.string(),
    })),
    slug: s.slug('material'),
    downloadLink: s.string().optional(),
    deadline: s.isodate().optional(),
    progressReportDates: s.array(s.isodate()).optional(),
    defenseDates: s.array(s.isodate()).optional(),
    content: s.markdown(),   // rendered HTML
    toc: s.toc(),            // auto-generated TOC
  }),
})

const calendarEvents = defineCollection({
  name: 'CalendarEvent',
  pattern: 'Events/**/*.md',
  schema: s.object({
    title: s.string(),
    dates: s.array(s.isodate()),
    tooltip: s.string(),
    eventType: s.enum(['Holiday','Release','Deadline','Progress','Defense','Custom']),
    url: s.string().optional(),
    cssClass: s.string().optional(),
  }),
})

// ... projects, bookings collections similarly

export default defineConfig({
  root: 'content',
  output: { data: '.velite', assets: 'public/static', clean: true },
  collections: { materials, calendarEvents, /* projects, bookings */ },
  markdown: { rehypePlugins: [[rehypePrettyCode, { /* shiki options */ }]] },
})
```

**Next.js integration** (`next.config.ts`):
```typescript
const isDev = process.argv.indexOf('dev') !== -1
const isBuild = process.argv.indexOf('build') !== -1
if (!process.env.VELITE_STARTED && (isDev || isBuild)) {
  process.env.VELITE_STARTED = '1'
  import('velite').then(m => m.build({ watch: isDev, clean: !isDev }))
}
```

### 3.2 Syntax Highlighting: Shiki + Custom NASM TextMate Grammar

**Decision:** Use **Shiki** (via `rehype-pretty-code`) with a custom TextMate grammar for NASM/x86 assembly loaded from [`13xforever/x86-assembly-textmate-bundle`](https://github.com/13xforever/x86-assembly-textmate-bundle).

**Investigation findings:**
- Shiki natively supports Python, Bash, C#, Java, Kotlin, and most languages used in the course materials.
- Shiki does **not** ship a built-in NASM grammar, but it uses the TextMate grammar format and supports loading custom grammars via `shiki.loadLanguage()`.
- The [`13xforever/x86-assembly-textmate-bundle`](https://github.com/13xforever/x86-assembly-textmate-bundle) repository provides:
  - `x86_64 Assembly.tmLanguage` — A compiled TextMate grammar (76KB plist XML) covering NASM/YASM/TASM with instruction sets up to AVX-512, AES-NI, APX, and more.
  - `Nasm Assembly.sublime-syntax` — A Sublime Text syntax definition (75KB).
  - A VS Code extension submodule at `vs code/language-x86_64-assembly`.
- The `.tmLanguage` file can be loaded directly by Shiki at build time as a custom grammar.
- License: MIT — compatible for use.

**Implementation approach:**
```typescript
// In rehype-pretty-code config within velite.config.ts
import nasmGrammar from './grammars/x86_64-assembly.tmLanguage.json'

const shikiOptions = {
  theme: 'github-dark',
  langs: [
    // Built-in languages are loaded automatically
    // Custom NASM grammar:
    {
      id: 'nasm',
      scopeName: 'source.asm.x86_64',
      grammar: nasmGrammar,
      aliases: ['asm', 'x86', 'x86_64'],
    },
  ],
}
```

**Steps:**
1. Download the `x86_64 Assembly.tmLanguage` (plist XML) from the repository.
2. Convert it to JSON using `plist` npm package or VS Code's built-in converter (Shiki prefers JSON grammars).
3. Place in `grammars/nasm.tmLanguage.json` in the project.
4. Register in the `rehype-pretty-code` Shiki config with aliases `nasm`, `asm`, `x86`.

### 3.3 Calendar: TanStack Time (Headless) + Custom Event Layer

**Decision:** Use **[TanStack Time](https://github.com/TanStack/time)** as the headless calendar primitive, with a custom event overlay layer.

**Why TanStack Time:**
- **Headless** — Provides calendar math, day/week/month grid generation, and navigation without any UI, giving full control over Tailwind styling.
- **Framework-agnostic core** — The `@tanstack/time-core` package handles calendar logic; `@tanstack/react-time` provides React hooks.
- **Modern & maintained** — From the TanStack ecosystem (TanStack Table, TanStack Query, etc.), 566+ stars, actively developed.
- **Composable primitives** — Provides `useCalendar()` hook that returns day cells, navigation functions, and state — directly replacing the current `initCalendarNav()` and month grid rendering in `calendar.js`.

**Why not `react-day-picker`:**
- `react-day-picker` (6.7K stars) is primarily a date picker component, not a calendar view. It's designed for selecting dates, not displaying events. While it could be adapted, it would require fighting against its API for event display, popover overflow, and the dual desktop/mobile layout.

**Alternative considered: `use-lilius`:**
- `use-lilius` (277 stars) is a lightweight headless hook that provides calendar grid data. It's simpler than TanStack Time and could be a fallback if TanStack Time proves too heavy. However, TanStack Time has better TypeScript support and is more actively maintained.

**Architecture for the calendar migration:**

```
┌─────────────────────────────────────────────────────┐
│ app/calendar/page.tsx (Server Component)             │
│  • Fetches events from Velite at build time          │
│  • Fetches holidays from API with fallback           │
│  • Merges all 3 event sources into CalendarEvent[]   │
│  • Passes events + term dates as props               │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│ components/CalendarView.tsx ("use client")           │
│  • useCalendar() from TanStack Time for grid state   │
│  • useState for current month, active filter         │
│  • Tag filtering (replaces filterCalendar JS)        │
│  • Month navigation (replaces changeMonth JS)        │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Desktop: CSS Grid 7-col month view           │    │
│  │  • CalendarCell with event chips             │    │
│  │  • EventPopover (floating, portal-based)     │    │
│  │    for overflow events (replaces popover JS) │    │
│  └─────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Mobile: Vertical list (events-only days)     │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Key improvements over current implementation:**
- **React state management** replaces global `window.changeMonth`, `window.filterCalendar` functions and direct DOM manipulation.
- **Popover via React portal** (e.g., `@floating-ui/react` or Radix UI `Popover`) replaces the manual `position:fixed` + `getBoundingClientRect()` positioning in `calendar.js`.
- **Event data as props** instead of pre-rendered hidden HTML divs (the current `.overflow-events` pattern).
- **Single component tree** instead of two separate render paths for desktop/mobile that need to stay in sync.

### 3.4 Migration Strategy: Fresh Branch, Module-by-Module

**Decision:** Start in a **fresh branch** (e.g., `feat/nextjs-migration`). Migrate **module by module**, pulling content/assets from `master` as needed.

**Rationale:**
- Avoids polluting the working `master` branch with in-progress migration changes.
- Each module can be independently tested and validated before moving to the next.
- Content files (`Content/**/*.md`) and static assets (`wwwroot/`) can be copied directly from `master` since they contain no framework-specific code.
- The `.NET` project files and `Components/` directory are left untouched on `master` until the migration branch is complete and merged.

**Module migration order** (by dependency and complexity, simplest first):

| Order | Module | Depends On | Notes |
|---|---|---|---|
| 1 | **Scaffolding** | — | Next.js + Velite + Tailwind + Shiki setup, `next.config.ts`, `velite.config.ts`, theme tokens |
| 2 | **Layout** | Scaffolding | `app/layout.tsx`, `NavMenu.tsx`, `ThemeSwitcher.tsx`, footer |
| 3 | **Materials** (Blog) | Layout, Velite | Content layer, `PostsList`, `CatalogsList`, article pages, TOC |
| 4 | **Projects** | Layout, Velite | `ProjectsList`, tag filtering, expandable cards |
| 5 | **Bookings** | Layout, Velite | Simple card grid with external cal.com links |
| 6 | **Calendar** | Layout, Velite, TanStack Time | Most complex; all 3 event sources, filtering, popover, responsive |
| 7 | **RSS Feed** | Materials Velite collection | Build-time generation via `feed` npm package |
| 8 | **PWA** | Layout | `next-pwa` plugin, service worker, manifest |
| 9 | **Build & Deploy** | All modules | Dual-target CI/CD, HTML minification, CRON schedule |
| 10 | **Cleanup** | Everything | Remove .NET artifacts, update README, visual regression |

### 3.5 RSS Feed: Build-Time Generation in Next.js

**Decision:** Generate RSS feeds as part of the Next.js build step using the [`feed`](https://github.com/jpmonette/feed) npm package (1.3K stars, TypeScript, supports RSS 2.0 / Atom / JSON Feed), eliminating the Python script dependency.

**Why move away from the Python script:**
- **Atomicity** — The current Python script (`generate_feed.py`) runs as a separate CI step *before* the site build. If the build fails after RSS generation, or if content changes between the RSS step and the build step, the feeds may be inconsistent with the site. Generating feeds within `next build` ensures they are always atomic with the rendered HTML.
- **Single runtime** — Eliminates the Python 3.12 setup step in CI, reducing build time and dependencies (no more `pip install`, `requirements.txt`).
- **Shared data** — The Velite content collections are already parsed and available. The RSS generator can import directly from `.velite/` data, reusing the same term-filtering and date logic as the site itself.

**Implementation approach:**

RSS feeds will be generated as a **post-build script** that runs immediately after `next build`, reading from the Velite output data (which is generated during the build).

```typescript
// scripts/generate-feeds.ts
import { Feed } from 'feed'
import { materials } from '../.velite'  // Velite typed output
import { writeFileSync } from 'fs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://whitelicorice.github.io/Ren-s-Courses'
const TERM_START = new Date(process.env.TERM_START!)
const TERM_END = new Date(process.env.TERM_END!)
const BUILD_TIME = new Date(process.env.STATIC_GEN_TIME || new Date().toISOString())

// Filter posts the same way the site does
const visiblePosts = materials
  .filter(p => new Date(p.published) <= BUILD_TIME)
  .filter(p => {
    const pub = new Date(p.published)
    return pub >= TERM_START && pub <= TERM_END
  })
  .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime())

// Master feed
const masterFeed = new Feed({
  title: "Ren's Courses",
  description: "Course materials for CS units at UP Visayas",
  id: SITE_URL,
  link: SITE_URL,
  updated: BUILD_TIME,
  copyright: 'All rights reserved.',
})

for (const post of visiblePosts) {
  masterFeed.addItem({
    title: post.title,
    id: `${SITE_URL}/articles/${post.slug}`,
    link: `${SITE_URL}/articles/${post.slug}`,
    description: post.lead,
    date: new Date(post.published),
    category: post.tags.map(t => ({ name: t })),
  })
}

writeFileSync('out/feed.xml', masterFeed.rss2())

// Per-tag feeds
const allTags = [...new Set(visiblePosts.flatMap(p => p.tags))]
for (const tag of allTags) {
  const tagFeed = new Feed({ /* same as master but filtered */ })
  visiblePosts
    .filter(p => p.tags.includes(tag))
    .forEach(p => tagFeed.addItem({ /* same as above */ }))
  writeFileSync(`out/feed-${tag}.xml`, tagFeed.rss2())
}
```

**Build script integration** (`package.json`):
```json
{
  "scripts": {
    "build": "next build && tsx scripts/generate-feeds.ts"
  }
}
```

This ensures:
1. Velite processes all content during `next build`.
2. Next.js generates static HTML into `out/`.
3. The feed script reads the same Velite data and writes `feed.xml` + `feed-{tag}.xml` into `out/`.
4. All output is atomic — feeds and HTML are always consistent.

### 3.6 Booking System

**Decision:** No changes needed. The cal.com integration is just external links in `BookingFrontmatter.calendar` (e.g., `https://cal.com/renscourses/cmsc125lab`). These URLs render as clickable cards in `Bookings.razor` and will render identically in `app/bookings/page.tsx`.

---

## 4. Migration Plan

### Phase 0: Scaffolding (Module 1)
- [ ] Create fresh branch `feat/nextjs-migration` from `master`.
- [ ] Initialize Next.js 14+ project with TypeScript (`npx create-next-app@latest --ts --app`).
- [ ] Install core dependencies: `velite`, `tailwindcss@4`, `@tailwindcss/postcss`, `@tailwindcss/typography`, `rehype-pretty-code`, `shiki`, `next-themes`.
- [ ] Configure Velite with `velite.config.ts`: define all 4 collections (Materials, Projects, Bookings, CalendarEvents) with Zod schemas matching current frontmatter.
- [ ] Wire Velite into `next.config.ts` using the official integration snippet.
- [ ] Copy `Styles/app.css` → `styles/app.css`, preserving all Tailwind theme tokens and CSS variables.
- [ ] Download and convert the NASM TextMate grammar from `13xforever/x86-assembly-textmate-bundle` into `grammars/nasm.tmLanguage.json`.
- [ ] Configure `rehype-pretty-code` in Velite with the custom NASM grammar registered.
- [ ] Copy `Content/` directory from `master` as-is (no file changes needed).
- [ ] Verify `velite build` succeeds and outputs typed data to `.velite/`.

### Phase 1: Layout (Module 2)
- [ ] Create `app/layout.tsx` — merge `App.razor` head (fonts, favicons, meta) + `MainLayout.razor` body (flex container, footer).
- [ ] Create `components/NavMenu.tsx` — port navbar with scroll-hide (`useEffect` + scroll listener), hamburger menu (`useState`), nav links.
- [ ] Create `components/ThemeSwitcher.tsx` — port theme selection with `next-themes` (replaces `ThemeService.cs` + `theme.js`).
- [ ] Verify layout renders correctly with Tailwind styling.

### Phase 2: Materials / Blog (Module 3)
- [ ] Create `lib/buildTime.ts` — port `BuildTimeProvider.cs` (read `STATIC_GEN_TIME`, `TERM_START`, `TERM_END` from `process.env`).
- [ ] Create `lib/content.ts` — port `CourseContentProvider.cs` (term-aware filtering, tag extraction, visible posts logic).
- [ ] Create `lib/status.ts` — port `FrontmatterStatusService.cs` (deadline status: None/Future/DueToday/Expired).
- [ ] Create `components/CatalogsList.tsx` — generic tag cloud (TypeScript generics, replaces `CatalogsList.razor`).
- [ ] Create `components/PostsList.tsx` — course material card grid with status badges (replaces `PostsList.razor`).
- [ ] Create `app/materials/[[...tag]]/page.tsx` — tag catalog + filtered list (replaces `Materials.razor`).
- [ ] Create `app/articles/[slug]/page.tsx` — individual article page with MDX rendering + TOC sidebar (replaces `Blog.razor`).
- [ ] Create `components/TableOfContents.tsx` — port `toc.js` with `IntersectionObserver` for scroll-spy.
- [ ] Create `components/ScrollToTop.tsx` — port `scroll-button.js`.
- [ ] Verify Shiki syntax highlighting works for all languages including NASM.

### Phase 3: Projects (Module 4)
- [ ] Create `components/ProjectsList.tsx` — expandable `<details>` cards (replaces `ProjectsList.razor`).
- [ ] Create `app/projects/[[...tag]]/page.tsx` — tag catalog + project list (replaces `Projects.razor`).
- [ ] Verify tag filtering and project expansion work correctly.

### Phase 4: Bookings (Module 5)
- [ ] Create `app/bookings/page.tsx` — card grid with external cal.com links (replaces `Bookings.razor`).
- [ ] Verify all booking links are correct and functional.

### Phase 5: Calendar (Module 6)
- [ ] Install `@tanstack/react-time` (or `@tanstack/time-core` if hooks aren't available yet).
- [ ] Create `lib/holidays.ts` — port `HolidaysProvider.cs` (Nager.Date API fetch with 5s timeout + Computus-based fallback holidays for PH).
- [ ] Create `app/calendar/page.tsx` (Server Component) — fetch and merge all 3 event sources (holidays, custom events, frontmatter-derived dates).
- [ ] Create `components/CalendarView.tsx` ("use client") — headless calendar with:
  - `useCalendar()` for month grid state and navigation.
  - `useState` for active tag filter and current month index.
  - Desktop: CSS Grid 7-column month view with event chips.
  - Mobile: Vertical list showing only days with events.
- [ ] Create `components/EventPopover.tsx` — floating popover for overflow events ("+X more"), using `@floating-ui/react` or Radix UI Popover.
- [ ] Port tag filtering logic (currently `filterCalendar()` in `calendar.js`).
- [ ] Verify: month navigation, tag filtering, overflow popover, responsive layouts.

### Phase 6: RSS Feed (Module 7)
- [ ] Install `feed` npm package.
- [ ] Create `scripts/generate-feeds.ts` — read Velite output, apply same term/date filtering as the site, generate `feed.xml` + per-tag `feed-{tag}.xml`.
- [ ] Add to build script: `"build": "next build && tsx scripts/generate-feeds.ts"`.
- [ ] Verify generated feeds match current feed structure and content.

### Phase 7: PWA (Module 8)
- [ ] Install `@ducanh2912/next-pwa`.
- [ ] Configure `next.config.ts` with PWA plugin options.
- [ ] Copy `wwwroot/site.webmanifest` → `public/site.webmanifest`, update paths.
- [ ] Copy favicon files to `public/`.
- [ ] Verify PWA install prompt and offline behavior.

### Phase 8: Build & Deploy (Module 9)
- [ ] Configure `next.config.ts` with `output: 'export'` for full static export.
- [ ] Handle dual base path via `NEXT_PUBLIC_BASE_PATH` env var → `basePath` in `next.config.ts`.
- [ ] Rewrite GitHub Actions workflow:
  - Remove .NET SDK, Python setup steps.
  - Use Node.js only: `npm ci && npm run build`.
  - Build 1 (Netlify): `NEXT_PUBLIC_BASE_PATH= npm run build`, deploy `out/` → `netlify-pages`.
  - Build 2 (GitHub Pages): `NEXT_PUBLIC_BASE_PATH=/Ren-s-Courses npm run build`, deploy `out/` → `gh-pages`.
  - Keep `STATIC_GEN_TIME`, `TERM_START`, `TERM_END` env vars.
  - Keep CRON rebuild schedule.
  - Keep `.nojekyll` for GitHub Pages.
- [ ] Verify both deployments work correctly.

### Phase 9: Cleanup (Module 10)
- [ ] Visual regression testing: compare old and new site output page-by-page.
- [ ] Remove .NET project files: `*.csproj`, `*.sln`, `Program.cs`, `Components/`, `Models/`, `Services/`, `Properties/`, `appsettings*.json`.
- [ ] Remove Python utilities: `.github/utils/generate_feed.py`, `.github/utils/requirements.txt`.
- [ ] Remove vanilla JS files that were ported to React: `wwwroot/js/calendar.js`, `theme.js`, `code-features.js`, `scroll-button.js`, `toc.js`, `site.js`.
- [ ] Update `README.md` with new build instructions, tech stack, and development workflow.
- [ ] Update `package.json` with accurate metadata.
- [ ] Merge `feat/nextjs-migration` → `master`.

---

## 5. Component-by-Component Mapping

| BlazorStatic (Current) | Next.js (Proposed) | Complexity | Notes |
|---|---|---|---|
| `App.razor` | `app/layout.tsx` + `app/page.tsx` | Low | Head metadata, fonts, scripts move to `layout.tsx` |
| `MainLayout.razor` | `app/layout.tsx` | Low | Flex layout, footer |
| `NavMenu.razor` | `components/NavMenu.tsx` | Medium | Scroll-hide JS → React `useEffect` + `useState` |
| `Blog.razor` | `app/articles/[slug]/page.tsx` | Medium | MDX rendering via Velite `s.markdown()`, TOC sidebar via `s.toc()` |
| `Materials.razor` | `app/materials/[[...tag]]/page.tsx` | Low | Tag cloud + filtered list |
| `Calendar.razor` | `app/calendar/page.tsx` + `CalendarView.tsx` | **High** | TanStack Time headless hooks, 3 event sources, EventPopover, responsive |
| `Bookings.razor` | `app/bookings/page.tsx` | Low | Simple card grid, cal.com links |
| `Projects.razor` | `app/projects/[[...tag]]/page.tsx` | Low | Tag cloud + expandable cards |
| `CatalogsList.razor` | `components/CatalogsList.tsx` | Low | Generic tag cloud (TypeScript generics) |
| `PostsList.razor` | `components/PostsList.tsx` | Low | Card grid with status badges |
| `ProjectsList.razor` | `components/ProjectsList.tsx` | Low | `<details>` cards |
| `ThemeSwitcher.razor` | `components/ThemeSwitcher.tsx` | Low | `next-themes` — simpler than current C#-JS bridge |
| `CourseFrontMatter.cs` | Zod schema in `velite.config.ts` | Low | Type-safe, auto-inferred |
| `CalendarEventFrontmatter.cs` | Zod schema in `velite.config.ts` | Low | Type-safe, auto-inferred |
| `BookingFrontmatter.cs` | Zod schema in `velite.config.ts` | Low | Type-safe, auto-inferred |
| `ProjectFrontMatter.cs` | Zod schema in `velite.config.ts` | Low | Type-safe, auto-inferred |
| `CourseContentProvider.cs` | `lib/content.ts` | Medium | Term-aware filtering using Velite output data |
| `HolidaysProvider.cs` | `lib/holidays.ts` | Medium | API fetch at build time, Computus-based fallback holidays |
| `FrontmatterStatusService.cs` | `lib/status.ts` | Low | Pure date comparison logic |
| `BuildTimeProvider.cs` | `lib/buildTime.ts` | Low | `process.env.STATIC_GEN_TIME` + `TERM_START` + `TERM_END` |
| `ThemeService.cs` | `next-themes` package | Low | Direct localStorage, no C#-JS bridge needed |
| `calendar.js` | `CalendarView.tsx` + `EventPopover.tsx` | **High** | React state replaces DOM manipulation; TanStack Time replaces manual grid |
| `theme.js` | `next-themes` | Low | Eliminated entirely |
| `code-features.js` | Velite `rehype-pretty-code` + MDX `<pre>` component | Medium | Build-time Shiki replaces CDN Prism; copy button as React component |
| `toc.js` | `components/TableOfContents.tsx` | Medium | Velite `s.toc()` provides heading data; IntersectionObserver for scroll-spy |
| `scroll-button.js` | `components/ScrollToTop.tsx` | Low | Simple scroll listener in `useEffect` |
| `service-worker.js` | `next-pwa` plugin | Low | Plugin handles generation |
| `generate_feed.py` | `scripts/generate-feeds.ts` (uses `feed` npm) | Low | Atomic with build, reads from Velite data |
| `build-and-publish.yml` | Updated workflow (Node.js only) | Medium | Remove .NET + Python steps; `npm run build` does everything |

---

## 6. Potential Issues & Risks

### 6.1 High-Risk: Calendar Component Complexity
The `Calendar.razor` component is the most complex piece (~520 lines of Razor + ~200 lines of `calendar.js`). It:
- Merges 3 event sources (holidays API, custom events from `CalendarEventFrontmatter`, and frontmatter-derived dates from `CourseFrontMatter` including release, deadline, progress, defense dates).
- Renders a full month grid with overflow handling ("+X more" floating popover using `position:fixed` + `getBoundingClientRect()`).
- Has tag-based filtering via CSS class toggling (`tag-{tagName}` classes).
- Uses two completely different layouts (CSS Grid for desktop, vertical list for mobile).
- Injects tag CSS classes into event elements for JS filtering.

**Risk:** This is the most significant rewrite. The current architecture uses pre-rendered hidden HTML (`.overflow-events` divs) as a data source for popovers, which is a server-rendering workaround that doesn't apply in React.

**Mitigation:** TanStack Time provides the calendar grid primitives. React state management replaces all DOM manipulation. The popover will use `@floating-ui/react` or Radix UI for reliable positioning. Migrate this module last (Module 6) to allow familiarity with the new stack.

### 6.2 Medium-Risk: TanStack Time Maturity
TanStack Time (566 stars) is newer and less battle-tested than alternatives.

**Risk:** API may change or lack specific features needed for the month grid view.

**Mitigation:** The fallback is building the calendar grid from scratch with a `useCalendar` custom hook (just date math + `useMemo`). The current C# `GetDynamicTermMonths()` and `GetEventsForDate()` logic is simple and can be ported to a custom hook if TanStack Time doesn't fit. `use-lilius` (277 stars) is another lightweight headless option.

### 6.3 Medium-Risk: Holidays API at Build Time
`HolidaysProvider` fetches Philippine holidays from the Nager.Date API during SSG build.

**Risk:** Build failures if the API is down. The current C# code has a 5-second timeout with a fallback to calculated holidays (fixed dates + Computus-based Easter + last-Monday-of-August National Heroes Day).

**Mitigation:** Port the exact same pattern to TypeScript: `fetch()` with `AbortController` 5-second timeout, catch → calculate fallback holidays. This is straightforward — the Computus algorithm and fixed-date holiday list are pure math.

### 6.4 Medium-Risk: Frozen Build Time & Term Dates
The site uses `BuildTimeProvider` (reads `STATIC_GEN_TIME`, `TERM_START`, `TERM_END` from environment variables) to freeze the "current time" across the entire build.

**Risk:** In Next.js, `process.env` values at build time are inlined. Care must be taken to ensure consistent values across all pages and the RSS script.

**Mitigation:** Create a shared `lib/buildTime.ts` module that reads and caches these values at module initialization. Since `next build` runs in a single Node.js process, module-level variables are shared across all page generations. The RSS script also reads the same env vars directly.

### 6.5 Medium-Risk: Dual Base Path Deployment
Two builds with different `basePath`: `/` for Netlify, `/Ren-s-Courses/` for GitHub Pages.

**Risk:** Asset links, navigation, and image paths must all respect `basePath`. Need to ensure the RSS feed generator also uses the correct base URL.

**Mitigation:** Use `NEXT_PUBLIC_BASE_PATH` env var → `basePath` in `next.config.ts`. Use `next/link` and `next/image` which automatically prepend `basePath`. For the RSS script, read `NEXT_PUBLIC_SITE_URL` env var.

### 6.6 Low-Risk: Shiki NASM Grammar Loading
Custom TextMate grammar loading requires conversion from plist XML to JSON.

**Risk:** The grammar may have edge cases with complex NASM syntax (macros, preprocessor directives).

**Mitigation:** The `13xforever/x86-assembly-textmate-bundle` grammar is comprehensive (covers up to AVX-512, APX) and actively maintained. If specific highlighting issues arise, they can be addressed post-migration. The grammar file is MIT licensed.

### 6.7 Low-Risk: Velite Stability
Velite is at v0.3.1, not yet 1.0.

**Risk:** Breaking changes in future versions.

**Mitigation:** Pin the version in `package.json`. Velite is used by Chakra UI and Ark UI in production. The API is stable for the core features we need (collections, schemas, markdown processing). If Velite becomes unmaintained, migrating to raw `gray-matter` + `fs` is straightforward since Velite collections are just glorified frontmatter parsers.

### 6.8 Low-Risk: PWA / Service Worker
Currently a custom `service-worker.js` with network-first caching.

**Risk:** Minimal. `next-pwa` provides equivalent functionality out of the box.

**Mitigation:** Use `@ducanh2912/next-pwa`. Verify offline behavior matches expectations.

### 6.9 Low-Risk: Tailwind CSS v4 Compatibility
The site uses Tailwind CSS v4 with custom theme tokens (CSS variables). Already well-supported in Next.js.

**Risk:** None. The `@tailwindcss/postcss` package is already a project dependency.

**Mitigation:** Copy `Styles/app.css` directly. No changes needed.

---

## 7. Feasibility Assessment

### Verdict: ✅ Feasible, with moderate effort

| Criterion | Assessment |
|---|---|
| **Content compatibility** | ✅ Excellent — all content is standard Markdown + YAML frontmatter, zero conversion needed |
| **Styling compatibility** | ✅ Excellent — Tailwind v4 transfers directly, CSS variables are framework-agnostic |
| **Type safety** | ✅ Excellent — Velite Zod schemas provide equivalent (or better) type safety to C# models |
| **Component complexity** | ⚠️ Moderate — most components are straightforward, **Calendar is the main challenge** |
| **Service logic portability** | ✅ Good — all C# services are pure logic (date math, filtering, API calls) easily portable to TypeScript |
| **Interactive JS portability** | ✅ Good — vanilla JS DOM manipulation maps cleanly to React state/effects + headless libraries |
| **Build/Deploy compatibility** | ✅ Good — `next export` produces the same static HTML; simplified CI (Node.js only, no .NET/Python) |
| **Ecosystem maturity** | ✅ Excellent — Next.js + Velite + Shiki + TanStack is a proven, well-documented stack |

### Estimated Effort

| Phase | Module | Estimated Time |
|---|---|---|
| Phase 0 | Scaffolding | 1–2 days |
| Phase 1 | Layout | 1 day |
| Phase 2 | Materials / Blog | 2–3 days |
| Phase 3 | Projects | 0.5–1 day |
| Phase 4 | Bookings | 0.5 day |
| Phase 5 | Calendar | 2–3 days |
| Phase 6 | RSS Feed | 0.5 day |
| Phase 7 | PWA | 0.5 day |
| Phase 8 | Build & Deploy | 1–2 days |
| Phase 9 | Cleanup | 1–2 days |
| **Total** | | **~10–15 days** |

### Why Migrate?

| Advantage | Details |
|---|---|
| **Larger ecosystem** | React/Next.js has a vastly larger package ecosystem than Blazor |
| **Developer familiarity** | TypeScript/React skills are more common than C#/Blazor in web development |
| **Better MDX support** | MDX allows embedding React components directly in Markdown content |
| **Type-safe content** | Velite + Zod provides build-time schema validation with TypeScript inference |
| **Faster iteration** | Hot reload, better DX tooling, faster builds |
| **Simplified CI** | Eliminates .NET SDK and Python from CI/CD — single Node.js runtime |
| **Atomic RSS** | RSS feeds generated within the build process, always consistent with site content |
| **Future-proof** | Next.js is actively maintained with strong community support |

### Why Stay?

| Advantage | Details |
|---|---|
| **Working system** | The current site is fast, functional, and deployed |
| **No bugs to fix** | Migration introduces risk of new bugs for zero immediate user-facing benefit |
| **Migration cost** | ~2 weeks of effort that could be spent on new features instead |
