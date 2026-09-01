'use strict';

const source = require('fs').readFileSync(
    require('path').join(__dirname, '../site.js'), 'utf8');

function createWorker(status = { state: 'ready', buildId: 'a'.repeat(64) }) {
    const listeners = new Map();
    let currentStatus = status;
    return {
        state: 'activated',
        postMessage: jest.fn((message, ports) => {
            if (message.type === 'record-offline-error') {
                currentStatus = {
                    state: 'error',
                    buildId: currentStatus.buildId,
                    errorCode: message.errorCode,
                    detail: message.detail,
                };
            }
            if (message.type === 'repair-offline-cache') {
                currentStatus = {
                    state: 'ready',
                    buildId: currentStatus.buildId,
                    errorCode: null,
                    detail: null,
                };
            }
            if ((message.type === 'get-offline-status'
                || message.type === 'get-offline-installation-status'
                || message.type === 'record-offline-error'
                || message.type === 'repair-offline-cache') && ports?.[0]) {
                const reply = message.type === 'get-offline-installation-status'
                    && currentStatus.state !== 'error'
                    ? { state: 'updating', buildId: currentStatus.buildId }
                    : currentStatus;
                queueMicrotask(() => ports[0].postMessage(reply));
            }
        }),
        addEventListener: jest.fn((type, listener) => {
            listeners.set(type, listener);
        }),
        removeEventListener: jest.fn((type, listener) => {
            if (listeners.get(type) === listener) listeners.delete(type);
        }),
        setStatus(nextStatus) {
            currentStatus = nextStatus;
        },
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

afterEach(async () => {
    if (fixture.registration.installing) {
        const worker = fixture.registration.installing;
        fixture.registration.installing = null;
        fixture.registration.active = worker;
        worker.state = 'activated';
        worker.dispatchStateChange();
    }
    fixture.registration.installing = null;
    fixture.registration.active = fixture.activeWorker;
    fixture.serviceWorker.controller = fixture.activeWorker;
    fixture.serviceWorker.register.mockReset().mockResolvedValue(fixture.registration);
    fixture.registration.update.mockReset().mockResolvedValue();
    fixture.activeWorker.state = 'activated';
    await new Promise(resolve => setTimeout(resolve, 0));
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

test('registration failure records the terminal error before displaying it', async () => {
    fixture.serviceWorker.register.mockRejectedValue(new Error('registration failed'));

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));

    const messages = fixture.activeWorker.postMessage.mock.calls.map(([message]) => message.type);
    expect(messages).toContain('record-offline-error');
    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('error');
});

test('installation queries the installing worker and never the old controller', async () => {
    const installingWorker = createWorker();
    installingWorker.state = 'installing';
    fixture.registration.installing = installingWorker;
    fixture.registration.active = fixture.activeWorker;

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(installingWorker.postMessage.mock.calls.map(([message]) => message.type)).toContain(
        'get-offline-installation-status');
    expect(fixture.activeWorker.postMessage.mock.calls.map(([message]) => message.type)).not.toContain(
        'get-offline-installation-status');

    installingWorker.state = 'activated';
    fixture.registration.installing = null;
    fixture.registration.active = installingWorker;
    installingWorker.dispatchStateChange();
    await new Promise(resolve => setTimeout(resolve, 0));
});

test('installation timeout records the error on the installing worker', async () => {
    jest.useFakeTimers();
    try {
        const installingWorker = createWorker();
        installingWorker.state = 'installing';
        fixture.registration.installing = installingWorker;
        fixture.registration.active = fixture.activeWorker;

        document.dispatchEvent(new Event('DOMContentLoaded'));
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        await jest.advanceTimersByTimeAsync(180000);
        await jest.runAllTimersAsync();
        for (let index = 0; index < 8; index += 1) await Promise.resolve();

        expect(installingWorker.postMessage.mock.calls.map(([message]) => message.type)).toContain(
            'record-offline-error');
        expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('error');
    } finally {
        jest.useRealTimers();
    }
});

test('an old worker Ready message cannot replace Updating for a newer install', () => {
    const installingWorker = createWorker();
    fixture.registration.installing = installingWorker;
    fixture.registration.active = fixture.activeWorker;
    window.updateOfflineStatus({ state: 'updating', buildId: 'a'.repeat(64) });

    const messageListener = fixture.serviceWorker.addEventListener.mock.calls
        .find(([type]) => type === 'message')?.[1];
    messageListener({
        source: fixture.activeWorker,
        data: { type: 'offline-status', state: 'ready', buildId: 'a'.repeat(64) },
    });

    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('updating');
});

test('a failure report from the current installing worker reaches the badge', () => {
    const installingWorker = createWorker();
    fixture.registration.installing = installingWorker;
    fixture.registration.active = fixture.activeWorker;
    window.updateOfflineStatus({ state: 'updating', buildId: 'a'.repeat(64) });

    const messageListener = fixture.serviceWorker.addEventListener.mock.calls
        .find(([type]) => type === 'message')?.[1];
    messageListener({
        source: installingWorker,
        data: {
            type: 'offline-status',
            state: 'error',
            buildId: 'a'.repeat(64),
            errorCode: 'installation-failed',
            detail: 'Installation failed',
        },
    });

    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('error');
});

test('repeated online events do not start a second update while the first runs', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));
    window.updateOfflineStatus({ state: 'ready', buildId: 'a'.repeat(64) });

    let resolveUpdate;
    fixture.registration.update.mockImplementation(() => new Promise(resolve => {
        resolveUpdate = resolve;
    }));
    fixture.registration.update.mockClear();
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    await Promise.resolve();
    expect(fixture.registration.update).toHaveBeenCalledTimes(1);

    resolveUpdate();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fixture.registration.update).toHaveBeenCalledTimes(1);
});

