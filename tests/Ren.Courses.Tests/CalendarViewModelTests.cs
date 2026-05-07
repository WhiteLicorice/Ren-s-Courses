using BlazorStaticMinimalBlog.ViewModels;

namespace BlazorStaticMinimalBlog.Tests;

// No [Collection("BuildTimeProvider")] needed — CalendarViewModel.Build() takes explicit params.
public class CalendarViewModelTests
{
    private static readonly DateTime TermStart = new(2026, 3, 1);
    private static readonly DateTime TermEnd = new(2026, 3, 31);
    private static readonly DateTime LocalNow = new(2026, 3, 15, 10, 0, 0);

    private static CalendarEvent MakeEvent(
        DateTime date,
        EventType type = EventType.Custom,
        string title = "Event",
        string? url = null,
        string cssClass = "",
        string tooltip = "") =>
        new() { Title = title, Date = date, Type = type, CssClass = cssClass, Tooltip = tooltip, Url = url };

    private static CalendarViewModel.DayCell? FindCell(CalendarViewModel.MonthData month, DateTime date) =>
        month.Weeks.SelectMany(w => w.Days).OfType<CalendarViewModel.DayCell>()
             .FirstOrDefault(c => c.Date.Date == date.Date);

    // ---- Month generation ----

    [Fact]
    public void Build_SingleMonthTerm_ReturnsOneMonth()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        Assert.Single(vm.Months);
        Assert.Equal("March 2026", vm.Months[0].Label);
    }

    [Fact]
    public void Build_DecToJanTerm_ReturnsTwoMonthsHandlesYearBoundary()
    {
        var start = new DateTime(2025, 12, 1);
        var end = new DateTime(2026, 1, 31);
        var now = new DateTime(2026, 1, 10);

        var vm = CalendarViewModel.Build([], start, end, now);

        Assert.Equal(2, vm.Months.Count);
        Assert.Equal("December 2025", vm.Months[0].Label);
        Assert.Equal("January 2026", vm.Months[1].Label);
    }

    [Fact]
    public void Build_MultiMonthTerm_ReturnsCorrectCount()
    {
        var start = new DateTime(2026, 1, 1);
        var end = new DateTime(2026, 5, 31);
        var now = new DateTime(2026, 3, 1);

        var vm = CalendarViewModel.Build([], start, end, now);

        Assert.Equal(5, vm.Months.Count);
    }

    // ---- Current month detection ----

    [Fact]
    public void Build_LocalNowInMiddleMonth_CorrectMonthIsCurrent()
    {
        var start = new DateTime(2026, 1, 1);
        var end = new DateTime(2026, 3, 31);
        var now = new DateTime(2026, 2, 15);

        var vm = CalendarViewModel.Build([], start, end, now);

        Assert.False(vm.Months[0].IsCurrent); // January
        Assert.True(vm.Months[1].IsCurrent);  // February
        Assert.False(vm.Months[2].IsCurrent); // March
    }

    [Fact]
    public void Build_LocalNowBeforeTerm_FirstMonthIsCurrent()
    {
        var start = new DateTime(2026, 3, 1);
        var end = new DateTime(2026, 5, 31);
        var now = new DateTime(2026, 1, 1);

        var vm = CalendarViewModel.Build([], start, end, now);

        Assert.True(vm.Months[0].IsCurrent);
        Assert.All(vm.Months.Skip(1), m => Assert.False(m.IsCurrent));
    }

    [Fact]
    public void Build_LocalNowAfterTerm_FirstMonthIsCurrent()
    {
        var start = new DateTime(2026, 1, 1);
        var end = new DateTime(2026, 3, 31);
        var now = new DateTime(2026, 6, 1);

        var vm = CalendarViewModel.Build([], start, end, now);

        Assert.True(vm.Months[0].IsCurrent);
        Assert.All(vm.Months.Skip(1), m => Assert.False(m.IsCurrent));
    }

    [Fact]
    public void Build_ExactlyOneMonthIsCurrentAlways()
    {
        var vm = CalendarViewModel.Build([], TermStart, new DateTime(2026, 5, 31), LocalNow);

        Assert.Equal(1, vm.Months.Count(m => m.IsCurrent));
    }

    [Fact]
    public void ResolveCurrentMonthIndex_LocalNowInTerm_ReturnsCorrectIndex()
    {
        var months = new List<DateTime>
        {
            new(2026, 1, 1),
            new(2026, 2, 1),
            new(2026, 3, 1)
        };
        var now = new DateTime(2026, 2, 20);

        int idx = CalendarViewModel.ResolveCurrentMonthIndex(months, now);

        Assert.Equal(1, idx);
    }

    [Fact]
    public void ResolveCurrentMonthIndex_LocalNowOutsideTerm_ReturnsFallbackZero()
    {
        var months = new List<DateTime> { new(2026, 3, 1), new(2026, 4, 1) };
        var now = new DateTime(2026, 1, 1);

        int idx = CalendarViewModel.ResolveCurrentMonthIndex(months, now);

        Assert.Equal(0, idx);
    }

    // ---- Desktop grid structure ----

    [Fact]
    public void Build_DesktopGrid_AlwaysSixWeekRows()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        Assert.Equal(6, vm.Months[0].Weeks.Count);
    }

    [Fact]
    public void Build_DesktopGrid_EachWeekHasSevenCells()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        Assert.All(vm.Months[0].Weeks, week => Assert.Equal(7, week.Days.Count));
    }

    [Fact]
    public void Build_EmptyEvents_AllDayCellsHaveNoEvents()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);
        var dayCells = vm.Months[0].Weeks.SelectMany(w => w.Days).OfType<CalendarViewModel.DayCell>();

        Assert.All(dayCells, cell =>
        {
            Assert.Empty(cell.VisibleEvents);
            Assert.Empty(cell.OverflowEvents);
        });
    }

    // ---- Event bucketing ----

    [Fact]
    public void Build_OneEventOnDay15_AppearsInCorrectCell()
    {
        var eventDate = new DateTime(2026, 3, 15);
        var events = new List<CalendarEvent> { MakeEvent(eventDate, title: "Test Event") };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], eventDate);
        Assert.NotNull(cell);
        Assert.Single(cell.VisibleEvents);
        Assert.Equal("Test Event", cell.VisibleEvents[0].Title);
        Assert.Empty(cell.OverflowEvents);
    }

    [Fact]
    public void Build_FiveEventsOnDay1_SplitsThreeVisibleTwoOverflow()
    {
        var date = new DateTime(2026, 3, 1);
        var events = Enumerable.Range(1, 5).Select(i => MakeEvent(date, title: $"Event {i}")).ToList();

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], date);
        Assert.NotNull(cell);
        Assert.Equal(3, cell.VisibleEvents.Count);
        Assert.Equal(2, cell.OverflowEvents.Count);
    }

    [Fact]
    public void Build_ThreeEventsOnDay1_NoOverflow()
    {
        var date = new DateTime(2026, 3, 1);
        var events = Enumerable.Range(1, 3).Select(i => MakeEvent(date, title: $"Event {i}")).ToList();

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], date);
        Assert.NotNull(cell);
        Assert.Equal(3, cell.VisibleEvents.Count);
        Assert.Empty(cell.OverflowEvents);
    }

    [Fact]
    public void Build_EventsOnDifferentDates_EachAppearsInCorrectCell()
    {
        var date1 = new DateTime(2026, 3, 5);
        var date2 = new DateTime(2026, 3, 20);
        var events = new List<CalendarEvent>
        {
            MakeEvent(date1, title: "Event A"),
            MakeEvent(date2, title: "Event B")
        };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell1 = FindCell(vm.Months[0], date1);
        var cell2 = FindCell(vm.Months[0], date2);

        Assert.Single(cell1!.VisibleEvents);
        Assert.Equal("Event A", cell1.VisibleEvents[0].Title);
        Assert.Single(cell2!.VisibleEvents);
        Assert.Equal("Event B", cell2.VisibleEvents[0].Title);
    }

    [Fact]
    public void Build_EventsOnSameDate_OrderedByEventType()
    {
        var date = new DateTime(2026, 3, 10);
        var events = new List<CalendarEvent>
        {
            MakeEvent(date, EventType.Defense),
            MakeEvent(date, EventType.Holiday),
            MakeEvent(date, EventType.Deadline),
        };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], date);
        Assert.NotNull(cell);
        // EventType enum: Holiday=0, Release=1, Deadline=2, Progress=3, Defense=4, Custom=5
        Assert.Equal(EventType.Holiday, cell.VisibleEvents[0].Type);
        Assert.Equal(EventType.Deadline, cell.VisibleEvents[1].Type);
        Assert.Equal(EventType.Defense, cell.VisibleEvents[2].Type);
    }

    [Fact]
    public void Build_EventOnLastDayOfMonth_AppearsCorrectly()
    {
        var lastDay = new DateTime(2026, 3, 31);
        var events = new List<CalendarEvent> { MakeEvent(lastDay, title: "Last Day") };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], lastDay);
        Assert.NotNull(cell);
        Assert.Single(cell.VisibleEvents);
    }

    // ---- Overflow JSON ----

    [Fact]
    public void Build_NoOverflow_OverflowJsonIsEmptyArray()
    {
        var events = new List<CalendarEvent> { MakeEvent(new DateTime(2026, 3, 1)) };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], new DateTime(2026, 3, 1));
        Assert.Equal("[]", cell!.OverflowJson);
    }

    [Fact]
    public void Build_WithOverflow_OverflowJsonContainsTitleAndCssClass()
    {
        var date = new DateTime(2026, 3, 1);
        var events = Enumerable.Range(1, 5)
            .Select(i => new CalendarEvent
            {
                Title = $"E{i}",
                Date = date,
                Type = EventType.Custom,
                CssClass = $"css-{i}",
                Tooltip = $"tip-{i}"
            })
            .ToList();

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], date);
        Assert.NotNull(cell);
        Assert.Contains("E4", cell.OverflowJson);
        Assert.Contains("E5", cell.OverflowJson);
        Assert.Contains("css-4", cell.OverflowJson);
    }

    // ---- DayCell properties ----

    [Fact]
    public void Build_TodayCell_IsTodayTrue()
    {
        var today = new DateTime(2026, 3, 15, 12, 0, 0);

        var vm = CalendarViewModel.Build([], TermStart, TermEnd, today);

        var cell = FindCell(vm.Months[0], today);
        Assert.NotNull(cell);
        Assert.True(cell.IsToday);
    }

    [Fact]
    public void Build_WeekendCell_IsWeekendTrue()
    {
        // March 1 2026 is a Sunday
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        var sunday = FindCell(vm.Months[0], new DateTime(2026, 3, 1));
        var saturday = FindCell(vm.Months[0], new DateTime(2026, 3, 7));
        var monday = FindCell(vm.Months[0], new DateTime(2026, 3, 2));

        Assert.True(sunday!.IsWeekend);
        Assert.True(saturday!.IsWeekend);
        Assert.False(monday!.IsWeekend);
    }

    [Fact]
    public void Build_CellId_FollowsExpectedPattern()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        var cell = FindCell(vm.Months[0], new DateTime(2026, 3, 15));
        Assert.Equal("cell-2026-3-15", cell!.CellId);
    }

    [Fact]
    public void Build_DateLabel_FollowsExpectedFormat()
    {
        var vm = CalendarViewModel.Build([], TermStart, TermEnd, LocalNow);

        // March 15 2026 is a Sunday
        var cell = FindCell(vm.Months[0], new DateTime(2026, 3, 15));
        Assert.Equal("Sunday, March 15", cell!.DateLabel);
    }

    // ---- Mobile entries ----

    [Fact]
    public void Build_Mobile_OnlyIncludesDaysWithEventsOrToday()
    {
        var today = new DateTime(2026, 3, 15);
        var eventDate = new DateTime(2026, 3, 10);
        var events = new List<CalendarEvent> { MakeEvent(eventDate) };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, today);

        var entries = vm.Months[0].MobileEntries;
        Assert.Equal(2, entries.Count);
        Assert.Contains(entries, e => e.Date.Day == 10);
        Assert.Contains(entries, e => e.Date.Day == 15);
    }

    [Fact]
    public void Build_Mobile_TodayWithNoEventsStillAppears()
    {
        var today = new DateTime(2026, 3, 20);

        var vm = CalendarViewModel.Build([], TermStart, TermEnd, today);

        var entries = vm.Months[0].MobileEntries;
        Assert.Single(entries);
        Assert.True(entries[0].IsToday);
        Assert.Equal(20, entries[0].Date.Day);
        Assert.Empty(entries[0].Events);
    }

    [Fact]
    public void Build_Mobile_EmptyMonthOutsideTermHasNoEntries()
    {
        var today = new DateTime(2026, 5, 1); // outside March term

        var vm = CalendarViewModel.Build([], TermStart, TermEnd, today);

        Assert.Empty(vm.Months[0].MobileEntries);
    }

    [Fact]
    public void Build_Mobile_AllEventTypesAppear()
    {
        var date = new DateTime(2026, 3, 10);
        var events = new List<CalendarEvent>
        {
            MakeEvent(date, EventType.Holiday, "PH Holiday"),
            MakeEvent(date, EventType.Deadline, "HW1"),
            MakeEvent(date, EventType.Release, "MP1"),
            MakeEvent(date, EventType.Progress, "MP1 Progress"),
            MakeEvent(date, EventType.Defense, "MP1 Defense"),
        };

        var vm = CalendarViewModel.Build(events, TermStart, TermEnd, LocalNow);

        var entry = vm.Months[0].MobileEntries.Single(e => e.Date.Day == 10);
        Assert.Equal(5, entry.Events.Count);
        Assert.Contains(entry.Events, e => e.Type == EventType.Holiday);
        Assert.Contains(entry.Events, e => e.Type == EventType.Deadline);
        Assert.Contains(entry.Events, e => e.Type == EventType.Release);
        Assert.Contains(entry.Events, e => e.Type == EventType.Progress);
        Assert.Contains(entry.Events, e => e.Type == EventType.Defense);
    }
}
