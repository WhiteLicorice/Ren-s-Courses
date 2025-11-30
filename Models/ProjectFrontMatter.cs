using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models
{
    public class ProjectFrontMatter : IFrontMatter, IFrontMatterWithTags
    {
        public string Title { get; set; } = string.Empty;
        public DateTime Published { get; set; } = DateTime.Now;
        public string Url { get; set; } = string.Empty;

        // YAML properties
        public List<string> Authors { get; set; } = new();
        public string Abstract { get; set; } = string.Empty;
        public string Docs { get; set; } = string.Empty;
        public string Repository { get; set; } = string.Empty;
        public string Thumbnail { get; set; } = string.Empty;
        public string Year { get; set; } = string.Empty;
        public List<string> Tags { get; set; } = new();

        public List<ProjectAuthor> GetAuthorObjects()
        {
            return Authors.Select(x => new ProjectAuthor { Name = x }).ToList();
        }

        public string GetBatchString()
        {
            return $"{Published.Year}-{Published.AddYears(1).Year}";
        }
    }
}