# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Ren's Courses** is a headless Learning Management System (LMS) for CS courses at the University of the Philippines Visayas. It is a **Blazor Static Site Generator** built on [BlazorStatic](https://github.com/thinktecture/BlazorStatic) (.NET 9), which renders Razor components to static HTML at build time. Tailwind CSS v4 is bundled via an npm-managed CLI invoked during the .NET build.

## Commands

### Run (development with hot reload)
```bash
dotnet watch
```
Hot reload works on both `.razor` files and `.md` content files (via `<Watch Include="Content/**/*" />`).

### Build (production static output)
```bash
dotnet build
```
This also runs `npx @tailwindcss/cli` to compile `Styles/app.css` → `wwwroot/css/app.css` before the .NET build.

### Generate static site
```bash
dotnet run
```
In non-development environments, `UseBlazorStaticGenerator(shutdownApp: true)` writes the static output to the `output/` directory and exits.

### Rebuild CSS only
```bash
npx @tailwindcss/cli -i ./Styles/app.css -o ./wwwroot/css/app.css --minify
```

## Architecture

### Content Model
Content lives in `Content/` as Markdown files with YAML front matter. Each content type maps to a strongly-typed front matter class and a BlazorStatic content service registration in `Program.cs`:

| Directory | Front Matter Class | Rendered at |
|---|---|---|
| `Content/Materials/` | `CourseFrontMatter` | `/articles/...` |
| `Content/Projects/` | `ProjectFrontMatter` | (tags only, no individual pages) |
| `Content/Bookings/` | `BookingFrontmatter` | (data only) |
| `Content/Events/` | `CalendarEventFrontmatter` | (data only) |

### Services (`Services/`)
- **`CourseContentProvider`** — singleton that aggregates parsed course materials
- **`FrontmatterStatusService`** — derives per-content status from front matter fields
- **`HolidaysProvider`** — async-initialized singleton; fetches/caches PH holiday data
- **`ThemeService`** — scoped; manages light/dark theme state

### Components (`Components/`)
- `Pages/` — top-level Blazor pages (`Materials.razor`, `Projects.razor`, `Blog.razor`, `Calendar.razor`, `Bookings.razor`)
- `Layout/` — shell layouts
- Shared display components: `PostsList.razor`, `ProjectsList.razor`, `CatalogsList.razor`, `ThemeSwitcher.razor`

### Global Constants
`WebsiteKeys` (bottom of `Program.cs`) holds all URL prefixes, source paths, and site-wide strings. Use these constants rather than inline strings when referencing content paths or URLs.

### Styling
Tailwind CSS v4 with `@tailwindcss/typography` plugin. Source: `Styles/app.css`. Output: `wwwroot/css/app.css` (generated, do not edit directly). Typography overrides for rendered Markdown tables include `overflow-x: auto` for mobile.
