namespace BlazorStaticMinimalBlog.Services;

// SSR-only service: provides the list of available course tags for rendering
// the filter chip bar in NavMenu. Client-side filter state lives in localStorage
// and is managed entirely by course-filter.js.
public class CourseFilterService
{
    private List<string> _availableTags = new();

    public IReadOnlyList<string> AvailableTags => _availableTags;

    public void SetAvailableTags(IEnumerable<string> tags)
    {
        _availableTags = tags
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
