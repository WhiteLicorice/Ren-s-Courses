var builder = WebApplication.CreateBuilder(args);

builder.WebHost.UseStaticWebAssets();

builder.Services.AddBlazorStaticService(opt =>
{
    //opt. //check to change the defaults
})
.AddBlazorStaticContentService<CourseFrontMatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Materials.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.Materials.TagPageUrl;
    opt.PageUrl = WebsiteKeys.Materials.UrlPrefix;
})
.AddBlazorStaticContentService<ProjectFrontMatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Projects.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.Projects.TagPageUrl;
    opt.PageUrl = WebsiteKeys.Disabled;
})
.AddBlazorStaticContentService<BookingFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Bookings.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.Disabled;
    opt.PageUrl = WebsiteKeys.Disabled;
});

builder.Services.AddRazorComponents();

var holidaysProvider = new HolidaysProvider();
await holidaysProvider.InitializeAsync();
builder.Services.AddSingleton(holidaysProvider);

builder.Services.AddSingleton<CourseContentProvider>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>();

app.UseBlazorStaticGenerator(shutdownApp: !app.Environment.IsDevelopment());

app.Run();

public static class WebsiteKeys
{
    // --- GLOBAL SETTINGS ---
    public const string GitHubRepo = "https://github.com/WhiteLicorice/Ren-s-Courses";
    public const string AuthorGitHub = "https://github.com/WhiteLicorice";
    public const string Title = "Ren's Courses";
    public const string BlogPostStorageAddress = $"{GitHubRepo}/tree/main/Content/Blog";
    public const string BlogLead = "Ren's Courses is a headless Learning Management System designed for CS units I handle under the University of the Philippines Visayas, Division of Physical Sciences and Mathematics. All rights reserved.";

    // Use this constant when you need to pass the literal string "null"
    public const string Disabled = "null";

    // --- DOMAIN SPECIFIC KEYS ---
    public static class Materials
    {
        public const string SourcePath = "Content/Materials";
        public const string TagPageUrl = "materials";
        public const string UrlPrefix = "articles";
    }

    public static class Projects
    {
        public const string SourcePath = "Content/Projects";
        public const string TagPageUrl = "projects";
    }

    public static class Bookings
    {
        public const string SourcePath = "Content/Bookings";
    }
}