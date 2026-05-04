namespace BlazorStaticMinimalBlog.Tests;

[Collection("BuildTimeProvider")]
public class CalendarEventProviderTests
{
    private static readonly DateTime TestDate1 = new(2026, 3, 1);
    private static readonly DateTime TestDate2 = new(2026, 3, 15);
    private static readonly DateTime HolidayDate = new(2026, 4, 9);
    private const string CoursePageUrl = "/courses";

    // ----------------------------------------------------------------
    // 1. Holiday event
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_Holiday_AddsCorrectEvent()
    {
        var holidays = new List<Holiday>
        {
            new() { Date = HolidayDate, Name = "Araw ng Kagitingan" }
        };

        var results = CalendarEventProvider.BuildEvents(holidays, [], [], CoursePageUrl);

        var evt = Assert.Single(results);
        Assert.Equal("Araw ng Kagitingan", evt.Title);
        Assert.Equal("Holiday", evt.Tooltip);
        Assert.Equal(HolidayDate, evt.Date);
        Assert.Equal(EventType.Holiday, evt.Type);
        Assert.Equal("bg-accent/10 text-accent border-accent", evt.CssClass);
        Assert.Null(evt.Url);
    }

    // ----------------------------------------------------------------
    // 2. Course post Release event
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_CoursePost_CreatesReleaseEvent()
    {
        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Homework 1",
                Published = TestDate1,
                Deadline = null,
                Tags = []
            },
            Url = "homework-1",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], CoursePageUrl);

        var release = Assert.Single(results);
        Assert.Equal("Homework 1", release.Title);
        Assert.Equal("Release", release.Tooltip);
        Assert.Equal(TestDate1, release.Date);
        Assert.Equal(EventType.Release, release.Type);
        Assert.Equal($"{CoursePageUrl}/{post.Url}", release.Url);
    }

    // ----------------------------------------------------------------
    // 3. Course post Deadline event
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_CoursePostWithDeadline_CreatesDeadlineEvent()
    {
        var deadlineDate = new DateTime(2026, 3, 10);
        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Homework 1",
                Published = TestDate1,
                Deadline = deadlineDate,
                Tags = []
            },
            Url = "homework-1",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], CoursePageUrl);

        Assert.Equal(2, results.Count);

        var release = results[0];
        Assert.Equal(EventType.Release, release.Type);
        Assert.Equal("Release", release.Tooltip);

        var deadline = results[1];
        Assert.Equal("Homework 1", deadline.Title);
        Assert.Equal("Deadline", deadline.Tooltip);
        Assert.Equal(deadlineDate, deadline.Date);
        Assert.Equal(EventType.Deadline, deadline.Type);
        Assert.Equal($"{CoursePageUrl}/{post.Url}", deadline.Url);
    }

    // ----------------------------------------------------------------
    // 4. ProgressReportDates creates one event per date
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_ProgressReportDates_CreatesOneEventPerDate()
    {
        var progressDates = new List<DateTime>
        {
            new(2026, 3, 1),
            new(2026, 3, 15),
            new(2026, 3, 29)
        };

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Machine Problem 1",
                Published = TestDate1,
                ProgressReportDates = progressDates,
                Tags = []
            },
            Url = "mp1",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], CoursePageUrl);

        // 1 Release + 3 Progress = 4 total
        Assert.Equal(4, results.Count);

        var progressEvents = results.Where(e => e.Type == EventType.Progress).ToList();
        Assert.Equal(3, progressEvents.Count);

        Assert.Contains(progressEvents, e => e.Date == progressDates[0]);
        Assert.Contains(progressEvents, e => e.Date == progressDates[1]);
        Assert.Contains(progressEvents, e => e.Date == progressDates[2]);

        foreach (var pe in progressEvents)
        {
            Assert.Equal("Machine Problem 1", pe.Title);
            Assert.Equal("Progress", pe.Tooltip);
            Assert.Equal(EventType.Progress, pe.Type);
        }
    }

    // ----------------------------------------------------------------
    // 5. DefenseDates creates one event per date
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_DefenseDates_CreatesOneEventPerDate()
    {
        var defenseDates = new List<DateTime>
        {
            new(2026, 4, 10),
            new(2026, 4, 11)
        };

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Final Project",
                Published = TestDate1,
                DefenseDates = defenseDates,
                Tags = []
            },
            Url = "final-project",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], CoursePageUrl);

        // 1 Release + 2 Defense = 3 total
        Assert.Equal(3, results.Count);

        var defenseEvents = results.Where(e => e.Type == EventType.Defense).ToList();
        Assert.Equal(2, defenseEvents.Count);

        Assert.Contains(defenseEvents, e => e.Date == defenseDates[0]);
        Assert.Contains(defenseEvents, e => e.Date == defenseDates[1]);

        foreach (var de in defenseEvents)
        {
            Assert.Equal("Final Project", de.Title);
            Assert.Equal("Defense", de.Tooltip);
            Assert.Equal(EventType.Defense, de.Type);
            Assert.Equal($"{CoursePageUrl}/{post.Url}", de.Url);
        }
    }

    // ----------------------------------------------------------------
    // 6. Custom calendar event
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_CustomEvent_AddsWithCorrectFields()
    {
        var customDate = new DateTime(2026, 4, 20);
        var customEvents = new List<Post<CalendarEventFrontmatter>>
        {
            new()
            {
                FrontMatter = new CalendarEventFrontmatter
                {
                    Title = "University Week",
                    Dates = [customDate],
                    Tooltip = "Fun week celebration",
                    EventType = EventType.Custom,
                    Url = "https://example.com/univ-week",
                    CssClass = "my-custom-css"
                },
                Url = "univ-week",
                HtmlContent = "<p>fun</p>"
            }
        };

        var results = CalendarEventProvider.BuildEvents([], customEvents, [], CoursePageUrl);

        var evt = Assert.Single(results);
        Assert.Equal("University Week", evt.Title);
        Assert.Equal("Fun week celebration", evt.Tooltip);
        Assert.Equal(customDate, evt.Date);
        Assert.Equal(EventType.Custom, evt.Type);
        Assert.Equal("https://example.com/univ-week", evt.Url);
        Assert.Equal("my-custom-css", evt.CssClass);
    }

    // ----------------------------------------------------------------
    // 7. Multiple events on same date all appear
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_MultipleEventsOnSameDate_AllAppear()
    {
        var sameDate = new DateTime(2026, 3, 15);

        var holidays = new List<Holiday>
        {
            new() { Date = sameDate, Name = "Pi Day" }
        };

        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Pi Homework",
                Published = sameDate,
                Tags = []
            },
            Url = "pi-hw",
            HtmlContent = "<p>test</p>"
        };

        var customEvents = new List<Post<CalendarEventFrontmatter>>
        {
            new()
            {
                FrontMatter = new CalendarEventFrontmatter
                {
                    Title = "Custom",
                    Dates = [sameDate],
                    EventType = EventType.Custom
                },
                Url = "custom",
                HtmlContent = "<p>custom</p>"
            }
        };

        var results = CalendarEventProvider.BuildEvents(holidays, customEvents, [post], CoursePageUrl);

        Assert.Equal(3, results.Count);
        Assert.All(results, e => Assert.Equal(sameDate, e.Date));

        Assert.Contains(results, e => e.Type == EventType.Holiday);
        Assert.Contains(results, e => e.Type == EventType.Release);
        Assert.Contains(results, e => e.Type == EventType.Custom);
    }

    // ----------------------------------------------------------------
    // 8. Tags create CSS classes
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_PostWithTags_CssClassContainsTagPrefixes()
    {
        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Tagged Post",
                Published = TestDate1,
                Tags = ["Homework", "cmsc-131"],
                Deadline = null
            },
            Url = "tagged-post",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], CoursePageUrl);

        var release = Assert.Single(results);
        Assert.Contains("tag-Homework", release.CssClass);
        Assert.Contains("tag-cmsc-131", release.CssClass);
    }

    // ----------------------------------------------------------------
    // 9. Post Url uses coursePageUrl + post.Url format
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_PostUrl_UsesCoursePageUrlPrefix()
    {
        var post = new Post<CourseFrontMatter>
        {
            FrontMatter = new CourseFrontMatter
            {
                Title = "Url Check",
                Published = TestDate1,
                Deadline = new DateTime(2026, 4, 1),
                Tags = []
            },
            Url = "some-deep/post-path",
            HtmlContent = "<p>test</p>"
        };

        var results = CalendarEventProvider.BuildEvents([], [], [post], "/courses");

        var release = results.Single(e => e.Type == EventType.Release);
        var deadline = results.Single(e => e.Type == EventType.Deadline);

        Assert.Equal("/courses/some-deep/post-path", release.Url);
        Assert.Equal("/courses/some-deep/post-path", deadline.Url);
    }

    // ----------------------------------------------------------------
    // 10. Custom event with null/empty Dates is skipped
    // ----------------------------------------------------------------
    [Fact]
    public void BuildEvents_CustomEventWithNoDates_Skipped()
    {
        var customEvents = new List<Post<CalendarEventFrontmatter>>
        {
            new()
            {
                FrontMatter = new CalendarEventFrontmatter
                {
                    Title = "Null Dates",
                    Dates = null!,
                    EventType = EventType.Custom
                },
                Url = "null-dates",
                HtmlContent = ""
            },
            new()
            {
                FrontMatter = new CalendarEventFrontmatter
                {
                    Title = "Empty Dates",
                    Dates = [],
                    EventType = EventType.Custom
                },
                Url = "empty-dates",
                HtmlContent = ""
            }
        };

        var results = CalendarEventProvider.BuildEvents([], customEvents, [], CoursePageUrl);

        Assert.Empty(results);
    }
}
