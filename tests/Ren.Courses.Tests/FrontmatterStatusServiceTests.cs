namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class FrontmatterStatusServiceTests
{
    private readonly FrontmatterStatusService _service = new();

    [Fact]
    public void GetStatus_NoDeadlineIsTrue_ReturnsNone()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 1, 15),
            NoDeadline = true
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.None, result);
    }

    [Fact]
    public void GetStatus_DeadlineInPast_ReturnsExpired()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 1, 15),
            Deadline = new DateTime(2026, 3, 14)
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.Expired, result);
    }

    [Fact]
    public void GetStatus_DeadlineIsToday_ReturnsDueToday()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 1, 15),
            Deadline = new DateTime(2026, 3, 15)
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.DueToday, result);
    }

    [Fact]
    public void GetStatus_DeadlineInFuture_ReturnsFuture()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 1, 15),
            Deadline = new DateTime(2026, 3, 16)
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.Future, result);
    }

    [Fact]
    public void GetStatus_NoDeadlineAndDefaultExpired_ReturnsExpired()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 2, 1)
            // No Deadline, NoDeadline defaults to false
            // EffectiveDate = Published + 1 month = 2026-03-01
            // deadlineEndOfDay = 2026-03-01 23:59:59.9999999 < now (2026-03-15 18:00 PHT) -> Expired
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.Expired, result);
    }

    [Fact]
    public void GetStatus_NoDeadlineAndDefaultDueToday_ReturnsDueToday()
    {
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 2, 15)
            // No Deadline, NoDeadline defaults to false
            // EffectiveDate = Published + 1 month = 2026-03-15
            // deadlineEndOfDay = 2026-03-15 23:59:59.9999999, today is 2026-03-15 -> DueToday
        };

        var result = _service.GetStatus(fm);

        Assert.Equal(FrontmatterStatus.DueToday, result);
    }

    [Fact]
    public void GetEffectiveDate_WithDeadline_ReturnsDeadline()
    {
        var deadline = new DateTime(2026, 4, 1);
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = new DateTime(2026, 1, 15),
            Deadline = deadline
        };

        var result = _service.GetEffectiveDate(fm);

        Assert.Equal(deadline, result);
    }

    [Fact]
    public void GetEffectiveDate_WithoutDeadline_ReturnsPublishedPlusOneMonth()
    {
        var published = new DateTime(2026, 3, 1);
        var fm = new CourseFrontMatter
        {
            Title = "Test",
            Published = published
            // No Deadline
        };

        var result = _service.GetEffectiveDate(fm);

        Assert.Equal(published.AddMonths(1), result);
    }
}
