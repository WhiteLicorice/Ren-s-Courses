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

Measured 2026-11-11 on `master` after the B-004, B-005, B-006, B-008, and B-012 merges, with the local generator head `400b90b`. The Edge offline row remains from 2026-09-12 at `f595f1b`. The production row is from the B-019 head build. B-001 changes no route, PDF, or feed input.

| Gate | Result |
|---|---|
| .NET, Release | 271 passed, 0 failed |
| Jest | 12 suites, 223 passed, 0 failed |
| Python | 29 passed, 0 failed |
| Playwright, Chromium and Firefox | 352 of 352 passed |
| Edge offline, `edge-cases.spec.js` | 26 passed, 0 failed |
| Production build | `PDF gen: 62 docs, 0 gen, 61 cached, 1 external, 0 fallback, 0 unavailable`, exit 0. 47 routes, 61 PDF files, 33 feed items. Earlier rows counted PDFs only. This row quotes the generator's own summary line. |

The Python row is 29 after the deployment-trigger gate and the draft-key fix landed on 2026-11-12. Twelve tests cover the build gate and three cover the draft key. The other rows keep their original measurement dates.

The Playwright row is the full local release gate. When a worker-contention timeout appears, re-run that spec alone before calling it a regression. Test Harness Traps records the pattern.

Re-read the submodule pin before you trust it. `git submodule status` is the source of truth.

## Content Source

The public repository does not track the course materials. `Content` tracks only `.gitkeep`. The deploy workflow checks out the private `WhiteLicorice/RensMaterialDepot` repository into `Content` with the `MATERIAL_DEPOT_DEPLOY_KEY` deploy key. This step runs after the main checkout and before any step that reads `Content`.

Confirmed 2026-11-11 at `9986bbf` against the `actions/checkout@v5` source and README:

- `actions/checkout` with `path: Content` deletes the contents of an existing folder when that folder is not already a checkout of the same repository. The tracked `.gitkeep` does not survive on the runner. It exists only to keep the folder in a fresh clone of the public repository.
- The workflow runs `.github/utils/check_content.sh` after the depot checkout. The script fails the run when `Content/Materials` holds no Markdown file. The guard is the CI enforcement.
- The content checks that read `Content/Materials` skip with `MaterialDepotFact` when the folder is absent. The five content-hygiene tests and the material-layout real-corpus lint use it. A contributor without the private depot still runs the rest of the .NET gate. The guard, not the test, protects the deploy.
- `.gitignore` ignores everything under `Content` except `.gitkeep`, so a local depot clone never shows in `git status`. Clone the depot only after you remove the tracked `.gitkeep`, and restore it with `git restore -- Content/.gitkeep`. Git refuses to clone into a nonempty folder. Never delete an existing depot checkout.
- The csproj removes `Content/.git/**` from the output copy and from the watch glob. The depot checkout places a `.git` folder inside `Content`.
- A push to the depot does not trigger a build directly. An hourly fastcron job calls the workflow dispatch endpoint. The `check` job then builds when the depot commit changed or a dated material became visible. The platform cron remains a fallback. The Deployment Trigger section gives the setup.

### Deployment Trigger

GitHub's `schedule` event is best-effort. On this repository an hourly cron delivered 3 to 5 runs per day, with gaps of 4 to 12 hours. A dated material could stay hidden for hours after its release. Confirmed 2026-11-12 from the run history of `build-and-publish.yml`. The build at `2026-11-11T14:10:51Z` hid `cmsc-124-act15` as a future post. No scheduled run fired at `16:12Z` or later. A manual dispatch at `19:17Z` published it in two minutes.

fastcron is the dependable timer. It calls the dispatch endpoint hourly at minute 7. The endpoint creates the run at once and does not use the platform scheduler. The workflow keeps the platform cron as a fallback and `workflow_dispatch` for manual runs.

The owner does these steps.

