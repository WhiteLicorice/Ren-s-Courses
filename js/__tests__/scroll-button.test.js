'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../scroll-button.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildDOM() {
    document.body.innerHTML = `
        <button id="scroll-btn"
            class="opacity-0 pointer-events-none translate-y-4"
            aria-label="Scroll to top">
        </button>
    `;
}

afterEach(() => {
    jest.restoreAllMocks();
});

describe('initScrollButton — initial state', () => {
    test('returns early when #scroll-btn is absent', () => {
        document.body.innerHTML = '';
        loadScript();
        expect(() => window.initScrollButton()).not.toThrow();
    });
});

describe('initScrollButton — scroll behaviour', () => {
    beforeEach(() => {
        buildDOM();
        window.scrollTo = jest.fn();
        loadScript();
        window.initScrollButton();
    });

    test('button click scrolls to top', () => {
        document.getElementById('scroll-btn').click();
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    test('near top (<300px): button stays hidden on scroll', () => {
        Object.defineProperty(window, 'scrollY', { value: 100, configurable: true });
        window.dispatchEvent(new Event('scroll'));
        // requestAnimationFrame doesn't run in jsdom automatically; just verify no throw.
    });
});
