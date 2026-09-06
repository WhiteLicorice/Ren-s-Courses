# Testing

This file is the runbook for every gate in this repository. Read it before you run a suite. Each section gives the command to run, the count you should expect, and the false alarms that a full parallel run produces under load.

The project has four gates. Three of them run in GitHub CI. The Playwright suite does not, so you must run it yourself before you ship or present.

## Prerequisites

- .NET 9 SDK.
- Node.js. CI pins version 26.1.0.
- Python 3.12.
- A recursive submodule checkout. PDF generation reads `Dependencies/RensMarkdownTemplates`.

Clone the repository with `git clone --recurse-submodules`. In an existing checkout, run `git submodule update --init --recursive` instead.

## Gates at a Glance

| Gate | Command | Count | Runs in CI |
|---|---|---|---|
| JS | `npm test` | 12 suites, 219 tests | Yes |
| .NET | `dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj` | 201 tests | Yes |
| Python | `python -m unittest discover -s .github/utils -p "test_*.py"` | 11 tests | Yes |
| End-to-end | `npm run test:e2e` | 296 tests | No |
| Edge offline | `npx playwright test tests/e2e/edge-cases.spec.js --project=msedge --workers=1` | 26 tests | No |

All counts were measured on 2026-09-06 at commit `aea9707`.

## .NET (xUnit)

The tests live in `tests/Ren.Courses.Tests/`. The project uses xUnit with Moq and bUnit.

A Blazor process can hold a file lock and fail the build. Release the lock first, in PowerShell:

```powershell
Get-Process | Where-Object { $_.ProcessName -like '*Blazor*' } | Stop-Process -Force
```

Then run the suite:

```bash
dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj
```

### Patterns to Keep

`TestEnvironment.cs` sets `STATIC_GEN_TIME`, `TERM_START`, `TERM_END`, and `ACTIVE_COURSES` before any test runs. Every test that reads build time or visibility must join that collection.

The frozen time is `2026-03-15T10:00:00Z`. That is 18:00 Philippine time.

`InternalsVisibleTo` gives the test project access to `internal` members. The testability helpers `BuildEvents()`, `CalculateFallbackHolidays()`, and `GetVisiblePosts(IEnumerable)` are `internal` on purpose. Do not widen them.

`PostGrid` renders through bUnit with `TestContext.Render<PostGrid>()`. It needs no dependency injection. Every input arrives as a parameter.

Extract complex logic as an `internal static` method. A static method is testable without a container.

`EphemeralPost<T>` builds a Markdown fixture in memory. Declare the frontmatter and the body inline:

```csharp
var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
{
    Title = "Test", Published = new DateTime(2026, 3, 1)
}, body: "## Content");
var fm = post.FrontMatter;   // deserialized
var md = post.RawMarkdown;   // "---\ntitle: Test\n..."
```

Most tests need no file on disk. Two fixture files are the exception. Both are load-bearing. `tests/fixtures/diagram-fixtures.js` and `tests/Ren.Courses.Tests/DiagramFixtures.cs` hold the shared diagram matrix that Jest and Playwright both read.

## JS (Jest)

Jest tests the client scripts in `wwwroot/js/`. The suites live in `wwwroot/js/__tests__/`.

```bash
npm test                  # all suites
npx jest --watch          # watch mode
npx jest --coverage       # with coverage
```

### Covered Scripts

