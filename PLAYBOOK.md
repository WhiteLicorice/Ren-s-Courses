# PLAYBOOK.md

Persistent project memory. This file holds confirmed, reusable knowledge that is not obvious from reading one source file.

It does not duplicate documentation. [README.md](./README.md) explains what the project is and how to author content. [TESTING.md](./TESTING.md) explains how to run every gate. This file records the traps, the rejected approaches, and the reasons.

Keep the reasons. A rule recorded without one gets re-litigated by the next reader, who finds it inconvenient, cannot see what it was protecting against, and removes it.

## Update Protocol

- Update the relevant topic below before you end a session.
- Prefer a concise topic entry over a chronological activity log.
- Record the date confirmed and the evidence or verification path.
- Correct stale guidance in place. Do not append a retraction to a superseded paragraph.
- Keep the reason an approach lost, not only the rule that replaced it.
- Never store a credential, personal data, a private URL, transient process state, or an unverified guess here.

## The Standard Verification Path

Most entries below end with the same check. It is written once here.

1. `dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj --configuration Release`
2. A production run, `dotnet run --no-launch-profile --configuration Release`, with the documented term variables.
3. The browser suites when the change touches client code. See [TESTING.md](./TESTING.md).

## Gate Baselines

Measured 2026-09-06 at site commit `aea9707`, submodule pin `2d2b29e`, on a clean tree.

| Gate | Result |
|---|---|
| .NET, Release | 201 passed, 0 failed |
| Jest | 12 suites, 219 passed, 0 failed |
| Python | 11 passed, 0 failed |
| Playwright, Chromium and Firefox | 294 of 296 passed |
| Edge offline, `edge-cases.spec.js` | 26 passed, 0 failed |
| Production build | 45 PDFs, exit 0 |

The two Playwright failures were both `calendar.spec.js` in Firefox. Both passed when that spec ran alone, at 14 of 14. This is the worker contention recorded under Test Harness Traps, not a regression.

Re-read the submodule pin before you trust it. `git submodule status` is the source of truth.

## Content Authoring

Three contracts live here: submission links, the `downloadLink` exemption, and diagram markers. README shows the syntax. This section records why each behaves as it does.

Confirmed 2026-07-14, `downloadLink` updated 2026-09-05:

- Submission actions are declared as `submissions` entries with `name` and `link`. `Models/CourseFrontMatter.cs` and the shared `MarkdownFrontMatter` in `Dependencies/RensMarkdownTemplates/src/RensMarkdownTemplates/Models/` own the contract. `Blog.razor` renders it. `wwwroot/js/submission-menu.js` drives the dropdown.
- Google Forms are created by hand, one per submission. Drive organization is manual too. The expected number of forms is small, and manual placement handles a form with several file-upload questions more predictably than custom automation would. Do not introduce Forms or Drive automation unless the author revisits this decision.
- **`downloadLink` exempts a material. It is not a fallback.** A material without the key takes the default path and gets a native PDF. A material with the key is exempt. `DiscoverSources` keeps it out of `sources`, `RunAsync` publishes `PdfGenerationStatus.External`, and `PruneAsync` deletes any PDF and state that material held before. `Blog.razor` reads `DownloadLink` first, so a stale manifest entry cannot win. `IsNullOrWhiteSpace` is the predicate, so a blank value counts as absent.
- **The cost of that fork is the failure fallback, and losing it is intended.** A failed generation now renders no Download action, and the summary reports `Unavailable`. A redundancy that silently replaces a stale PDF hides the failure. Do not restore the old behavior.
- The exemption applies to batch discovery only. `PdfGeneratorOptions.IncludeExternalDownloads` overrides it, and `RensMarkdownTemplates.Cli` sets it to `true` beside `IncludeDrafts = true`. An explicit `render --input FILE` specifies the document itself, so it must always render.
- `LogSummary` counts `External` in its own bucket and keeps an exempt document out of the warning loop. Two `Diagnostic` strings must not change: `RunAsync` matches `"Pending generation"` exactly, and `LogSummary` matches the `"Fallback available"` prefix.
- An external URL never enters the offline manifest. `OfflineBundleGenerator.AddReference` rejects any host except the synthetic `offline.local`.
- All 36 materials that carried a legacy Google Drive `downloadLink` were stripped on 2026-09-05. The key is opt-in from zero. Every removed URL survives at `git show 811ec0a:Content/Materials/<file>.md`.
- **The fork probe is the only check that exercises the exempt branch end to end.** Add `downloadLink` to a material, rebuild, and expect `1 exempt` in discovery and `1 external` in the summary, with the PDF pruned and `data-download-source="external"` on the page. Remove the key and expect the material to return to `generated`. Repeat this probe after any change to discovery or pruning. A green suite never exercises it, because no committed material declares the key.
- Only the materials inside the term window publish article pages, so a probe must use one of those. Do not probe `cmsc-124-lab0`. `tests/e2e/materials.spec.js` asserts its native PDF download.

