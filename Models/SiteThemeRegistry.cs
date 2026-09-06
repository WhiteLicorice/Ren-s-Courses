namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Single source of truth for site themes.
/// Each entry names the site theme (the <c>data-theme</c> value), the Mermaid
/// theme it harvests colours from, and the browser-chrome colour for that mode.
/// The browser twin lives in <c>wwwroot/js/theme.js</c> and
/// <c>wwwroot/js/interactive-diagrams.js</c> via <c>window.siteThemeRegistry</c>,
/// which <c>Components/App.razor</c> renders from this list. Keep them in step.
/// Adding a theme is one entry here, one <c>[data-theme="name"]</c> token block
/// in <c>wwwroot/css/site.css</c>, and optionally a <c>--dg-*</c> override block.
/// </summary>
public sealed record SiteTheme(string Name, string MermaidTheme, string ThemeColor);

public static class SiteThemeRegistry
{
    /// <summary>Seeded with light and dark. The order is the display order.</summary>
    public static readonly IReadOnlyList<SiteTheme> All =
    [
        new("light", "default", "#f8f9fa"),
        new("dark", "dark", "#111827"),
    ];

    public static bool IsSupported(string? name) =>
        name is not null && All.Any(t => t.Name.Equals(name, StringComparison.Ordinal));

    public static SiteTheme? Find(string? name) =>
        All.FirstOrDefault(t => t.Name.Equals(name, StringComparison.Ordinal));
}
