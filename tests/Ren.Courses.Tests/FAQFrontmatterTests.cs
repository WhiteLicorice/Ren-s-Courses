namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class FAQFrontmatterTests
{
    [Fact]
    public void ParseFrontMatter_ValidFAQ_ParsesAllFields()
    {
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "How do I submit Lab 0?",
            Tags = new List<string> { "cmsc-125" },
            Published = new DateTime(2026, 1, 15)
        }, body: "Zip your screenshots and submit via the portal.");

        var fm = post.FrontMatter;

        Assert.Equal("How do I submit Lab 0?", fm.Question);
        Assert.Single(fm.Tags);
        Assert.Contains("cmsc-125", fm.Tags);
        Assert.Equal(new DateTime(2026, 1, 15), fm.Published);
    }

    [Fact]
    public void ParseFrontMatter_MultipleTags_ParsesAllTags()
    {
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "What is the grading policy?",
            Tags = new List<string> { "cmsc-124", "cmsc-125" },
            Published = new DateTime(2026, 2, 1)
        });

        var fm = post.FrontMatter;

        Assert.Equal(2, fm.Tags.Count);
        Assert.Contains("cmsc-124", fm.Tags);
        Assert.Contains("cmsc-125", fm.Tags);
    }

    [Fact]
    public void ParseFrontMatter_MinimalFAQ_UsesDefaultValues()
    {
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "Minimal question",
            Tags = new List<string> { "cmsc-131" }
        });

        var fm = post.FrontMatter;

        Assert.Equal("Minimal question", fm.Question);
        Assert.Single(fm.Tags);
        Assert.Equal("", fm.Answer);
    }

    [Fact]
    public void ParseFrontMatter_WithAnswerField_ParsesAnswer()
    {
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "When are office hours?",
            Answer = "Tuesdays 3-5pm.",
            Tags = new List<string> { "cmsc-124" },
            Published = new DateTime(2026, 2, 10)
        });

        var fm = post.FrontMatter;

        Assert.Equal("When are office hours?", fm.Question);
        Assert.Equal("Tuesdays 3-5pm.", fm.Answer);
    }

    [Fact]
    public void EphemeralPost_Body_IsAccessibleSeparatelyFromFrontmatter()
    {
        const string body = "This is the full answer in the markdown body.";
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "Body test question",
            Tags = new List<string> { "cmsc-124" },
            Published = new DateTime(2026, 3, 1)
        }, body: body);

        Assert.Equal(body, post.Body);
    }

    [Fact]
    public void EphemeralPost_RawMarkdown_ContainsFrontmatterDelimiters()
    {
        var post = new EphemeralPost<FAQFrontmatter>(new FAQFrontmatter
        {
            Question = "Delimiter test",
            Tags = new List<string> { "cmsc-124" }
        });

        Assert.StartsWith("---", post.RawMarkdown);
        Assert.Contains("\n---\n", post.RawMarkdown);
    }

    [Fact]
    public void ParseFrontMatter_RawYaml_ParsesCorrectly()
    {
        const string yaml = """
            ---
            question: "How is attendance tracked?"
            tags: [cmsc-125]
            published: 2026-01-20
            ---
            Attendance is tracked via the class portal.
            """;

        var post = new EphemeralPost<FAQFrontmatter>(yaml);

        Assert.Equal("How is attendance tracked?", post.FrontMatter.Question);
        Assert.Contains("cmsc-125", post.FrontMatter.Tags);
    }
}
