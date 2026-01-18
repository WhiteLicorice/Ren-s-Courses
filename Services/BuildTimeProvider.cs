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
    public static TimeZoneInfo LocalTimeZone { get; private set; }
    public static DateTime LocalNow => TimeZoneInfo.ConvertTimeFromUtc(UtcNow, LocalTimeZone);

    // FIXME: C# thinks that the term starts 8 hours into the day lmao.
    static BuildTimeProvider()
    {
        Console.WriteLine("--------------------------------------------------");
        Console.WriteLine("[BuildTimeProvider] Initializing...");

        // 1. Initialize TimeZone (Defined once here)
        // If we change this later, it propagates everywhere.
        LocalTimeZone = TimeZoneInfo.CreateCustomTimeZone(
            "PH",
            TimeSpan.FromHours(8),
            "Philippine Time",
            "Philippine Time"
        );

        // 2. Initialize Frozen Time
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

        // 3. Initialize Term Dates
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