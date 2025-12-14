using System.Text.Json;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public class HolidaysProvider
{
    private List<Holiday> _holidaysCache = new();

    public async Task InitializeAsync()
    {
        var startYear = DateTime.UtcNow.Year;
        var years = Enumerable.Range(startYear, 3).ToList();

        var fetchedHolidays = new List<Holiday>();

        using var client = new HttpClient();
        client.Timeout = TimeSpan.FromSeconds(5);

        foreach (var year in years)
        {
            try
            {   
                // Using the nager.date free API.
                var json = await client.GetStringAsync($"https://date.nager.at/api/v3/PublicHolidays/{year}/PH");
                var apiHolidays = JsonSerializer.Deserialize<List<NagerHoliday>>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (apiHolidays != null)
                {
                    fetchedHolidays.AddRange(apiHolidays);
                    Console.WriteLine($"[HolidaysProvider] Successfully fetched {apiHolidays.Count} PH holidays for {year}.");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[HolidaysProvider] WARNING: Failed to fetch live PH holidays for {year}. Using fallback. Error: {ex.Message}");

                // If API fails for one year, we generate the fallback for THAT year immediately
                fetchedHolidays.AddRange(GetStaticHolidays(year));
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

    private List<Holiday> GetStaticHolidays(int year)
    {
        var list = new List<Holiday>
        {
            // --- FIXED DATES (Same every year) ---
            new() { Date = new DateTime(year, 1, 1), Name = "New Year's Day" },
            new() { Date = new DateTime(year, 1, 23), Name = "First Philippine Republic Day" },
            new() { Date = new DateTime(year, 2, 25), Name = "EDSA Revolution Anniversary" },
            new() { Date = new DateTime(year, 4, 9), Name = "Araw ng Kagitingan" },
            new() { Date = new DateTime(year, 5, 1), Name = "Labor Day" },
            new() { Date = new DateTime(year, 6, 12), Name = "Independence Day" },
            new() { Date = new DateTime(year, 8, 21), Name = "Ninoy Aquino Day" },
            new() { Date = new DateTime(year, 8, 25), Name = "National Heroes Day" }, // Note: Often moves to nearest Monday
            new() { Date = new DateTime(year, 11, 1), Name = "All Saints' Day" },
            new() { Date = new DateTime(year, 11, 2), Name = "All Souls' Day" },
            new() { Date = new DateTime(year, 11, 30), Name = "Bonifacio Day" },
            new() { Date = new DateTime(year, 12, 8), Name = "Feast of Immaculate Conception" },
            new() { Date = new DateTime(year, 12, 25), Name = "Christmas Day" },
            new() { Date = new DateTime(year, 12, 30), Name = "Rizal Day" },
            new() { Date = new DateTime(year, 12, 31), Name = "Last Day of the Year" }
        };

        return list;
    }
}