Diagram markers, confirmed 2026-07-15:

- A diagram renders only where the body carries `<!-- diagram: key -->` on its own line. An unreferenced diagram never renders. The same key twice produces two widgets.
- The marker sets placement in the web page and in the PDF, by construction. The web path splits rendered HTML at the comment. The PDF path substitutes the same marker line in body Markdown before Pandoc.
- Shared `DiagramMarkers` is the single syntax owner. `MarkerLine` matches an own-line marker, `FindReferencedKeys` serves the PDF path, `Substitute` replaces a marker, and `ResolveSegments` serves the web path. `KeyFormat` validates a key as `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `GetFencedRanges` uses a CommonMark line-based state machine. It handles a labeled fence, an indented fence of up to three spaces, a tilde fence, and an unclosed fence that runs to end of file. A bare-fence-only regex was tried and rejected. It missed a labeled opener and misread the bare closer of a labeled block as a new opener. CommonMark allows an info string on a tilde fence, including one containing backticks, so only a backtick fence restricts it.
- `ResolveSegments` uses one global instance counter, not a per-key count. Two distinct diagrams on one page get ids 0 and 1 instead of colliding at 0.
- `tests/Ren.Courses.Tests/DiagramContentHygieneTests.cs` scans every file under `Content/Materials` and fails the build on a missing, invalid, or duplicate `key`, on a marker naming an undeclared key, and on a declared diagram no marker references. Runtime stays graceful, so an unknown-key marker logs a warning and an unreferenced diagram is skipped.

## PDF Generation

The generator lives in the submodule, not here. Read that boundary first. Most confusion in this area comes from looking for a file in the wrong repository.

Confirmed 2026-07-14 through 2026-08-16:

- PDF generation runs at application startup, immediately before BlazorStatic generation. `PdfGeneratorService` discovers non-draft Markdown recursively from `Content/Materials` itself, because BlazorStatic's post collection is not populated at that point. It publishes a per-route `PdfGenerationManifest`. A document-level failure is isolated. It never stops the site build.
- A document fingerprint length-frames every logical input: generator schema version, the complete raw Markdown, the selected template directory, the shared toolchain manifest, `package-lock.json`, Mermaid configuration, referenced local media, and shared PDF assets. Any frontmatter or body change therefore invalidates that document alone. Cache state lives in `artifacts/material-pdfs/state`. Content-addressed PDFs live in `wwwroot/pdfs`. A missing, corrupt, mismatched, inactive, or orphaned entry is invalidated or pruned. Both PDF and state publication are atomic.
- The pinned submodule restores its Node dependencies before Tailwind or PDF generation. Application startup bootstraps pinned Pandoc 3.10 and Tectonic 0.16.9 archives for the current Windows or Linux x64 runtime. Downloads use checksums, partial files, retries, extraction staging, and executable validation. Tectonic receives the pinned remote bundle URL and keeps its range cache under `artifacts/tectonic-cache`. It does not download the multi-gigabyte bundle eagerly.
- Generated PDFs must stay out of SDK static-web-asset discovery, which the early-imported `Directory.Build.props` handles. Read that file rather than duplicating its exclusion list here. BlazorStatic copies the physical directory after startup generation.
- **The generator does not live here.** The PDF generator, canonical frontmatter DTOs, diagram-marker implementation, templates, institutional assets, pinned tool manifest, Mermaid dependencies, and pipeline tests all live in the public `WhiteLicorice/RensMarkdownTemplates` repository. This repository holds the Blazor adapter and the site-specific content hygiene tests. CI must initialize submodules recursively. Change the shared repository first, run its test gate, render its Mermaid fixture through the CLI, then advance the pin here.
- **Mermaid PDF configuration moved with the generator.** The `.mmdc.json` palette work and the finding that a top-level `"htmlLabels": false` is what switches node labels to SVG text both belong to the shared repository now. Neither `.mmdc.json` nor `@mermaid-js/mermaid-cli` exists in this tree. Do not look for them here.
- `RunPandocAsync` runs every `.lua` file in the selected template directory in deterministic order, with `code-block.lua` first. `wide-table.lua` renders a table of six or more columns as ruled landscape in an ordinary material, and renders any section whose heading contains `rubric` in landscape whatever the table width. A formal-syllabus table needs an explicit `.landscape` fenced Div, which keeps a compact CO or grading matrix in portrait. Footer bars are zero-width overlays, so they cannot expand a longtable and clip the right border.
- `page-break.lua` converts a standalone `<!-- newpage -->` comment to LaTeX `\newpage`. It is template-local on purpose, so the marker affects the PDF without adding page semantics to web rendering.
- `RunPandocAsync` copies supported image, PDF, and SVG files from the selected template into an isolated `template-assets` work directory and passes that relative path as `templateAssets`. This avoids an absolute-path Tectonic input while preserving template-directory fingerprint invalidation.
- **Pandoc's `implicit_figures` floats a mid-body image to the top of a page.** The shared default template loads `\usepackage{float}` and sets `\floatplacement{figure}{H}` to pin a figure at its marker. A tall diagram on a full page then leaves a whitespace gap. That is preferable to incorrect ordering.
- **Markdig and Pandoc disagree about lists.** Markdig allows a `- ` list immediately after a paragraph. Pandoc's `markdown` reader requires a blank line first. The generator passes `--from markdown+lists_without_preceding_blankline` to match Markdig. The extension is present in pinned Pandoc 3.10.
- **An embedded image needs both the source asset and the staging fix.** Shared commit `a042e75` stages resolved images into the isolated Tectonic work directory and reports an unresolved reference before compilation. Without it, Pandoc can emit a relative `\includegraphics` path that Tectonic cannot resolve from its work directory. Advance the pin before relying on an embedded image.
- Running headers keep page 1 empty, show the material subtitle on an even page, and show `Prepared by: <full author name>` on an odd page after page 1. One `\RunningHeaderText` macro drives portrait pages, rotated rubric pages, and landscape longtable headers. PDF metadata ignores `nickname` deliberately.
- Verification path for a cold run: delete `artifacts/pdf-toolchain`, `artifacts/tectonic-cache`, `artifacts/material-pdfs`, and `wwwroot/pdfs`, then run the production build. A warm run afterwards must report every document as a cache hit.

## Static Generation

Visibility is the hard part. A page that seems missing is usually a page the term window or the active-course gate hid on purpose, and the build is correct.

Confirmed 2026-07-14 through 2026-08-06:

- A generated article page is `output/articles/{slug}.html`, not `output/articles/{slug}/index.html`.
- The home page must pass `BlazorStaticContentService<CourseFrontMatter>.Posts` into `PostsList`, which then applies `CourseContentProvider.GetVisiblePosts(sourcePosts)`. During static generation a provider can capture the service before its post collection is populated. The parameterless overload produced tag chips above an empty card grid. `BlogPageTests.Home_UsesParsedPostsEvenWhenProviderCapturedAnEmptyService` reproduces that lifecycle split.
- A local CSS or JavaScript URL carries a 12-character SHA-256 content hash. An assembly timestamp is not sufficient, because a static-asset-only edit need not rebuild the assembly. The offline build ID hashes the finalized worker template and every manifest input, so a worker change needs no manual cache-name bump.
- **Visibility is a strict term window plus an active-course gate.** Content outside `TERM_START` to `TERM_END` is not published at all, even for an active course. A tagged item must also match `ACTIVE_COURSES`. Showcase mode bypasses both and hides drafts only. This supersedes the earlier carryover and showcase-only rules. `CourseContentProvider` and `FAQContentProvider` share `IsVisibleOutsideShowcase`. `BookingContentProvider` and `CalendarEventProvider.GetVisibleCustomEvents` apply the same gate, and `CalendarEventFrontmatter` carries `Tags` so an event can be course-scoped.
- The gate is applied on every surface, and each one was a separate hole. `WebsiteKeys.RemoveHiddenArticlePages`, wired as `AfterContentParsedAndAddedAction`, drops the `articles/{slug}` page for a post that fails visibility, so a direct URL no longer serves hidden material. The home page derives its `CourseFilter` chips from visible posts. `generate_feed.py` mirrors the same rules, so feed item count equals generated article page count.
- **`generate_feed.py` must receive `ACTIVE_COURSES`.** Without it the generator sees an empty active set and drops every tagged post.
- Tests use dedicated fixture tags, `fixture-course-a` and `fixture-course-b` active and `fixture-course-c` inactive, set in `TestEnvironment`. Never anchor a test to a real course tag.
- Empty states exist and are tested. `Blog.razor` shows "No Materials available." and `Projects.razor` shows "No projects available.", mirroring the Bookings text that already existed.

## Interactive Diagrams

The renderer measures before it commits. Every rule below protects one of two things: a readable label, or a page that does not jump.

Confirmed 2026-09-02, responsive rendering:

- The fixed stage is gone. `.diagram-viewport` fills the article column and scrolls sideways. `.diagram-stage` inside it carries the measured size. The old `.diagram-canvas` rule capped width at 26rem. It squeezed a wide diagram until its labels were unreadable. Measured with the `wideTokenStream` fixture in Chromium before the change: smallest painted label 2.07px at a 360px viewport and 2.98px at 768px. After the change the same fixture paints 16.58px and 33.28px with no overflow.
- The renderer writes its choice to `data-diagram-layout` as `fit`, `narrow`, or `pan`. The floor is 14 CSS pixels for a normal label, and 16px stands in when a drawing carries no measurable label. Painted label size is `computed font-size x (stage width / viewBox width)`, so the decision reduces to comparing `available/viewBoxWidth` against `14/labelSize`.
- `narrowDirection` is the only reflow opt-in. It accepts `TB` and `BT`, applies to the first `flowchart` or `graph` declaration line, and preserves every other character. A widget reflows only when every step is rewritable, so a walkthrough never mixes layouts. A sequence diagram therefore always pans. `Models/DiagramNarrowDirection.cs` owns the .NET rules and `rewriteFlowchartDirection` in `wwwroot/js/interactive-diagrams.js` owns the browser twin. **Keep the two regexes in step.** Nothing on the .NET side rewrites a definition for the PDF, which always receives the canonical `step.Mermaid`.
- **Every variant renders into an offscreen measurement host attached to `document.body`, never into the visible stage.** Detaching the node from the document is not an option, because `getBBox` and `getComputedStyle` need layout. The host uses `position:absolute;left:-99999px;visibility:hidden`. A failed recalculation keeps the previously committed SVG, so a theme change or a resize can never blank a working diagram.
- **One `ResizeObserver` per widget, work scheduled with `requestAnimationFrame`, and a width-change guard.** The guard is what stops the observer loop. The renderer's own output changes heights, so reacting to anything but a real width change re-enters immediately. A width change inside the same mode resizes with no Mermaid call.
- Both the tallest stage height and the tallest complete step height are reserved, so Previous, Next, and Play never move the surrounding page. Horizontal scroll position carries across a step change proportionally.
- **Do not trust Mermaid's generated viewBox or intrinsic `max-width`.** Some client renders produced a correctly sized stage holding a drawing about 40px wide. Rebuild each SVG viewBox from `.root.getBBox()` plus 8px padding and enforce fill dimensions inline with `!important`. Diagram sources must also be excluded from `code-features.js` and hidden synchronously before Mermaid loads, or the raw definition flickers and receives an empty `.code-wrapper`.

Playback, confirmed 2026-09-02:

- Play does not run on a `setInterval`. One cancellable session per widget drives a small state machine. The phases are `opening`, `pan`, `edge`, and `page`. A step that fits uses the opening hold alone.
- Pan speed is one viewport width per 8 seconds. No research specifies a correct pan speed. This is the agreed comprehension-first default, and every value stays a named constant for later tuning: `PLAY_INITIAL_HOLD_MS`, `PLAY_VIEWPORT_TRAVERSAL_MS`, `PLAY_END_HOLD_MS`, `PLAY_REDUCED_MOTION_HOLD_MS`, and `PLAY_REDUCED_MOTION_PAGE_FRACTION`.
- Every stationary hold is five times the first draft, which had asked a reader to take in a whole diagram in two seconds. Opening is 10000ms, edge is 5000ms, and the reduced-motion page hold is 10000ms. `PLAY_VIEWPORT_TRAVERSAL_MS` stays 8000 on purpose. It paces reading while the drawing moves, which is a different problem from how long a still view should last. One step of the pacing fixture runs about 18 seconds, so a browser test that watches a whole step carries an explicit `test.setTimeout`.
- `state.playback` is both the live session and the generation token. Every timeout and animation frame checks `state.playback === session` before acting, which stops a cancelled phase from changing the step later. `pausePlayback` moves the session to `state.paused` and subtracts the elapsed hold. Manual scrolling, Previous, and Next call `stopPlayback`, which discards the session, so the next Play starts fresh from the left edge.
- Overflow and viewport width are read again on every pan frame, so a resize or a rerender during playback changes the speed instead of breaking the pan. The pan position lives in the session, not in the DOM.
- **`setScrollLeft` writes `scrollLeft` and then records what the browser actually stored. Keep the read-back.** The browser's own maximum can sit a fraction below the measured overflow. Without the read-back that clamp looks exactly like a reader grabbing the diagram, which stops playback at the right edge.
- The live region is written only when the step text changes. A pan writes hundreds of scroll updates per step, and every assignment to `textContent` is another polite announcement.
- Reduced motion replaces the pan with static pages. Each page is 90% of the viewport width, so consecutive views keep a tenth in common. `matchMedia` is absent in jsdom, so `createMotionQuery` returns null and the renderer treats that as full motion. W3C requires pause and resume for scripted scrolling ([SCR33](https://www.w3.org/WAI/WCAG22/Techniques/client-side-script/SCR33)) and recommends suppressing interaction-triggered animation for reduced-motion readers ([SCR40](https://www.w3.org/WAI/WCAG21/Techniques/client-side-script/SCR40)).
- `modestOverflowWalkthrough` in `tests/fixtures/diagram-fixtures.js` is the pacing fixture. At a 1280px window it hides 207px behind a 574px viewport, so one pan takes roughly 3 seconds and a browser test finishes quickly. `wideFlowchartWithoutReflow` hides 1198px, which suits reduced-motion paging and is far too slow for a full traversal.
- Jest drives the scheduler with fake timers. Confirmed, not assumed: a fake `requestAnimationFrame` fires every 16ms with a timestamp equal to the fake clock, and `Date.now()` advances with it. The first pan frame only seeds the timestamp and moves nothing, so an expected position is `(elapsed - hold - 16) x speed`.

Fixtures:

- **`tests/fixtures/diagram-fixtures.js` hand-mirrors `InteractiveDiagram.razor`, and that duplication can drift silently.** Both suites would keep passing against their own markup while the real article page breaks. `BlogPageTests.DiagramWidgetContract_MatchesTheJavaScriptFixtureBuilder` renders the component and asserts every emitted `data-` attribute appears in the fixture file. **Match whole tokens.** A substring check accepts a renamed attribute, because `data-diagram-scroll-hint` sits inside `data-diagram-scroll-hintX`. Confirmed red with that exact rename.
- **No test may depend on real material existing.** Material gets re-dated, retired, or hidden by the term window and the active-course gate. A test anchored to a published route then fails for a reason unrelated to the code under test. Use `tests/fixtures/diagram-fixtures.js`, `DiagramFixtures.cs`, or ephemeral frontmatter. `interactive-diagrams.spec.js` keeps a guard test asserting that the harness requests no `/articles/` route at all. A published article is a place to look with your own eyes, never a fixture.

## Diagram Theming

A theme flip costs zero Mermaid calls. Getting there took several rejected approaches, and the entries below record which ones failed and what the measurements were.

Confirmed 2026-09-06:

- Each step renders once with sentinel colours in the reserved range `#100000` to `#10FFFF`. They become `var(--dg-*)` after `mermaid.render` returns, past `securityLevel: strict` sanitisation. Flipping `data-theme` repaints with zero Mermaid calls. Geometry is theme-invariant, with identical viewBox, BBox, and label size for all 7 production steps under `default` against `base` overrides, so layout, the 14px floor, and height reservation never rerun for colour. The hygiene gate fails the build if an author uses the sentinel range.
- Palette harvest reads `mermaid.mermaidAPI.getConfig().themeVariables` per registry theme, takes about 10ms, and renders nothing. It keeps `CSS.supports('color', ...)` entries plus the `dropShadow` inner colour, and emits `<style id="diagram-palette">` as the first child of `<head>`, with one block per registry entry plus a `:root` fallback. **An empty harvest falls back to a plain per-theme `mermaid.initialize` and skips the rewrite**, so a Mermaid upgrade that moves `themeVariables` degrades to the old behavior instead of rendering everything in the `base` palette.
- Author colours survive untouched. `collectAuthorColors` reads `classDef`, `style`, and `linkStyle` lines and allows the shorthand, the expanded hex, and the `rgb()` spelling of each, because Mermaid re-serialises them. The palette-coverage test builds the same set, and the two must stay in step.
- **Residue rules run in paint contexts only.** Those are the generated `<style>` block, `<defs>`, and any `style`, `fill`, `stroke`, `color`, `stop-color`, or `flood-color` attribute. Never bare text, so a label reading `rgb(0,0,0)` survives. Scoping to `<style>` and `<defs>` alone was tried and rejected. Mermaid ships architecture icons as inline sprites whose paths carry `style="fill: none; stroke: #fff"` in the document body. Measured on a real `architecture-beta` render with built-in icons: 43 hardcoded whites, all inside `style` attributes, none in `<style>` or `<defs>`.
- **Black and white both map to `lineColor`, and this is deliberate.** They are opposites only because Mermaid authored each against its own default canvas. In a paint position both mean ink on the canvas. Measured contrast against `background`: `lineColor` 12.63 light and 8.44 dark, white left alone 1.00 light and therefore invisible, white mapped to `background` 1.00 in both. `background` is the surface behind the ink. **Never map ink to the canvas.** The `feDropShadow` flood maps to `shadowFlood`, which each registry entry names for itself. `#e0e0e0` is a genuine theme-invariant hardcoded value, confirmed as the single occurrence, in `.stateGroup .alt-composit`.
- `architecture-beta` needs no `registerIconPacks` call. The pinned bundle ships `cloud`, `database`, `disk`, `internet`, and `server` inline. The `serviceArchitecture` fixture and the architecture sprite e2e test are the gate, and that test measures a WCAG contrast floor of 3:1 rather than asserting a colour name. **Measure against `--dg-background`, never `document.body`.** The harness body is transparent, a transparent colour parses to black, and the test then reports a false failure.
- **Load does not block on a below-fold diagram.** `initInteractiveDiagrams` awaits `whenIdle()` before `getMermaid()`, so the 3.5 MB parse lands in an idle period. Do not reintroduce a fire-and-forget warm call beside an immediate `getMermaid()`. `getMermaid` memoises its promise and appends the script tag on the first call, so a second call starts the fetch at once and the idle scheduling does nothing. Widgets observe with `rootMargin: 800px`, renders yield between steps through `scheduler.yield` or a `MessageChannel` or `setTimeout(0)` fallback, and sources stay hidden from the first frame. The yield has one seam, `window.__diagramSchedule`, which `wwwroot/js/__tests__/setup.js` sets to a microtask because jsdom under fake timers runs no macrotask while a render chain is awaited. Nothing in the site sets it.
- A widget that fails on the deferred path calls `failWidget` for itself. The observer catch must never swallow the error. The source is hidden for every widget at init, so a silent failure leaves an empty box instead of the authored Mermaid.
- **`IntersectionObserver` alone is not enough, and this was confirmed the hard way.** It reports a threshold crossing, not a position. A reader who moves the page in one step, through an anchor link, an End keypress, or a fast fling, takes a widget from below the band to above it without the ratio ever leaving 0. No entry is queued and the widget stays an empty box until it is scrolled back. Reproduced on the real page: `window.scrollTo(0, scrollHeight)` on `articles/cmsc-124-act3` left both widgets at `data-diagram-initialized="loading"` with the source hidden, indefinitely. A probe observer created afterwards did receive an initial entry, which is why the bug hides from any test that observes after the jump. The fix is a `requestAnimationFrame`-throttled passive `scroll` sweep beside the observer, rendering any pending widget whose `getBoundingClientRect().bottom` is below 0. It runs once at setup. Both listeners come off when the last widget renders.
- `Models/SiteThemeRegistry.cs` is the single source of truth for the theme map. It renders into `App.razor` as `window.siteThemeRegistry` and `window.siteThemeColors`, and `theme.js` and the renderer both consume it. `ThemeSwitcher.razor` is static markup plus vanilla JS. `Services/ThemeService.cs` was deleted as dead interop. `theme.js` no longer gates the site theme on `#prism-theme-link` and no longer clobbers an explicit choice on an OS change.
- Adjacent decisions in the same blast radius: Tailwind `dark:` follows `[data-theme="dark"]` through `@custom-variant`. `interactive-diagrams.js` loads only on an article with diagram segments, following the `Prism.highlightAll` precedent in `Blog.razor`. The `wwwroot/offline-manifest.json` placeholder was deleted, because the generated `output/offline-manifest.json` is authoritative.

