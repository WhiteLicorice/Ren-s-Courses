using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models;

public class BookingFrontmatter : IFrontMatter, IFrontMatterWithTags
{
    public List<string> Tags { get; set; } = new();
    public string Name { get; set; } = "";
    public string Calendar { get; set; } = "";
    public string Desc { get; set; } = "";
}

