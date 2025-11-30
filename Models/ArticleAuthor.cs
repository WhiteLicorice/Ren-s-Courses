using System.Collections;
using System.Reflection.Metadata;

public class ArticleAuthor
{
    public string? Name { get; set; }
    public string? Nickname { get; set; } // TODO: Integrate into Markdown and Blog view.
    public string? GitHubUserName { get; set; }
    public const string DEFAULT_NAME = "Author";
}