test('repair clears an actionable stored error after validation succeeds', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));
    fixture.activeWorker.setStatus({
        state: 'error',
        buildId: 'a'.repeat(64),
        errorCode: 'installation-timeout',
        detail: 'Installation timed out',
    });
    window.updateOfflineStatus({
        state: 'error',
        buildId: 'a'.repeat(64),
        errorCode: 'installation-timeout',
        detail: 'Installation timed out',
    });

    document.querySelector('#offline-status-badge').click();
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('ready');
    expect(fixture.activeWorker.postMessage.mock.calls.map(([message]) => message.type)).toContain(
        'repair-offline-cache');
});

test('late activation replaces timeout Error when no newer operation superseded it', async () => {
    jest.useFakeTimers();
    try {
        const installingWorker = createWorker();
        installingWorker.state = 'installing';
        fixture.registration.installing = installingWorker;
        fixture.registration.active = fixture.activeWorker;

        document.dispatchEvent(new Event('DOMContentLoaded'));
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        await jest.advanceTimersByTimeAsync(180000);
        await jest.runAllTimersAsync();
        for (let index = 0; index < 8; index += 1) await Promise.resolve();
        expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('error');

        installingWorker.setStatus({ state: 'ready', buildId: 'a'.repeat(64) });
        fixture.registration.installing = null;
        fixture.registration.active = installingWorker;
        installingWorker.state = 'activated';
        installingWorker.dispatchStateChange();
        await jest.runAllTimersAsync();
        for (let index = 0; index < 8; index += 1) await Promise.resolve();

        expect(document.querySelector('#offline-status-badge').dataset.offlineState).toBe('ready');
    } finally {
        jest.useRealTimers();
    }
});

test('shared observers use one terminal promise for the same worker', async () => {
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 10));
    const installingWorker = createWorker();
    installingWorker.state = 'installing';
    fixture.registration.installing = installingWorker;

    const updateFound = fixture.registration.addEventListener.mock.calls
        .find(([type]) => type === 'updatefound')?.[1];
    updateFound();
    updateFound();

    expect(installingWorker.addEventListener).toHaveBeenCalledTimes(1);
    fixture.registration.installing = null;
    installingWorker.state = 'activated';
    installingWorker.dispatchStateChange();
    await new Promise(resolve => setTimeout(resolve, 0));
});
