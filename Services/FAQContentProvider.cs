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
    {
        if (!showcaseMode && BuildTimeProvider.LocalNow > BuildTimeProvider.TermEnd)
            return Enumerable.Empty<Post<FAQFrontmatter>>();

        return sourcePosts.Where(p =>
            showcaseMode || IsVisibleOutsideShowcase(p.FrontMatter)
        ).OrderBy(p => p.FrontMatter.Published);
    }

    // Tagged FAQs are course-scoped: visible iff their course is active.
    // Untagged FAQs fall back to the term-window check. Future releases stay
    // hidden either way.
    private static bool IsVisibleOutsideShowcase(FAQFrontmatter fm)
    {
        if (fm.Published > BuildTimeProvider.LocalNow)
            return false;
        if (fm.Tags.Any())
            return BuildTimeProvider.IsCourseActive(fm.Tags);
        return fm.Published >= BuildTimeProvider.TermStart
            && fm.Published <= BuildTimeProvider.TermEnd;
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
