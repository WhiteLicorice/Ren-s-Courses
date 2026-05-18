// wwwroot/calendar.js

/**
 * CALENDAR FILTERING LOGIC
 * * Pivoted to JS to avoid 404s on static host.
 * * Toggles visibility of events based on 'tag-{TagName}' class.
 */
window.filterCalendar = (tag) => {
    // 1. Update Buttons State
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (tag && btn.dataset.tag === tag) {
            btn.classList.add('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.remove('bg-surface', 'border-border-muted', 'text-text-dim', 'hover:border-accent/50');
        } else {
            btn.classList.remove('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.add('bg-surface', 'border-border-muted', 'text-text-dim', 'hover:border-accent/50');
        }
    });

    // 2. Filter Events (Show/Hide)
    const events = document.querySelectorAll('.calendar-event');
    events.forEach(el => {
        if (!tag) {
            el.style.display = ''; // Reset to default (block)
        } else {
            // Check if element has the class "tag-{TagName}"
            // Note: C# replaced spaces with dashes, so we must match that.
            const targetClass = `tag-${tag.replace(/\s+/g, '-')}`;

            if (el.classList.contains(targetClass)) {
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        }
    });

    // 3. Update Header Text
    const title = document.getElementById('cal-title');
    const subtitle = document.getElementById('cal-subtitle');
    const resetBtn = document.getElementById('cal-reset-btn');

    // Guard clause in case elements are missing
    if (!title || !subtitle) return;

    if (tag) {
        title.innerHTML = `<span class="text-accent">#</span>${tag}`;
        subtitle.innerHTML = `Displaying specific events for <span class="text-text-main font-semibold">${tag}</span>.`;
        if (resetBtn) resetBtn.style.display = 'flex';
    } else {
        title.innerHTML = `<span class="text-accent">./</span>Calendar`;
        // Restore default text from data attribute
        const defaultText = subtitle.getAttribute('data-default');
        subtitle.innerText = defaultText || "Displaying schedule...";
        if (resetBtn) resetBtn.style.display = 'none';
    }
};

/**
 * CALENDAR NAVIGATION LOGIC
 * Handles month switching (Previous/Next buttons).
 * Initialized via Blazor OnAfterRender or DOMContentLoaded.
 */
window.initCalendarNav = () => {
    let currentIndex = 0;
    const months = document.querySelectorAll('.month-view');
    const label = document.getElementById('month-label');

    // Exit if we are not on the calendar page or elements missing
    if (!label || months.length === 0) return;

    function updateView() {
        months.forEach(m => {
            if (parseInt(m.dataset.index) === currentIndex) {
                m.classList.remove('hidden');
                label.innerText = m.dataset.label;
            } else {
                m.classList.add('hidden');
            }
        });
    }

    // Initialize state based on the HTML rendered by Razor (find the visible one)
    months.forEach(m => {
        if (!m.classList.contains('hidden')) {
            currentIndex = parseInt(m.dataset.index);
            label.innerText = m.dataset.label;
        }
    });

    // Expose the change function to the global scope so HTML buttons can call it.
    // We attach it here because it relies on the 'currentIndex' closure above.
    window.changeMonth = function (direction) {
        let newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < months.length) {
            currentIndex = newIndex;
            updateView();
        }
    };
};

/**
 * CALENDAR EVENT POPOVER
 * Opens a floating popover showing overflow events for a given cell.
 * Reads event data from the button's data-overflow JSON attribute — no DOM traversal needed.
 * Called by the "+X more" button on calendar cells with >3 events.
 */
window.openEventPopoverFromData = (buttonEl) => {
    const popover = document.getElementById('calendar-popover');
    const titleEl = document.getElementById('calendar-popover-title');
    const eventsEl = document.getElementById('calendar-popover-events');

    if (!popover || !titleEl || !eventsEl || !buttonEl) return;

    titleEl.textContent = buttonEl.dataset.dateLabel || '';

    const overflowData = JSON.parse(buttonEl.dataset.overflow || '[]');
    eventsEl.innerHTML = '';
    overflowData.forEach(evt => {
        let el;
        if (evt.url) {
            el = document.createElement('a');
            el.href = evt.url;
            el.target = '_blank';
            el.className = `calendar-event block text-[10px] px-2 py-1 rounded-sm border-l-4 truncate cursor-pointer opacity-90 hover:opacity-100 hover:translate-x-0.5 transition-all shadow-sm ${evt.cssClass}`;
        } else {
            el = document.createElement('div');
            el.className = `calendar-event block text-[10px] px-2 py-1 rounded-sm border-l-4 truncate cursor-help opacity-90 hover:opacity-100 transition-all shadow-sm ${evt.cssClass}`;
        }
        el.title = evt.tooltip;
        const span = document.createElement('span');
        span.className = 'font-medium';
        span.textContent = evt.title;
        el.appendChild(span);
        eventsEl.appendChild(el);
    });

    // Position the popover using fixed coordinates from the button's bounding rect.
    // Prefer to open below-left; flip left/up if near viewport edges.
    const POPOVER_WIDTH = 280;
    const POPOVER_EST_HEIGHT = 280;
    const MARGIN = 8;
    const btnRect = buttonEl.getBoundingClientRect();

    let top = btnRect.bottom + MARGIN;
    let left = btnRect.left;

    if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) left = btnRect.right - POPOVER_WIDTH;
    if (left < MARGIN) left = MARGIN;
    if (top + POPOVER_EST_HEIGHT > window.innerHeight - MARGIN) top = btnRect.top - POPOVER_EST_HEIGHT - MARGIN;
    if (top < MARGIN) top = MARGIN;

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.remove('hidden');
    popover.dataset.activeCell = buttonEl.dataset.cell || '';
    buttonEl.setAttribute('aria-expanded', 'true');
};

