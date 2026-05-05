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

    // Extracted for testability — pure filtering function
    public IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts(IEnumerable<Post<CourseFrontMatter>> sourcePosts)
    {
        DateTime termStart = BuildTimeProvider.TermStart;
        DateTime termEnd = BuildTimeProvider.TermEnd;
        DateTime nowPh = BuildTimeProvider.LocalNow;

        if (nowPh > termEnd)
            return Enumerable.Empty<Post<CourseFrontMatter>>();

        return sourcePosts.Where(p =>
            !p.FrontMatter.IsDraft
            && !p.FrontMatter.Tags.Any(t => GlobalHiddenTags.Contains(t))
            && p.FrontMatter.Published <= nowPh
            && p.FrontMatter.Published >= termStart
            && p.FrontMatter.Published <= termEnd
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
