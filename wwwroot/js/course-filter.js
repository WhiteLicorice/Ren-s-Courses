// course-filter.js
// Client-side course filter. State lives in localStorage; Blazor SSR renders
// the chip buttons and data-course-tags attributes on filterable elements.

var _selectedTags = [];
var FILTER_KEY = 'course-filter';

function _readStoredFilter() {
    try {
        var stored = localStorage.getItem(FILTER_KEY);
        if (stored) {
            var parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                return parsed.map(function (t) { return t.toLowerCase(); });
            }
        }
    } catch (e) { }
    return [];
}

function _persist() {
    try { localStorage.setItem(FILTER_KEY, JSON.stringify(_selectedTags)); } catch (e) { }
}

function _updateChips() {
    document.querySelectorAll('.course-filter-chip').forEach(function (btn) {
        var tag = (btn.dataset.tag || '').toLowerCase();
        var active = _selectedTags.indexOf(tag) >= 0;
        if (active) {
            btn.classList.add('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.remove('border-border-muted', 'text-text-dim', 'bg-surface');
        } else {
            btn.classList.remove('bg-accent-dim', 'border-accent', 'text-accent', 'scale-105', 'shadow-lg');
            btn.classList.add('border-border-muted', 'text-text-dim', 'bg-surface');
        }
    });

    var clearBtn = document.getElementById('course-filter-clear');
    if (clearBtn) {
        clearBtn.style.display = _selectedTags.length > 0 ? 'inline-flex' : 'none';
    }
}

function _applyFilter() {
    var active = _selectedTags.length > 0;

    // Show/hide all elements tagged with data-course-tags
    document.querySelectorAll('[data-course-tags]').forEach(function (el) {
        if (!active) {
            el.style.display = '';
            return;
        }
        var elTags = (el.getAttribute('data-course-tags') || '').toLowerCase().split(' ').filter(Boolean);
        var matches = _selectedTags.some(function (t) { return elTags.indexOf(t) >= 0; });
        el.style.display = matches ? '' : 'none';
    });

}

window.initCourseFilter = function () {
    _selectedTags = _readStoredFilter();
    _updateChips();
    _applyFilter();
};

window.toggleCourseFilter = function (tag) {
    var t = tag.toLowerCase();
    var idx = _selectedTags.indexOf(t);
    if (idx >= 0) {
        _selectedTags.splice(idx, 1);
    } else {
        _selectedTags.push(t);
    }
    _persist();
    _updateChips();
    _applyFilter();
};

window.clearCourseFilter = function () {
    _selectedTags = [];
    _persist();
    _updateChips();
    _applyFilter();
};

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initCourseFilter);
} else {
    window.initCourseFilter();
}
