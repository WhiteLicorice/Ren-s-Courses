using System.Collections;
using System.Reflection.Metadata;

public class ArticleAuthor
{
    public string? Name { get; set; }
    public string? Nickname { get; set; } // Display alias; shown in Blog in place of Name when set
    public string? GitHubUserName { get; set; }
    public const string DEFAULT_NAME = "Author";
}