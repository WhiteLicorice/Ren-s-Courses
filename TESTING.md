# Testing

This file is the runbook for every gate in this repository. Read it before you run a suite. Each section gives the command to run, the count you should expect, and the false alarms that a full parallel run produces under load.

The project has four gates. Three of them run in GitHub CI. The Playwright suite does not, so you must run it yourself before you ship or present.

## Prerequisites

- .NET 9 SDK.
- Node.js. CI pins version 26.1.0.
- Python 3.12.
- A recursive submodule checkout. PDF generation reads `Dependencies/RensMarkdownTemplates`.

Clone the repository with `git clone --recurse-submodules`. In an existing checkout, run `git submodule update --init --recursive` instead.

The public repository does not track the course materials. The workflow clones the private material depot into `Content` before it runs the .NET gate. To run the content-hygiene tests locally, remove `Content/.gitkeep`, clone the depot into `Content`, then run `git restore -- Content/.gitkeep`. The Quick Start in [README.md](./README.md) gives the commands. A contributor without depot access does not need it for the fixture workflow below.

## Gates at a Glance

| Gate | Command | Count | Runs in CI |
|---|---|---|---|
| JS | `npm test` | 12 suites, 223 tests | Yes |
| .NET | `dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj` | 271 tests | Yes |
| Python | `python -m unittest discover -s .github/utils -p "test_*.py"` | 14 tests | Yes |
| End-to-end | `npm run test:e2e` | 318 tests | No |
| Edge offline | `npx playwright test tests/e2e/edge-cases.spec.js --project=msedge --workers=1` | 26 tests | No |

We measured the JS, .NET, Python, and end-to-end counts on 2026-11-11 after the B-001 rebase and the R4 fixes. The Edge offline count remains from 2026-09-12 at commit `f595f1b`.

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

The five content-hygiene tests and the material-layout real-corpus lint read `Content/Materials`. A clone without the private material depot has no such folder, so those six tests skip with `MaterialDepotFact`. The workflow clones the depot before the .NET gate, and its guard fails earlier if the checkout is empty.

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

Most tests need no file on disk. Three fixture files are the exception. The suites depend on all three. `tests/fixtures/diagram-fixtures.js` and `tests/Ren.Courses.Tests/DiagramFixtures.cs` hold the shared diagram matrix that Jest and Playwright both read. `tests/fixtures/toc-fixtures.js` holds the article page that `toc.spec.js` serves. No test may depend on a live material. [PLAYBOOK.md](./PLAYBOOK.md), section Test Fixtures, gives the rule and its guards.

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
| `toc.js` | `replaceState` rather than `pushState` on click, no-href links, keyboard activation, the `hashchange` listener, scroll on load, the position spy, the zero-height guard, diagram heading exclusion, and the desktop sidebar follow |
| `faq.js` | `replaceState` on a quick-link click, `_openDetailsForHash`, and the `hashchange` listener |
| `calendar.js` | `filterCalendar`, `filterCalendarMulti`, `toggleCalendarTag`, `clearCalendarFilter`, `initCalendarNav`, `changeMonth`, and the event popover |
| `course-filter.js` | `initCourseFilter` restore from `localStorage`, `toggleCourseFilter`, and `clearCourseFilter` |
| `code-features.js` | Wrapping, the double-wrap guard, language labels, and the copy button |
| `interactive-diagrams.js` | Lazy Mermaid loading, fit and narrow and pan selection, the 14px label floor, direction rewriting, height reservation, overflow cues, resize, theme handling, both fallback paths, and manual step navigation |
| `scroll-button.js` | The click scrolls to the top, and the absent button is a no-op |
| `submission-menu.js` | Dropdown state, outside-click dismissal, Escape, and idempotent setup |
| `theme.js` | `switchPrismTheme`, `data-theme`, `localStorage`, the theme-color meta tag, and the system preference fallback |
| `site.js` | Offline status and lifecycle, through `offline-status.test.js` and `offline-lifecycle.test.js` |
| `Offline/service-worker.template.js` | Snapshot install, incremental update copy, validation, repair, and navigation fallback, through `service-worker.test.js` |

`wwwroot/js/scrollbars.js` has no Jest suite. Playwright covers its behavior instead.