/**
 * Closes the calendar event popover and resets ARIA state on the trigger button.
 */
window.closeEventPopover = () => {
    const popover = document.getElementById('calendar-popover');
    if (!popover) return;

    // Reset the trigger button's ARIA state
    const cellId = popover.dataset.activeCell;
    if (cellId) {
        const btn = document.querySelector(`button[data-cell="${cellId}"]`);
        if (btn) btn.setAttribute('aria-expanded', 'false');
    }

    popover.classList.add('hidden');
    popover.dataset.activeCell = '';
};

/**
 * Multi-tag calendar filter. Pure: only touches event visibility and header text.
 * Button chip state is managed separately by _updateCalendarChips().
 * Called internally by toggleCalendarTag / clearCalendarFilter.
 */
window.filterCalendarMulti = function (tags) {
    var events = document.querySelectorAll('.calendar-event');
    var title = document.getElementById('cal-title');
    var subtitle = document.getElementById('cal-subtitle');
    var resetBtn = document.getElementById('cal-reset-btn');

    if (!tags || tags.length === 0) {
        events.forEach(function (el) { el.style.display = ''; });
        if (title) title.innerHTML = '<span class="text-accent">./</span>Calendar';
        if (subtitle) {
            var defaultText = subtitle.getAttribute('data-default');
            subtitle.innerText = defaultText || 'Displaying schedule...';
        }
        if (resetBtn) resetBtn.style.display = 'none';
    } else {
        events.forEach(function (el) {
            var matches = tags.some(function (tag) {
                return el.classList.contains('tag-' + tag.replace(/\s+/g, '-'));
            });
            el.style.display = matches ? '' : 'none';
        });
        if (title) title.innerHTML = '<span class="text-accent">#</span>' + tags.join(', ');
        if (subtitle) {
            subtitle.innerHTML = 'Filtering by <span class="text-text-main font-semibold">' + tags.join(', ') + '</span>.';
        }
        if (resetBtn) resetBtn.style.display = 'flex';
    }
};

// Calendar-local multi-select filter state (not persisted, not shared with global filter)
var _calendarSelectedTags = [];

function _updateCalendarChips() {
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
        var tag = (btn.dataset.tag || '').toLowerCase();
        var active = _calendarSelectedTags.indexOf(tag) >= 0;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) {
            btn.classList.add('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.remove('bg-surface', 'border-border-muted', 'text-text-dim');
        } else {
            btn.classList.remove('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.add('bg-surface', 'border-border-muted', 'text-text-dim');
        }
    });
}

window.toggleCalendarTag = function (tag) {
    var t = tag.toLowerCase();
    var idx = _calendarSelectedTags.indexOf(t);
    if (idx >= 0) {
        _calendarSelectedTags.splice(idx, 1);
    } else {
        _calendarSelectedTags.push(t);
    }
    filterCalendarMulti(_calendarSelectedTags.length > 0 ? _calendarSelectedTags : []);
    _updateCalendarChips();
};

window.clearCalendarFilter = function () {
    _calendarSelectedTags = [];
    filterCalendarMulti([]);
    _updateCalendarChips();
};

/**
 * INITIALIZE CALENDAR POPOVER BEHAVIOUR
 * Sets up document-level listeners for closing the popover on outside click or Escape.
 */
window.initCalendarExpansion = () => {
    // Close on click outside the popover (but not on a show-more-btn, which opens it)
    document.addEventListener('click', function (e) {
        const popover = document.getElementById('calendar-popover');
        if (!popover || popover.classList.contains('hidden')) return;

        const clickedInsidePopover = popover.contains(e.target);
        const clickedShowMore = e.target.closest('.show-more-btn');
        if (!clickedInsidePopover && !clickedShowMore) {
            closeEventPopover();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeEventPopover();
    });
};