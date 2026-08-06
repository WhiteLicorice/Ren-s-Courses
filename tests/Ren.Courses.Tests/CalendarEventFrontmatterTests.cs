namespace Ren.Courses.Tests;

public class CalendarEventFrontmatterTests
{
    // ----------------------------------------------------------------
    // 1. Tags parse from raw YAML frontmatter
    // ----------------------------------------------------------------
    [Fact]
    public void ParseFrontMatter_RawYaml_ParsesTags()
    {
        const string yaml = """
            ---
            title: CMSC 125 Midterms
            dates: [2026-03-02]
            tooltip: 9am-11am MILC Lab
            eventType: Custom
            tags: [cmsc-125]
            ---
            Body
            """;

        var post = new EphemeralPost<CalendarEventFrontmatter>(yaml);

        Assert.Equal("CMSC 125 Midterms", post.FrontMatter.Title);
        Assert.Equal(EventType.Custom, post.FrontMatter.EventType);
        Assert.Single(post.FrontMatter.Dates);
        Assert.Contains("cmsc-125", post.FrontMatter.Tags);
    }

    // ----------------------------------------------------------------
    // 2. Missing tags defaults to an empty list (not null)
    // ----------------------------------------------------------------
    [Fact]
    public void ParseFrontMatter_WithoutTags_DefaultsToEmptyList()
    {
        const string yaml = """
            ---
            title: University Week
            dates: [2026-04-20]
            eventType: Custom
            ---
            Body
            """;

        var post = new EphemeralPost<CalendarEventFrontmatter>(yaml);

        Assert.NotNull(post.FrontMatter.Tags);
        Assert.Empty(post.FrontMatter.Tags);
    }
}
