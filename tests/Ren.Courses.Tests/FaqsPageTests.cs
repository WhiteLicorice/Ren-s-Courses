using BlazorStaticMinimalBlog.Utilities;

namespace Ren.Courses.Tests;

public class FaqsPageTests
{
    [Theory]
    [InlineData("How do I submit Lab 0?", "how-do-i-submit-lab-0")]
    [InlineData("What is the grading policy?", "what-is-the-grading-policy")]
    [InlineData("When are office hours?", "when-are-office-hours")]
    [InlineData("C++ or C#?", "c-or-c")]
    [InlineData("  leading and trailing  ", "leading-and-trailing")]
    [InlineData("Multiple   spaces", "multiple-spaces")]
    [InlineData("", "")]
    public void Slugify_ProducesExpectedSlug(string input, string expected)
    {
        Assert.Equal(expected, SlugHelper.Slugify(input));
    }

    [Fact]
    public void Slugify_OutputIsLowercase()
    {
        Assert.Equal("hello-world", SlugHelper.Slugify("Hello World"));
    }

    [Fact]
    public void Slugify_NoLeadingOrTrailingHyphens()
    {
        var result = SlugHelper.Slugify("!!! Question ???");
        Assert.False(result.StartsWith('-'), "slug must not start with hyphen");
        Assert.False(result.EndsWith('-'), "slug must not end with hyphen");
    }

    [Fact]
    public void Slugify_SameInput_ProducesSameSlug()
    {
        // TOC href="#<slug>" and <details id="<slug>"> are both derived from the same call.
        // Verifies referential consistency: same question => same anchor id.
        const string question = "How do I install the IDE?";
        Assert.Equal(SlugHelper.Slugify(question), SlugHelper.Slugify(question));
    }

    [Fact]
    public void Slugify_SpecialCharsOnly_ReturnsEmptyOrHyphenFree()
    {
        var result = SlugHelper.Slugify("???");
        Assert.True(result.Length == 0 || (!result.StartsWith('-') && !result.EndsWith('-')));
    }
}
