using BlazorStatic;
using BlazorStaticMinimalBlog.Models;
namespace BlazorStaticMinimalBlog.Services;
using BlazorStatic.Services;

public class CourseContentProvider
{
    private readonly BlazorStaticContentService<CourseFrontMatter> _staticService;

    public CourseContentProvider(BlazorStaticContentService<CourseFrontMatter> staticService)
    {
        _staticService = staticService;
    }

    /// <summary>
    /// Returns posts that are published, not draft, and within the current Term Window.
    /// Handles all Timezone conversions internally.
    /// </summary>
    public IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts()
    {
        var sourcePosts = _staticService.Posts;

        // 1. Get Time/Term constants in UTC
        DateTime termStart = BuildTimeProvider.TermStart;
        DateTime termEnd = BuildTimeProvider.TermEnd;

        // 2. Prepare PH Timezone for comparison
        DateTime nowPh = BuildTimeProvider.LocalNow;

        // 3. Short Circuit if Term Ended
        if (nowPh > termEnd)
        {
            return Enumerable.Empty<Post<CourseFrontMatter>>();
        }

        // 4. Filter
        return sourcePosts.Where(p =>
            !p.FrontMatter.IsDraft
            && p.FrontMatter.Published <= nowPh // Post (PH) vs Now (PH)
            && p.FrontMatter.Published >= termStart
            && p.FrontMatter.Published <= termEnd
        ).OrderByDescending(p => p.FrontMatter.Published);
    }

    public List<string> GetAllTags()
    {
        return GetVisiblePosts()
            .SelectMany(p => p.FrontMatter.Tags)
            .Distinct()
            .OrderBy(t => t)
            .ToList();
    }
}