1. Create a fine-grained personal access token. Set the resource owner to `WhiteLicorice`. Set repository access to `Ren-s-Courses` only. Set the `Actions` repository permission to `Read and write`. Set an expiry and record it.
2. Create a fastcron job with these values:
   - Method: `POST`
   - URL: `https://api.github.com/repos/WhiteLicorice/Ren-s-Courses/actions/workflows/build-and-publish.yml/dispatches`
   - Headers: `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, `X-GitHub-Api-Version: 2026-03-10`
   - Body: `{"ref":"master","inputs":{"mode":"auto"}}`
   - Schedule: `7 * * * *`
3. Run the job once. A new workflow run appears in seconds. Its `check` job prints `build=false` when nothing changed.

The token can start workflows in this repository. It cannot change code. Never put the token in the repository, a ticket, or a chat. fastcron stores it in the job headers. An expired token stops the sync on the GitHub side without an error in this repository, so check the fastcron response.

The `check` job reads `build-metadata.txt` from `netlify-pages` and `gh-pages`. Each file carries `Build Time` and `Depot Commit`. The job builds when a file is missing, when the commit differs, or when a non-draft material's `published` instant falls after the recorded build time and no later than now. A date-only `published` value is midnight Philippine time. `.github/utils/should_build.py` holds the decision. `.github/utils/test_should_build.py` covers it.

A push to the site, or a manual `gh workflow run build-and-publish.yml`, always builds. Use `gh workflow run build-and-publish.yml -f mode=auto` to exercise the gate by hand.

To roll back, move the depot checkout out of `Content` first. Then revert one commit at a time, newest first:

1. The deployment-trigger commit removes the `check` job, the gate script and its tests, and the fastcron instructions. It restores the cron-only workflow.
2. `meta: update the license for the private material repository` restores the old `LICENSE.md` section 1.
3. `docs: describe the material depot as the Content source` restores the old `README.md`, `TESTING.md`, and `PLAYBOOK.md`.
4. `devops: pull the material depot into Content at build time` restores the 133 tracked `Content` files. It removes the guard, the workflow steps, the ignore rules, and the test change. It also removes `.gitkeep` and the csproj exclusion.

Do not rely on Git to refuse writing over the ignored depot files.

## Test Fixtures

**No test may depend on a live material.** The rule covers Jest, .NET, and Playwright. It covers a new test and any test you move or edit. A live material is anything under `Content/`, or a route the build generates from it, such as `/articles/cmsc-124-lab0`.

An author can re-date, retire, or rewrite a material. The term window and the active-course gate also hide it. A test anchored to a published route then fails, or passes vacuously, for a reason unrelated to the code under test. A published article is a place to look with your own eyes. It is never a fixture.

Simulate the page with a fixture instead:

- **Jest.** Build the DOM in the test. Reuse a shared builder where one exists, such as `buildWidgetMarkup`. Do not hand-copy Razor markup.
- **.NET.** Use `EphemeralPost<T>`, `DiagramFixtures.cs`, and the fixture course tags from `TestEnvironment`.
- **Playwright, one widget.** Serve an in-memory harness page with `page.route` and `route.fulfill` on a synthetic route on the static server's own origin. The site's own stylesheet and scripts then load from the built site. `interactive-diagrams.spec.js` (`/__diagram-harness`) and `toc.spec.js` (`/__toc-harness`) are the models.
- **Playwright, a whole page.** Add a Markdown file under `tests/fixtures/site/Content`. Rebuild with `npm run build:e2e-site`. The site generator in `Program.cs` writes the fixture site to `output-e2e/`, and the suite serves only that folder. Put route names in `tests/fixtures/site/routes.js`, so a spec never repeats a slug.

The fixture site replaced a live build on 2026-09-24. Before that, the suite served `output/`, built with `SHOWCASE_MODE=true` from `Content/`. Specs named `cmsc-124-lab0`, `cmsc-125`, and `cmsc-131`, and 18 tests skipped whenever the term window hid their content. The fixture site now fixes the content and the frozen time, so those skips became assertions.

`SITE_PROFILE=e2e` selects `SiteLayout.EndToEndFixture` in `Program.cs`. **Every generated path must stay apart from production.** `PdfCacheService.PruneAsync` deletes the cache state and the PDF of every slug outside the current build. A fixture build that shared `artifacts/` or `wwwroot/pdfs` would delete the production PDF cache. `ProgramTests` guards each separated path.

A hand-mirrored fixture needs two guards:

1. A .NET contract test. It renders the Razor component and asserts that the fixture carries the same hooks. `BlogPageTests.DiagramWidgetContract_MatchesTheJavaScriptFixtureBuilder` guards `tests/fixtures/diagram-fixtures.js`. `BlogPageTests.TocHarnessContract_MatchesTheArticleLayout` guards `tests/fixtures/toc-fixtures.js`.
2. A Playwright guard test. It asserts that the harness requests no `/articles/` route.

`fixture-site.spec.js` guards the fixture site itself. It fails when the server under test holds a live article, a live course, or a live PDF.

Also guard the fixture inside each test that needs a specific fixture property. Examples are "the sidebar box can scroll" and "a hidden diagram step heading exists". Without that guard, a fixture edit makes the test vacuous with no signal.

**One exception.** `DiagramContentHygieneTests` reads `Content/Materials` on purpose. Its subject is the authored content, so a fixture cannot stand in for it. It targets no specific material and passes with zero files. When the folder is absent, the five content-scanning tests skip with `MaterialDepotFact` instead of throwing. The material-layout real-corpus lint uses the same attribute and skips too. The workflow guard fails the CI run before the .NET gate, so the skip cannot hide an empty deploy. Keep any new content lint to the same limits.

Confirmed 2026-09-24. The first TOC fix at `0f28707` added e2e tests against the live `cmsc-124-act9` and `cmsc-124-lab0`. Those tests moved to `toc.spec.js`. Against the pre-fix `toc.js`, the harness fails 5 of 12 tests, the same defect the live page showed.

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
- Only the materials inside the term window publish article pages, so a probe must use one of those.

Diagram markers, confirmed 2026-07-15:

- A diagram renders only where the body carries `<!-- diagram: key -->` on its own line. An unreferenced diagram never renders. The same key twice produces two widgets.
- The marker sets placement in the web page and in the PDF, by construction. The web path splits rendered HTML at the comment. The PDF path substitutes the same marker line in body Markdown before Pandoc.
- Shared `DiagramMarkers` is the single syntax owner. `MarkerLine` matches an own-line marker, `FindReferencedKeys` serves the PDF path, `Substitute` replaces a marker, and `ResolveSegments` serves the web path. `KeyFormat` validates a key as `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- `GetFencedRanges` uses a CommonMark line-based state machine. It handles a labeled fence, an indented fence of up to three spaces, a tilde fence, and an unclosed fence that runs to end of file. A bare-fence-only regex was tried and rejected. It missed a labeled opener and misread the bare closer of a labeled block as a new opener. CommonMark allows an info string on a tilde fence, including one containing backticks, so only a backtick fence restricts it.
- `ResolveSegments` uses one global instance counter, not a per-key count. Two distinct diagrams on one page get ids 0 and 1 instead of colliding at 0.
- `tests/Ren.Courses.Tests/DiagramContentHygieneTests.cs` scans every file under `Content/Materials` and fails the build on a missing, invalid, or duplicate `key`, on a marker naming an undeclared key, and on a declared diagram no marker references. Runtime stays graceful, so an unknown-key marker logs a warning and an unreferenced diagram is skipped.

