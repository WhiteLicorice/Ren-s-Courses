using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.Services;

public class HolidaysProvider
{
    public IEnumerable<(DateTime Date, string Name)> GetHolidaysForRange(DateTime start, DateTime end)
    {
        var allHolidays = new List<(DateTime Date, string Name)>();

        // Loop through every year involved in the term
        for (int year = start.Year; year <= end.Year; year++)
        {
            allHolidays.AddRange(GetHolidaysForYear(year));
        }

        return allHolidays.Where(h => h.Date >= start && h.Date <= end);
    }

    private IEnumerable<(DateTime Date, string Name)> GetHolidaysForYear(int year)
    {
        var holidays = new List<(DateTime Date, string Name)>
        {
            // Fixed Dates
            (new DateTime(year, 1, 1), "New Year's Day"),
            (new DateTime(year, 1, 23), "First Philippine Republic Day"),
            (new DateTime(year, 2, 25), "EDSA Revolution Anniversary"),
            (new DateTime(year, 4, 9), "Araw ng Kagitingan"),
            (new DateTime(year, 5, 1), "Labor Day"),
            (new DateTime(year, 6, 12), "Independence Day"),
            (new DateTime(year, 8, 21), "Ninoy Aquino Day"),
            (new DateTime(year, 8, 25), "National Heroes Day"), // Note: This actually floats (last Mon of Aug), simplified for now
            (new DateTime(year, 11, 1), "All Saints' Day"),
            (new DateTime(year, 11, 2), "All Souls' Day"),
            (new DateTime(year, 11, 30), "Bonifacio Day"),
            (new DateTime(year, 12, 8), "Feast of Immaculate Conception"),
            (new DateTime(year, 12, 25), "Christmas Day"),
            (new DateTime(year, 12, 30), "Rizal Day"),
            (new DateTime(year, 12, 31), "Last Day of the Year")
        };

        // Movable Dates (Hardcoded for 2025/2026 for simplicity)
        if (year == 2025)
        {
            holidays.Add((new DateTime(2025, 1, 29), "Chinese New Year"));
            holidays.Add((new DateTime(2025, 3, 31), "Eid'l Fitr (Est)"));
            holidays.Add((new DateTime(2025, 4, 17), "Maundy Thursday"));
            holidays.Add((new DateTime(2025, 4, 18), "Good Friday"));
            holidays.Add((new DateTime(2025, 6, 6), "Eid'l Adha (Est)"));
        }
        else if (year == 2026)
        {
            holidays.Add((new DateTime(2026, 2, 17), "Chinese New Year"));
            holidays.Add((new DateTime(2026, 3, 20), "Eid'l Fitr (Est)"));
            holidays.Add((new DateTime(2026, 4, 2), "Maundy Thursday"));
            holidays.Add((new DateTime(2026, 4, 3), "Good Friday"));
            holidays.Add((new DateTime(2026, 5, 27), "Eid'l Adha (Est)"));
        }

        return holidays;
    }
}