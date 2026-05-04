using System.Text;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class StaticGenerationTests
{
    private readonly string _materialsDir;

    public StaticGenerationTests()
    {
        var baseDir = Path.GetDirectoryName(typeof(StaticGenerationTests).Assembly.Location)
            ?? throw new InvalidOperationException("Cannot determine test assembly directory");
        _materialsDir = Path.Combine(baseDir, "Content", "Materials");
    }

    [Fact]
    public void ParseFrontMatter_ValidPost_ParsesAllFields()
    {
        var md = File.ReadAllText(Path.Combine(_materialsDir, "valid-post.md"));
        var fm = ParseFrontMatter<CourseFrontMatter>(md);

        Assert.Equal("Test Post", fm.Title);
        Assert.Equal("Test lead paragraph", fm.Lead);
        Assert.Equal("Test subtitle", fm.Subtitle);
        Assert.Equal(new DateTime(2026, 2, 1), fm.Published);
        Assert.False(fm.IsDraft);
        Assert.Equal("https://example.com/download", fm.DownloadLink);
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
        var md = File.ReadAllText(Path.Combine(_materialsDir, "draft-post.md"));
        var fm = ParseFrontMatter<CourseFrontMatter>(md);

        Assert.Equal("Draft Post", fm.Title);
        Assert.True(fm.IsDraft);
        Assert.Contains("cmsc-124", fm.Tags);
    }

    [Fact]
    public void ParseFrontMatter_MinimalPost_UsesDefaultValuesForMissingFields()
    {
        var md = File.ReadAllText(Path.Combine(_materialsDir, "minimal-post.md"));
        var fm = ParseFrontMatter<CourseFrontMatter>(md);

        Assert.Equal("Minimal Post", fm.Title);
        Assert.Equal(new DateTime(2026, 3, 1), fm.Published);
        Assert.False(fm.IsDraft);

        // Fields not present in YAML should fall through to C# defaults
        Assert.Empty(fm.Lead);
        Assert.Empty(fm.Subtitle);
        Assert.Null(fm.Deadline);
        Assert.False(fm.NoDeadline);
        Assert.Null(fm.DownloadLink);
        Assert.Empty(fm.Authors);

        Assert.Contains("cmsc-131", fm.Tags);
    }

    [Fact]
    public void GetVisiblePosts_ValidAndMinimalPostsVisible_DraftExcluded()
    {
        var validMd = File.ReadAllText(Path.Combine(_materialsDir, "valid-post.md"));
        var draftMd = File.ReadAllText(Path.Combine(_materialsDir, "draft-post.md"));
        var minimalMd = File.ReadAllText(Path.Combine(_materialsDir, "minimal-post.md"));

        var validFm = ParseFrontMatter<CourseFrontMatter>(validMd);
        var draftFm = ParseFrontMatter<CourseFrontMatter>(draftMd);
        var minimalFm = ParseFrontMatter<CourseFrontMatter>(minimalMd);

        var posts = new List<Post<CourseFrontMatter>>
        {
            new() { FrontMatter = validFm, Url = "valid-post", HtmlContent = "" },
            new() { FrontMatter = draftFm, Url = "draft-post", HtmlContent = "" },
            new() { FrontMatter = minimalFm, Url = "minimal-post", HtmlContent = "" }
        };

        // Construct provider with null because GetVisiblePosts(IEnumerable<>)
        // is a pure function that does not use the constructor parameter.
        var provider = new CourseContentProvider(null!);
        var visible = provider.GetVisiblePosts(posts).ToList();

        // Valid and minimal posts should be visible; draft post should be excluded
        Assert.Contains(visible, p => p.Url == "valid-post");
        Assert.Contains(visible, p => p.Url == "minimal-post");
        Assert.DoesNotContain(visible, p => p.Url == "draft-post");

        // Should be ordered by Published descending:
        // minimal-post (2026-03-01) first, then valid-post (2026-02-01)
        Assert.Equal(2, visible.Count);
        Assert.Equal("minimal-post", visible[0].Url);
        Assert.Equal("valid-post", visible[1].Url);
    }

    /// <summary>
    /// Extracts and deserializes YAML frontmatter from a markdown string.
    /// Expects content between leading "---" and closing "---" delimiters.
    /// </summary>
    private static T ParseFrontMatter<T>(string markdown) where T : class
    {
        const string delimiter = "---";
        using var reader = new StringReader(markdown);

        var firstLine = reader.ReadLine()?.Trim();
        if (firstLine != delimiter)
        {
            throw new InvalidOperationException(
                "Markdown must start with frontmatter delimiter (---).");
        }

        var yaml = new StringBuilder();
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (line.Trim() == delimiter)
                break;
            yaml.AppendLine(line);
        }

        var deserializer = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        return deserializer.Deserialize<T>(yaml.ToString());
    }
}