## In-Page Navigation

Every trap below came from one root cause. The page has a `<base href>`, and browser APIs resolve relative URLs against it.

Confirmed 2026-08-21 and 2026-08-31:

- **`<base href="/">` rewrites a relative `history.replaceState` URL, not just an anchor.** `Components/App.razor` sets `<base href="/" />`, and `replaceState` resolves a relative URL against `document.baseURI`. `history.replaceState(null, null, '#kotlin')` on `/articles/cmsc-124-lab0` therefore produced `https://host/#kotlin` and dropped the article path. On GitHub Pages the base is `/Ren-s-Courses/`, with the same failure. Dropping `href` from the TOC anchors never addressed this, because the base URL applies to the History API too. Always pass a path-absolute URL: `location.pathname + location.search + '#' + id`. Reproduce in a console by comparing `document.baseURI` with `location.href`.
- **A Markdown-authored `[text](#heading)` link has the same defect** and the TOC handlers do not cover it. `toc.js` rewrites `.prose a[href^="#"]` to a path-absolute href at init. That fixes the click, and also copy-link, middle-click, and open-in-new-tab, and it lets native fragment navigation do the scrolling. `materials.spec.js` guards the invariant. No `.prose a` may resolve to pathname `/` with a non-empty hash.
- **An IntersectionObserver band scroll spy leaves dead zones.** The old spy used `rootMargin: '-100px 0px -66% 0px'` and acted only on an intersecting entry, so a heading crossing the roughly 169px band between samples was never highlighted. Nothing was active at page top, and a clicked link landed its heading at y=0, above the band, leaving no highlight at all. It was replaced with a position check: the last heading whose `getBoundingClientRect().top - TOC_NAV_OFFSET <= 1`, throttled with `requestAnimationFrame` on scroll, applied to the desktop and mobile lists together and called directly on click. That is deterministic and unit-testable by stubbing `getBoundingClientRect`, since jsdom has no layout and zeroes every rect by default.
- A position-based spy cannot reach the last heading when the document ends before that heading reaches the navbar line. The at-bottom short-circuit in `toc.js` activates the final entry.
- **`document.querySelector('#' + id)` is wrong for a heading anchor.** Markdig `AutoIdentifiers` emits ids containing dots, such as `build.sh-run`, which parse as `#build` plus `.sh-run` and match nothing. An id starting with a digit throws `SyntaxError` outright, which aborts init before listeners are wired. Use `document.getElementById(decodeURIComponent(hash.slice(1)))`.
- **`TOC_NAV_OFFSET` (80px) in `wwwroot/js/toc.js` and `scroll-margin-top: 5rem` on `.prose h1,h2,h3` in `Styles/app.css` are a pair.** The fixed navbar measures 64.67px and otherwise hides an anchored heading at y=0. Keep them in sync, because CSS cannot read the JS constant.
- **An init function must be idempotent about a window-level listener.** `toc.js` stores its handlers on `window.__tocWindowListeners` and `faq.js` on `window.__faqHashListener`, removing the previous pair before re-registering. `faq.js` also marks a bound link with `dataset.faqBound`. This was not theoretical. The Jest suite re-executes each script per test against one jsdom window, and a duplicate-listener probe measured 10 `scrollIntoView` calls for one `hashchange`.

