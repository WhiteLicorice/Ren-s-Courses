using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public class BookingContentProvider
{
    private readonly BlazorStaticContentService<BookingFrontmatter> _staticService;

    public BookingContentProvider(BlazorStaticContentService<BookingFrontmatter> staticService)
    {
        _staticService = staticService;
    }

    public IEnumerable<Post<BookingFrontmatter>> GetVisiblePosts()
        => GetVisiblePosts(_staticService.Posts);

    public IEnumerable<Post<BookingFrontmatter>> GetVisiblePosts(IEnumerable<Post<BookingFrontmatter>> sourcePosts)
        => GetVisiblePosts(sourcePosts, BuildTimeProvider.IsShowcaseMode);

    // Tagged bookings are course-scoped: visible iff their course is active.
    // Untagged bookings are always visible. Showcase mode bypasses the check.
    internal IEnumerable<Post<BookingFrontmatter>> GetVisiblePosts(
        IEnumerable<Post<BookingFrontmatter>> sourcePosts, bool showcaseMode)
        => sourcePosts
            .Where(p => showcaseMode
                || !p.FrontMatter.Tags.Any()
                || BuildTimeProvider.IsCourseActive(p.FrontMatter.Tags))
            .OrderBy(p => p.FrontMatter.Name);
}
