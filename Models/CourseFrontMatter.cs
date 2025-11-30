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
    public string? DownloadLink { get; set; }
    public bool NoDeadline { get; set; } = false;
}