## Service Worker

Snapshots are immutable. A build either installs completely or keeps the previous snapshot, so a half-installed site never reaches a reader.

Confirmed 2026-09-01:

- `Services/OfflineBundleGenerator.cs` scans the final `output/` directory after static generation. It writes `output/offline-manifest.json` and replaces `__OFFLINE_BUILD_ID__` in `Offline/service-worker.template.js`. The build ID is a lowercase SHA-256 hash of the schema, clean routes, referenced asset URLs, asset bytes, and worker template bytes.
- The manifest contract is `{ schemaVersion: 1, buildId, routes, assets }`. Routes use clean URLs. Assets use relative URLs within the worker scope. Both arrays are sorted and deduplicated.
- **Run finalization after every output mutation.** The order is static generation, feed injection, HTML minification, deployment metadata stamping, then the finalizer. The workflow runs it for both Netlify and GitHub Pages. The command is in [TESTING.md](./TESTING.md).
- The generated worker uses immutable `ren-courses-offline-<buildId>` snapshots and `ren-courses-offline-meta` status metadata. It fetches the manifest with `no-store`. It then verifies the embedded build ID, fetches required resources with four concurrent workers, retries a transient failure up to three times, stores clean and trailing-slash route aliases, and calls `skipWaiting` only after validation succeeds.
- A same-build install validates the active snapshot before it writes. A complete snapshot receives no cache writes. An incomplete snapshot fetches and writes only the absent entries. Any failed install preserves the active build ID and records the failed build ID.
- Offline metadata always keeps five fields: `activeBuildId`, `state`, `errorCode`, `detail`, and `failedBuildId`. A client-side registration, update, timeout, or repair failure persists through a private worker message before the badge shows `error`. A repair clears error fields only after full snapshot validation.
- `wwwroot/js/site.js` serializes offline operations and passes an operation token through every asynchronous status update. It queries the installing worker during installation, ignores a stale worker message, and accepts a late activation only for the current operation. Repeated `online` events do not start parallel updates.
- A failed install deletes only a new incomplete snapshot. It keeps the active snapshot when a same-build repair fails. Activation validates the snapshot, writes ready metadata, claims clients, and removes only known Ren snapshot names plus legacy `ren-courses-online-first-v2` through `v5`. It does not delete an unrelated application cache.
- Navigation is network-first. The worker uses the exact clean route and its trailing-slash alias as a three-second fallback, then cancels the network request once the fallback wins. An unknown offline route returns HTTP 503. The worker does not update a cached route after a successful online navigation.
- Local scripts, styles, fonts, media, generated PDFs, Prism files, the web manifest, and Mermaid are exact cache entries. A linked web manifest icon, screenshot, or shortcut icon joins the asset inventory when it uses a local path. A local asset request checks the active snapshot before the network. The Android banner stays an optional online request and does not block local snapshot installation.
- `Components/App.razor` self-hosts pinned Prism 1.29.0, Mermaid 11.16.0, Inter, and JetBrains Mono files. `wwwroot/vendor/THIRD-PARTY-NOTICES.txt` records the licenses.
- Development pages hide the status control and skip worker registration. Production generation resets the exact `output/` directory first. The finalizer removes copied JavaScript tests and stale compressed offline files. Production output must include `service-worker.js` at the deployed application root. The GitHub Pages base path must stay in `Components/App.razor` while the generator emits scope-relative manifest entries.
- To roll back, deploy a byte-changed worker that clears only known Ren caches, unregisters itself, and claims clients. Keep the registration call active until the kill switch reaches installed clients.