## Material Layout

Confirmed 2026-11-11 against site commit `c13f018` with the nested-material change in the working tree. That commit alone lacks the feature.

- A material at `Content/Materials/<course>/<material>/<name>.md` publishes at `articles/<name>`, the same URL a flat `<name>.md` has. `MaterialLayout.Normalize` rewrites the BlazorStatic post URL and the generated page, so old links and feed items stay valid. Flat files keep their old URL and PDF name.
- **BlazorStatic makes a nested URL from the path relative to `ContentPath`.** The after-parse hook flattens it. It is a usable hook, not the only possible design. The page URL and output file are already in `PagesToGenerate` when the hook runs.
- **An absolute `ContentPath` breaks BlazorStatic's media rewrite.** The fixture profile passes an absolute path, so `HtmlMediaRewriter` turns an image `src` into a rooted Windows path. The media copy target then becomes the source folder, `CopyContent` copies a file onto itself, and the host never stops. `MaterialLayout.Normalize` rewrites the copy target and the `src` to `Content/Materials/...`. Keep this normalization. Production passes a relative path and its media entries already point at the published folder.
- **The published image URL is relative on purpose.** `Content/Materials/...` resolves under `<base href="/">` and `<base href="/Ren-s-Courses/">`. Do not add a leading slash.
- **A duplicate file name fails the build.** `MaterialLayout.ValidateUniqueSlugs` compares names without case and after trimming edge hyphens, the same rule as the generator. It also checks the slug against the allowlist. A slug must match `^[A-Za-z0-9][A-Za-z0-9_-]*$` after the generator's normalization. The allowed characters are ASCII letters, digits, underscore, and hyphen. The first character must be an ASCII letter or digit. The generator trims edge hyphens, so the PDF name and the duplicate key use `lesson`, while the page URL and the feed link keep `-lesson-`. The check runs before PDF generation. The duplicate error names both paths. The slug error names the file, the slug, and the allowed characters. The generator repeats the duplicate check with its own exception, so a standalone generator run cannot collide either. The slug check is site-only. The generator is unchanged for it.
- The generator change lives in `RensMarkdownTemplates`. `PdfGeneratorService.RouteName` removes one trailing `/index` first, then takes the last path segment, the same rule BlazorStatic uses. Advance the pin before you rely on it. A relative image is resolved against the material folder first, so a `media` folder beside the file needs no extra generator change.
- `generate_feed.py` mirrors the same slug rule, including a nested `index.md`. Its recursive scan is the reason a nested material reaches the feed at all.

