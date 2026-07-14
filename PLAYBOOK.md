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
- Submission actions open the relevant external form from the material page. The former global submission-bin navigation entry was intentionally removed from `menu.json`.
- Google Forms are created manually per submission. Drive organization is also intentionally manual because the expected number of forms is small and manual placement handles forms with multiple file-upload questions more predictably than custom automation. Do not introduce Forms/Drive automation unless the user revisits this decision.
- Verify the contract and UI with `StaticGenerationTests` and `BlogPageTests`. Run the full .NET gate with `dotnet test tests/Ren.Courses.Tests/Ren.Courses.Tests.csproj`.

## Static Generation

Confirmed 2026-07-14:

- Generated article pages use `output/articles/{slug}.html`, not `output/articles/{slug}/index.html`. This was verified by generating and locally rendering a temporary material through the production entry path.
