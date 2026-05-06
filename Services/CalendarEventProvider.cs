using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public class CalendarEventProvider
{
    private readonly HolidaysProvider _holidaysProvider;
    private readonly CourseContentProvider _contentProvider;
    private readonly BlazorStaticContentService<CalendarEventFrontmatter> _calendarEventService;
    private readonly BlazorStaticContentService<CourseFrontMatter> _courseService;

    public CalendarEventProvider(
        HolidaysProvider holidaysProvider,
        CourseContentProvider contentProvider,
        BlazorStaticContentService<CalendarEventFrontmatter> calendarEventService,
        BlazorStaticContentService<CourseFrontMatter> courseService)
    {
        _holidaysProvider = holidaysProvider;
        _contentProvider = contentProvider;
        _calendarEventService = calendarEventService;
        _courseService = courseService;
    }

    public List<CalendarEvent> GetAllEvents()
    {
        DateTime holidayStart = BuildTimeProvider.TermStart;
        DateTime holidayEnd = BuildTimeProvider.TermEnd;

        if (BuildTimeProvider.IsShowcaseMode)
        {
            // Showcase mode: show holidays across all years
            holidayStart = DateTime.MinValue;
            holidayEnd = DateTime.MaxValue;
        }

        return BuildEvents(
            _holidaysProvider.GetHolidaysForRange(holidayStart, holidayEnd),
            _calendarEventService.Posts,
            _contentProvider.GetVisiblePosts(),
            _courseService.Options.PageUrl
        );
    }

    // Extracted for testability — pure function with no DI dependencies
    internal static List<CalendarEvent> BuildEvents(
        IEnumerable<Holiday> holidays,
        IEnumerable<Post<CalendarEventFrontmatter>> customEvents,
        IEnumerable<Post<CourseFrontMatter>> coursePosts,
        string coursePageUrl)
    {
        var events = new List<CalendarEvent>();

        // 1. Holidays
        foreach (var h in holidays)
        {
            events.Add(new CalendarEvent
            {
                Title = h.Name,
                Tooltip = "Holiday",
                Date = h.Date,
                Type = EventType.Holiday,
                CssClass = "bg-accent/10 text-accent border-accent",
                Url = null
            });
        }

        // 2. Custom Calendar Events
        foreach (var evt in customEvents)
        {
            var fm = evt.FrontMatter;
            if (fm.Dates == null || !fm.Dates.Any())
                continue;

            string cssClass = fm.CssClass ?? GetDefaultCssForEventType(fm.EventType);

            foreach (var date in fm.Dates)
            {
                events.Add(new CalendarEvent
                {
                    Title = fm.Title,
                    Tooltip = string.IsNullOrEmpty(fm.Tooltip) ? fm.EventType.ToString() : fm.Tooltip,
                    Date = date,
                    Type = fm.EventType,
                    CssClass = cssClass,
                    Url = fm.Url
                });
            }
        }

        // 3. Course Posts
        foreach (var post in coursePosts)
        {
            var fm = post.FrontMatter;
            var postUrl = $"{coursePageUrl}/{post.Url}";
            var tagClasses = string.Join(" ", fm.Tags.Select(t => $"tag-{t.Replace(" ", "-")}"));

            events.Add(new CalendarEvent
            {
                Title = fm.Title,
                Tooltip = "Release",
                Date = fm.Published.Date,
                Type = EventType.Release,
                CssClass = $"bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500 {tagClasses}",
                Url = postUrl
            });

            if (fm.Deadline.HasValue)
            {
                events.Add(new CalendarEvent
                {
                    Title = fm.Title,
                    Tooltip = "Deadline",
                    Date = fm.Deadline.Value.Date,
                    Type = EventType.Deadline,
                    CssClass = $"bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500 font-bold {tagClasses}",
                    Url = postUrl
                });
            }

            if (fm.ProgressReportDates != null)
            {
                foreach (var date in fm.ProgressReportDates)
                {
                    events.Add(new CalendarEvent
                    {
                        Title = fm.Title,
                        Tooltip = "Progress",
                        Date = date.Date,
                        Type = EventType.Progress,
                        CssClass = $"bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500 {tagClasses}",
                        Url = postUrl
                    });
                }
            }

            if (fm.DefenseDates != null)
            {
                foreach (var date in fm.DefenseDates)
                {
                    events.Add(new CalendarEvent
                    {
                        Title = fm.Title,
                        Tooltip = "Defense",
                        Date = date.Date,
                        Type = EventType.Defense,
                        CssClass = $"bg-green-500/10 text-green-700 dark:text-green-400 border-green-500 {tagClasses}",
                        Url = postUrl
                    });
                }
            }
        }

        return events;
    }

    private static string GetDefaultCssForEventType(EventType eventType)
    {
        return eventType switch
        {
            EventType.Holiday => "bg-accent/10 text-accent border-accent",
            EventType.Custom => "bg-accent/10 text-accent border-accent",
            EventType.Release => "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500",
            EventType.Deadline => "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500 font-bold",
            EventType.Progress => "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500",
            EventType.Defense => "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500",
            _ => "bg-accent/10 text-accent border-accent"
        };
    }
}
