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