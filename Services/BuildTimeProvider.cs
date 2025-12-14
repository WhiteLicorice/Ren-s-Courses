using System.Diagnostics;

namespace BlazorStaticMinimalBlog.Services;

public static class BuildTimeProvider
{
    public static DateTime UtcNow => _frozenTime;
    private static readonly DateTime _frozenTime;
    public static DateTime TermStart => _termStart;
    public static DateTime TermEnd => _termEnd;
    private static readonly DateTime _termStart;
    private static readonly DateTime _termEnd;
    
    static BuildTimeProvider()
    {
        Console.WriteLine("--------------------------------------------------");
        Console.WriteLine("[BuildTimeProvider] Initializing...");


        // STATIC_GEN_TIME is undefined in dev since we expect it to be set to current time.
        // Just let it fall through!
        var staticGenTime = Environment.GetEnvironmentVariable("STATIC_GEN_TIME");

        Console.WriteLine($"[BuildTimeProvider] Raw STATIC_GEN_TIME env var: '{staticGenTime ?? "NULL"}'");

        if (!string.IsNullOrEmpty(staticGenTime) &&
            DateTime.TryParse(staticGenTime, out var parsedDate))
        {
            _frozenTime = parsedDate.ToUniversalTime();
            Console.WriteLine($"[BuildTimeProvider] SUCCESS: Time frozen at {_frozenTime:O} (UTC)");
        }
        else
        { 
            _frozenTime = DateTime.UtcNow;
            Console.WriteLine("[BuildTimeProvider] WARNING: Could not parse frozen time or variable was empty.");
            Console.WriteLine($"[BuildTimeProvider] FALLBACK: Using current machine time: {_frozenTime:O} (UTC)");
        }

        // Never null, since deployment errors out if misconfigured.
        _termStart = DateTime.Parse(Environment.GetEnvironmentVariable("TERM_START")!);
        Console.WriteLine($"[BuildTimeProvider] SUCCESS: Set TermStart to {_termStart}.");
        _termEnd = DateTime.Parse(Environment.GetEnvironmentVariable("TERM_END")!);
        // Ensure the End Date includes the entire day (up to 23:59:59)
        // This matches the user expectation that a post on the End Date is included.
        _termEnd = _termEnd.Date.AddDays(1).AddTicks(-1);
        Console.WriteLine($"[BuildTimeProvider] SUCCESS: Set TermEnd to {_termEnd}.");

        Console.WriteLine("--------------------------------------------------");
    }
}