## PDF Generation

The generator lives in the submodule, not here. Read that boundary first. Most confusion in this area comes from looking for a file in the wrong repository.

Confirmed 2026-07-14 through 2026-08-16:

- PDF generation runs at application startup, immediately before BlazorStatic generation. `PdfGeneratorService` discovers non-draft Markdown recursively from `Content/Materials` itself, because BlazorStatic's post collection is not populated at that point. It publishes a per-route `PdfGenerationManifest`. A document-level failure is isolated. It never stops the site build.
- A document fingerprint length-frames every logical input: generator schema version, the complete raw Markdown, the selected template directory, the shared toolchain manifest, `package-lock.json`, Mermaid configuration, referenced local media, and shared PDF assets. Any frontmatter or body change therefore invalidates that document alone. Cache state lives in `artifacts/material-pdfs/state`. Content-addressed PDFs live in `wwwroot/pdfs`. A missing, corrupt, mismatched, inactive, or orphaned entry is invalidated or pruned. Both PDF and state publication are atomic.
- The pinned submodule restores its Node dependencies before Tailwind or PDF generation. Application startup bootstraps pinned Pandoc 3.10 and Tectonic 0.16.9 archives for the current Windows or Linux x64 runtime. Downloads use checksums, partial files, retries, extraction staging, and executable validation. Tectonic receives the pinned remote bundle URL and keeps its range cache under `artifacts/tectonic-cache`. The real path is `Dependencies/RensMarkdownTemplates/artifacts/tectonic-cache`. The site-root `artifacts/tectonic-cache` is not read, so a build that copies only that folder downloads the bundle again. It does not download the multi-gigabyte bundle eagerly when the cache is present.

