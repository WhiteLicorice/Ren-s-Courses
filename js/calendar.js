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
 * Uses position:fixed to avoid affecting grid cell or row dimensions.
 * Called by the "+X more" button on calendar cells with >3 events.
 */
window.openEventPopover = (cellId, buttonEl) => {
    const cell = document.getElementById(cellId);
    const popover = document.getElementById('calendar-popover');
    const titleEl = document.getElementById('calendar-popover-title');
    const eventsEl = document.getElementById('calendar-popover-events');

    if (!cell || !popover || !titleEl || !eventsEl || !buttonEl) return;

    // The overflow-events div is a sibling of the events list inside the cell wrapper
    const overflowDiv = cell.parentElement.querySelector('.overflow-events');
    if (!overflowDiv) return;

    // Set the date label from the data attribute (e.g. "Tuesday, February 3")
    titleEl.textContent = overflowDiv.dataset.date || '';

    // Clone overflow event nodes into the popover events list
    eventsEl.innerHTML = '';
    Array.from(overflowDiv.children).forEach(child => {
        eventsEl.appendChild(child.cloneNode(true));
    });

    // Position the popover using fixed coordinates from the button's bounding rect.
    // Prefer to open below-left; flip left/up if near viewport edges.
    const POPOVER_WIDTH = 280;
    const POPOVER_EST_HEIGHT = 280;
    const MARGIN = 8;
    const btnRect = buttonEl.getBoundingClientRect();

    let top = btnRect.bottom + MARGIN;
    let left = btnRect.left;

    if (left + POPOVER_WIDTH > window.innerWidth - MARGIN) {
        left = btnRect.right - POPOVER_WIDTH;
    }
    if (left < MARGIN) {
        left = MARGIN;
    }
    if (top + POPOVER_EST_HEIGHT > window.innerHeight - MARGIN) {
        top = btnRect.top - POPOVER_EST_HEIGHT - MARGIN;
    }
    if (top < MARGIN) {
        top = MARGIN;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.classList.remove('hidden');
    popover.dataset.activeCell = cellId;

    // Update button ARIA state
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