using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models;

public class FAQFrontmatter : IFrontMatter, IFrontMatterWithTags
{
    public string Question { get; set; } = "";
    // GOTCHA: Answer is stored in the markdown body, not this field.
    // The page renders HtmlContent (compiled from the body) instead.
    // This field exists for spec compliance / future tooling use.
    public string Answer { get; set; } = "";
    public List<string> Tags { get; set; } = new();
    public DateTime Published { get; set; } = DateTime.Now;
}
