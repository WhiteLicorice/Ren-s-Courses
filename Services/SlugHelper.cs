using System.Text.RegularExpressions;

namespace BlazorStaticMinimalBlog.Services;

public static class SlugHelper
{
    public static string Slugify(string text)
    {
        var s = text.ToLowerInvariant();
        s = Regex.Replace(s, @"[^a-z0-9\s-]", "");
        s = Regex.Replace(s, @"\s+", "-");
        return s.Trim('-');
    }
}