`wwwroot/js/__tests__/setup.js` applies the `innerText` polyfill and the `IntersectionObserver` stub before every suite.

### Patterns to Keep

`window.location.hash` is not configurable in jsdom. Call `history.pushState` to set the hash before you install a mock. Use `Object.getPrototypeOf(window.history).pushState.call(...)` to bypass an active spy when the test needs a real URL change.

Each suite reads its script from disk and runs it with `new Function(source)()`. The script therefore executes in global scope. That is what publishes `window.generateTOC` and its siblings.

## Python (unittest)

`.github/utils/generate_feed.py` builds one RSS 2.0 feed per course at build time. It has 14 tests. They cover feed generation, date parsing, the term-end boundary, empty-feed output, showcase-mode skipping, the active-course gate, and nested materials.

```bash
python -m unittest discover -s .github/utils -p "test_*.py" -v
```

## End-to-End (Playwright)

Playwright runs against two pre-built fixture sites. A lightweight file server serves the absolute fixture. The suite covers every major user flow.

No test reads a live material. The site generator builds the fixture content from `tests/fixtures/site/Content`. It writes `output-e2e/` with an absolute ContentPath and `output-e2e-relative/` with a relative one. The suite never reads `output/`, which holds the production site. [PLAYBOOK.md](./PLAYBOOK.md), section Test Fixtures, gives the rule and its guards.

CI does not run this suite. The Playwright run takes too long for a GitHub runner, so CI runs the JS, .NET, and Python gates instead. Treat the end-to-end suite as the release gate you run locally.

### Building the Fixture Site

Build both fixture sites first. The suite reads `output-e2e/` and `output-e2e-relative/` and does not create either.

```bash
npm run build:e2e-site
npm run build:e2e-relative
```

The script is `tests/fixtures/site/build.js`. It sets `SITE_PROFILE=e2e` or `SITE_PROFILE=e2e-relative` and a fixed environment:

| Variable | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `STATIC_GEN_TIME` | `2026-09-15T02:00:00Z` |
| `TERM_START`, `TERM_END` | `2026-08-01`, `2026-12-31` |
| `ACTIVE_COURSES` | `fixture-course-a,fixture-course-b` |
| `SHOWCASE_MODE` | `false`, so the real visibility rules run |

`tests/fixtures/site/Content/Materials` holds two flat materials and one nested material. The nested file sits at `fixture-course-a/fixture-lab-nested/fixture-course-a-lab-nested.md`, and its image sits in a `media` folder beside it.

`SITE_PROFILE=e2e` selects `SiteLayout.EndToEndFixture` in `Program.cs`. That layout keeps every generated path apart from production: the content root, the output folder, the PDF cache in `artifacts/e2e-site`, and the generated PDFs. The PDF cache prunes every slug it does not see, so a shared cache would delete the production PDFs.

The first build links `artifacts/e2e-site/pdf-toolchain` to the pinned toolchain in `artifacts/pdf-toolchain`. Without a production toolchain, the build downloads one.

`SITE_PROFILE=e2e-relative` selects `SiteLayout.RelativeFixture`. It reads the fixture content through the relative `bin/Release/net9.0/Content` copy. It writes `output-e2e-relative/`. It uses `artifacts/e2e-site-relative` for the PDF cache and toolchain. The relative build deletes that bin content folder after the app exits. The normal fixture build deletes it before the run, and the production build copies the depot checkout under `Content/` into it. A later production build in the same worktree therefore cannot read fixture files.

`relative-materials.spec.js` serves the relative output under `/` and `/Ren-s-Courses/` from its own Node server. The server rewrites `<base href="/">` to the prefix for HTML responses. The GitHub Pages workflow sets the base in `App.razor` before the build. This test exercises relative URL resolution under both bases, not the build-time base edit. The server listens on an OS-assigned loopback port, logs it, and closes in `afterAll`. It must not use 5000 or 8081. The first full run failed two Chromium worker checks while the server sent `Cache-Control: no-store`. Commit `f81583a` removed that header and set `Content-Length`. The reruns passed. The cause is inferred, not proven. A controlled comparison was not run. Do not send `Cache-Control: no-store`.

Rebuild after you change a fixture Markdown file, a Razor component, a stylesheet, or a script. The suite serves whatever the two output folders hold.

