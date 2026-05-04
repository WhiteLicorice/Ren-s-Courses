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
        var events = new List<CalendarEvent>();

        // 1. Load Holidays
        var holidays = _holidaysProvider.GetHolidaysForRange(
            BuildTimeProvider.TermStart,
            BuildTimeProvider.TermEnd
        );

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

        // 2. Load Custom Calendar Events
        var customEvents = _calendarEventService.Posts;

        foreach (var evt in customEvents)
        {
            var fm = evt.FrontMatter;

            if (fm.Dates == null || !fm.Dates.Any())
                continue;

            string cssClass = fm.CssClass ?? GetDefaultCssForEventType(fm.EventType);

            foreach (var date in fm.Dates)
            {
                if (date >= BuildTimeProvider.TermStart && date <= BuildTimeProvider.TermEnd)
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
        }

        // 3. Load Posts
        var posts = _contentProvider.GetVisiblePosts();

        foreach (var post in posts)
        {
            var fm = post.FrontMatter;
            var postUrl = $"{_courseService.Options.PageUrl}/{post.Url}";
            var tagClasses = string.Join(" ", fm.Tags.Select(t => $"tag-{t.Replace(" ", "-")}"));

            // A. Release Date
            events.Add(new CalendarEvent
            {
                Title = fm.Title,
                Tooltip = "Release",
                Date = fm.Published.Date,
                Type = EventType.Release,
                CssClass = $"bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500 {tagClasses}",
                Url = postUrl
            });

            // B. Deadline
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

            // C. Progress
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

            // D. Defense
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
