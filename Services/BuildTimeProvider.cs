namespace BlazorStaticMinimalBlog.Services;
using System.Globalization;

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
            DateTime.TryParse(staticGenTime, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal, out var parsedDate))
        {
            _frozenTime = parsedDate;
            Console.WriteLine($"[BuildTimeProvider] SUCCESS: Time frozen at {_frozenTime:O}");
        }
        else
        {
            _frozenTime = DateTime.UtcNow;
            Console.WriteLine("[BuildTimeProvider] WARNING: Could not parse frozen time or variable was empty.");
            Console.WriteLine($"[BuildTimeProvider] FALLBACK: Using current machine time: {_frozenTime:O} (UTC)");
        }

        // We use AdjustToUniversal to ensure the 'Z' in the config is respected as UTC.
        _termStart = DateTime.Parse(
            Environment.GetEnvironmentVariable("TERM_START")!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal
        );
        Console.WriteLine($"[BuildTimeProvider] SUCCESS: Set TermStart to {_termStart:O}");

        _termEnd = DateTime.Parse(
            Environment.GetEnvironmentVariable("TERM_END")!,
            CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal
        );

        Console.WriteLine($"[BuildTimeProvider] SUCCESS: Set TermEnd to {_termEnd:O}");

        Console.WriteLine("--------------------------------------------------");
    }
}