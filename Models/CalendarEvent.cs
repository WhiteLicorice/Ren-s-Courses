namespace BlazorStaticMinimalBlog.Models;

public class CalendarEvent
{
    public string Title { get; set; } = "";
    public string Tooltip { get; set; } = "";
    public DateTime Date { get; set; }
    public EventType Type { get; set; }
    public string CssClass { get; set; } = "";
    public string? Url { get; set; }
}