### Running the Suite

Install the browsers once:

```bash
npx playwright install --with-deps chromium
```

Then run the tests. `playwright.config.js` starts `npx serve output-e2e` on port 8081 for you. It does not use port 8080, where a leftover `serve output` would serve the production site.

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

A full local run can show one or two Firefox failures. `playwright.config.js` uses two workers locally. Each browser context installs the service worker and pre-caches the whole site from one `npx serve` process. That contention times out a different Firefox test on each run. Re-run the failing spec alone before you call it a regression. It passes alone.

### Suite Coverage

| Spec file | What it covers |
|---|---|
| `home.spec.js` | `/`, the title, the glitch text, the lead, and the chip filter |
| `materials.spec.js` | `/materials`, `/materials/{tag}`, `/articles/{slug}`, the tag cloud, post cards, the generated and external download actions, code blocks, and the copy button |
| `nested-materials.spec.js` | The nested fixture: the flat article URL, the image beside the file, the generated PDF link, and the image entry in the offline manifest |
| `relative-materials.spec.js` | The fixture content built with a relative ContentPath, served under `/` and `/Ren-s-Courses/`: exact article URL, image natural width, linked PDF, and worker readiness |
| `faqs.spec.js` | `/faqs`, the sections, the chip filter, the accordion, hash deep-linking, and `hashchange` |
| `calendar.spec.js` | `/calendar`, month navigation, the tag filter, and the popover |
| `projects.spec.js` | `/projects`, `/projects/{tag}`, the tag cloud, and card expansion |
| `interactive-diagrams.spec.js` | In-memory fixtures on a synthetic route. Readable labels at 360px, 768px, and 1280px, layout selection, overflow cues, keyboard panning, stable widget height, and theme and resize safety |
| `toc.spec.js` | An in-memory article on a synthetic route. The outline without diagram headings, click navigation, the article path in the URL, the highlight, the at-bottom rule, navbar clearance, hash load, the scroll spy after a click, the sidebar follow, in-body fragment links, and a guard that no test requests an `/articles/` route |
| `navigation.spec.js` | Desktop navigation with 7 menu entries and the scroll hide-and-show, plus the mobile overlay |
| `theme.spec.js` | The light and dark toggle, `localStorage`, the Prism CSS swap, the icon state, and persistence |
| `edge-cases.spec.js` | `/null`, missing articles, offline snapshots, repair, and every major route checked for JS errors |
| `fixture-site.spec.js` | Guards: the server under test is the fixture site, and it publishes no live article, course, or PDF |

## What CI Runs

`.github/workflows/build-and-publish.yml` runs on every push to `master` and hourly on a cron. The order is:

1. Check out the repository with recursive submodules.
2. Check out the private material depot into `Content`.
3. Verify that `Content/Materials` holds a Markdown file.
4. Freeze a UTC timestamp into `STATIC_GEN_TIME`.
5. Restore the PDF toolchain cache and the generated PDF cache.
6. Run `npm ci`.
7. Run the JS gate.
8. Delete `Properties/launchSettings.json`, so no launch profile can force Development.
9. Run the .NET gate in Release.
10. Run the Python gate.
11. Generate the per-course RSS feeds.
12. Build for Netlify with `base href="/"`, then minify, stamp, finalize, and push to `netlify-pages`.
13. Build for GitHub Pages with `base href="/Ren-s-Courses/"`, then repeat and push to `gh-pages`.

Step 3 fails the run when the depot checkout is empty. No build then reads an empty `Content`.

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

`TERM_START` and `TERM_END` are not optional. Without them the static constructor of `BuildTimeProvider` calls `DateTime.Parse(null)`, throws `TypeInitializationException`, and the build exits 82.

## After a Change to `output/`

Run the offline finalizer after any command that changes `output/`. The production `dotnet run` does this for you. A later mutation does not. `npm run build:e2e-site` also finalizes `output-e2e/` for you.

```bash
dotnet run --no-build --project BlazorStaticMinimalBlog.csproj --configuration Release -- --finalize-offline
```

The final check belongs to a person, not to a suite. Install the deployed PWA in Edge. Load every generated route once while online. Close the app, reopen it offline, and open a generated PDF. Then test a failed deployment and a repaired update.
