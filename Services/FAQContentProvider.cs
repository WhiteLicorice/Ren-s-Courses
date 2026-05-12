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
        DateTime termStart = BuildTimeProvider.TermStart;
        DateTime termEnd = BuildTimeProvider.TermEnd;
        DateTime nowPh = BuildTimeProvider.LocalNow;

        if (!showcaseMode && nowPh > termEnd)
            return Enumerable.Empty<Post<FAQFrontmatter>>();

        return sourcePosts.Where(p =>
            (showcaseMode || p.FrontMatter.Published >= termStart)
            && (showcaseMode || p.FrontMatter.Published <= termEnd)
            && (showcaseMode || p.FrontMatter.Published <= nowPh)
        ).OrderBy(p => p.FrontMatter.Published);
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