| Script | What the suite tests |
|---|---|
| `toc.js` | `replaceState` rather than `pushState` on click, no-href links, keyboard activation, the `hashchange` listener, and scroll on load |
| `faq.js` | `replaceState` on a quick-link click, `_openDetailsForHash`, and the `hashchange` listener |
| `calendar.js` | `filterCalendar`, `filterCalendarMulti`, `toggleCalendarTag`, `clearCalendarFilter`, `initCalendarNav`, `changeMonth`, and the event popover |
| `course-filter.js` | `initCourseFilter` restore from `localStorage`, `toggleCourseFilter`, and `clearCourseFilter` |
| `code-features.js` | Wrapping, the double-wrap guard, language labels, and the copy button |
| `interactive-diagrams.js` | Lazy Mermaid loading, fit and narrow and pan selection, the 14px label floor, direction rewriting, height reservation, overflow cues, resize, theme handling, and both fallback paths |
| `scroll-button.js` | The click scrolls to the top, and the absent button is a no-op |
| `submission-menu.js` | Dropdown state, outside-click dismissal, Escape, and idempotent setup |
| `theme.js` | `switchPrismTheme`, `data-theme`, `localStorage`, the theme-color meta tag, and the system preference fallback |
| `site.js` | Offline status and lifecycle, through `offline-status.test.js` and `offline-lifecycle.test.js` |
| `Offline/service-worker.template.js` | Snapshot install, validation, repair, and navigation fallback, through `service-worker.test.js` |

`wwwroot/js/scrollbars.js` has no Jest suite. Playwright covers its behavior instead.

`wwwroot/js/__tests__/setup.js` applies the `innerText` polyfill and the `IntersectionObserver` stub before every suite.

### Patterns to Keep

`window.location.hash` is not configurable in jsdom. Call `history.pushState` to set the hash before you install a mock. Use `Object.getPrototypeOf(window.history).pushState.call(...)` to bypass an active spy when the test needs a real URL change.

Each suite reads its script from disk and runs it with `new Function(source)()`. The script therefore executes in global scope. That is what publishes `window.generateTOC` and its siblings.

## Python (unittest)

`.github/utils/generate_feed.py` builds one RSS 2.0 feed per course at build time. It has 11 tests. They cover feed generation, date parsing, the term-end boundary, empty-feed output, showcase-mode skipping, and the active-course gate.

```bash
python -m unittest discover -s .github/utils -p "test_*.py" -v
```

## End-to-End (Playwright)

Playwright runs against the pre-built static output. A lightweight file server serves it. The suite covers every major user flow.

CI does not run this suite. The Playwright run takes too long for a GitHub runner, so CI runs the JS, .NET, and Python gates instead. Treat the end-to-end suite as the release gate you run locally.

### Building the Fixture Site

Build the site first. The suite reads `output/` and does not create it.

```bash
SHOWCASE_MODE=true \
ASPNETCORE_ENVIRONMENT=Production \
TERM_START=2026-08-01 \
TERM_END=2026-12-31 \
ACTIVE_COURSES="cmsc-124,cmsc-131" \
dotnet run --no-launch-profile --configuration Release
```

`TERM_START` and `TERM_END` are not optional. Without them the static constructor of `BuildTimeProvider` calls `DateTime.Parse(null)`, throws `TypeInitializationException`, and the build exits 82.

`SHOWCASE_MODE=true` shows every non-draft post. Some specs need that content and skip without it.

