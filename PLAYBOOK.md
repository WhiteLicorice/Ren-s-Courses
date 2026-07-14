# PLAYBOOK.md

Persistent project memory for confirmed, reusable learnings that are not obvious from reading a single source file. Read this file alongside `FABLE.md` before substantive work.

## Update Protocol

- Before ending a session, update the relevant topic below with durable learnings from that session.
- Prefer concise topic entries over a chronological activity log.
- Include the date confirmed and the evidence or verification path.
- Correct stale guidance in place and note what superseded it.
- Never store credentials, personal data, private URLs, transient process state, or unverified guesses here.

## Course Material Submissions

Confirmed 2026-07-14:

- Materials optionally declare submission actions as `submissions` entries with `name` and `link` fields. The contract is defined in `Models/CourseFrontMatter.cs` and `Models/SubmissionLink.cs`; rendering lives in `Components/Pages/Blog.razor`.
- Submission actions open the relevant external form from a compact Submit dropdown beside Download. Submit uses an up-arrow/tray glyph to distinguish it from Download. Pointer hover exposes the links; click works for touch, outside-click dismisses it, and Escape closes it for keyboard users. Rendering lives in `Components/Pages/Blog.razor`; behavior lives in `wwwroot/js/submission-menu.js`.
- Google Forms are created manually per submission. Drive organization is also intentionally manual because the expected number of forms is small and manual placement handles forms with multiple file-upload questions more predictably than custom automation. Do not introduce Forms/Drive automation unless the user revisits this decision.
- Verify the contract and markup with `StaticGenerationTests` and `BlogPageTests`; verify dropdown state and dismissal with `submission-menu.test.js`. Run the full .NET gate with `dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj`.

## Static Generation

Confirmed 2026-07-14:

- Generated article pages use `output/articles/{slug}.html`, not `output/articles/{slug}/index.html`. This was verified by generating and locally rendering a temporary material through the production entry path.
- Run local production generation with `dotnet run --no-launch-profile` after setting `ASPNETCORE_ENVIRONMENT=Production`. The repository launch profiles force Development and otherwise start a persistent server; this was confirmed by comparing the timed-out default-profile run with a successful production run.
- The home page must pass `BlazorStaticContentService<CourseFrontMatter>.Posts` into `PostsList`, which then applies `CourseContentProvider.GetVisiblePosts(sourcePosts)`. During static generation, a provider can capture the service before its post collection is populated; using its parameterless overload produced tag chips but an empty card grid. `BlogPageTests.Home_UsesParsedPostsEvenWhenProviderCapturedAnEmptyService` reproduces this lifecycle split.
- CI and local launch profiles enable `SHOWCASE_MODE`, so non-draft material remains visible outside the configured term. Local CSS and JavaScript URLs use a 12-character SHA-256 content hash; an assembly timestamp is insufficient because static-asset-only edits need not rebuild the assembly. Service-worker shell changes still require a cache-name bump. Verify generated HTML hashes against the referenced files and run `home.spec.js` in a real browser.

## Interactive Diagrams

Confirmed 2026-07-14:

- Materials optionally declare `diagrams`, each with `title`, optional `description`, and ordered `steps`. Every step has a `title`, optional `description`, and a complete Mermaid definition in `mermaid`. The contract lives in `Models/CourseFrontMatter.cs`, `Models/LearningDiagram.cs`, and `Models/LearningDiagramStep.cs`.
- `Components/InteractiveDiagram.razor` renders diagrams before the Markdown body with Previous, Next, and Play controls. `wwwroot/js/interactive-diagrams.js` lazy-loads pinned Mermaid 11.16.0 only on pages with widgets, uses strict security, pre-renders every step before enabling controls, rerenders every step for site theme changes, and preserves authored source when loading or rendering fails.
- Diagram sources must be excluded from `code-features.js` and hidden synchronously before Mermaid loads; otherwise the raw definition flickers and receives an empty `.code-wrapper`. Do not trust Mermaid's generated viewBox or intrinsic `max-width`: some client renders produced a correctly sized stage with a roughly 40px drawing. Temporarily make hidden steps measurable offscreen, rebuild each SVG viewBox from `.root.getBBox()` plus padding, and enforce fill dimensions inline with `!important`; repeat synchronously whenever a step is shown. Derive the stable widget ratio from those normalized bounds.
- The 26rem-wide stage is bounded to 6rem–18rem high, so square and horizontal diagrams remain proportionate without resizing between steps. Verify YAML and static markup with `StaticGenerationTests` and `BlogPageTests`; verify controls, eager rendering, viewport normalization, stable aspect metadata, error fallback, single-step behavior, and theme refresh with `interactive-diagrams.test.js`. `interactive-diagrams.spec.js` deliberately corrupts a step to a 40px SVG with a 2000×2000 viewport and verifies repair in Chromium and Firefox.
