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

    // Tagged posts are course-scoped: they are visible iff their course is
    // active (the term window no longer gates them). Untagged posts fall back
    // to the term-window check. Future releases stay hidden either way.
    private static bool IsVisibleOutsideShowcase(CourseFrontMatter fm)
    {
        if (fm.Published > BuildTimeProvider.LocalNow)
            return false;
        if (fm.Tags.Any())
            return BuildTimeProvider.IsCourseActive(fm.Tags);
        return fm.Published >= BuildTimeProvider.TermStart
            && fm.Published <= BuildTimeProvider.TermEnd;
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
