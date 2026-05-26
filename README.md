# Ren's Courses

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222222?style=for-the-badge&logo=github&logoColor=white)](https://whitelicorice.github.io/Ren-s-Courses/)
[![Netlify](https://img.shields.io/badge/Netlify-Mirror-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://renscourses.netlify.app)
[![Shortlink](https://img.shields.io/badge/Shortlink-bit.ly%2Frenscourses-EE6123?style=for-the-badge&logo=bitly&logoColor=white)](https://bit.ly/renscourses)

A headless Learning Management System for courses I teach under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics, BS in Computer Science curriculum.

Built with .NET 9, Blazor, BlazorStatic (v1.0.0-beta.17), and Tailwind CSS v4. The site compiles to static HTML and deploys to both GitHub Pages and Netlify on every push and on an hourly cron.

---

### Modules

* [x] Course site -- materials, deadlines, and course content served as static pages
* [x] Submission bin -- students submit deliverables through an embedded Google Form
* [x] Grades viewer -- real-time grade lookups via a private Google Apps Script web app
* [x] Site mirror -- live mirror on Netlify for redundancy
* [x] Booking system -- students book consultations in advance
* [x] Mailing list -- enrolled students get notified by email when new materials drop
* [x] PWA -- the course site installs as a native app on desktop and mobile
* [x] Calendar -- upcoming events, deadlines, and holidays in one view
* [x] Calendar holidays -- Philippine holidays from the [Nager.Date API](https://date.nager.at/), with a calculated fallback if the API is down
* [x] Calendar custom events -- instructors define arbitrary events via markdown frontmatter
* [x] Theming -- light/dark toggle that persists across sessions, synced with Prism.js for code blocks
* [x] FAQs -- per-course FAQ pages with accordion layout, hash deep-linking, and a course-tag filter
* [x] Project showcase -- student projects organized by school year and course, with tag filtering
* [x] RSS feeds -- per-course Atom feeds generated at build time by a Python sidecar script
* [ ] Search -- a full-text search engine across all frontmatter (low priority; content volume is still manageable by hand)
* [ ] Custom themes -- more themes beyond light/dark and an API to extend them (low priority)

---

### How it works

The CI workflow (`.github/workflows/build-and-publish.yml`) runs on push to `master` and hourly via cron. It freezes a UTC timestamp, runs JS tests, generates RSS feeds with a Python script, then builds the static site twice: once with `base href="/"` for Netlify and once with `base href="/Ren-s-Courses/"` for GitHub Pages. Both outputs get HTML-minified before being pushed to their respective deploy branches.

`CourseContentProvider` only surfaces materials whose `Published` date falls inside the `TERM_START`--`TERM_END` window and is not later than the frozen build time. After the term ends, current-term materials are hidden unless showcase mode is enabled. The CI pins these as env vars so the build is deterministic.

All client-side behavior is vanilla JS -- no framework. Theme, calendar, TOC, code block features, FAQ accordion, course filtering, and scroll-to-top are each their own script loaded via `<script>` tags.

---

### Grades viewer architecture

The Grades Viewer is a private Google Apps Script web app deployed separately from this repo. Students access it through the nav menu. The source is closed because it handles student records, but I'm documenting the architecture here since it accounts for most of the backend engineering.

Google Apps Script imposes a 6-minute execution limit, a 100 KB per-key cache ceiling, and a 250-character cache key max. Under those constraints, the system provides sub-second grade lookups across multiple Google Sheets gradebooks.

**Data model.** A static `CourseDirectory` maps academic years to courses to spreadsheet IDs and sub-sheet names. Adding a new course is one line in that directory. The form's year/course cascading dropdown runs client-side from a serialized JSON map -- no server round-trip.

**Caching.** Two layers. Layer 1 (student result cache, 10-minute TTL) stores parsed grades for a student-sheet pair. Layer 2 (sheet data cache, 60-minute TTL) stores raw sheet contents. Both cache keys are SHA-256 hashes that include the sheet's header row as a schema version -- when an instructor adds, renames, or reorders a column, both layers self-invalidate. A per-section refresh button on the frontend bypasses all caches for a single sub-sheet.

**Header mapping.** Gradebook columns are matched by semantic header names ("Student Number", "Student No.", "SN" all map to the same field). Any column not prefixed with an underscore is treated as a grade column. Instructors can add assessment columns without touching the code.

**Rendering.** Wide gradebooks get split into groups of 4 columns, each with its own repeated header row. No horizontal scrolling -- matters on mobile and during in-person consultations.

**Frontend.** Light/dark theme (synced with localStorage and system preference), inline form validation with live error messages, ARIA roles and live regions for screen readers, `prefers-reduced-motion` support. Zero external dependencies beyond Google's `google.script.run` bridge.

---

### Legal notice

**All material is copyrighted. All rights reserved.**

This project is not free to clone, fork, or distribute. The source code and course materials are on GitHub for reference and educational purposes only. View the detailed [LICENSE](./LICENSE.md) for permitted usage. Some modules (e.g., Grades Viewer) are closed-source by design and excluded from this repository.

---

## Contributing

Contributions are welcome under the terms of the license.

### Workflow

1. Fork the repository.
2. Create a branch with a prefix that describes the change type:
   * `feat/` for new features
   * `fix/` for bug fixes
   * `refactor/` for code restructuring
   * `docs/` for documentation updates
3. Make your changes and test with `dotnet run`.
4. Submit a pull request.

### Commit messages

This project uses semantic commits:

* `feat:` new feature
* `fix:` bug fix
* `ux:` UI or UX improvement
* `docs:` documentation only
* `style:` formatting, whitespace, semicolons -- no logic changes
* `refactor:` code restructuring that does not fix a bug or add a feature
* `chore:` build process or tooling changes
* `meta:` license, metadata, dependency changes
* `devops:` CI/CD pipeline changes
* `debug/test:` testing and scaffolding

---

## Tests

### .NET (xUnit)

Tests live in `tests/Ren.Courses.Tests/`. xUnit framework, Moq + bUnit. No fixture files on disk -- test data is defined inline via the `EphemeralPost<T>` harness.

```bash
# Kill any locked process first
pwsh -Command "Get-Process | Where-Object { \$_.ProcessName -like '*Blazor*' } | Stop-Process -Force"

# Run all tests
dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj
```

Key patterns:
- `BuildTimeProvider` test collection sets `STATIC_GEN_TIME`, `TERM_START`, and `TERM_END` env vars before any test runs. All tests that depend on these must opt into the collection.
- `InternalsVisibleTo` gives tests access to `internal` methods. Testability helpers (`BuildEvents()`, `CalculateFallbackHolidays()`, `GetVisiblePosts(IEnumerable)`) are marked `internal` -- do not change their visibility.
- `PostGrid` tested via bUnit with `TestContext.Render<PostGrid>()`. No DI needed; all state comes through parameters.
- Complex logic extracted as `internal static` methods for direct testing without DI.
- Date logic frozen via `STATIC_GEN_TIME` env var. Current frozen time: 2026-03-15 18:00 PHT.
- `EphemeralPost<T>`: in-memory markdown fixture harness. Define frontmatter + body inline, no disk I/O:
  ```csharp
  var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
  {
      Title = "Test", Published = new DateTime(2026, 3, 1)
  }, body: "## Content");
  var fm = post.FrontMatter; // deserialized
  var md = post.RawMarkdown; // "---\ntitle: Test\n..."
  ```

### E2E (Playwright)

End-to-end tests run against the pre-built static output served by a lightweight file server. They cover every major user flow.

**Prerequisites:** Node.js 20+, .NET 9 SDK.

```bash
# 1. Build the static site (output/ directory appears, then the process exits)
ASPNETCORE_ENVIRONMENT=Production dotnet run

# 2. Install Playwright browsers (first time only)
npx playwright install --with-deps chromium

# 3. Run tests (the config starts `serve output` automatically)
npm run test:e2e

# Single spec
npx playwright test tests/e2e/home.spec.js

# Single browser
npx playwright test --project=chromium
```

```bash
# View HTML report
npx playwright show-report
```

**Build time constraint:** `CourseContentProvider` only surfaces materials published on or before `STATIC_GEN_TIME` and inside the `TERM_START`--`TERM_END` window. CI pins `STATIC_GEN_TIME=2026-03-15T12:00:00Z`. To preview in-term visibility locally before the term ends:

```bash
STATIC_GEN_TIME="2026-03-15T12:00:00Z" TERM_START="2026-01-19" TERM_END="2026-05-23" ASPNETCORE_ENVIRONMENT=Production dotnet run
```

**Suite coverage:**

| Spec file | What it covers |
|---|---|
| `home.spec.js` | `/` -- title, glitch text, lead, chip filter |
| `materials.spec.js` | `/materials`, `/materials/{tag}`, `/articles/{slug}` -- tag cloud, post cards, TOC, code blocks, copy button |
| `faqs.spec.js` | `/faqs` -- sections, chip filter, accordion, hash deep-link, hashchange |
| `calendar.spec.js` | `/calendar` -- month nav, tag filter, popover open/close |
| `projects.spec.js` | `/projects`, `/projects/{tag}` -- tag cloud, card expand/collapse |
| `navigation.spec.js` | Desktop nav (3 items + dropdown, scroll hide/show); mobile nav (overlay, backdrop, close) |
| `theme.spec.js` | Light/dark toggle, localStorage, Prism CSS swap, icon state, persistence |
| `edge-cases.spec.js` | `/null`, non-existent articles, all major routes checked for JS errors |

### JS (Jest)

Client-side scripts in `wwwroot/js/` are tested with Jest + jest-environment-jsdom. Test files live in `wwwroot/js/__tests__/`.

```bash
# Run all JS tests
npm test

# Watch mode
npx jest --watch

# With coverage
npx jest --coverage
```

**Covered scripts:**

| Script | What is tested |
|---|---|
| `toc.js` | `replaceState` (not `pushState`) on click; no-href links (Blazor nav safety); keyboard activation (Enter/Space); `hashchange` listener; scroll-on-load |
| `faq.js` | `replaceState` on TOC link click; `_openDetailsForHash` opens accordion + scrolls on load; `hashchange` listener |
| `calendar.js` | `filterCalendar`, `filterCalendarMulti`, `toggleCalendarTag`, `clearCalendarFilter`; `initCalendarNav` + `changeMonth`; `openEventPopoverFromData`, `closeEventPopover` |
| `course-filter.js` | `initCourseFilter` (localStorage restore); `toggleCourseFilter` (visibility, chips, persistence); `clearCourseFilter` |
| `code-features.js` | Wrapping, double-wrap guard, language label mapping, copy button injection + clipboard write + timeout revert |
| `scroll-button.js` | Button click scrolls to top; no-op when button absent |
| `theme.js` | `switchPrismTheme` sets link href, `data-theme`, localStorage, theme-color meta; system preference fallback |

**Setup file:** `wwwroot/js/__tests__/setup.js` -- applies the `innerText` polyfill and `IntersectionObserver` stub globally before every test suite.

**Key test patterns:**
- History API: `history.pushState` sets `window.location.hash` before mocking, because `window.location.hash` is non-configurable in jsdom. `Object.getPrototypeOf(window.history).pushState.call(...)` bypasses active spies when real URL changes are needed.
- Scripts are loaded by reading the source file and executing via `new Function(source)()` -- runs in global scope so `window.generateTOC` etc. become available.
