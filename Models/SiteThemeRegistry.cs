namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Single source of truth for site themes.
/// Each entry names the site theme (the <c>data-theme</c> value), the Mermaid
/// theme it harvests colours from, the browser-chrome colour for that mode, and
/// the flood colour for Mermaid's hardcoded drop shadows.
/// The browser twin lives in <c>wwwroot/js/theme.js</c> and
/// <c>wwwroot/js/interactive-diagrams.js</c> via <c>window.siteThemeRegistry</c>,
/// which <c>Components/App.razor</c> renders from this list. Keep them in step.
/// Adding a theme is one entry here and one <c>[data-theme="name"]</c> token block
/// in <c>wwwroot/css/site.css</c>. The diagram palette block is generated.
/// </summary>
/// <param name="Name">The <c>data-theme</c> value.</param>
/// <param name="MermaidTheme">The Mermaid theme this palette harvests from.</param>
/// <param name="ThemeColor">The browser-chrome colour.</param>
/// <param name="ShadowFlood">
/// The flood colour for Mermaid's hardcoded <c>feDropShadow</c>. Mermaid picks
/// black on light canvases and white on dark ones.
/// </param>
public sealed record SiteTheme(string Name, string MermaidTheme, string ThemeColor, string ShadowFlood);

public static class SiteThemeRegistry
{
    /// <summary>Seeded with light and dark. The order is the display order.</summary>
    public static readonly IReadOnlyList<SiteTheme> All =
    [
        new("light", "default", "#f8f9fa", "#000000"),
        new("dark", "dark", "#111827", "#FFFFFF"),
    ];

    /// <summary>
    /// The theme a bare <c>:root</c> falls back to when nothing sets
    /// <c>data-theme</c>. This mirrors <c>wwwroot/css/site.css</c>, where the
    /// unattributed <c>:root</c> block holds the dark tokens.
    /// </summary>
    public static SiteTheme RootDefault => Find("dark") ?? All[^1];

    public static bool IsSupported(string? name) =>
        name is not null && All.Any(t => t.Name.Equals(name, StringComparison.Ordinal));

    public static SiteTheme? Find(string? name) =>
        name is null ? null : All.FirstOrDefault(t => t.Name.Equals(name, StringComparison.Ordinal));
}
