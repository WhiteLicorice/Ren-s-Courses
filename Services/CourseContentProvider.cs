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
        if (!showcaseMode && BuildTimeProvider.UtcNow >= BuildTimeProvider.TermEnd)
            return Enumerable.Empty<Post<CourseFrontMatter>>();

        return sourcePosts.Where(p =>
            !p.FrontMatter.IsDraft
            && !p.FrontMatter.Tags.Any(t => GlobalHiddenTags.Contains(t))
            && (showcaseMode || IsVisibleOutsideShowcase(p.FrontMatter))
        ).OrderByDescending(p => p.FrontMatter.Published);
    }

    // Tagged posts are course-scoped: visible iff their course is active AND
    // published inside the term window. Posts outside the window are not
    // published at all, even for active courses. Future releases stay hidden.
    private static bool IsVisibleOutsideShowcase(CourseFrontMatter fm)
    {
        if (fm.Published > BuildTimeProvider.LocalNow)
            return false;
        if (fm.Published < BuildTimeProvider.TermStart
            || fm.Published > BuildTimeProvider.TermEnd)
            return false;
        return !fm.Tags.Any() || BuildTimeProvider.IsCourseActive(fm.Tags);
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
