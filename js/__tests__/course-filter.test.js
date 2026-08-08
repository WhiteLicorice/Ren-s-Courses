'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../course-filter.js'), 'utf8');

// course-filter.js auto-inits on load. Reset global state between tests by reloading.
function loadScript() {
    // Reset module-level state by re-executing the script.
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildDOM(chips = [], items = []) {
    const chipHTML = chips.map(tag =>
        `<button class="course-filter-chip" data-tag="${tag}">${tag}</button>`
    ).join('');
    const clearBtn = `<button id="course-filter-clear" style="display:none">Clear</button>`;
    const itemHTML = items.map(({ tags, label }) =>
        `<div data-course-tags="${tags.join(' ')}">${label}</div>`
    ).join('');
    document.body.innerHTML = chipHTML + clearBtn + itemHTML;
}

afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    document.body.innerHTML = '';
});

// ─── initCourseFilter ─────────────────────────────────────────────────────────

describe('initCourseFilter', () => {
    test('restores saved filter from localStorage on init', () => {
        localStorage.setItem('course-filter', JSON.stringify(['cmsc-131']));
        buildDOM(['cmsc-131', 'cmsc-124'], [
            { tags: ['cmsc-131'], label: 'Item A' },
            { tags: ['cmsc-124'], label: 'Item B' },
        ]);
        loadScript();
        window.initCourseFilter();

        expect(document.querySelector('[data-course-tags="cmsc-131"]').style.display).toBe('');
        expect(document.querySelector('[data-course-tags="cmsc-124"]').style.display).toBe('none');
    });

    test('shows all items when no filter is saved', () => {
        buildDOM(['cmsc-131'], [{ tags: ['cmsc-131'], label: 'Item A' }]);
        loadScript();
        window.initCourseFilter();

        expect(document.querySelector('[data-course-tags="cmsc-131"]').style.display).toBe('');
    });
});

// ─── toggleCourseFilter ───────────────────────────────────────────────────────

describe('toggleCourseFilter', () => {
    beforeEach(() => {
        buildDOM(
            ['cmsc-131', 'cmsc-124'],
            [
                { tags: ['cmsc-131'], label: 'Item A' },
                { tags: ['cmsc-124'], label: 'Item B' },
                { tags: ['cmsc-131', 'cmsc-124'], label: 'Item C' },
            ]
        );
        loadScript();
        window.initCourseFilter();
    });

    test('toggling a tag hides non-matching items', () => {
        window.toggleCourseFilter('cmsc-131');
        expect(document.querySelector('[data-course-tags="cmsc-131"]').style.display).toBe('');
        expect(document.querySelector('[data-course-tags="cmsc-124"]').style.display).toBe('none');
    });

    test('toggling same tag twice restores all items', () => {
        window.toggleCourseFilter('cmsc-131');
        window.toggleCourseFilter('cmsc-131');
        document.querySelectorAll('[data-course-tags]').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('two active tags show union of matching items', () => {
        window.toggleCourseFilter('cmsc-131');
        window.toggleCourseFilter('cmsc-124');
        document.querySelectorAll('[data-course-tags]').forEach(el => {
            expect(el.style.display).toBe('');
        });
    });

    test('persists selection to localStorage', () => {
        window.toggleCourseFilter('cmsc-131');
        const stored = JSON.parse(localStorage.getItem('course-filter'));
        expect(stored).toContain('cmsc-131');
    });

    test('tag comparison is case-insensitive', () => {
        window.toggleCourseFilter('CMSC-131');
        expect(document.querySelector('[data-course-tags="cmsc-131"]').style.display).toBe('');
    });

    test('active chip gets accent class', () => {
        window.toggleCourseFilter('cmsc-131');
        const chip = document.querySelector('[data-tag="cmsc-131"]');
        expect(chip.classList.contains('bg-accent-dim')).toBe(true);
    });

    test('inactive chip loses accent class', () => {
        window.toggleCourseFilter('cmsc-131');
        window.toggleCourseFilter('cmsc-131');
        const chip = document.querySelector('[data-tag="cmsc-131"]');
        expect(chip.classList.contains('bg-accent-dim')).toBe(false);
    });

    test('clear button becomes visible when a tag is active', () => {
        window.toggleCourseFilter('cmsc-131');
        expect(document.getElementById('course-filter-clear').style.display).toBe('inline-flex');
    });
});

// ─── clearCourseFilter ────────────────────────────────────────────────────────

describe('clearCourseFilter', () => {
    beforeEach(() => {
        buildDOM(
            ['cmsc-131'],
            [{ tags: ['cmsc-131'], label: 'Item A' }]
        );
        loadScript();
        window.initCourseFilter();
        window.toggleCourseFilter('cmsc-131');
    });

    test('shows all items after clear', () => {
        window.clearCourseFilter();
        expect(document.querySelector('[data-course-tags="cmsc-131"]').style.display).toBe('');
    });

    test('persists empty selection to localStorage', () => {
        window.clearCourseFilter();
        const stored = JSON.parse(localStorage.getItem('course-filter'));
        expect(stored).toEqual([]);
    });

    test('hide clear button after clear', () => {
        window.clearCourseFilter();
        expect(document.getElementById('course-filter-clear').style.display).toBe('none');
    });
});
