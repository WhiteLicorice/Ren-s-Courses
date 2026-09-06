# Ren's Courses

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222222?style=for-the-badge&logo=github&logoColor=white)](https://whitelicorice.github.io/Ren-s-Courses/)
[![Netlify](https://img.shields.io/badge/Netlify-Mirror-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://renscourses.netlify.app)
[![Shortlink](https://img.shields.io/badge/Shortlink-bit.ly%2Frenscourses-EE6123?style=for-the-badge&logo=bitly&logoColor=white)](https://bit.ly/renscourses)

A headless Learning Management System for courses I teach under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics, BS in Computer Science curriculum.

Built with .NET 9, Blazor, BlazorStatic (v1.0.0-beta.17), and Tailwind CSS v4. The site compiles to static HTML. It deploys to both GitHub Pages and Netlify on every push and on an hourly cron.

## Quick Start

Clone with submodules. PDF builds read the pinned `Dependencies/RensMarkdownTemplates` submodule. The build fails without it.

```bash
git clone --recurse-submodules https://github.com/WhiteLicorice/Ren-s-Courses.git
cd Ren-s-Courses
npm ci
dotnet run
```

In a checkout that already exists, run `git submodule update --init --recursive`.

`dotnet run` on its own starts a development server and keeps running. That's what you want while writing content. For a static build, and for every test command, see [TESTING.md](./TESTING.md).

## Repository Layout

```
Components/     Razor components and pages, including Layout/ and Pages/
Content/        Markdown source: Materials, FAQs, Projects, Bookings, Events
Dependencies/   RensMarkdownTemplates submodule: PDF generator, LaTeX templates, shared models
Models/         Frontmatter types, the site theme registry, holiday models
Services/       Content providers, build time, the offline bundle generator
ViewModels/     CalendarViewModel
Offline/        service-worker.template.js
Styles/         app.css, the Tailwind entry point
wwwroot/        Static assets: js/, css/, fonts/, vendor/, pdfs/
tests/          e2e/ (Playwright), fixtures/, Ren.Courses.Tests/ (xUnit)
.github/        workflows/build-and-publish.yml and utils/generate_feed.py
output/         Generated site. Not tracked.
artifacts/      Toolchain and PDF caches. Not tracked.
```

## Modules

* [x] Course site: materials, deadlines, and course content served as static pages
* [x] Submission bins: materials link directly to their relevant Google Forms through optional frontmatter
* [x] Interactive diagrams: materials can present Mermaid diagrams as controlled, step-by-step walkthroughs
* [x] Grades viewer: sub-second grade lookups through a private Google Apps Script web app
* [x] Site mirror: live mirror on Netlify for redundancy
* [x] Booking system: students book consultations in advance
* [x] Mailing list: enrolled students get notified by email when new materials drop
* [x] PWA: installs as a native app on desktop and mobile
* [x] Calendar: upcoming events, deadlines, and holidays in one view
* [x] Calendar holidays: Philippine holidays from the [Nager.Date API](https://date.nager.at/), with a calculated fallback if the API is down
* [x] Calendar custom events: instructors define arbitrary events through markdown frontmatter
* [x] Theming: light and dark toggle that persists across sessions, synced with Prism.js for code blocks
* [x] FAQs: per-course FAQ pages with accordion layout, hash deep-linking, and a course-tag filter
* [x] Project showcase: student projects organized by school year and course, with tag filtering
* [x] RSS feeds: per-course RSS 2.0 feeds generated at build time by a Python sidecar script
* [ ] Search: a full-text search engine across all frontmatter (low priority, content volume is still manageable by hand)
* [ ] Custom themes: more themes beyond light and dark, plus an API to extend them (low priority)

## How It Works

`.github/workflows/build-and-publish.yml` runs on push to `master` and hourly on a cron. It freezes a UTC timestamp, then runs the JS, .NET, and Python gates in that order. It generates the per-course RSS feeds. Then it builds the static site twice: once with `base href="/"` for Netlify, and once with `base href="/Ren-s-Courses/"` for GitHub Pages. Both outputs get minified, stamped, and finalized with the offline manifest generator before they reach their deploy branches.

`CourseContentProvider` publishes a material only when its `Published` date sits inside the `TERM_START` to `TERM_END` window and is no later than the frozen build time. After the term ends, current-term materials disappear unless showcase mode is on. CI pins these as environment variables, so the build is deterministic. [TESTING.md](./TESTING.md) has the full visibility rules and the local recipes.

All client-side behavior is vanilla JS with no framework. Theme, calendar, TOC, code blocks, the FAQ accordion, course filtering, and scroll-to-top are each their own script, loaded with a plain `<script>` tag.

## Authoring Materials

Materials are Markdown files under `Content/Materials`. YAML frontmatter drives everything below.

### Submission Links

A material that requires a deliverable can declare one or more submission forms. The list is optional. Each entry renders as a named action on that material's article page.

```yaml
submissions:
  - name: Source code
    link: https://forms.gle/example
  - name: Individual reflection
    link: https://forms.gle/example
```

### Interactive Diagrams

A material can declare interactive diagrams in frontmatter. Each step is a complete [Mermaid](https://mermaid.js.org/) definition, so a walkthrough can use flowcharts, sequence diagrams, state diagrams, or any other type Mermaid supports.

```yaml
diagrams:
  - title: Bubble sort
    key: bubble-sort-pass
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

A diagram renders where the body references it with a marker comment on its own line:

```markdown
## What to try

<!-- diagram: bubble-sort-pass -->

Use Previous and Next to step through the pass.
```

The syntax is `<!-- diagram: key -->` and the marker must sit on its own line. Placement decides where the widget appears in the web page and in the generated PDF. Repeat the marker to show one diagram twice.

Strict mode is the rule here. A diagram that no marker references never renders.

Mermaid loads from a pinned local bundle, and only on a page that contains a diagram. If the library fails to load, or a step contains invalid syntax, the authored source stays visible. An explanation should never collapse into a blank panel.

A diagram never shrinks below a readable size. Labels stay at 14 CSS pixels or larger. The renderer picks one of three layouts per widget:

1. **Fit.** The authored drawing scales to the article column.
2. **Narrow.** An author-approved vertical variant replaces the horizontal one.
3. **Pan.** The drawing keeps a readable width, and the viewport scrolls sideways.

Add `narrowDirection` to opt one diagram into the narrow layout. It accepts `TB` or `BT`, and every step of that diagram must be a Mermaid `flowchart` or `graph`. A type with no direction token, such as a sequence diagram, always pans instead.

```yaml
diagrams:
  - title: Token stream
    key: token-stream
    narrowDirection: TB
    steps:
      - title: Scan the identifier
        mermaid: |
          flowchart LR
              T0["IDENT"] --> T1["ASSIGN"]
```

`narrowDirection` changes the web rendering only. A generated PDF always uses the authored `mermaid` source. A scrolling diagram also gains a "Scroll sideways to view the full diagram." instruction, edge cues, and keyboard focus. The widget reserves one height for every step, so Previous, Next, and Play never move the page.

The sentinel colour range `#100000` to `#10FFFF` is reserved. Never use it in a `mermaid` source. The content-hygiene gate fails the build if any material does. Author `classDef` colours outside that range survive untouched and stay fixed across themes by design.

### Adding a Theme

Theme switching costs a diagram nothing. Each step renders once with sentinel colours that become `var(--dg-*)` references, so flipping `data-theme` repaints through CSS with zero Mermaid calls.

To add a theme, do two things. Add one entry to `Models/SiteThemeRegistry.cs` naming the site theme, the Mermaid theme it harvests from, the browser-chrome colour, and the drop-shadow flood colour. Then add one `[data-theme="<name>"]` token block in `wwwroot/css/site.css` beside `:root` and `[data-theme="light"]`.

The renderer generates a `--dg-*` block for every registry entry, so no JavaScript change is needed. Add your own `--dg-*` block in `site.css` only when the harvested palette is not what you want.

### Native Material PDFs

The production entry point generates a PDF for every non-draft Markdown file under `Content/Materials` before it renders the static pages. The generator comes from the pinned `Dependencies/RensMarkdownTemplates` submodule. The first run downloads Pandoc, Tectonic, and browser dependencies into ignored cache directories. Later runs reuse the per-material cache and skip the toolchain when every fingerprint still matches.

The complete Markdown file is part of its fingerprint, so a change to either frontmatter or body invalidates only that material. Shared templates, Mermaid configuration, pinned dependency metadata, and referenced local media are fingerprinted too. If one PDF fails, the site build continues and only that material loses its Download action.

### Opting Out With `downloadLink`

A material without `downloadLink` takes the default path above. Add the key to exempt one material from generation. The generator then skips it, reports it as `External` in the build summary, and prunes any PDF that material held before. The article page links the URL exactly as written and opens it in a new tab.

Use this when the download has to carry more than the PDF, such as a Drive folder that bundles starter files. Remove the key to return that material to native generation. A blank value counts as absent.

### PDF Templates

PDF generation uses Pandoc to convert Markdown to LaTeX, then Tectonic to compile LaTeX to PDF. The generator, templates, filters, pinned tools, and canonical frontmatter contract all live in `Dependencies/RensMarkdownTemplates`. Make changes there first. Update this repository's submodule pin after the shared tests and the Mermaid fixture render pass.

Do not copy generator classes, templates, filters, or assets into this repository. The shared repository README documents direct CLI use, repository integration, Mermaid marker behavior, and the pin-update procedure.

#### The Default Template

One template ships, at `Dependencies/RensMarkdownTemplates/templates/default/template.latex`. It follows the official UPV DPSM OBE visual system and adapts to formal syllabi, laboratory manuals, activities, and notes alike. It gives you:

- **Code blocks** framed with line numbers and a light gray background, through `fancyvrb` and `fvextra`. A Pandoc Lua filter, `code-block.lua`, routes every fenced block through the `Highlighting` environment, including an unlabeled block that Pandoc would otherwise send to bare `verbatim`.
- **Explicit page breaks.** Put `<!-- newpage -->` on its own line, with blank lines around it, to force the following content onto a new page. The marker affects PDF generation only.
- **Institutional branding.** UPV and DPSM logos, the division masthead, a maroon title, compact sans-serif typography, a running header, and UPV-colored footer bars.
- **A general-material fallback.** Without syllabus variables, the title block shows the title, subtitle, full author name, publication date, and deadline.
- **Formal syllabus mode.** `documentType`, `courseCode`, `academicTerm`, `meetingSchedule`, and `venue` activate the compact OBE title and institutional typography.
- **Wide tables and rubrics.** In an ordinary material, a table with six or more columns switches to the ruled landscape renderer. Any section whose heading contains `rubric` renders in landscape in full, heading and notes included, whatever the table width. A formal-syllabus table needs an explicit `.landscape` fenced Div, which keeps portrait CO and grading matrices while study schedules stay landscape.

The two logo assets live beside `template.latex`. The generator copies template image assets into an isolated work directory before Tectonic runs. Every file in the template directory is part of the PDF fingerprint, so changing either logo invalidates the affected PDFs.

#### Defining a Custom Template

Create a directory under the shared repository's `templates/`, commit a `template.latex` inside it, then update the consumer pin.

```
templates/
├── default/
│   ├── template.latex       ← shipped default
│   ├── code-block.lua       ← Pandoc Lua filter (code block styling)
│   ├── page-break.lua       ← Markdown page-break marker
│   ├── wide-table.lua       ← automatic and explicit landscape tables
│   ├── upv-seal.png
│   └── dpsm-logo.png
└── my-custom/
    └── template.latex       ← your custom template
```

A template name must match `[a-z0-9][a-z0-9_-]*`, so lowercase letters, digits, hyphens, and underscores. Any file under the template directory is fingerprinted. Changing a template invalidates every material that uses it.

A minimal template must render `$body$`:

```latex
\documentclass{article}
\usepackage[utf8]{inputenc}
\begin{document}
$body$
\end{document}
```

Pandoc documents the full template syntax at <https://pandoc.org/MANUAL.html#template-syntax>.

#### Assigning a Template to a Material

Set `pdf.template` in the material's frontmatter. Omit it to use `default`.

```yaml
pdf:
  template: default
  variables:
    documentType: Course Syllabus
    courseCode: CMSC 131
    academicTerm: 1st Semester, A.Y. 2025-2026
    meetingSchedule: "Lecture: MTh 9:00-11:00 AM"
    venue: MILC
```

The template reads variables as `$pdf.variables.<key>$`. String and numeric values both work. A nested object arrives as its string representation. A custom template may define a different set of variables.

## Offline PWA

A production build generates `output/offline-manifest.json` and `output/service-worker.js` after static pages, feeds, minification, and build metadata are complete. The manifest lists clean generated routes and exact local assets. Its SHA-256 build ID is embedded in the worker.

The worker installs an immutable `ren-courses-offline-<buildId>` snapshot. It validates every route, stylesheet, script, local font, media file, generated PDF, and web manifest before it activates. A failed update keeps the current snapshot and its error state across reloads. Offline navigation uses the clean route and trailing-slash aliases with a three-second cached fallback. An unknown route returns HTTP 503.

The navbar carries a compact status icon beside Ren's Courses. The ready icon needs no action. The updating icon ignores clicks. The error icon starts a retry or repairs missing entries. The icon uses an accessible tooltip and a separate live region. Development pages hide the control. A production browser without service worker support gets a non-actionable message recommending a current browser.

The generator includes local icons, screenshots, and shortcut icons listed by the linked web manifest, and it includes those files in the build ID. Production generation resets `output/` before it writes the site. Development generation suppresses static file output. The finalizer removes stale compressed offline files and copied JavaScript tests.

Run the finalizer after any command that changes `output/`:

```bash
dotnet run --no-build --project BlazorStaticMinimalBlog.csproj --configuration Release -- --finalize-offline
```

[TESTING.md](./TESTING.md) covers the offline release checks, including the Windows Edge run and the installed-PWA walkthrough.

## Grades Viewer

The Grades Viewer is a private Google Apps Script web app, deployed separately from this repo. Students reach it through the nav menu. The source is closed because it handles student records, but the architecture is documented here since it accounts for most of the backend engineering.

Google Apps Script imposes a 6-minute execution limit, a 100 KB per-key cache ceiling, and a 250-character cache key maximum. Under those constraints the system still answers a grade lookup in under a second, across several Google Sheets gradebooks.

**Data model.** A static `CourseDirectory` maps academic years to courses to spreadsheet IDs and sub-sheet names. Adding a course is one line in that directory. The year and course cascading dropdown runs client-side from a serialized JSON map, with no server round-trip.

**Caching.** Two layers. Layer 1, the student result cache, holds parsed grades for a student and sheet pair for 10 minutes. Layer 2, the sheet data cache, holds raw sheet contents for 60 minutes. Both keys are SHA-256 hashes that include the sheet's header row as a schema version, so adding, renaming, or reordering a column self-invalidates both layers. A per-section refresh button bypasses all caches for a single sub-sheet.

**Header mapping.** Gradebook columns match by semantic header name, so "Student Number", "Student No.", and "SN" all reach the same field. Any column without an underscore prefix counts as a grade column. An instructor can add assessment columns without touching the code.

**Rendering.** A wide gradebook splits into groups of 4 columns, each with its own repeated header row. Nothing scrolls horizontally, which matters on a phone and during an in-person consultation.

**Frontend.** Light and dark theme synced with `localStorage` and the system preference. Inline form validation with live error messages. ARIA roles and live regions for screen readers. `prefers-reduced-motion` support. No external dependency beyond Google's `google.script.run` bridge.

## Material Mailer

The Material Mailer is a private Google Apps Script, deployed as a time-driven trigger on a Google Sheets workbook. It powers the mailing list module. Enrolled students receive an email whenever new course materials are published.

**How it works.** On each trigger the script fetches the per-course RSS feed that the Python sidecar generated at build time. It parses the feed's `<item>` GUIDs against a persistent log sheet. Any GUID not already logged is new. The script renders a dark-themed HTML email in the course site's visual identity, BCC-sends it to every address in the `Emails` sheet, then appends the GUID to the log. `SpreadsheetApp.flush()` forces a write after each send, so a mid-run timeout never causes a duplicate email.

**Configuration.** A `Config` sheet holds key-value pairs: `RSS_URL`, `COURSE_NAME`, `SENDER_NAME`, `SENDER_EMAIL` (an optional Google Group proxy), and `UNSUBSCRIBE_URL`. A new course is a new workbook with its own config and trigger. No code change needed.

**Send order and throttling.** An RSS feed lists newest first, so the script reverses the array and materials send in chronological order. "Lab 1" arrives before "Lab 2". A configurable timeout between sends, 5 seconds by default, prevents Gmail spam-filter drops on a large batch.

**Proxy sender.** When `SENDER_EMAIL` holds a Google Group address, email originates from the group instead of the instructor's personal account. `replyTo` points at the same address, so a student reply reaches the shared inbox.

**Email template.** GitHub-dark colors, so `#0d1117` background, `#161b22` card, and `#ef4444` accent. Table-based layout for maximum email-client compatibility. The subtitle renders in monospace with a `//` prefix when present. The footer identifies the course and suppresses replies.

## Contributing

Contributions are welcome under the terms of the license. You may clone or fork this repository to prepare one.

1. Fork the repository.
2. Create a branch with a prefix that describes the change type:
   * `feat/` for new features
   * `fix/` for bug fixes
   * `refactor/` for code restructuring
   * `docs/` for documentation updates
3. Make your changes, then run the gates in [TESTING.md](./TESTING.md).
4. Submit a pull request.

For step 3, `dotnet run` starts a development server and does not exit. Use it to look at your change in a browser. Use the commands in [TESTING.md](./TESTING.md) to actually verify it.

### Commit Messages

This project uses semantic commits:

* `feat:` new feature
* `fix:` bug fix
* `ux:` UI or UX improvement
* `docs:` documentation only
* `style:` formatting and whitespace, no logic change
* `refactor:` code restructuring that neither fixes a bug nor adds a feature
* `chore:` build process or tooling changes
* `meta:` license, metadata, dependency changes
* `devops:` CI/CD pipeline changes
* `debug/test:` testing and scaffolding

## Legal Notice

Copyright 2026 Rene Andre Bedonia Jocsing. All rights reserved. This is not open source software.

**Source code.** Clone or fork the repository to prepare a contribution, and modify your own copy for that purpose. You may not redistribute the software, publish or deploy a derivative of it, sublicense it, or sell copies of it, without explicit written consent.

**Course materials.** Read them, and give an unmodified copy to another person for their personal, private study. You may not modify them, present them as your own work, publish or post them anywhere, teach from them in any course or bootcamp or training programme, or sell them, without explicit written consent.

Read [LICENSE.md](./LICENSE.md) for the exact terms. Some modules, such as the Grades Viewer, are closed by design and are absent from this repository.