```js
const REN_CACHE_PREFIXES = [
    'ren-courses-offline-',
    'ren-courses-offline-meta',
    'ren-courses-online-first-v2',
    'ren-courses-online-first-v3',
    'ren-courses-online-first-v4',
    'ren-courses-online-first-v5',
];

self.addEventListener('install', event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter(name => REN_CACHE_PREFIXES.some(prefix => name.startsWith(prefix)))
            .map(name => caches.delete(name)));
        await self.registration.unregister();
        await self.clients.claim();
    })());
});
```

## Calendar

Confirmed 2026-08-31:

- The desktop calendar shows three events per day at first. **Filtering must re-pack all events before it calculates the overflow count.** Filtering only the initially visible bars leaves an unrelated event inside `+N more`. `Calendar.razor` keeps the full day event list in the static output, and `wwwroot/js/calendar.js` applies the three-event limit after each filter.

## Scrollbars

Confirmed 2026-08-31:

- Native scrollbar colours follow `color-scheme` on `:root` and `[data-theme="light"]`. The `@supports not selector(::-webkit-scrollbar)` guard keeps Firefox's `scrollbar-color` path separate from Chromium's WebKit pseudo-elements. The drag state uses the accent token in both paths. Verified in Chromium and Firefox at phone, tablet, and desktop widths.

