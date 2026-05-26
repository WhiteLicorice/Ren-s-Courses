using BlazorStatic;
using BlazorStaticMinimalBlog.Models;
using BlazorStatic.Services;

namespace BlazorStaticMinimalBlog.Services;

public class CourseContentProvider
{
    private readonly BlazorStaticContentService<CourseFrontMatter> _staticService;

    // Internal setter for testing via InternalsVisibleTo
    internal HashSet<string> GlobalHiddenTags { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public CourseContentProvider(BlazorStaticContentService<CourseFrontMatter> staticService)
    {
        _staticService = staticService;
    }

    public IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts()
        => GetVisiblePosts(_staticService.Posts);

    // Delegates to internal overload with current showcase mode
    public IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts(IEnumerable<Post<CourseFrontMatter>> sourcePosts)
        => GetVisiblePosts(sourcePosts, BuildTimeProvider.IsShowcaseMode);

    // Pure filtering function — showcaseMode bypasses term window + future check
    internal IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts(
        IEnumerable<Post<CourseFrontMatter>> sourcePosts, bool showcaseMode)
    {
        DateTime termStart = BuildTimeProvider.TermStart;
        DateTime termEnd = BuildTimeProvider.TermEnd;
        DateTime nowUtc = BuildTimeProvider.UtcNow;
        DateTime nowPh = BuildTimeProvider.LocalNow;

        if (!showcaseMode && nowUtc >= termEnd)
            return Enumerable.Empty<Post<CourseFrontMatter>>();

        return sourcePosts.Where(p =>
            !p.FrontMatter.IsDraft
            && !p.FrontMatter.Tags.Any(t => GlobalHiddenTags.Contains(t))
            && (showcaseMode || p.FrontMatter.Published >= termStart)
            && (showcaseMode || p.FrontMatter.Published <= termEnd)
            && (showcaseMode || p.FrontMatter.Published <= nowPh)
        ).OrderByDescending(p => p.FrontMatter.Published);
    }

    public List<string> GetAllTags()
    {
        return GetAllTags(GetVisiblePosts());
    }

    public List<string> GetAllTags(IEnumerable<Post<CourseFrontMatter>> filteredPosts)
    {
        return filteredPosts
            .SelectMany(p => p.FrontMatter.Tags)
            .Distinct()
            .OrderBy(t => t)
            .ToList();
    }
}
