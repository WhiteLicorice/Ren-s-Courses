using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models;

/// <summary>
/// Represents frontmatter for user-defined custom calendar events.
/// Allows creating calendar entries beyond holidays and course-related events.
/// </summary>
public class CalendarEventFrontmatter : IFrontMatter
{
    /// <summary>
    /// The title/name of the custom event (e.g., "University Week", "Registration Period").
    /// </summary>
    public string Title { get; set; } = "";

    /// <summary>
    /// The date when this custom event occurs.
    /// </summary>
    public DateTime Date { get; set; }

    /// <summary>
    /// Optional tooltip/description for the event.
    /// </summary>
    public string Tooltip { get; set; } = "";

    /// <summary>
    /// The type of event (Holiday, Release, Deadline, Progress, Defense).
    /// Determines the visual styling on the calendar.
    /// </summary>
    public EventType EventType { get; set; } = EventType.Holiday;

    /// <summary>
    /// Optional URL to link to when the event is clicked.
    /// </summary>
    public string? Url { get; set; }

    /// <summary>
    /// Optional custom CSS classes for styling the event.
    /// If not provided, default styling based on EventType will be used.
    /// </summary>
    public string? CssClass { get; set; }
}
