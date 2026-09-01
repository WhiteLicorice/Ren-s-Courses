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
            aria-label="" aria-describedby="offline-status-tooltip">
            <span data-offline-icon aria-hidden="true"></span>
            <span id="offline-status-tooltip" data-offline-tooltip role="tooltip"></span>
        </button>
        <div data-offline-live-region class="sr-only" aria-live="polite" aria-atomic="true"></div>`;
    loadScript();
});

test.each(['ready', 'updating', 'error'])('renders the %s offline state on the persistent badge', state => {
    window.updateOfflineStatus({ state, buildId: 'a'.repeat(64), errorCode: null, detail: null });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.dataset.offlineState).toBe(state);
    expect(badge.querySelector('[data-offline-icon] svg')).not.toBeNull();
    expect(badge.querySelector('[data-offline-tooltip]').textContent).toContain('Offline Mode saves');
    expect(badge.getAttribute('title')).toBeNull();
});

test('uses the exact state blurb for the accessible name and tooltip', () => {
    const expected = 'Offline Mode saves this site and its course files for use without internet, and no action is needed.';

    window.updateOfflineStatus({ state: 'ready', buildId: 'a'.repeat(64), errorCode: null, detail: null });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.getAttribute('aria-label')).toBe(expected);
    expect(badge.querySelector('[data-offline-tooltip]').textContent).toBe(expected);
    expect(badge.getAttribute('aria-describedby')).toBe('offline-status-tooltip');
});

test('keeps diagnostics in data attributes and does not add them to the one-sentence blurb', () => {
    window.updateOfflineStatus({
        state: 'error',
        buildId: 'a'.repeat(64),
        errorCode: 'missing-resource',
        detail: 'Missing required PDF'
    });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.getAttribute('data-offline-error-code')).toBe('missing-resource');
    expect(badge.querySelector('[data-offline-tooltip]').textContent).toBe(
        'Offline Mode saves this site and its course files for use without internet, but the latest update failed, so select this icon to retry.'
    );
    expect(badge.getAttribute('aria-label')).not.toContain('Missing required PDF');
});

test('uses non-actionable copy when service workers are unsupported', () => {
    const expected = 'Offline Mode saves this site and its course files for use without internet, but this browser cannot use it, so use a current browser.';

    window.updateOfflineStatus({
        state: 'error',
        buildId: null,
        errorCode: 'unsupported',
        detail: 'Offline mode is unavailable',
    });

    const badge = document.querySelector('#offline-status-badge');
    expect(badge.querySelector('[data-offline-tooltip]').textContent).toBe(expected);
    expect(badge.getAttribute('aria-label')).toBe(expected);
    expect(badge.getAttribute('aria-disabled')).toBe('true');
});

test('does not duplicate state announcements', () => {
    const status = { state: 'ready', buildId: 'a'.repeat(64), errorCode: null, detail: null };
    window.updateOfflineStatus(status);
    const liveRegion = document.querySelector('[data-offline-live-region]');
    const firstAnnouncement = liveRegion.textContent;

    window.updateOfflineStatus(status);

    expect(liveRegion.textContent).toBe(firstAnnouncement);
});