Since generator `63c19f2`, two settings control the cache. `PDF_TECTONIC_ONLY_CACHED=1` passes `--only-cached`, so Tectonic uses no resource outside the cache. `PDF_TECTONIC_CACHE_DIR` points every worktree at one shared cache. A complete cache, including the bundle index, generates a changed PDF with no network request. A cold or incomplete cache fails and names the missing resource. Both default to the old behavior, so a build without them still fetches when the cache misses.
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
- **A site stylesheet cannot change a PDF.** The pipeline maps Markdown to LaTeX with the template files in the submodule. It reads `wwwroot` only to stage a referenced media file, at `PdfGeneratorService.cs:736-742`. No stylesheet input exists. A rule in `wwwroot/css/site.css` therefore changes the web page only. Confirmed 2026-11-11 for the table-cell inline code rule at commit `11d2738`.
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
- **An absent content `media` folder does not fail the build.** A production build with `Content/Projects/media` deleted and both content favicon copies removed finished with exit 0 on 2026-11-11 at `c13f018`. The log copies `Content/Materials/media` and does not mention `Content/Projects/media`. Do not add a placeholder or `.gitkeep` to keep an empty `media` folder in Git.

## Interactive Diagrams

The renderer measures before it commits. Every rule below protects one of two things: a readable label, or a page that does not jump.

Confirmed 2026-09-02, responsive rendering:

- The fixed stage is gone. `.diagram-viewport` fills the article column and scrolls sideways. `.diagram-stage` inside it carries the measured size. The old `.diagram-canvas` rule capped width at 26rem. It squeezed a wide diagram until its labels were unreadable. Measured with the `wideTokenStream` fixture in Chromium before the change: smallest painted label 2.07px at a 360px viewport and 2.98px at 768px. After the change the same fixture paints 16.58px and 33.28px with no overflow.
- The renderer writes its choice to `data-diagram-layout` as `fit`, `narrow`, or `pan`. The floor is 14 CSS pixels for a normal label, and 16px stands in when a drawing carries no measurable label. Painted label size is `computed font-size x (stage width / viewBox width)`, so the decision reduces to comparing `available/viewBoxWidth` against `14/labelSize`.
- `narrowDirection` is the only reflow opt-in. It accepts `TB` and `BT`, applies to the first `flowchart` or `graph` declaration line, and preserves every other character. A widget reflows only when every step is rewritable, so a walkthrough never mixes layouts. A sequence diagram therefore always pans. `Models/DiagramNarrowDirection.cs` owns the .NET rules and `rewriteFlowchartDirection` in `wwwroot/js/interactive-diagrams.js` owns the browser twin. **Keep the two regexes in step.** Nothing on the .NET side rewrites a definition for the PDF, which always receives the canonical `step.Mermaid`.
- **Every variant renders into an offscreen measurement host attached to `document.body`, never into the visible stage.** Detaching the node from the document is not an option, because `getBBox` and `getComputedStyle` need layout. The host uses `position:absolute;left:-99999px;visibility:hidden`. A failed recalculation keeps the previously committed SVG, so a theme change or a resize can never blank a working diagram.
- **One `ResizeObserver` per widget, work scheduled with `requestAnimationFrame`, and a width-change guard.** The guard is what stops the observer loop. The renderer's own output changes heights, so reacting to anything but a real width change re-enters immediately. A width change inside the same mode resizes with no Mermaid call.
- Both the tallest stage height and the tallest complete step height are reserved, so Previous and Next never move the surrounding page. Horizontal scroll position carries across a step change proportionally.
- **Do not trust Mermaid's generated viewBox or intrinsic `max-width`.** Some client renders produced a correctly sized stage holding a drawing about 40px wide. Rebuild each SVG viewBox from `.root.getBBox()` plus 8px padding and enforce fill dimensions inline with `!important`. Diagram sources must also be excluded from `code-features.js` and hidden synchronously before Mermaid loads, or the raw definition flickers and receives an empty `.code-wrapper`.

- The live region is written only when the step text changes. A step change writes the sentence once, and a scroll inside the step writes nothing.

Fixtures:

- **`tests/fixtures/diagram-fixtures.js` hand-mirrors `InteractiveDiagram.razor`, and that duplication can drift silently.** Both suites would keep passing against their own markup while the real article page breaks. `BlogPageTests.DiagramWidgetContract_MatchesTheJavaScriptFixtureBuilder` renders the component and asserts every emitted `data-` attribute appears in the fixture file. **Match whole tokens.** A substring check accepts a renamed attribute, because `data-diagram-scroll-hint` sits inside `data-diagram-scroll-hintX`. Confirmed red with that exact rename.
- **No diagram test may depend on a live material.** Test Fixtures above holds the rule and its guards. `interactive-diagrams.spec.js` keeps a guard test asserting that the harness requests no `/articles/` route at all.

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

