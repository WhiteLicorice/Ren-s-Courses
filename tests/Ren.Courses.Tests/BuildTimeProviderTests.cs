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
}
