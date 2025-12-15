using System.Text.Json;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public class HolidaysProvider
{
    private List<Holiday> _holidaysCache = new();
    private const string TIMEZONE_STR = "PH";

    public async Task InitializeAsync()
    {
        var startYear = BuildTimeProvider.UtcNow.Year;

        // Fetch current year + next year (usually enough for academic calendars)
        var years = Enumerable.Range(startYear, 2).ToList();

        var fetchedHolidays = new List<Holiday>();

        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(5);
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (compatible; BlazorStaticBot/1.0)");

        foreach (var year in years)
        {
            try
            {
                // Attempt to fetch from Nager.Date API
                var json = await client.GetStringAsync($"https://date.nager.at/api/v3/PublicHolidays/{year}/{TIMEZONE_STR}");
                var apiHolidays = JsonSerializer.Deserialize<List<NagerHoliday>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (apiHolidays != null && apiHolidays.Any())
                {
                    fetchedHolidays.AddRange(apiHolidays);
                    Console.WriteLine($"[HolidaysProvider] Successfully fetched {apiHolidays.Count} {TIMEZONE_STR} holidays for {year}.");
                }
                else
                {
                    throw new Exception("API returned empty list");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HolidaysProvider] WARNING: Failed to fetch live {TIMEZONE_STR} holidays for {year}. Calculating fallbacks. Error: {ex.Message}");
                fetchedHolidays.AddRange(CalculateFallbackHolidays(year));
            }
        }

        _holidaysCache = fetchedHolidays;
    }

    public IEnumerable<Holiday> GetHolidaysForRange(DateTime start, DateTime end)
    {
        return _holidaysCache
            .Where(h => h.Date >= start && h.Date <= end)
            .OrderBy(h => h.Date);
    }

    private List<Holiday> CalculateFallbackHolidays(int year)
    {
        var holidays = new List<Holiday>();

        // 1. Fixed Dates
        holidays.AddRange(
        [
            new Holiday { Date = new DateTime(year, 1, 1), Name = "New Year's Day" },
            new Holiday { Date = new DateTime(year, 1, 23), Name = "First Philippine Republic Day" },
            new Holiday { Date = new DateTime(year, 2, 25), Name = "EDSA Revolution Anniversary" },
            new Holiday { Date = new DateTime(year, 4, 9), Name = "Araw ng Kagitingan" },
            new Holiday { Date = new DateTime(year, 5, 1), Name = "Labor Day" },
            new Holiday { Date = new DateTime(year, 6, 12), Name = "Independence Day" },
            new Holiday { Date = new DateTime(year, 8, 21), Name = "Ninoy Aquino Day" },
            new Holiday { Date = new DateTime(year, 11, 1), Name = "All Saints' Day" },
            new Holiday { Date = new DateTime(year, 11, 2), Name = "All Souls' Day" },
            new Holiday { Date = new DateTime(year, 11, 30), Name = "Bonifacio Day" },
            new Holiday { Date = new DateTime(year, 12, 8), Name = "Feast of Immaculate Conception" },
            new Holiday { Date = new DateTime(year, 12, 25), Name = "Christmas Day" },
            new Holiday { Date = new DateTime(year, 12, 30), Name = "Rizal Day" },
            new Holiday { Date = new DateTime(year, 12, 31), Name = "Last Day of the Year" }
        ]);

        // 2. National Heroes Day (Last Monday of August)
        holidays.Add(new Holiday
        {
            Date = GetLastDayOfWeekInMonth(year, 8, DayOfWeek.Monday),
            Name = "National Heroes Day"
        });

        // 3. Holy Week (Calculated relative to Easter)
        DateTime easter = CalculateEasterSunday(year);
        holidays.Add(new Holiday { Date = easter.AddDays(-3), Name = "Maundy Thursday" });
        holidays.Add(new Holiday { Date = easter.AddDays(-2), Name = "Good Friday" });
        holidays.Add(new Holiday { Date = easter.AddDays(-1), Name = "Black Saturday" });
        holidays.Add(new Holiday { Date = easter, Name = "Easter Sunday" });

        /* NOTE: We explicitly DO NOT calculate:
           - Chinese New Year
           - Eid al-Fitr
           - Eid al-Adha
           These depend on the lunar calendar and official presidential proclamations 
           which vary by sighting. Better to omit them in fallback, than guess wrong.
        */

        return holidays;
    }

    private DateTime GetLastDayOfWeekInMonth(int year, int month, DayOfWeek dayOfWeek)
    {
        var dt = new DateTime(year, month, DateTime.DaysInMonth(year, month));
        while (dt.DayOfWeek != dayOfWeek)
        {
            dt = dt.AddDays(-1);
        }
        return dt;
    }

    private DateTime CalculateEasterSunday(int year)
    {
        int a = year % 19;
        int b = year / 100;
        int c = year % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int month = (h + l - 7 * m + 114) / 31;
        int day = ((h + l - 7 * m + 114) % 31) + 1;

        return new DateTime(year, month, day);
    }
}