The first two traps below share one cause. The page has a `<base href>`. Browser APIs resolve relative URLs against that base.

Confirmed 2026-08-21, 2026-08-31, and 2026-09-24:

- **`<base href="/">` rewrites a relative `history.replaceState` URL, not just an anchor.** `Components/App.razor` sets `<base href="/" />`, and `replaceState` resolves a relative URL against `document.baseURI`. `history.replaceState(null, null, '#kotlin')` on `/articles/cmsc-124-lab0` therefore produced `https://host/#kotlin` and dropped the article path. On GitHub Pages the base is `/Ren-s-Courses/`, with the same failure. Dropping `href` from the TOC anchors never addressed this, because the base URL applies to the History API too. Always pass a path-absolute URL: `location.pathname + location.search + '#' + id`. Reproduce in a console by comparing `document.baseURI` with `location.href`.
- **A Markdown-authored `[text](#heading)` link has the same defect** and the TOC handlers do not cover it. `toc.js` rewrites `.prose a[href^="#"]` to a path-absolute href at init. That fixes the click, and also copy-link, middle-click, and open-in-new-tab, and it lets native fragment navigation do the scrolling. `toc.spec.js` guards the invariant. No `.prose a` may resolve to pathname `/` with a non-empty hash.
- **An IntersectionObserver band scroll spy leaves dead zones.** The old spy used `rootMargin: '-100px 0px -66% 0px'` and acted only on an intersecting entry, so a heading crossing the roughly 169px band between samples was never highlighted. Nothing was active at page top, and a clicked link landed its heading at y=0, above the band, leaving no highlight at all. It was replaced with a position check: the last heading whose `getBoundingClientRect().top - TOC_NAV_OFFSET <= 1`, throttled with `requestAnimationFrame` on scroll, applied to the desktop and mobile lists together and called directly on click. That is deterministic and unit-testable by stubbing `getBoundingClientRect`, since jsdom has no layout and zeroes every rect by default.
- A position-based spy cannot reach the last heading when the document ends before that heading reaches the navbar line. The at-bottom short-circuit in `toc.js` activates the final entry.
- **Exclude every heading inside `[data-interactive-diagram]` from the outline.** `InteractiveDiagram.razor` renders its own `<h2>` and one `<h3>` per step inside `.prose`. Later steps use `hidden`. Their rectangles have height 0 and top 0. The position spy treats top 0 as passed, so the last hidden heading pins the active id. A TOC link to a hidden step cannot scroll to that step. `toc.js` filters all diagram headings and skips any remaining heading whose rectangle has height 0. Chromium reproduced this on act9 before the fix. The old TOC listed seven diagram headings and held `learning-diagram-1-step-2-title` through six wheel samples.
- **Keep the desktop active entry visible inside its scroll box.** The box is `tocContainer.parentElement`, the sticky element at `Components/Pages/Blog.razor:252`. This DOM coupling must stay in sync with `toc.js`. The code adjusts only the box's `scrollTop`, only when the active id changes, and only when the box can scroll. A manual sidebar scroll therefore stays in place until the active id changes. Before the fix, the active entry on lab0 sat at y=1032 below the box bottom at y=868. Its `scrollTop` stayed at 0. Chromium and Firefox now verify this behavior in `toc.spec.js`.
- **`document.querySelector('#' + id)` is wrong for a heading anchor.** Markdig `AutoIdentifiers` emits ids containing dots, such as `build.sh-run`, which parse as `#build` plus `.sh-run` and match nothing. An id starting with a digit throws `SyntaxError` outright, which aborts init before listeners are wired. Use `document.getElementById(decodeURIComponent(hash.slice(1)))`.
- **`TOC_NAV_OFFSET` (80px) in `wwwroot/js/toc.js` and `scroll-margin-top: 5rem` on `.prose h1,h2,h3` in `Styles/app.css` are a pair.** The fixed navbar measures 64.67px and otherwise hides an anchored heading at y=0. Keep them in sync, because CSS cannot read the JS constant.
- **An init function must be idempotent about a window-level listener.** `toc.js` stores its handlers on `window.__tocWindowListeners` and `faq.js` on `window.__faqHashListener`, removing the previous pair before re-registering. `faq.js` also marks a bound link with `dataset.faqBound`. This was not theoretical. The Jest suite re-executes each script per test against one jsdom window, and a duplicate-listener probe measured 10 `scrollIntoView` calls for one `hashchange`.

