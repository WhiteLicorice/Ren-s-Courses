namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Optional PDF generation customization in CourseFrontMatter frontmatter.
/// </summary>
public class PdfConfig
{
    /// <summary>
    /// Template name matching [a-z0-9][a-z0-9_-]*.
    /// Resolved inside the committed PDF template directory.
    /// Defaults to "default" when missing.
    /// </summary>
    public string Template { get; set; } = "default";

    /// <summary>
    /// Arbitrary variables exposed to the Pandoc template.
    /// </summary>
    public Dictionary<string, object>? Variables { get; set; }
}
