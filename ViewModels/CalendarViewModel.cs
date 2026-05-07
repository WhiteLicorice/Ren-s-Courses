using System.Text.Json;
using BlazorStaticMinimalBlog.Models;

namespace BlazorStaticMinimalBlog.ViewModels;

public class CalendarViewModel
{
    public record MonthData(
        DateTime Month,
        string Label,
        bool IsCurrent,
        List<WeekRow> Weeks,
        List<DayListEntry> MobileEntries
    );

    public record WeekRow(List<DayCell?> Days);

    public record DayCell(
        DateTime Date,
        bool IsToday,
        bool IsWeekend,
        List<CalendarEvent> VisibleEvents,
        List<CalendarEvent> OverflowEvents,
        string CellId,
        string OverflowJson,
        string DateLabel
    );

    public record DayListEntry(
        DateTime Date,
        bool IsToday,
        List<CalendarEvent> Events
    );

    public List<MonthData> Months { get; }

    private CalendarViewModel(List<MonthData> months) => Months = months;

    public static CalendarViewModel Build(
        List<CalendarEvent> allEvents,
        DateTime termStart,
        DateTime termEnd,
        DateTime localNow)
    {
        var lookup = BuildLookup(allEvents);
        var monthDates = GenerateMonthDates(termStart, termEnd);
        int currentIdx = ResolveCurrentMonthIndex(monthDates, localNow);

        var months = new List<MonthData>(monthDates.Count);
        for (int i = 0; i < monthDates.Count; i++)
        {
            var month = monthDates[i];
            months.Add(new MonthData(
                month,
                month.ToString("MMMM yyyy"),
                i == currentIdx,
                BuildWeeks(month, localNow, lookup),
                BuildMobileEntries(month, localNow, lookup)
            ));
        }

        return new CalendarViewModel(months);
    }

    private static Dictionary<DateTime, List<CalendarEvent>> BuildLookup(List<CalendarEvent> allEvents)
    {
        var lookup = new Dictionary<DateTime, List<CalendarEvent>>();
        foreach (var evt in allEvents)
        {
            var key = evt.Date.Date;
            if (!lookup.TryGetValue(key, out var list))
                lookup[key] = list = [];
            list.Add(evt);
        }
        foreach (var key in lookup.Keys.ToList())
            lookup[key] = lookup[key].OrderBy(e => e.Type).ToList();
        return lookup;
    }

    private static List<DateTime> GenerateMonthDates(DateTime termStart, DateTime termEnd)
    {
        var months = new List<DateTime>();
        var first = new DateTime(termStart.Year, termStart.Month, 1);
        var last = new DateTime(termEnd.Year, termEnd.Month, 1);
        for (var m = first; m <= last; m = m.AddMonths(1))
            months.Add(m);
        return months;
    }

    // Internal for test access via InternalsVisibleTo
    internal static int ResolveCurrentMonthIndex(List<DateTime> months, DateTime localNow)
    {
        int idx = months.FindIndex(m => localNow >= m && localNow < m.AddMonths(1));
        return idx >= 0 ? idx : 0;
    }

    private static List<WeekRow> BuildWeeks(
        DateTime month,
        DateTime localNow,
        Dictionary<DateTime, List<CalendarEvent>> lookup)
    {
        const int TotalCells = 42;
        var cells = new List<DayCell?>(TotalCells);
        int daysInMonth = DateTime.DaysInMonth(month.Year, month.Month);
        int startOffset = (int)new DateTime(month.Year, month.Month, 1).DayOfWeek;

        for (int i = 0; i < startOffset; i++)
            cells.Add(null);

        for (int day = 1; day <= daysInMonth; day++)
        {
            var date = new DateTime(month.Year, month.Month, day);
            var events = lookup.GetValueOrDefault(date.Date, []);
            var visible = events.Take(3).ToList();
            var overflow = events.Skip(3).ToList();
            cells.Add(new DayCell(
                date,
                date.Date == localNow.Date,
                date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday,
                visible,
                overflow,
                $"cell-{month.Year}-{month.Month}-{day}",
                overflow.Count > 0 ? SerializeOverflow(overflow) : "[]",
                date.ToString("dddd, MMMM d")
            ));
        }

        while (cells.Count < TotalCells)
            cells.Add(null);

        var weeks = new List<WeekRow>(6);
        for (int i = 0; i < TotalCells; i += 7)
            weeks.Add(new WeekRow(cells.GetRange(i, 7)));
        return weeks;
    }

    private static List<DayListEntry> BuildMobileEntries(
        DateTime month,
        DateTime localNow,
        Dictionary<DateTime, List<CalendarEvent>> lookup)
    {
        int daysInMonth = DateTime.DaysInMonth(month.Year, month.Month);
        var entries = new List<DayListEntry>();
        for (int day = 1; day <= daysInMonth; day++)
        {
            var date = new DateTime(month.Year, month.Month, day);
            var events = lookup.GetValueOrDefault(date.Date, []);
            bool isToday = date.Date == localNow.Date;
            if (events.Count > 0 || isToday)
                entries.Add(new DayListEntry(date, isToday, events));
        }
        return entries;
    }

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private static string SerializeOverflow(List<CalendarEvent> overflow)
        => JsonSerializer.Serialize(
            overflow.Select(e => new { e.Title, Url = e.Url ?? "", e.CssClass, e.Tooltip }),
            _jsonOptions);
}
