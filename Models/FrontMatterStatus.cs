namespace BlazorStaticMinimalBlog.Models;

public enum FrontmatterStatus
{
    None,       // No specific status applies
    Future,     // Active/Due later
    DueToday,   // Due right now
    Expired     // Past due
}
