namespace Ren.Courses.Tests;

/// <summary>Locates the repository from the test binary, for tests that read a fixture file.</summary>
internal static class RepoPaths
{
    internal static string Root
    {
        get
        {
            for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
            {
                if (File.Exists(Path.Combine(dir.FullName, "BlazorStaticMinimalBlog.csproj")))
                    return dir.FullName;
            }
            throw new DirectoryNotFoundException("Cannot locate the repository root");
        }
    }
}
