using BlazorStatic;

namespace BlazorStaticMinimalBlog.Models
{
    public class ProjectFrontMatter : IFrontMatter, IFrontMatterWithTags
    {
        public string Title { get; set; } = string.Empty;
        public DateTime Published { get; set; } = DateTime.Now;
        public string Url { get; set; } = string.Empty;
        public List<string> Authors { get; set; } = new();
        public string Abstract { get; set; } = string.Empty;
        public string Docs { get; set; } = string.Empty;
        public string Repository { get; set; } = string.Empty;
        public string Thumbnail { get; set; } = string.Empty;
        public int SchoolYear { get; set; } = DateTime.Now.Year;
        public List<string> Tags { get; set; } = new();

        public List<ProjectAuthor> GetAuthorObjects()
        {
            return Authors.Select(x => new ProjectAuthor { Name = x }).ToList();
        }

        public string GetSchoolYear()
        {
            // Schoolyear is always in the format of X-(X+1): e.g., 2025-2026.
            // This is unlikely to change, so we save a few bytes by doing this, shaving off build time.
            return $"{SchoolYear}-{SchoolYear + 1}";
        }
    }
}