namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Per-document PDF generation result stored in the singleton manifest.
/// </summary>
public class PdfGenerationResult
{
    public PdfGenerationStatus Status { get; set; }
    public string? RelativeUrl { get; set; }
    public string? Diagnostic { get; set; }
}

public enum PdfGenerationStatus
{
    Generated,
    Cached,
    Failed
}
