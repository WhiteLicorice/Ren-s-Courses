*Before substantive work, read FABLE.md and PLAYBOOK.md; they contain general operating instructions and durable project learnings. If either conflicts with this file, AGENTS.md wins.*

# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. E2E Before Ship

**Run the Playwright e2e suite before presenting work or shipping.**

GitHub CI does not run e2e — the suite takes too long for GitHub runners. CI covers the jest, .NET, and Python gates only. A green CI without e2e is not a shippable state; the e2e suite is the release gate for rendered-site behavior.

- Build first: `ASPNETCORE_ENVIRONMENT=Production dotnet run --no-launch-profile`
- Then run: `npm run test:e2e` (single spec: `npx playwright test tests/e2e/home.spec.js`)
- Run the full suite when the change touches rendering, markup, or JS; run at least the affected specs otherwise.

## 6. Preserve Session Learnings

**Update durable project memory before presenting the end of a session to the user.**

- Add confirmed, reusable project learnings from the session to `PLAYBOOK.md`.
- Correct an existing entry in place when new evidence supersedes it.
- Record evidence or a verification path so future agents can re-confirm important claims.
- Do not add transient status, speculation, raw logs, credentials, personal data, or facts already obvious from the source.
- If the session produced no durable learning, record that explicitly in the current playbook entry rather than inventing one.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
