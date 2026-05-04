using BlazorStatic;
using BlazorStatic.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using BlazorStaticMinimalBlog.Components;
using BlazorStaticMinimalBlog.Models;
using BlazorStaticMinimalBlog.Services;
// YES, THESE ARE NECESSARY.

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
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
})
.AddBlazorStaticContentService<BookingFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.Bookings.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.DisabledPage;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.Tags.AddTagPagesFromPosts = false;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
})
.AddBlazorStaticContentService<CalendarEventFrontmatter>(opt =>
{
    opt.ContentPath = WebsiteKeys.CalendarEvents.SourcePath;
    opt.Tags.TagsPageUrl = WebsiteKeys.DisabledPage;
    opt.PageUrl = WebsiteKeys.DisabledPage;
    opt.Tags.AddTagPagesFromPosts = false;
    opt.AfterContentParsedAndAddedAction = WebsiteKeys.RemovePostPages;
});

builder.Services.AddRazorComponents();

var holidaysProvider = new HolidaysProvider();
await holidaysProvider.InitializeAsync();
builder.Services.AddSingleton(holidaysProvider);

builder.Services.AddSingleton<CourseContentProvider>();
builder.Services.AddSingleton<FrontmatterStatusService>();
builder.Services.AddSingleton<CalendarEventProvider>();
builder.Services.AddScoped<ThemeService>();

var menuFilePath = Path.Combine(builder.Environment.ContentRootPath, "menu.json");
builder.Services.AddSingleton(new MenuConfigService(menuFilePath));

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

    // Non-empty placeholder for content types where individual pages are not needed.
    // Generation of individual post pages is suppressed via AfterContentParsedAndAddedAction.
    public const string DisabledPage = "_disabled";

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

    public static class CalendarEvents
    {
        public const string SourcePath = "Content/Events";
    }

    // AfterContentParsedAndAddedAction callback: removes individual post pages
    // for content types that only need the listing page, not detail pages.
    // BlazorStatic v1.0.0-beta.17 has no built-in option to skip individual page
    // generation, so we remove them post-parse via this hook.
    internal static void RemovePostPages<T>(BlazorStaticService svc, BlazorStaticContentService<T> _) where T : class, IFrontMatter, new()
    {
        // The options for the specific content service are stored; we find the
        // PageUrl by matching against the content service's internal prefix.
        // We remove any page whose Url starts with "DisabledPage/" (the placeholder)
        // since that indicates it was auto-generated from a disabled content type.
        var prefix = DisabledPage + "/";
        var pagesToRemove = svc.Options.PagesToGenerate
            .Where(p => p.Url.StartsWith(prefix, StringComparison.Ordinal))
            .ToList();
        foreach (var page in pagesToRemove)
            svc.Options.PagesToGenerate.Remove(page);
    }
}