'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../submission-menu.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildMenu() {
    document.body.innerHTML = `
        <div data-submission-menu>
            <button type="button" data-submission-trigger aria-expanded="false">Submit</button>
            <div class="submission-menu-panel">
                <a href="https://example.com/one">First bin</a>
            </div>
        </div>
        <button id="outside">Outside</button>`;
}

beforeEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.submissionMenuOutsideClick;
    loadScript();
});

afterEach(() => {
    jest.restoreAllMocks();
});

test('click toggles the menu and aria-expanded state', () => {
    buildMenu();
    window.initSubmissionMenus();
    const menu = document.querySelector('[data-submission-menu]');
    const trigger = document.querySelector('[data-submission-trigger]');

    trigger.click();
    expect(menu.hasAttribute('data-open')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    trigger.click();
    expect(menu.hasAttribute('data-open')).toBe(false);
    expect(menu.hasAttribute('data-hover-suppressed')).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
});

test('Escape closes the menu and returns focus to its trigger', () => {
    buildMenu();
    window.initSubmissionMenus();
    const menu = document.querySelector('[data-submission-menu]');
    const trigger = document.querySelector('[data-submission-trigger]');
    trigger.click();

    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(menu.hasAttribute('data-open')).toBe(false);
    expect(menu.hasAttribute('data-hover-suppressed')).toBe(true);
    expect(document.activeElement).toBe(trigger);
});

test('clicking outside closes an open menu', () => {
    buildMenu();
    window.initSubmissionMenus();
    const menu = document.querySelector('[data-submission-menu]');
    document.querySelector('[data-submission-trigger]').click();

    document.getElementById('outside').click();

    expect(menu.hasAttribute('data-open')).toBe(false);
});

test('initialization is idempotent', () => {
    buildMenu();
    window.initSubmissionMenus();
    window.initSubmissionMenus();

    document.querySelector('[data-submission-trigger]').click();

    expect(document.querySelector('[data-submission-menu]').hasAttribute('data-open')).toBe(true);
});
