using BlazorStatic;
using BlazorStaticMinimalBlog.Models;
using BlazorStatic.Services;

namespace BlazorStaticMinimalBlog.Services;

public class FAQContentProvider
{
    private readonly BlazorStaticContentService<FAQFrontmatter> _staticService;

    public FAQContentProvider(BlazorStaticContentService<FAQFrontmatter> staticService)
    {
        _staticService = staticService;
    }

    public IEnumerable<Post<FAQFrontmatter>> GetVisiblePosts()
        => GetVisiblePosts(_staticService.Posts);

    public IEnumerable<Post<FAQFrontmatter>> GetVisiblePosts(IEnumerable<Post<FAQFrontmatter>> sourcePosts)
        => GetVisiblePosts(sourcePosts, BuildTimeProvider.IsShowcaseMode);

    internal IEnumerable<Post<FAQFrontmatter>> GetVisiblePosts(
        IEnumerable<Post<FAQFrontmatter>> sourcePosts, bool showcaseMode)
        => GetVisiblePosts(sourcePosts, showcaseMode, BuildTimeProvider.UtcNow);

    internal IEnumerable<Post<FAQFrontmatter>> GetVisiblePosts(
        IEnumerable<Post<FAQFrontmatter>> sourcePosts, bool showcaseMode, DateTime utcNow)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, BuildTimeProvider.LocalTimeZone);
        if (!showcaseMode && utcNow >= BuildTimeProvider.TermEnd)
            return Enumerable.Empty<Post<FAQFrontmatter>>();

        return sourcePosts.Where(p =>
            showcaseMode || IsVisibleOutsideShowcase(p.FrontMatter, localNow)
        ).OrderBy(p => p.FrontMatter.Published);
    }

    // Tagged FAQs are course-scoped: visible iff their course is active AND
    // published inside the term window. Posts outside the window are not
    // published at all, even for active courses. Future releases stay hidden.
    private static bool IsVisibleOutsideShowcase(FAQFrontmatter fm, DateTime localNow)
    {
        if (fm.Published > localNow)
            return false;
        if (fm.Published < BuildTimeProvider.TermStart
            || fm.Published > BuildTimeProvider.TermEnd)
            return false;
        return !fm.Tags.Any() || BuildTimeProvider.IsCourseActive(fm.Tags);
    }

    public List<string> GetAllTags()
        => GetAllTags(GetVisiblePosts());

    public List<string> GetAllTags(IEnumerable<Post<FAQFrontmatter>> filteredPosts)
        => filteredPosts
            .SelectMany(p => p.FrontMatter.Tags)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();
}
