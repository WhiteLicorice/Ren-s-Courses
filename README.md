# Ren's Courses

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222222?style=for-the-badge&logo=github&logoColor=white)](https://whitelicorice.github.io/Ren-s-Courses/)
[![Netlify](https://img.shields.io/badge/Netlify-Mirror-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://renscourses.netlify.app)
[![Shortlink](https://img.shields.io/badge/Shortlink-bit.ly%2Frenscourses-EE6123?style=for-the-badge&logo=bitly&logoColor=white)](https://bit.ly/renscourses)

A headless Learning Management System for courses I teach under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics, BS in Computer Science curriculum.

Built with .NET 9, Blazor, BlazorStatic (v1.0.0-beta.17), and Tailwind CSS v4. The site compiles to static HTML and deploys to both GitHub Pages and Netlify on every push and on an hourly cron.

---

### Modules

* [x] Course site -- materials, deadlines, and course content served as static pages
* [x] Submission bins -- materials link directly to their relevant Google Forms through optional frontmatter
* [x] Interactive diagrams -- materials can present Mermaid diagrams as controlled, step-by-step walkthroughs
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

Materials that require deliverables can define one or more submission forms in frontmatter. The list is optional; each entry is rendered as a named action on that material's article page:

```yaml
submissions:
  - name: Source code
    link: https://forms.gle/example
  - name: Individual reflection
    link: https://forms.gle/example
```

Materials can also define interactive diagrams in frontmatter. Each step is a complete
[Mermaid](https://mermaid.js.org/) definition, so steps can use flowcharts, sequence diagrams,
state diagrams, or any other diagram type supported by Mermaid. Diagrams appear before the
Markdown body with Previous, Next, and Play controls:

```yaml
diagrams:
  - title: Bubble sort
    description: Follow one pass through the array.
    steps:
      - title: Compare the first pair
        description: Five is greater than two, so the values are out of order.
        mermaid: |
          flowchart LR
              A[5] --> B[2]
      - title: Swap the pair
        description: Move the smaller value to the left.
        mermaid: |
          flowchart LR
              B[2] --> A[5]
```

Mermaid is loaded from its pinned CDN module only when a page contains a diagram. If the
library cannot load or a step contains invalid syntax, the authored Mermaid source remains
visible so the explanation does not become a blank panel.

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

### Material Mailer architecture

The Material Mailer is a private Google Apps Script deployed as a time-driven trigger on a Google Sheets workbook. It powers the mailing list module listed above. Enrolled students receive an email whenever new course materials are published.

**How it works.** On each trigger, the script fetches the per-course RSS feed generated by the Python sidecar at build time. It parses the feed's `<item>` GUIDs against a persistent log sheet. Any GUID not already logged is new. The script renders a dark-themed HTML email, adhering to the course site's visual identity, BCC-sends it to every address in the `Emails` sheet, then appends the GUID to the log. `SpreadsheetApp.flush()` forces a write after each send so a mid-run timeout never causes duplicate emails.

**Configuration.** A `Config` sheet holds key-value pairs: `RSS_URL`, `COURSE_NAME`, `SENDER_NAME`, `SENDER_EMAIL` (optional Google Group proxy), and `UNSUBSCRIBE_URL`. Adding a new course is a new workbook with its own config and trigger. No code changes needed.

**Send order and throttling.** RSS feeds list newest-first; the script reverses the array so materials send in chronological order ("Lab 1" before "Lab 2"). A configurable timeout (default 5 s) between sends prevents Gmail spam-filter drops on large batches.

**Proxy sender.** When `SENDER_EMAIL` is set to a Google Group address, emails originate from the group instead of the instructor's personal account. `replyTo` is set to the same address so student replies go to the shared inbox.

**Email template.** GitHub-dark color scheme (`#0d1117` background, `#161b22` card, `#ef4444` accent). Table-based layout for maximum email-client compatibility. Subtitle rendered in monospace with a `//` prefix when present. Footer identifies the course and suppresses replies.

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
ASPNETCORE_ENVIRONMENT=Production dotnet run --no-launch-profile

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
STATIC_GEN_TIME="2026-03-15T12:00:00Z" TERM_START="2026-01-19" TERM_END="2026-05-23" ASPNETCORE_ENVIRONMENT=Production dotnet run --no-launch-profile
```

`--no-launch-profile` is required for static generation because the local launch profiles set
`ASPNETCORE_ENVIRONMENT=Development` and otherwise start a persistent development server.

### Native material PDFs

The production `dotnet run` entry point generates a PDF for every non-draft Markdown file under
`Content/Materials` before the static pages are rendered. The first run downloads pinned Pandoc,
Tectonic, and browser dependencies into the ignored `artifacts/` directory. Later runs reuse the
per-material cache and skip the toolchain entirely when every fingerprint still matches.

The complete Markdown file is part of its fingerprint, so changing either frontmatter or body
content invalidates only that material. Template files, Mermaid configuration, pinned dependency
metadata, and referenced local media are fingerprinted as well. If one PDF fails, the site build
continues and that material uses its `downloadLink`; if no fallback exists, only its Download
action is omitted.

For a CI-equivalent local build in PowerShell:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:TERM_START = "2026-01-19"
$env:TERM_END = "2026-05-28"
$env:SHOWCASE_MODE = "true"
$env:STATIC_GEN_TIME = "2026-07-14T00:00:00Z"
dotnet run --no-launch-profile --configuration Release
```

### PDF template system

PDF generation uses Pandoc to convert Markdown to LaTeX, then Tectonic to compile LaTeX to PDF.
The template that controls the PDF's visual appearance is a Pandoc LaTeX template.

#### Default template (`PdfTemplates/default/template.latex`)

The default template is derived from Pandoc's built-in article template. It has been tweaked to
match the original UPV DPSM lab-manual format:

| Element     | Content                                      |
|-------------|----------------------------------------------|
| Left header | University of the Philippines Visayas        |
| Right header| Division of Physical Sciences and Mathematics|
| Left footer | `courseLabel` variable (e.g., "CMSC 131")   |
| Center footer| `labNumber` variable (e.g., "Laboratory Manual 5") |
| Right footer| Page number                                  |
| Title block | Title, subtitle, lead, "Prepared by" author, published date, deadline, topics |

The template reads `pdf.variables.courseLabel` and `pdf.variables.labNumber` from the material's
frontmatter. When these variables are absent, the corresponding footer fields render empty.

The author line shows the full `Name` field (not the `Nickname` display alias used on the website).
This ensures the PDF carries the author's complete legal name in the "Prepared by" attribution.

#### Defining a custom template

Create a new directory under `PdfTemplates/`, commit a `template.latex` file inside it:

```
PdfTemplates/
├── default/
│   └── template.latex       ← shipped default
└── my-custom/
    └── template.latex       ← your custom template
```

Template names must match `[a-z0-9][a-z0-9_-]*` (lowercase letters, digits, hyphens, underscores).
Any file under the template directory is fingerprinted; changing a template invalidates every
material that uses it.

A minimal template must render `$body$`:

```latex
\documentclass{article}
\usepackage[utf8]{inputenc}
\begin{document}
$body$
\end{document}
```

Full Pandoc template syntax is documented at <https://pandoc.org/MANUAL.html#template-syntax>.

#### Assigning a template to a material

Set the `pdf.template` key in the material's frontmatter. Omit it to use `default`:

```yaml
pdf:
  template: my-custom
  variables:
    courseLabel: CMSC 131
    labNumber: Laboratory Manual 5
    # … any key-value pairs your template expects
```

Variables are exposed to the template as `$pdf.variables.<key>$`. Both string and numeric values
are supported; nested objects are passed as their string representation.

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
| `interactive-diagrams.js` | Lazy Mermaid rendering; previous/next/play controls; single-step and render-error fallbacks |
| `scroll-button.js` | Button click scrolls to top; no-op when button absent |
| `submission-menu.js` | Submission dropdown click state, outside-click dismissal, Escape handling, and idempotent setup |
| `theme.js` | `switchPrismTheme` sets link href, `data-theme`, localStorage, theme-color meta; system preference fallback |

**Setup file:** `wwwroot/js/__tests__/setup.js` -- applies the `innerText` polyfill and `IntersectionObserver` stub globally before every test suite.

**Key test patterns:**
- History API: `history.pushState` sets `window.location.hash` before mocking, because `window.location.hash` is non-configurable in jsdom. `Object.getPrototypeOf(window.history).pushState.call(...)` bypasses active spies when real URL changes are needed.
- Scripts are loaded by reading the source file and executing via `new Function(source)()` -- runs in global scope so `window.generateTOC` etc. become available.
