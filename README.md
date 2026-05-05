# Ren's Courses

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-222222?style=for-the-badge&logo=github&logoColor=white)](https://whitelicorice.github.io/Ren-s-Courses/)
[![Netlify](https://img.shields.io/badge/Netlify-Mirror-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://renscourses.netlify.app)
[![Shortlink](https://img.shields.io/badge/Shortlink-bit.ly%2Frenscourses-EE6123?style=for-the-badge&logo=bitly&logoColor=white)](https://bit.ly/renscourses)

This repository hosts a headless Learning Management System designed for courses I handle under the **University of the Philippines Visayas, Division of Physical Sciences and Mathematics, BS in Computer Science curriculum.**

---

### Legal Notice & License

**All material is strictly copyrighted. All rights reserved.**

This project is **NOT free to clone, fork, or distribute.** The source code and course materials are provided on GitHub for **reference and educational purposes only**.

* View the detailed **[LICENSE](./LICENSE.md)** for a more in-depth read on permitted usage.
* **Some modules and related services (e.g., Grades Viewer) are closed-source by design** and are intentionally excluded from this repository.

---

### Roadmap by Module

* [x] Course Site: Modernize the UX of the core LMS module.
* [x] Submission Bin: Let students submit their deliverables on the course site itself, instead of email.
* [x] Grades Viewer: Let students view their grades in real-time.
* [x] Site Mirror: deploy a live mirror on Netlify for redundancy.
* [x] Booking System: Let students book appointments in advance.
* [x] Mailing List: Email those enrolled in each course (on a per course basis) as frontmatter is released.
* [x] PWA Integration: Allow the course site to be installed on machines as an application.
* [x] Calendar: Let students view upcoming events and deadlines. For instructors, allow dynamic scheduling of events.
* [ ] Calendar Local Holidays: Look for an API that serves local holidays (this is hard, probably need to build my own).
* [x] Calendar Custom Events: Provide an API for defining custom events on the calendar beyond holidays and frontmatter.
* [ ] Search system: somehow integrate a search engine that parses generic frontmatter (possible, but low-priority since frontmatter count is manageable).
* [x] Theming. Adaptive themes and controls.
* [ ] Custom themes. Add more themes and provide an API to extend these themes (low-priority, since Light Mode and Dark Mode are sufficient).

---

### Notes

* Since the Course Site module runs entirely on CRON jobs and the BlazorStatic engine, updating of deadlines and release of upcoming materials may be delayed by a few minutes. In exchange, the course site is very, *very* fast and loads almost instantly even on slow networks. There is *zero lag*, versus other similar course sites built using heavyweight frameworks like React, Angular, Laravel, etc.

* Headless architecture allows swapping in and out of modules, providing infinite flexibility versus monolithic frameworks like Moodle.

* The Grades Viewer module utilizes an L2 and L1 cache for speedy grade lookups. However, this means that cached grade sheets may be stale versus their live counterparts until the cache expires: 15 minutes for L1 and 60 minutes for L2. This is insignificant in practice as the live sheets are rarely updated...

* The Submission Bin module runs on an external Google Forms, but it works as intended, and is sufficient for my purposes. Perhaps I will hoist this off to a proper web module in the future. However, no free-forever solution exists for independent developers. As the issue is simply UI, then this probably won't be addressed.

* A proper Dashboard will probably be never implemented due to architecture constraints. Instead, all managerial tasks will have to be done programmatically (I do not like Dashboards, anyway).

### Grades Viewer Architecture

The Grades Viewer module is a private Google Apps Script application deployed as a web app that lets students query their grades in real-time. It integrates with the course site through a menu link and shares the same visual identity. Because it handles student records, the source code is not public — but its architecture is worth describing here since it represents a substantial portion of the system's backend engineering.

The core design constraint is that Google Apps Script imposes a 6-minute execution limit, a 100 KB per-key cache ceiling, and a 250-character cache key maximum. Under those constraints, the system provides sub-second lookups across multiple Google Sheets gradebooks while keeping every layer cache-aware and cache-invalidating.

**Data model.** A static `CourseDirectory` maps academic years to courses to spreadsheet IDs and sub-sheet names. Adding a new course is a one-line entry in this directory — no code changes, no deployment needed. Each course config declares which sub-sheets to query, and those sub-sheet names become the section headers in the rendered output. The form's year-course cascading dropdown runs entirely client-side from a serialized JSON map, so filtering courses by academic year requires no server round-trip.

**Caching.** A two-layer strategy isolates student results from sheet data. Layer 1 (student result cache, 10-minute TTL) stores the parsed grade array for a specific student-sheet combination. Layer 2 (sheet data cache, 60-minute TTL) stores the full raw sheet contents parsed from the Google Sheets API. Both cache keys are SHA-256 hashes that include a live schema version derived from the sheet's header row — when an instructor adds, renames, reorders, or deletes a grade column, the schema hash changes automatically and both cache layers invalidate without manual intervention. A per-section refresh button on the frontend bypasses all caches and re-fetches the live sheet for a single sub-sheet, returning updated grades without reloading the page.

**Header mapping.** Gradebook columns are identified by semantic headers rather than hard-coded column indices. The system recognizes variations like "Student Number," "Student No.," and "SN" for the same field, and any column whose name does not start with an underscore is treated as a grade column. This means instructors can add new assessment columns to their spreadsheets without touching the code.

**Rendering.** Since Google Sheets gradebooks often have many columns, the table renderer splits each sub-sheet's grades into sections of 4 columns, each with its own repeated header row. This ensures students never need to scroll horizontally to see column labels — a small UX detail that matters on mobile devices and during in-person grade consultations.

**Frontend.** The web app supports light and dark themes (synced with localStorage and system preference), includes inline form validation with live error messages, uses proper ARIA roles and live regions for screen readers, and respects `prefers-reduced-motion`. The theme toggle, collapsible grade sections, and refresh buttons all work with zero external dependencies beyond Google's built-in `google.script.run` bridge.

The Grades Viewer is accessed by students through the course site's menu bar under "Grades." It is intentionally separate from the main repository — partly for security, partly because Google Apps Script has its own deployment lifecycle (managed via `clasp` and TypeScript compilation) that differs from the .NET static-generation pipeline of the course site.

## Contributing

Contributions are welcome, but take note that your code will fall under the terms of the license. Please follow these guidelines to keep the project organized.

### Workflow

1. Fork the repository.
2. Create a new branch for your changes. Use a prefix that describes the type of change, followed by a specific name:
* `feat/` for new features
* `fix/` for bug fixes
* `refactor/` for code restructuring
* `docs/` for documentation updates
* Example: `feat/vite-plugin-monkey`
3. Make your changes and test them using `npm run dev`.
4. Submit a Pull Request.

### Commit Messages

This project follows semantic commits. Start your commit message with a type, followed by a colon and a brief description.

* `feat:` A new feature
* `fix:` A bug fix
* `ux:` User interface or user experience improvements
* `docs:` Documentation only changes
* `style:` Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc)
* `refactor:` A code change that neither fixes a bug nor adds a feature, but makes the codebase better
* `chore:` Build process or auxiliary tool changes
* `meta:` License, metadata, dependency changes, etc.
* `debug/test:` Testing, scaffolding, and debugging.
* Example: `feat: add markdown export to doc manager`

### Tests

Tests live in `tests/Ren.Courses.Tests/`. xUnit framework, Moq + bUnit. No fixture files on disk — test data defined inline via `EphemeralPost<T>` harness.

```bash
# Kill any locked process before building
pwsh -Command "Get-Process | Where-Object { \$_.ProcessName -like '*Blazor*' } | Stop-Process -Force"

# Run all tests
dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj
```

Key patterns:
- **Test collection** `BuildTimeProvider` sets `STATIC_GEN_TIME` + `TERM_START`/`TERM_END` env vars before any test in the collection runs. All tests using `BuildTimeProvider` or services that depend on it must opt into this collection.
- **InternalsVisibleTo** lets tests access `internal` methods. Testability helpers (`BuildEvents()`, `CalculateFallbackHolidays()`, `GetVisiblePosts(IEnumerable)`) are marked `internal` — never change their public signature.
- **PostGrid component** tested via bUnit with `TestContext.Render<PostGrid>()`. No DI services needed — all state comes through parameters.
- **Pure function extraction**: Complex logic extracted as `internal static` methods for direct testing without DI setup.
- **Environment-dependent date logic** frozen via `STATIC_GEN_TIME` env var for deterministic assertions. Current frozen time: 2026-03-15 18:00 PHT. Update this value when writing date-sensitive tests.
- **EphemeralPost&lt;T&gt;**: In-memory markdown fixture harness. Define frontmatter + body in-line, no disk I/O:
  ```csharp
  var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
  {
      Title = "Test", Published = new DateTime(2026, 3, 1)
  }, body: "## Content");
  var fm = post.FrontMatter; // deserialized
  var md = post.RawMarkdown; // "---\ntitle: Test\n..."
  ```

