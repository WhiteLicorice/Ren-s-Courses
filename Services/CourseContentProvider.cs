using BlazorStatic;
using BlazorStaticMinimalBlog.Models;
using BlazorStatic.Services;

namespace BlazorStaticMinimalBlog.Services;

public class CourseContentProvider
{
    private readonly BlazorStaticContentService<CourseFrontMatter> _staticService;

    // TODO: Define courses that we should hide here.
    private readonly HashSet<string> _globalHiddenTags = new(StringComparer.OrdinalIgnoreCase)
    {
        // "cmsc-131"
    };

    public CourseContentProvider(BlazorStaticContentService<CourseFrontMatter> staticService)
    {
        _staticService = staticService;
    }

    public IEnumerable<Post<CourseFrontMatter>> GetVisiblePosts()
    {
        var sourcePosts = _staticService.Posts;
        DateTime termStart = BuildTimeProvider.TermStart;
        DateTime termEnd = BuildTimeProvider.TermEnd;
        DateTime nowPh = BuildTimeProvider.LocalNow;

        if (nowPh > termEnd)
        {
            return Enumerable.Empty<Post<CourseFrontMatter>>();
        }

        return sourcePosts.Where(p =>
            !p.FrontMatter.IsDraft
            && !p.FrontMatter.Tags.Any(t => _globalHiddenTags.Contains(t))
            && p.FrontMatter.Published <= nowPh
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