The same command in PowerShell:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:TERM_START = "2026-08-01"
$env:TERM_END = "2026-12-31"
$env:ACTIVE_COURSES = "cmsc-124,cmsc-131"
$env:SHOWCASE_MODE = "true"
dotnet run --no-launch-profile --configuration Release
```

### Running the Suite

Install the browsers once:

```bash
npx playwright install --with-deps chromium
```

Then run the tests. `playwright.config.js` starts `npx serve output` for you.

```bash
npm run test:e2e                                 # Chromium and Firefox
npx playwright test tests/e2e/home.spec.js       # one spec
npx playwright test --project=chromium           # one browser
npx playwright show-report                       # the HTML report
```

On Windows, run the Edge offline checks separately:

```bash
npx playwright test tests/e2e/edge-cases.spec.js --project=msedge --workers=1
```

Read the summary line for the result. A pipe into `tail` reports the exit code of `tail`, not of Playwright.

Expect two Firefox failures in a full local run. `playwright.config.js` uses two workers locally. Each browser context installs the service worker and pre-caches more than 150 assets from one `npx serve` process. That contention times out a different Firefox test on each run. Re-run the failing spec alone before you call it a regression. It passes alone.

### Suite Coverage

| Spec file | What it covers |
|---|---|
| `home.spec.js` | `/`, the title, the glitch text, the lead, and the chip filter |
| `materials.spec.js` | `/materials`, `/materials/{tag}`, `/articles/{slug}`, the tag cloud, post cards, the TOC, code blocks, and the copy button |
| `faqs.spec.js` | `/faqs`, the sections, the chip filter, the accordion, hash deep-linking, and `hashchange` |
| `calendar.spec.js` | `/calendar`, month navigation, the tag filter, and the popover |
| `projects.spec.js` | `/projects`, `/projects/{tag}`, the tag cloud, and card expansion |
| `interactive-diagrams.spec.js` | In-memory fixtures on a synthetic route. Readable labels at 360px, 768px, and 1280px, layout selection, overflow cues, keyboard panning, stable widget height, and theme and resize safety |
| `navigation.spec.js` | Desktop navigation with 7 menu entries and the scroll hide-and-show, plus the mobile overlay |
| `theme.spec.js` | The light and dark toggle, `localStorage`, the Prism CSS swap, the icon state, and persistence |
| `edge-cases.spec.js` | `/null`, missing articles, offline snapshots, repair, and every major route checked for JS errors |

## What CI Runs

`.github/workflows/build-and-publish.yml` runs on every push to `master` and hourly on a cron. The order is:

1. Check out the repository with recursive submodules.
2. Freeze a UTC timestamp into `STATIC_GEN_TIME`.
3. Restore the PDF toolchain cache and the generated PDF cache.
4. Run `npm ci`.
5. Run the JS gate.
6. Delete `Properties/launchSettings.json`, so no launch profile can force Development.
7. Run the .NET gate in Release.
8. Run the Python gate.
9. Generate the per-course RSS feeds.
10. Build for Netlify with `base href="/"`, then minify, stamp, finalize, and push to `netlify-pages`.
11. Build for GitHub Pages with `base href="/Ren-s-Courses/"`, then repeat and push to `gh-pages`.

The RSS step must receive `ACTIVE_COURSES`. Without it the generator sees an empty active set and drops every tagged post.

## Build-Time Visibility Rules

A build hides most content by default. Know these rules before you decide that a page is broken.

`CourseContentProvider` publishes a material only when its `Published` date falls inside the `TERM_START` to `TERM_END` window. The date must also be no later than the frozen build time.

A tagged material is course-scoped. It needs at least one tag that matches `ACTIVE_COURSES`. An active course does not override the term window. Both checks must pass.

After the term ends, nothing is visible. A future release stays hidden until the frozen time reaches it.

`SHOWCASE_MODE=true` bypasses every rule above and hides drafts only.

Use `--no-launch-profile` for static generation. The launch profiles set `ASPNETCORE_ENVIRONMENT=Development` and start a persistent development server instead.

To preview the CI-equivalent visibility locally, set the frozen time yourself:

```bash
STATIC_GEN_TIME="2026-08-06T10:00:00Z" \
TERM_START="2026-08-01" \
TERM_END="2026-12-31" \
ACTIVE_COURSES="cmsc-124,cmsc-131" \
SHOWCASE_MODE=false \
ASPNETCORE_ENVIRONMENT=Production \
dotnet run --no-launch-profile --configuration Release
```

## After a Change to `output/`

Run the offline finalizer after any command that changes `output/`. The production `dotnet run` does this for you. A later mutation does not.

```bash
dotnet run --no-build --project BlazorStaticMinimalBlog.csproj --configuration Release -- --finalize-offline
```

The final check belongs to a person, not to a suite. Install the deployed PWA in Edge. Load every generated route once while online. Close the app, reopen it offline, and open a generated PDF. Then test a failed deployment and a repaired update.