## Service Worker

Snapshots are immutable. A build either installs completely or keeps the previous snapshot, so a half-installed site never reaches a reader.

Confirmed 2026-09-01:

- `Services/OfflineBundleGenerator.cs` scans the final `output/` directory after static generation. It writes `output/offline-manifest.json` and replaces `__OFFLINE_BUILD_ID__` in `Offline/service-worker.template.js`. The build ID is a lowercase SHA-256 hash of the schema, clean routes, referenced asset URLs, asset bytes, and worker template bytes.
- **Run finalization after every output mutation.** The order is static generation, feed injection, HTML minification, deployment metadata stamping, then the finalizer. The workflow runs it for both Netlify and GitHub Pages. The command is in [TESTING.md](./TESTING.md).
- The generated worker uses immutable `ren-courses-offline-<buildId>` snapshots and `ren-courses-offline-meta` status metadata. It fetches the manifest with `no-store`. It then verifies the embedded build ID, fetches the required resources with four concurrent workers, retries a transient failure up to three times, stores clean and trailing-slash route aliases, and calls `skipWaiting` only after validation succeeds.
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

Confirmed 2026-11-11, schema 2 manifest and incremental update:

- The manifest contract is `{ schemaVersion: 2, buildId, routes, assets, hashes }`. Routes use clean URLs. Assets use relative URLs within the worker scope. Both arrays are sorted and deduplicated. `hashes` maps each route and each asset to the SHA-256 hash of its bytes.
- **A new build copies unchanged entries from the previous snapshot and fetches only the entries that changed.** The worker compares the per-entry hash in the new manifest with the hash in the previous snapshot manifest. It copies an entry only when the URL and the hash both match. A URL match alone would keep stale content, because a page keeps its URL when its content changes. The worker checks every required entry before activation. Activation still deletes the old snapshot. A schema-1 snapshot carries no per-entry hashes, so the first update after the schema change fetches the complete snapshot once.

## Calendar

Confirmed 2026-08-31:

- The desktop calendar shows three events per day at first. **Filtering must re-pack all events before it calculates the overflow count.** Filtering only the initially visible bars leaves an unrelated event inside `+N more`. `Calendar.razor` keeps the full day event list in the static output, and `wwwroot/js/calendar.js` applies the three-event limit after each filter.

Confirmed 2026-11-11:

