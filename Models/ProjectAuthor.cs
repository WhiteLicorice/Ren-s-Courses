namespace BlazorStaticMinimalBlog.Models;

// TODO: Allow optional links (GitHub) for project authors as well.
public class ProjectAuthor
{
    public string Name { get; set; } = string.Empty;

    public const string DEFAULT_NAME = "Author";
}