'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../calendar.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildCalendarDOM() {
    document.body.innerHTML = `
        <div id="cal-title">./Calendar</div>
        <div id="cal-subtitle" data-default="Displaying schedule...">Displaying schedule...</div>
        <button id="cal-reset-btn" style="display:none">Reset</button>
        <button class="filter-btn" data-tag="holiday">Holiday</button>
        <button class="filter-btn" data-tag="deadline">Deadline</button>
        <div class="calendar-event tag-holiday">Holiday event</div>
        <div class="calendar-event tag-deadline">Deadline event</div>
        <div class="calendar-event tag-holiday tag-deadline">Both</div>
    `;
}

function buildCalendarNavDOM() {
    document.body.innerHTML = `
        <div id="month-label">Month</div>
        <div class="month-view" data-index="0" data-label="January 2026"></div>
        <div class="month-view hidden" data-index="1" data-label="February 2026"></div>
        <div class="month-view hidden" data-index="2" data-label="March 2026"></div>
    `;
}

afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';
});

// ─── filterCalendar ───────────────────────────────────────────────────────────

describe('filterCalendar', () => {
    beforeEach(() => {
        buildCalendarDOM();
        loadScript();
    });

    test('hides non-matching events for a given tag', () => {
        window.filterCalendar('holiday');
        expect(document.querySelector('.tag-deadline:not(.tag-holiday)').style.display).toBe('none');
    });

    test('shows matching events for a given tag', () => {
        window.filterCalendar('holiday');
        expect(document.querySelector('.tag-holiday:not(.tag-deadline)').style.display).toBe('');
    });

    test('null tag restores all events', () => {
        window.filterCalendar('holiday');
        window.filterCalendar(null);
        document.querySelectorAll('.calendar-event').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('activates the matching filter button', () => {
        window.filterCalendar('holiday');
        const btn = document.querySelector('[data-tag="holiday"]');
        expect(btn.classList.contains('bg-accent-dim')).toBe(true);
    });

    test('deactivates other filter buttons', () => {
        window.filterCalendar('holiday');
        const btn = document.querySelector('[data-tag="deadline"]');
        expect(btn.classList.contains('bg-accent-dim')).toBe(false);
    });

    test('updates cal-title when tag is set', () => {
        window.filterCalendar('holiday');
        expect(document.getElementById('cal-title').innerHTML).toContain('holiday');
    });

    test('resets cal-title when tag is null', () => {
        window.filterCalendar('holiday');
        window.filterCalendar(null);
        expect(document.getElementById('cal-title').innerHTML).toContain('./');
    });

    test('shows reset button when tag is set', () => {
        window.filterCalendar('holiday');
        expect(document.getElementById('cal-reset-btn').style.display).toBe('flex');
    });

    test('hides reset button when tag is null', () => {
        window.filterCalendar(null);
        expect(document.getElementById('cal-reset-btn').style.display).toBe('none');
    });
});

// ─── filterCalendarMulti ──────────────────────────────────────────────────────

describe('filterCalendarMulti', () => {
    beforeEach(() => {
        buildCalendarDOM();
        loadScript();
    });

    test('empty array restores all events', () => {
        window.filterCalendarMulti([]);
        document.querySelectorAll('.calendar-event').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('single tag hides non-matching events', () => {
        window.filterCalendarMulti(['holiday']);
        expect(document.querySelector('.tag-deadline:not(.tag-holiday)').style.display).toBe('none');
    });

    test('multiple tags show union of matches', () => {
        window.filterCalendarMulti(['holiday', 'deadline']);
        document.querySelectorAll('.calendar-event').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('updates cal-title with active tags', () => {
        window.filterCalendarMulti(['holiday', 'deadline']);
        expect(document.getElementById('cal-title').innerHTML).toContain('holiday');
    });
});

// ─── toggleCalendarTag / clearCalendarFilter ──────────────────────────────────

describe('toggleCalendarTag', () => {
    beforeEach(() => {
        buildCalendarDOM();
        loadScript();
    });

    test('toggling a tag hides non-matching events', () => {
        window.toggleCalendarTag('holiday');
        expect(document.querySelector('.tag-deadline:not(.tag-holiday)').style.display).toBe('none');
    });

    test('toggling same tag twice restores all events', () => {
        window.toggleCalendarTag('holiday');
        window.toggleCalendarTag('holiday');
        document.querySelectorAll('.calendar-event').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('active chip gets accent class', () => {
        window.toggleCalendarTag('holiday');
        expect(document.querySelector('[data-tag="holiday"]').classList.contains('bg-accent-dim')).toBe(true);
    });
});

describe('clearCalendarFilter', () => {
    beforeEach(() => {
        buildCalendarDOM();
        loadScript();
        window.toggleCalendarTag('holiday');
    });

    test('restores all events', () => {
        window.clearCalendarFilter();
        document.querySelectorAll('.calendar-event').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('deactivates all chips', () => {
        window.clearCalendarFilter();
        document.querySelectorAll('.filter-btn').forEach(btn => {
            expect(btn.classList.contains('bg-accent-dim')).toBe(false);
        });
    });
});

// ─── initCalendarNav ──────────────────────────────────────────────────────────

describe('initCalendarNav', () => {
    beforeEach(() => {
        buildCalendarNavDOM();
        loadScript();
        window.initCalendarNav();
    });

    test('no-op when month-label is absent', () => {
        document.body.innerHTML = '';
        loadScript();
        expect(() => window.initCalendarNav()).not.toThrow();
    });

    test('changeMonth(1) moves to next month', () => {
        window.changeMonth(1);
        expect(document.querySelector('[data-index="1"]').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('month-label').innerText).toBe('February 2026');
    });

    test('changeMonth(-1) does not go below index 0', () => {
        window.changeMonth(-1);
        expect(document.querySelector('[data-index="0"]').classList.contains('hidden')).toBe(false);
    });

    test('changeMonth past last index is a no-op', () => {
        window.changeMonth(1);
        window.changeMonth(1);
        window.changeMonth(1); // index 3 out of range
        expect(document.querySelector('[data-index="2"]').classList.contains('hidden')).toBe(false);
    });
});

// ─── openEventPopoverFromData / closeEventPopover ─────────────────────────────

describe('openEventPopoverFromData', () => {
    function buildPopoverDOM() {
        document.body.innerHTML = `
            <div id="calendar-popover" class="hidden" style="position:fixed">
                <div id="calendar-popover-title"></div>
                <div id="calendar-popover-events"></div>
            </div>
            <button class="show-more-btn"
                data-cell="2026-01-05"
                data-date-label="January 5"
                data-overflow='[{"title":"Event 1","tooltip":"Tip","cssClass":"bg-red"},{"title":"Event 2","url":"https://example.com","tooltip":"Tip2","cssClass":"bg-blue"}]'>
                +2 more
            </button>
        `;
    }

    beforeEach(() => {
        buildPopoverDOM();
        loadScript();
        // Stub getBoundingClientRect for jsdom.
        Element.prototype.getBoundingClientRect = jest.fn(() => ({
            top: 100, bottom: 120, left: 50, right: 150, width: 100, height: 20,
        }));
        Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
    });

    test('removes "hidden" class from popover', () => {
        const btn = document.querySelector('.show-more-btn');
        window.openEventPopoverFromData(btn);
        expect(document.getElementById('calendar-popover').classList.contains('hidden')).toBe(false);
    });

    test('sets popover title from data-date-label', () => {
        window.openEventPopoverFromData(document.querySelector('.show-more-btn'));
        expect(document.getElementById('calendar-popover-title').textContent).toBe('January 5');
    });

    test('renders overflow events in the popover', () => {
        window.openEventPopoverFromData(document.querySelector('.show-more-btn'));
        expect(document.getElementById('calendar-popover-events').children.length).toBe(2);
    });

    test('renders linked events as <a> elements', () => {
        window.openEventPopoverFromData(document.querySelector('.show-more-btn'));
        const links = document.querySelectorAll('#calendar-popover-events a');
        expect(links.length).toBe(1);
    });

    test('sets aria-expanded="true" on trigger button', () => {
        const btn = document.querySelector('.show-more-btn');
        window.openEventPopoverFromData(btn);
        expect(btn.getAttribute('aria-expanded')).toBe('true');
    });

    test('no-op when buttonEl is null', () => {
        expect(() => window.openEventPopoverFromData(null)).not.toThrow();
    });
});

describe('closeEventPopover', () => {
    function buildOpenPopoverDOM() {
        document.body.innerHTML = `
            <div id="calendar-popover" data-active-cell="2026-01-05">
                <div id="calendar-popover-title"></div>
                <div id="calendar-popover-events"></div>
            </div>
            <button data-cell="2026-01-05" aria-expanded="true"></button>
        `;
    }

    beforeEach(() => {
        buildOpenPopoverDOM();
        loadScript();
    });

    test('adds "hidden" class to popover', () => {
        window.closeEventPopover();
        expect(document.getElementById('calendar-popover').classList.contains('hidden')).toBe(true);
    });

    test('sets aria-expanded="false" on the active trigger button', () => {
        window.closeEventPopover();
        expect(document.querySelector('[data-cell="2026-01-05"]').getAttribute('aria-expanded')).toBe('false');
    });

    test('clears data-active-cell', () => {
        window.closeEventPopover();
        expect(document.getElementById('calendar-popover').dataset.activeCell).toBe('');
    });

    test('no-op when popover element is absent', () => {
        document.body.innerHTML = '';
        expect(() => window.closeEventPopover()).not.toThrow();
    });
});
