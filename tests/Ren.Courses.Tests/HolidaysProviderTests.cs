namespace Ren.Courses.Tests;

[Collection("BuildTimeProvider")]
public class HolidaysProviderTests
{
    [Fact]
    public void CalculateEasterSunday_2026_ReturnsApril5()
    {
        DateTime easter = HolidaysProvider.CalculateEasterSunday(2026);

        Assert.Equal(new DateTime(2026, 4, 5), easter);
    }

    [Fact]
    public void CalculateEasterSunday_2025_ReturnsApril20()
    {
        DateTime easter = HolidaysProvider.CalculateEasterSunday(2025);

        Assert.Equal(new DateTime(2025, 4, 20), easter);
    }

    [Fact]
    public void CalculateEasterSunday_2024_ReturnsMarch31()
    {
        DateTime easter = HolidaysProvider.CalculateEasterSunday(2024);

        Assert.Equal(new DateTime(2024, 3, 31), easter);
    }

    [Fact]
    public void CalculateEasterSunday_2027_ReturnsMarch28()
    {
        DateTime easter = HolidaysProvider.CalculateEasterSunday(2027);

        Assert.Equal(new DateTime(2027, 3, 28), easter);
    }

    [Fact]
    public void CalculateFallbackHolidays_2026_ContainsAllFixedDateHolidays()
    {
        var provider = new HolidaysProvider();
        var holidays = provider.CalculateFallbackHolidays(2026);

        var expectedDates = new[]
        {
            new DateTime(2026, 1, 1),
            new DateTime(2026, 1, 23),
            new DateTime(2026, 2, 25),
            new DateTime(2026, 4, 9),
            new DateTime(2026, 5, 1),
            new DateTime(2026, 6, 12),
            new DateTime(2026, 8, 21),
            new DateTime(2026, 11, 1),
            new DateTime(2026, 11, 2),
            new DateTime(2026, 11, 30),
            new DateTime(2026, 12, 8),
            new DateTime(2026, 12, 25),
            new DateTime(2026, 12, 30),
            new DateTime(2026, 12, 31)
        };

        foreach (var date in expectedDates)
        {
            Assert.Contains(holidays, h => h.Date == date);
        }
    }

    [Fact]
    public void CalculateFallbackHolidays_2026_NationalHeroesDay_IsLastMondayOfAugust()
    {
        var provider = new HolidaysProvider();
        var holidays = provider.CalculateFallbackHolidays(2026);

        var heroesDays = holidays.Where(h => h.Name == "National Heroes Day").ToList();
        var heroesDay = Assert.Single(heroesDays);
        Assert.Equal(DayOfWeek.Monday, heroesDay.Date.DayOfWeek);
        Assert.Equal(8, heroesDay.Date.Month);
        Assert.Equal(31, heroesDay.Date.Day);
    }

    [Fact]
    public void CalculateFallbackHolidays_2026_HolyWeek_AlignsWithEaster()
    {
        var provider = new HolidaysProvider();
        var holidays = provider.CalculateFallbackHolidays(2026);
        DateTime easter = HolidaysProvider.CalculateEasterSunday(2026);

        Assert.Contains(holidays, h => h.Date == easter.AddDays(-3) && h.Name == "Maundy Thursday");
        Assert.Contains(holidays, h => h.Date == easter.AddDays(-2) && h.Name == "Good Friday");
        Assert.Contains(holidays, h => h.Date == easter.AddDays(-1) && h.Name == "Black Saturday");
        Assert.Contains(holidays, h => h.Date == easter && h.Name == "Easter Sunday");
    }

    [Fact]
    public void CalculateFallbackHolidays_2026_FixedHolidays_HaveCorrectNames()
    {
        var provider = new HolidaysProvider();
        var holidays = provider.CalculateFallbackHolidays(2026);

        var expected = new Dictionary<DateTime, string>
        {
            { new(2026, 1, 1), "New Year's Day" },
            { new(2026, 1, 23), "First Philippine Republic Day" },
            { new(2026, 2, 25), "EDSA Revolution Anniversary" },
            { new(2026, 4, 9), "Araw ng Kagitingan" },
            { new(2026, 5, 1), "Labor Day" },
            { new(2026, 6, 12), "Independence Day" },
            { new(2026, 8, 21), "Ninoy Aquino Day" },
            { new(2026, 11, 1), "All Saints' Day" },
            { new(2026, 11, 2), "All Souls' Day" },
            { new(2026, 11, 30), "Bonifacio Day" },
            { new(2026, 12, 8), "Feast of Immaculate Conception" },
            { new(2026, 12, 25), "Christmas Day" },
            { new(2026, 12, 30), "Rizal Day" },
            { new(2026, 12, 31), "Last Day of the Year" }
        };

        foreach (var (date, name) in expected)
        {
            Assert.Contains(holidays, h => h.Date == date && h.Name == name);
        }
    }
}
