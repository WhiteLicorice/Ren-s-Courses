using System.Diagnostics;

namespace BlazorStaticMinimalBlog.Services;

public static class BuildTimeProvider
{
    // This is the single source of truth for "Now"
    public static DateTime UtcNow => _frozenTime ?? DateTime.UtcNow;

    private static readonly DateTime? _frozenTime;

    static BuildTimeProvider()
    {
        Console.WriteLine("--------------------------------------------------");
        Console.WriteLine("[BuildTimeProvider] Initializing...");

        // Try to read the environment variable set by GitHub Actions
        var envVar = Environment.GetEnvironmentVariable("STATIC_GEN_TIME");

        Console.WriteLine($"[BuildTimeProvider] Raw STATIC_GEN_TIME env var: '{envVar ?? "NULL"}'");

        if (!string.IsNullOrEmpty(envVar) &&
            DateTime.TryParse(envVar, out var parsedDate))
        {
            _frozenTime = parsedDate.ToUniversalTime();
            Console.WriteLine($"[BuildTimeProvider] SUCCESS: Time frozen at {_frozenTime:O} (UTC)");
        }
        else
        {
            Console.WriteLine("[BuildTimeProvider] WARNING: Could not parse frozen time or variable was empty.");
            Console.WriteLine($"[BuildTimeProvider] FALLBACK: Using current machine time: {DateTime.UtcNow:O} (UTC)");
        }
        Console.WriteLine("--------------------------------------------------");
    }
}