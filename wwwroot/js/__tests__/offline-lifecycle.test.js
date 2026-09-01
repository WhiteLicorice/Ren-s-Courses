'use strict';

const source = require('fs').readFileSync(
    require('path').join(__dirname, '../site.js'), 'utf8');

function createWorker(status = { state: 'ready', buildId: 'a'.repeat(64) }) {
    const listeners = new Map();
    return {
        state: 'activated',
        postMessage: jest.fn((message, ports) => {
            if (message.type === 'get-offline-status' && ports?.[0]) {
                queueMicrotask(() => ports[0].postMessage(status));
            }
        }),
        addEventListener: jest.fn((type, listener) => {
            listeners.set(type, listener);
        }),
        removeEventListener: jest.fn((type, listener) => {
            if (listeners.get(type) === listener) listeners.delete(type);
        }),
        dispatchStateChange() {
            listeners.get('statechange')?.();
        },
    };
}

global.MessageChannel = class MessageChannel {
    constructor() {
        this.port1 = {
            onmessage: null,
            close: jest.fn(),
        };
        this.port2 = {
            postMessage: value => this.port1.onmessage?.({ data: value }),
            close: jest.fn(),
        };
    }
};

function createServiceWorkerFixture() {
    const activeWorker = createWorker();
    const registration = {
        active: activeWorker,
        installing: null,
        update: jest.fn(() => Promise.resolve()),
        unregister: jest.fn(() => Promise.resolve(true)),
        addEventListener: jest.fn(),
    };
    const serviceWorker = {
        controller: activeWorker,
        ready: Promise.resolve(registration),
        register: jest.fn(() => Promise.resolve(registration)),
        addEventListener: jest.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: serviceWorker,
    });
    return { registration, serviceWorker, activeWorker };
}

let fixture;

beforeAll(() => {
    fixture = createServiceWorkerFixture();
    // eslint-disable-next-line no-new-func
    new Function(source)();
});

beforeEach(() => {
    document.documentElement.dataset.environment = 'Production';
    document.body.innerHTML = `
        <button id="offline-status-badge" type="button" data-offline-state="updating">
            <span data-offline-icon aria-hidden="true"></span>
            <span id="offline-status-tooltip" data-offline-tooltip role="tooltip"></span>
        </button>
        <div data-offline-live-region aria-live="polite"></div>`;
});

test('development hides the badge and skips registration', async () => {
    fixture.serviceWorker.register.mockClear();
    document.documentElement.dataset.environment = 'Development';

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector('#offline-status-badge').hidden).toBe(true);
    expect(fixture.serviceWorker.register).not.toHaveBeenCalled();
});

test('first installation stays Updating until its worker activates', async () => {
    const installingWorker = createWorker();
    installingWorker.state = 'installing';
    fixture.registration.installing = installingWorker;
    fixture.registration.active = fixture.activeWorker;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('updating');

    fixture.registration.installing = null;
    fixture.registration.active = installingWorker;
    fixture.serviceWorker.controller = installingWorker;
    installingWorker.state = 'activated';
    installingWorker.dispatchStateChange();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('ready');
});

test('retry does not unregister the existing registration', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));

    window.updateOfflineStatus({
        state: 'error',
        buildId: 'a'.repeat(64),
        errorCode: 'installation-failed',
        detail: 'Installation failed',
    });
    document.querySelector('#offline-status-badge').click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fixture.registration.unregister).not.toHaveBeenCalled();
});
