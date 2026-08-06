namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class BuildTimeProviderTests
{
    // ----------------------------------------------------------------
    // 1. Tag matching is case-insensitive
    // ----------------------------------------------------------------
    [Fact]
    public void IsCourseActive_TagMatch_IsCaseInsensitive()
    {
        Assert.True(BuildTimeProvider.IsCourseActive(["FIXTURE-COURSE-A"]));
        Assert.True(BuildTimeProvider.IsCourseActive(["fixture-course-a"]));
    }

    // ----------------------------------------------------------------
    // 2. Tag not in the active set returns false
    // ----------------------------------------------------------------
    [Fact]
    public void IsCourseActive_UnknownTag_ReturnsFalse()
    {
        Assert.False(BuildTimeProvider.IsCourseActive(["fixture-course-c"]));
    }

    // ----------------------------------------------------------------
    // 3. Empty tag list returns false
    // ----------------------------------------------------------------
    [Fact]
    public void IsCourseActive_EmptyTags_ReturnsFalse()
    {
        Assert.False(BuildTimeProvider.IsCourseActive([]));
    }

    // ----------------------------------------------------------------
    // 4. Any matching tag is enough
    // ----------------------------------------------------------------
    [Fact]
    public void IsCourseActive_AnyTagMatches_ReturnsTrue()
    {
        Assert.True(BuildTimeProvider.IsCourseActive(["fixture-course-c", "fixture-course-a"]));
    }

    // ----------------------------------------------------------------
    // 5. ActiveCourses contains exactly the fixture courses
    // ----------------------------------------------------------------
    [Fact]
    public void ActiveCourses_ContainsFixtureCoursesOnly()
    {
        Assert.True(BuildTimeProvider.ActiveCourses.Contains("fixture-course-a"));
        Assert.True(BuildTimeProvider.ActiveCourses.Contains("fixture-course-b"));
        Assert.False(BuildTimeProvider.ActiveCourses.Contains("fixture-course-c"));
    }

    // ================================================================
    // ParseActiveCourses (direct unit tests — no static-ctor re-run)
    // ================================================================

    // ----------------------------------------------------------------
    // 6. Null or empty env var yields an empty set
    // ----------------------------------------------------------------
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ParseActiveCourses_NullOrEmpty_ReturnsEmptySet(string? raw)
    {
        var result = BuildTimeProvider.ParseActiveCourses(raw);

        Assert.Empty(result);
    }

    // ----------------------------------------------------------------
    // 7. Comma-separated values split and trim
    // ----------------------------------------------------------------
    [Fact]
    public void ParseActiveCourses_CommaSeparated_TrimsAndSplits()
    {
        var result = BuildTimeProvider.ParseActiveCourses("  cmsc-124 , cmsc-131 ,cmsc-141  ");

        Assert.Equal(3, result.Count);
        Assert.Contains("cmsc-124", result);
        Assert.Contains("cmsc-131", result);
        Assert.Contains("cmsc-141", result);
    }

    // ----------------------------------------------------------------
    // 8. Empty entries are dropped
    // ----------------------------------------------------------------
    [Fact]
    public void ParseActiveCourses_EmptyEntries_Dropped()
    {
        var result = BuildTimeProvider.ParseActiveCourses("cmsc-124,,cmsc-131,");

        Assert.Equal(2, result.Count);
        Assert.Contains("cmsc-124", result);
        Assert.Contains("cmsc-131", result);
    }

    // ----------------------------------------------------------------
    // 9. Matching is case-insensitive
    // ----------------------------------------------------------------
    [Fact]
    public void ParseActiveCourses_Matching_IsCaseInsensitive()
    {
        var result = BuildTimeProvider.ParseActiveCourses("CMSC-124");

        Assert.Contains("cmsc-124", result);
        Assert.Contains("CMSC-124", result);
    }
}
