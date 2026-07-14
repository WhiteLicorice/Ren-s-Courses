namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class StaticGenerationTests
{
    [Fact]
    public void ParseFrontMatter_ValidPost_ParsesAllFields()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Test Post",
            Lead = "Test lead paragraph",
            Subtitle = "Test subtitle",
            Published = new DateTime(2026, 2, 1),
            IsDraft = false,
            DownloadLink = "https://example.com/download",
            Submissions = new List<SubmissionLink>
            {
                new() { Name = "Lab report", Link = "https://forms.gle/example" }
            },
            Diagrams = new List<LearningDiagram>
            {
                new()
                {
                    Title = "Bubble sort",
                    Description = "Follow one pass through the array.",
                    Steps =
                    [
                        new()
                        {
                            Title = "Compare",
                            Description = "Compare adjacent values.",
                            Mermaid = "flowchart LR\n    A[5] --> B[2]"
                        },
                        new()
                        {
                            Title = "Swap",
                            Description = "Move the smaller value left.",
                            Mermaid = "flowchart LR\n    B[2] --> A[5]"
                        }
                    ]
                }
            },
            Deadline = new DateTime(2026, 3, 20),
            Tags = new List<string> { "cmsc-131", "homework" },
            Authors = new List<ArticleAuthor>
            {
                new() { Name = "Test Author" }
            }
        }, body: "# Test Content\n\nThis is test markdown.\n");

        var fm = post.FrontMatter;

        Assert.Equal("Test Post", fm.Title);
        Assert.Equal("Test lead paragraph", fm.Lead);
        Assert.Equal("Test subtitle", fm.Subtitle);
        Assert.Equal(new DateTime(2026, 2, 1), fm.Published);
        Assert.False(fm.IsDraft);
        Assert.Equal("https://example.com/download", fm.DownloadLink);
        var submission = Assert.Single(fm.Submissions);
        Assert.Equal("Lab report", submission.Name);
        Assert.Equal("https://forms.gle/example", submission.Link);
        var diagram = Assert.Single(fm.Diagrams);
        Assert.Equal("Bubble sort", diagram.Title);
        Assert.Equal("Follow one pass through the array.", diagram.Description);
        Assert.Equal(2, diagram.Steps.Count);
        Assert.Equal("Compare", diagram.Steps[0].Title);
        Assert.Equal("flowchart LR\n    A[5] --> B[2]", diagram.Steps[0].Mermaid.TrimEnd());
        Assert.NotNull(fm.Deadline);
        Assert.Equal(new DateTime(2026, 3, 20), fm.Deadline.Value);
        Assert.Contains("cmsc-131", fm.Tags);
        Assert.Contains("homework", fm.Tags);
        Assert.Single(fm.Authors);
        Assert.Equal("Test Author", fm.Authors[0].Name);
    }

    [Fact]
    public void ParseFrontMatter_DraftPost_HasIsDraftTrue()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Draft Post",
            Published = new DateTime(2026, 3, 1),
            IsDraft = true,
            Tags = new List<string> { "cmsc-124" }
        }, body: "Draft content.");

        var fm = post.FrontMatter;

        Assert.Equal("Draft Post", fm.Title);
        Assert.True(fm.IsDraft);
        Assert.Contains("cmsc-124", fm.Tags);
    }

    [Fact]
    public void ParseFrontMatter_MinimalPost_UsesDefaultValuesForMissingFields()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Minimal Post",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "cmsc-131" }
        }, body: "Minimal content.");

        var fm = post.FrontMatter;

        Assert.Equal("Minimal Post", fm.Title);
        Assert.Equal(new DateTime(2026, 3, 1), fm.Published);
        Assert.False(fm.IsDraft);

        // Fields not set in frontmatter should have C# defaults
        Assert.Empty(fm.Lead);
        Assert.Empty(fm.Subtitle);
        Assert.Null(fm.Deadline);
        Assert.False(fm.NoDeadline);
        Assert.Null(fm.DownloadLink);
        Assert.Empty(fm.Submissions);
        Assert.Empty(fm.Diagrams);
        Assert.Empty(fm.Authors);
        Assert.Contains("cmsc-131", fm.Tags);
    }

    [Fact]
    public void GetVisiblePosts_ValidAndMinimalPostsVisible_DraftExcluded()
    {
        var valid = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Valid Post",
            Published = new DateTime(2026, 2, 1),
            Tags = new List<string> { "cmsc-131" }
        });
        var draft = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Draft Post",
            Published = new DateTime(2026, 3, 1),
            IsDraft = true,
            Tags = new List<string> { "cmsc-124" }
        });
        var minimal = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Minimal Post",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string> { "cmsc-131" }
        });

        var posts = new List<Post<CourseFrontMatter>>
        {
            new() { FrontMatter = valid.FrontMatter, Url = "valid-post", HtmlContent = "" },
            new() { FrontMatter = draft.FrontMatter, Url = "draft-post", HtmlContent = "" },
            new() { FrontMatter = minimal.FrontMatter, Url = "minimal-post", HtmlContent = "" }
        };

        var provider = new CourseContentProvider(null!);
        var visible = provider.GetVisiblePosts(posts).ToList();

        Assert.Contains(visible, p => p.Url == "valid-post");
        Assert.Contains(visible, p => p.Url == "minimal-post");
        Assert.DoesNotContain(visible, p => p.Url == "draft-post");

        Assert.Equal(2, visible.Count);
        Assert.Equal("minimal-post", visible[0].Url); // 2026-03-01 first
        Assert.Equal("valid-post", visible[1].Url);    // 2026-02-01 second
    }

    [Fact]
    public void EphemeralPost_RoundTripsBodyCorrectly()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Body Test",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string>()
        }, body: "## Section 1\n\nSome *text* here.");

        Assert.Equal("## Section 1\n\nSome *text* here.", post.Body);
    }

    [Fact]
    public void EphemeralPost_RawMarkdown_ContainsFrontmatterDelimiters()
    {
        var post = new EphemeralPost<CourseFrontMatter>(new CourseFrontMatter
        {
            Title = "Delimiter Test",
            Published = new DateTime(2026, 3, 1),
            Tags = new List<string>()
        });

        Assert.StartsWith("---", post.RawMarkdown);
        Assert.Contains("\n---\n", post.RawMarkdown);
    }
}
