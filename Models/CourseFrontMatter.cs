using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models;

public class CourseFrontMatter : IFrontMatter, IFrontMatterWithTags
{
    public string Title { get; set; } = "Untitled";
    public string Lead { get; set; } = "";
    public DateTime Published { get; set; } = DateTime.Now;
    public bool IsDraft { get; set; }
    public List<ArticleAuthor> Authors { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public string Subtitle { get; set; } = "";

    public DateTime? Deadline { get; set; }
    public bool NoDeadline { get; set; } = false;

    public List<DateTime> ProgressReportDates { get; set; } = new();
    public List<DateTime> DefenseDates { get; set; } = new();

    public string? DownloadLink { get; set; }
    public List<SubmissionLink> Submissions { get; set; } = new();
    public List<LearningDiagram> Diagrams { get; set; } = new();

    /// <summary>
    /// Optional PDF generation customization.
    /// Missing value uses default template with no extra variables.
    /// </summary>
    public PdfConfig? Pdf { get; set; }
}