- **The agenda's second line is an event type label, and it needs 12px and 4.5 to 1 in both themes.** The label was 10px at opacity 0.75. The opacity blends the text into its card tint. Measured light ratios at 360px were Release 3.67, Deadline 3.15, Progress 2.89, Defense 2.89, Custom 3.17. The label now renders at `text-xs` in `text-text-main`, and the title and the left border keep the type colour. Keep the label at or above 12px and at or above 4.5 to 1. `calendar.spec.js` measures the computed value and includes the element opacity in the ratio.
- **The fixture agenda takes Progress and Defense from Event fixtures, not from material dates.** `tests/fixtures/site/Content/Events/fixture-course-a-progress.md` and `fixture-course-a-defense.md` declare the two types. An Event fixture generates no page and no PDF. A new date on a cached material changes its PDF fingerprint and forces a Tectonic regeneration, which the bundle host can refuse.

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
- The global Playwright timeout is 60 seconds, not the 30-second default. B-002 owns the value, so keep it as it stands.
- **The diagram harness must share the static server's origin.** `page.setContent` on `about:blank` gives the document an opaque origin, and Chrome then refuses every loopback subresource, reporting that the request client is not a secure context. Neither the stylesheet nor the renderer loads. Every diagram test times out. `page.route` plus `route.fulfill` on `/__diagram-harness` keeps the origin and avoids `site.js` and the service worker.
- **Playwright Firefox offline emulation does not block a loopback fetch made by the service worker.** The unknown-route test simulates a real origin outage by closing the fixture network path before navigation. Chromium and Firefox must both receive the worker-generated HTTP 503.
- **Scroll anchoring breaks a scroll assertion in Firefox.** The `navigation.spec.js` navbar test failed intermittently because a late layout shift of roughly 97px made Firefox re-anchor the view, which fires a downward scroll event the test never issued. Observed with a `MutationObserver` log: `scroll 500 -> hide -> scroll 300 -> show -> scroll 396.8 -> hide`. The fix sets `overflow-anchor: none`, waits for the scroll position to stop changing, and asserts with a retrying expectation instead of one `evaluate` read. `html` also carries `scroll-smooth`, so `scrollBy` starts an animation. Use `scrollTo` with an explicit `scroll-behavior: auto`.
- `locator.evaluate` given a string containing an arrow function returns `undefined` rather than calling it. Pass the function itself.
- A focused scroll container answers `ArrowRight` for horizontal scrolling. `End` does not move it sideways.
- **A theme switch animates the agenda colour.** The agenda card carries `transition-all`, so `color` needs about 150ms to settle. A test that reads the colour one frame after `data-theme` changes measures the previous theme. Wait about 400ms before the read. Confirmed 2026-11-11 in `calendar.spec.js`. An immediate read reported Release at 1.8 to 1 in the dark theme. The settled value is 5.43 to 1.
- **The e2e server runs on port 8081, not 8080.** `reuseExistingServer` accepts any server already on the port. On 2026-09-24 a leftover `serve output` on 8080 held the real site, and a full run used it without a warning. `fixture-site.spec.js` now fails in that case.
- **BlazorStatic resolves a relative `ContentPath` against the bin folder.** The csproj copies only `Content/**` there. `SiteLayout.ContentPathFor` therefore passes the fixture tree as an absolute path. The first fixture build failed with `Could not find a part of the path '...\bin\Release\net9.0\tests\fixtures\site\Content\Materials'`.
- **A per-file `IgnoredPathsOnContentCopy` entry does nothing.** A directory entry works, as `js/__tests__` shows. `SiteLayout.RemoveForeignPdfs` deletes the production PDFs from `output-e2e/pdfs` after generation instead.
- **A BlazorStatic generation error does not stop the process.** The generator logs `An error occurred while generating static pages` and the host keeps running. A build script then hangs and never reports a failure. Watch the log. Stop the `BlazorStaticMinimalBlog` process by hand. This is an open flaw.
- Two historical drift lessons worth keeping. `navigation.spec.js` once hardcoded 8 `menu.json` entries after the Submissions tab was dropped, leaving 7, and four tests failed in both browsers. Note the namesake: the per-material submission-links dropdown is a live feature and is unrelated. Separately, a substring locator for the "All Materials" back-link became a strict-mode violation once an empty-state panel added a second "View all materials" link. Use `getByRole('link', { name: 'All Materials', exact: true })`.
- **A deep checkout path breaks the Mermaid browser launch on Windows.** Puppeteer 25.3.0 resolves Chrome under `Dependencies/RensMarkdownTemplates/artifacts/puppeteer`. When the checkout puts that executable past 260 characters, Node `spawn` fails with ENOENT even though the file exists. A worktree under a long temporary path hits this. Copy `chrome-headless-shell-win64` to a short path. Set `PUPPETEER_EXECUTABLE_PATH` for the build. Do not change the generator for it.
- Playwright does not run in CI, by decision. The suite takes too long for a GitHub runner. `AGENTS.md` requires running the real thing before shipping, so the e2e suite is a local release gate. See [TESTING.md](./TESTING.md).
