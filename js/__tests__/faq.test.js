'use strict';

const fs = require('fs');
const path = require('path');

const faqSource = fs.readFileSync(path.join(__dirname, '../faq.js'), 'utf8');

function loadFaqScript() {
    // eslint-disable-next-line no-new-func
    new Function(faqSource)();
}

function buildDOM() {
    document.body.innerHTML = `
        <nav>
            <a data-faq-target="q-what-is-cmsc">What is CMSC?</a>
            <a data-faq-target="q-how-to-enroll">How to enroll?</a>
        </nav>
        <details id="q-what-is-cmsc">
            <summary>What is CMSC?</summary>
            <p>Computer Science.</p>
        </details>
        <details id="q-how-to-enroll">
            <summary>How to enroll?</summary>
            <p>Visit the registrar.</p>
        </details>
    `;
}

// Call the real pushState (bypasses any active jest.spyOn mock on pushState).
function realPushState(url) {
    Object.getPrototypeOf(window.history).pushState.call(window.history, {}, '', url);
}

afterEach(() => {
    jest.restoreAllMocks();
    window.history.pushState({}, '', '/');
});

// ─── replaceState vs pushState ────────────────────────────────────────────────

describe('initFaqToc — replaceState vs pushState', () => {
    let replaceStateSpy;
    let pushStateSpy;

    beforeEach(() => {
        window.history.pushState({}, '', '/'); // ensure no hash before mocking
        buildDOM();
        jest.useFakeTimers();
        Element.prototype.scrollIntoView = jest.fn();
        replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        pushStateSpy    = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadFaqScript();
        window.initFaqToc();
    });

    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
        // Note: global afterEach handles restoreAllMocks + URL reset.
    });

    test('clicking a FAQ TOC link calls replaceState', () => {
        document.querySelector('[data-faq-target="q-what-is-cmsc"]').click();
        expect(replaceStateSpy).toHaveBeenCalledWith(null, null, '#q-what-is-cmsc');
    });

    test('clicking a FAQ TOC link does NOT call pushState', () => {
        document.querySelector('[data-faq-target="q-what-is-cmsc"]').click();
        expect(pushStateSpy).not.toHaveBeenCalled();
    });

    test('clicking a link opens the target <details> element', () => {
        document.querySelector('[data-faq-target="q-how-to-enroll"]').click();
        expect(document.getElementById('q-how-to-enroll').open).toBe(true);
    });
});

// ─── initial load with hash ───────────────────────────────────────────────────

describe('initFaqToc — initial load with hash', () => {
    beforeEach(() => {
        buildDOM();
        jest.useFakeTimers();
        Element.prototype.scrollIntoView = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    test('_openDetailsForHash opens correct <details> on load when hash present', () => {
        // Set hash via real pushState BEFORE mocking — now window.location.hash is set.
        realPushState('#q-how-to-enroll');
        loadFaqScript();
        window.initFaqToc();
        expect(document.getElementById('q-how-to-enroll').open).toBe(true);
    });

    test('_openDetailsForHash scrolls to target after delay', () => {
        realPushState('#q-what-is-cmsc');
        loadFaqScript();
        window.initFaqToc();
        jest.runAllTimers();
        expect(document.getElementById('q-what-is-cmsc').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });

    test('no accordion opens when hash is absent on load', () => {
        realPushState('/');
        loadFaqScript();
        window.initFaqToc();
        document.querySelectorAll('details').forEach(d => expect(d.open).toBe(false));
    });
});

// ─── hashchange listener ──────────────────────────────────────────────────────

describe('initFaqToc — hashchange listener', () => {
    beforeEach(() => {
        window.history.pushState({}, '', '/'); // start with no hash before mocking
        buildDOM();
        jest.useFakeTimers();
        Element.prototype.scrollIntoView = jest.fn();
        jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
        jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
        loadFaqScript();
        window.initFaqToc();
    });

    afterEach(() => {
        jest.runAllTimers();
        jest.useRealTimers();
    });

    test('hashchange opens the matching FAQ accordion', () => {
        realPushState('#q-what-is-cmsc');
        window.dispatchEvent(new Event('hashchange'));
        expect(document.getElementById('q-what-is-cmsc').open).toBe(true);
    });

    test('hashchange scrolls to the FAQ item after delay', () => {
        realPushState('#q-how-to-enroll');
        window.dispatchEvent(new Event('hashchange'));
        jest.runAllTimers();
        expect(document.getElementById('q-how-to-enroll').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
});
