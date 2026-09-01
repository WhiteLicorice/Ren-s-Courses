'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../site.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

beforeEach(() => {
    document.body.innerHTML = `
        <button id="offline-status-badge" type="button" data-offline-state="updating"
            aria-live="polite" title="Updating offline content">
            <span data-offline-icon aria-hidden="true"></span>
            <span data-offline-label>Updating</span>
        </button>`;
    loadScript();
});

test.each([
    ['ready', 'Ready'],
    ['updating', 'Updating'],
    ['error', 'Error'],
])('renders the %s offline state on the persistent badge', (state, label) => {
    window.updateOfflineStatus({ state, buildId: 'a'.repeat(64), errorCode: null, detail: null });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.dataset.offlineState).toBe(state);
    expect(badge.querySelector('[data-offline-label]').textContent).toBe(label);
    expect(badge.querySelector('[data-offline-icon]').textContent).not.toBe('');
});

test('includes a concise failure reason in the error label and tooltip', () => {
    window.updateOfflineStatus({
        state: 'error',
        buildId: 'a'.repeat(64),
        errorCode: 'missing-resource',
        detail: 'Missing required PDF'
    });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.querySelector('[data-offline-label]').textContent).toBe('Error');
    expect(badge.title).toContain('Missing required PDF');
});