## Blazor Runtime (Absence Of)

Confirmed 2026-08-21:

- **The static output ships no Blazor runtime.** `Components/App.razor` loads plain `<script src>` tags only. A search of `output` for `blazor*.js` or `_framework` returns nothing, and no `@rendermode` is applied anywhere in `Components/` or `Program.cs`. The `DOMContentLoaded` handler in `wwwroot/js/site.js` is the only init path that has ever run in a browser.
- An `OnAfterRenderAsync` override in a page component is therefore dead code. The overrides in `Blog.razor` and `Calendar.razor` were removed. Their `@inject IJSRuntime` went too, along with the four `ctx.JSInterop.SetupVoid(...)` lines that existed only to stop bUnit's strict JSInterop from throwing. `BlogPageTests.Article_RendersWithoutIssuingAnyJavaScriptInterop` is the standing guard. It fails if any page component starts issuing interop again.
- Related shape left in place: `scroll-button.js` and `calendar.js` register `scroll` and `document` listeners unguarded inside their init functions. That is harmless while `site.js` is the single caller. They will double-register if an interactive render mode is ever introduced.

## Test Harness Traps

Read this before you call a browser failure a regression. Several entries here describe a test that fails under load, passes alone, and has nothing to do with the code under change.

- **Worker contention produces one or two varying Firefox timeouts per full local run.** Every Playwright context installs the service worker. Each one pre-caches more than 150 routes and assets from a single `npx serve` process. Measured on the full suite: 8 workers failed 1, 4 workers failed 1, and 2 workers passed all 288 at the time. `playwright.config.js` now uses 2 locally and 1 in CI, and it carries the reasoning inline. Named victims so far: the `home.spec.js` clear button, the `calendar.spec.js` reset button and month-label tests, the `projects.spec.js` abstract paragraph, the `materials.spec.js` back-link, and the offline cache tests. **A varying Firefox timeout is contention, not a product fault. Re-run the spec alone before calling it a regression.** Confirmed again 2026-09-06, when two `calendar.spec.js` tests failed in a full run and all 14 passed alone.
- A pre-existing flake was proved rather than assumed on 2026-09-06. The work was stashed, `output/` was rebuilt from the base commit, and the baseline failed the same way, a different test each run.
- The global Playwright timeout is 60 seconds, not the 30-second default. The diagram playback tests watch real 10-second holds, so one worker stays busy for minutes and a timing-sensitive test elsewhere can overrun 30 seconds with nothing actually wrong.
- **The diagram harness must share the static server's origin.** `page.setContent` on `about:blank` gives the document an opaque origin, and Chrome then refuses every loopback subresource, reporting that the request client is not a secure context. Neither the stylesheet nor the renderer loads. Every diagram test times out. `page.route` plus `route.fulfill` on `/__diagram-harness` keeps the origin and avoids `site.js` and the service worker.
- **Playwright Firefox offline emulation does not block a loopback fetch made by the service worker.** The unknown-route test simulates a real origin outage by closing the fixture network path before navigation. Chromium and Firefox must both receive the worker-generated HTTP 503.
- **Scroll anchoring breaks a scroll assertion in Firefox.** The `navigation.spec.js` navbar test failed intermittently because a late layout shift of roughly 97px made Firefox re-anchor the view, which fires a downward scroll event the test never issued. Observed with a `MutationObserver` log: `scroll 500 -> hide -> scroll 300 -> show -> scroll 396.8 -> hide`. The fix sets `overflow-anchor: none`, waits for the scroll position to stop changing, and asserts with a retrying expectation instead of one `evaluate` read. `html` also carries `scroll-smooth`, so `scrollBy` starts an animation. Use `scrollTo` with an explicit `scroll-behavior: auto`.
- `locator.evaluate` given a string containing an arrow function returns `undefined` rather than calling it. Pass the function itself.
- A focused scroll container answers `ArrowRight` for horizontal scrolling. `End` does not move it sideways.
- The e2e suite needs `SHOWCASE_MODE=true` to exercise every spec. Under the CI-matching `SHOWCASE_MODE=false`, the only FAQ content is filtered out and `faqs.spec.js` fails with "element(s) not found" rather than skipping. Unlike `materials.spec.js`, that spec has no `test.skip()` visibility guard.
- Two historical drift lessons worth keeping. `navigation.spec.js` once hardcoded 8 `menu.json` entries after the Submissions tab was dropped, leaving 7, and four tests failed in both browsers. Note the namesake: the per-material submission-links dropdown is a live feature and is unrelated. Separately, a substring locator for the "All Materials" back-link became a strict-mode violation once an empty-state panel added a second "View all materials" link. Use `getByRole('link', { name: 'All Materials', exact: true })`.
- Playwright does not run in CI, by decision. The suite takes too long for a GitHub runner. `AGENTS.md` requires running the real thing before shipping, so the e2e suite is a local release gate. See [TESTING.md](./TESTING.md).
