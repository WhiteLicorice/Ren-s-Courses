using System.Text.RegularExpressions;
using BlazorStatic;
using BlazorStatic.Services;
using BlazorStaticMinimalBlog.Models;
using RensMarkdownTemplates.Services;

namespace BlazorStaticMinimalBlog.Services;

/// <summary>
/// The site publishes a material at <c>articles/&lt;name&gt;</c> for a supported
/// <c>&lt;name&gt;.md</c> file. BlazorStatic derives a parsed post URL from the path
/// relative to the materials folder and removes one trailing <c>/index</c>. This class
/// takes the last segment of that parsed URL and publishes the media beside the file.
/// </summary>
internal static class MaterialLayout
{
    /// <summary>Where a material's images appear in the generated site.</summary>
    private const string PublishedMediaPrefix = "Content/Materials/";

    private static readonly Regex ImageSource = new(
        "(?<before><img\\b[^>]*\\bsrc\\s*=\\s*[\"'])(?<url>[^\"']+)(?<after>[\"'][^>]*>)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex AllowedSlug = new(
        @"^[A-Za-z0-9][A-Za-z0-9_-]*\z",
        RegexOptions.Compiled);

    /// <summary>
    /// The last segment of an already parsed post URL. The library removed one
    /// trailing <c>/index</c> before this point, so do not remove a second one.
    /// </summary>
    internal static string ParsedUrlSlug(string url)
    {
        var slash = url.LastIndexOf('/');
        return slash >= 0 ? url[(slash + 1)..] : url;
    }

    /// <summary>
    /// The normalized slug for a raw path relative to the materials directory,
    /// without its extension. It is the generator's rule, so the preflight and the
    /// PDF manifest key cannot diverge.
    /// </summary>
    internal static string RawPathSlug(string relativePathWithoutExtension) =>
        PdfGeneratorService.MaterialSlugFor(relativePathWithoutExtension);

    /// <summary>
    /// Two materials that share a file name would share one article URL and one PDF
    /// name. Fail the build and name both paths instead of letting one win silently.
    /// The comparison matches the generator: one <c>/index</c> removal, edge hyphens
    /// trimmed, and case ignored.
    /// </summary>
    internal static void ValidateUniqueSlugs(string materialsDirectory)
    {
        if (!Directory.Exists(materialsDirectory)) return;

        var entries = Directory
            .EnumerateFiles(materialsDirectory, "*.md", SearchOption.AllDirectories)
            .Select(file => (Path: file, Slug: RawPathSlug(
                RelativeWithoutExtension(materialsDirectory, file))))
            .ToList();

        foreach (var entry in entries)
        {
            var problem = UrlSlugProblem(entry.Slug);
            if (problem is not null)
                throw new InvalidOperationException(
                    $"Material '{entry.Path}' cannot publish: {problem}. Rename the file.");
        }

        var duplicate = entries
            .GroupBy(entry => entry.Slug, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);

        if (duplicate is null) return;

        var paths = string.Join(" and ", duplicate.Select(entry => entry.Path));
        throw new InvalidOperationException(
            $"Two materials share the file name '{duplicate.Key}'. Rename one of them: {paths}");
    }

    /// <summary>
    /// A slug must match the publishing allowlist. A dot, space, percent, or any
    /// other character outside the allowlist can select another article or break
    /// the host's URL resolution.
    /// </summary>
    internal static string? UrlSlugProblem(string slug)
    {
        if (AllowedSlug.IsMatch(slug)) return null;

        return $"the slug '{slug}' is outside the allowed set. Use only letters, digits, underscore, and hyphen, and start with a letter or digit";
    }

    internal static void Normalize(
        BlazorStaticService service,
        BlazorStaticContentService<CourseFrontMatter> contentService,
        string materialsDirectory)
    {
        var pageUrl = contentService.Options.PageUrl;
        var pages = service.Options.PagesToGenerate;
        var materialsRoot = Path.GetFullPath(materialsDirectory);

        foreach (var post in contentService.Posts)
        {
            var oldUrl = post.Url;
            var slug = ParsedUrlSlug(oldUrl);

            if (slug == oldUrl)
            {
                NormalizeMediaReferences(post, materialsRoot);
                continue;
            }

            post.Url = slug;
            var index = pages.FindIndex(page => page.Url == $"{pageUrl}/{oldUrl}");
            if (index >= 0)
            {
                var page = pages[index];
                pages[index] = new PageToGenerate(
                    $"{pageUrl}/{slug}",
                    Path.Combine(pageUrl, $"{slug}.html"),
                    page.AdditionalInfo);
            }

            NormalizeMediaReferences(post, materialsRoot);
        }

        NormalizeMediaCopies(service.Options.ContentToCopyToOutput, materialsRoot);
    }

    /// <summary>
    /// A material rewrites a rooted image to a site-relative URL. BlazorStatic
    /// resolves the image against the content path, which is absolute for the fixture
    /// site, so that URL can be a rooted Windows path. Rewrite it under the published
    /// material folder, which works for both base paths. A relative production URL is
    /// already correct and stays untouched.
    /// </summary>
    private static void NormalizeMediaReferences(
        Post<CourseFrontMatter> post, string materialsRoot)
    {
        post.HtmlContent = ImageSource.Replace(post.HtmlContent, match =>
        {
            var source = match.Groups["url"].Value;
            if (!Path.IsPathRooted(source)) return match.Value;

            var relative = Path.GetRelativePath(
                materialsRoot, source.Replace('/', Path.DirectorySeparatorChar));
            if (relative.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relative))
                return match.Value;

            var published = PublishedMediaPrefix + relative.Replace('\\', '/');
            return $"{match.Groups["before"].Value}{published}{match.Groups["after"].Value}";
        });
    }

    /// <summary>
    /// The absolute fixture makes BlazorStatic copy a media folder onto itself. Point
    /// that copy at the published folder instead. The relative fixture reads Content
    /// from bin, so point its relative source at the bin tree and keep its relative
    /// target. Production entries already resolve at the repo root.
    /// </summary>
    private static void NormalizeMediaCopies(
        List<ContentToCopy> copies, string materialsRoot)
    {
        var contentRoot = Path.GetDirectoryName(materialsRoot);

        for (var i = 0; i < copies.Count; i++)
        {
            var copy = copies[i];
            if (Path.IsPathRooted(copy.TargetPath))
            {
                var relative = Path.GetRelativePath(materialsRoot, copy.SourcePath);
                if (relative.StartsWith("..", StringComparison.Ordinal) || Path.IsPathRooted(relative))
                    continue;

                copies[i] = new ContentToCopy(
                    copy.SourcePath, PublishedMediaPrefix + relative.Replace('\\', '/'));
                continue;
            }

            if (contentRoot is not null
                && copy.SourcePath.StartsWith("Content/", StringComparison.Ordinal))
            {
                var sourceRelative = copy.SourcePath["Content/".Length..]
                    .Replace('/', Path.DirectorySeparatorChar);
                copies[i] = new ContentToCopy(
                    Path.Combine(contentRoot, sourceRelative), copy.TargetPath);
            }
        }
    }

    private static string RelativeWithoutExtension(string root, string file) =>
        Path.ChangeExtension(Path.GetRelativePath(root, file), null)!.Replace('\\', '/');
}
