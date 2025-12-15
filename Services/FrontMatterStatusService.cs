using BlazorStaticMinimalBlog.Models;
namespace BlazorStaticMinimalBlog.Services;

public class FrontmatterStatusService
{
    /// <summary>
    /// Determines the current status of the content based on business rules.
    /// </summary>
    public FrontmatterStatus GetStatus(CourseFrontMatter fm)
    {
        if (fm.NoDeadline) return FrontmatterStatus.None;

        var deadline = GetEffectiveDate(fm);
        var deadlineEndOfDay = deadline.Date.AddDays(1).AddTicks(-1);
        
        // Single Source of Truth for Time
        var now = BuildTimeProvider.LocalNow;

        if (deadlineEndOfDay < now)
        {
            return FrontmatterStatus.Expired;
        }
        else if (deadline.Date == now.Date)
        {
            return FrontmatterStatus.DueToday;
        }
        else
        {
            return FrontmatterStatus.Future;
        }
    }

    /// <summary>
    /// Returns the date used for the status calculation.
    /// (Published + 1 Month default, or the explicit Deadline)
    /// </summary>
    public DateTime GetEffectiveDate(CourseFrontMatter fm)
    {
        return fm.Deadline ?? fm.Published.AddMonths(1);
    }
}