// wwwroot/site.js

/**
 * MAIN ENTRY POINT
 * Initializes all dynamic features once the DOM is ready.
 */
document.addEventListener("DOMContentLoaded", () => {
    if (window.addCodeFeatures) window.addCodeFeatures();
    if (window.generateTOC) window.generateTOC();
    if (window.initScrollbarDrag) window.initScrollbarDrag();
    if (window.initScrollButton) window.initScrollButton();
    if (window.initCalendarNav) window.initCalendarNav();
    if (window.initFaqToc) window.initFaqToc();
    if (window.initInteractiveDiagrams) window.initInteractiveDiagrams();
    if (window.initSubmissionMenus) window.initSubmissionMenus();
    initOfflineBadge();
    void registerOfflineWorker();
    window.addEventListener('load', () => setTimeout(loadAndroidBanner, 0), { once: true });
});

function normalizeCleanPageUrl() {
    const { pathname, search, hash } = window.location;
    if (pathname.length > 1 && pathname.endsWith('/')) {
        window.history.replaceState(window.history.state, '',
            `${pathname.slice(0, -1)}${search}${hash}`);
    }
}

normalizeCleanPageUrl();

const OFFLINE_STATUS_TIMEOUT = 10000;
const OFFLINE_REPAIR_TIMEOUT = 120000;
const OFFLINE_INSTALL_TIMEOUT = 180000;
let offlineStatusRegistration = null;
let offlineOperation = Promise.resolve();
let offlineOperationToken = 0;
const offlineWorkerObservers = new WeakMap();
const offlineRegistrationWatchers = new WeakSet();

let offlineStatus = {
    state: 'updating',
    buildId: null,
    errorCode: null,
    detail: null
};

const OFFLINE_STATE_COPY = {
    ready: {
        blurb: 'Offline Mode saves this site and its course files for use without internet, and no action is needed.',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>'
    },
    updating: {
        blurb: 'Offline Mode saves this site and its course files for use without internet, so keep this page open while it updates them.',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 2v4"></path><path d="M12 18v4"></path><path d="m4.93 4.93 2.83 2.83"></path><path d="m16.24 16.24 2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="m4.93 19.07 2.83-2.83"></path><path d="m16.24 7.76 2.83-2.83"></path></svg>'
    },
    error: {
        blurb: 'Offline Mode saves this site and its course files for use without internet, but the latest update failed, so select this icon to retry.',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>'
    },
    unsupported: {
        blurb: 'Offline Mode saves this site and its course files for use without internet, but this browser cannot use it, so use a current browser.',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6 6 18"></path></svg>'
    }
};

function conciseOfflineDetail(status) {
    return typeof status.detail === 'string' && status.detail.trim()
        ? status.detail.trim()
        : 'Offline content is not complete';
}

function currentOfflineStatusKey(status) {
    return [status.state, status.buildId, status.errorCode, status.detail].join('|');
}

function updateOfflineStatus(status) {
    const state = ['ready', 'updating', 'error'].includes(status?.state)
        ? status.state
        : 'error';
    const copy = state === 'error' && status?.errorCode === 'unsupported'
        ? OFFLINE_STATE_COPY.unsupported
        : OFFLINE_STATE_COPY[state];
    const detail = state === 'error' ? conciseOfflineDetail(status) : null;
    const nextStatus = {
        state,
        buildId: status?.buildId ?? null,
        errorCode: status?.errorCode ?? null,
        detail
    };
    const changed = currentOfflineStatusKey(offlineStatus) !== currentOfflineStatusKey(nextStatus);
    offlineStatus = nextStatus;

    const badge = document.querySelector('#offline-status-badge');
    if (!badge) return;

    badge.dataset.offlineState = state;
    if (nextStatus.errorCode) badge.dataset.offlineErrorCode = nextStatus.errorCode;
    else delete badge.dataset.offlineErrorCode;

    const icon = badge.querySelector('[data-offline-icon]');
    if (icon) icon.innerHTML = copy.icon;

    const tooltip = badge.querySelector('[data-offline-tooltip]');
    if (tooltip) tooltip.textContent = copy.blurb;

    badge.setAttribute('aria-label', copy.blurb);
    badge.setAttribute('aria-describedby', tooltip?.id || 'offline-status-tooltip');
    badge.setAttribute(
        'aria-disabled', state === 'updating' || nextStatus.errorCode === 'unsupported' ? 'true' : 'false');
    badge.removeAttribute('title');

    const liveRegion = document.querySelector('[data-offline-live-region]');
    if (changed && liveRegion) liveRegion.textContent = `Offline Mode: ${copy.blurb}`;
}

window.updateOfflineStatus = updateOfflineStatus;

function queueOfflineOperation(operation) {
    const token = ++offlineOperationToken;
    const next = offlineOperation.catch(() => {}).then(() => operation(token));
    offlineOperation = next.catch(() => {});
    return next;
}

function isCurrentOfflineOperation(token) {
    return token === offlineOperationToken;
}

function postToOfflineWorker(message, timeout = OFFLINE_STATUS_TIMEOUT, targetWorker = null) {
    const registration = offlineStatusRegistration;
    const worker = targetWorker
        || (registration?.installing ? null : navigator.serviceWorker.controller || registration?.active);
    if (!worker) return Promise.resolve(null);

    return new Promise(resolve => {
        const channel = new MessageChannel();
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            channel.port1.close();
            channel.port2.close();
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), timeout);
        channel.port1.onmessage = event => finish(event.data);
        try {
            worker.postMessage(message, [channel.port2]);
        } catch {
            finish(null);
        }
    });
}

function observeOfflineWorker(registration, worker, timeout = OFFLINE_INSTALL_TIMEOUT, token = null) {
    const existing = offlineWorkerObservers.get(worker);
    if (existing) return existing.promise;

    let settled = false;
    let timer;
    let resolvePromise;
    const promise = new Promise(resolve => {
        resolvePromise = resolve;
    });
    const observer = { promise };
    offlineWorkerObservers.set(worker, observer);

    const finish = state => {
        if (state !== 'activated' && state !== 'redundant') return;
        worker.removeEventListener('statechange', onStateChange);
        if (timer) clearTimeout(timer);
        if (state === 'activated') {
            void requestOfflineStatus(registration, registration.active || worker, token)
                .catch(error => console.warn('[SW] Late offline activation status failed:', error));
        }
        if (!settled) {
            settled = true;
            resolvePromise(state);
        }
    };
    const onStateChange = () => finish(worker.state);

    worker.addEventListener('statechange', onStateChange);
    timer = setTimeout(() => {
        if (!settled) {
            settled = true;
            resolvePromise('timeout');
        }
    }, timeout);
    finish(worker.state);
    return promise;
}

async function requestOfflineStatus(registration = null, targetWorker = null, token = null) {
    const currentRegistration = registration || offlineStatusRegistration || await navigator.serviceWorker.ready;
    offlineStatusRegistration = currentRegistration;
    if (!targetWorker && currentRegistration.installing) return null;

    const status = await postToOfflineWorker(
        { type: 'get-offline-status' }, OFFLINE_STATUS_TIMEOUT, targetWorker);
    if (!status) throw new Error('Offline status request timed out');
    if (token === null || isCurrentOfflineOperation(token)) updateOfflineStatus(status);
    return status;
}

function watchOfflineInstallation(registration) {
    const worker = registration.installing;
    if (!worker) return;
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });
    void observeOfflineWorker(registration, worker).then(state => {
        if (state === 'redundant' && offlineStatus.state === 'updating') {
            updateOfflineStatus({
                state: 'error',
                buildId: offlineStatus.buildId,
                errorCode: 'installation-failed',
                detail: 'Installation failed'
            });
        }
    });
}

function watchOfflineRegistration(registration) {
    if (offlineRegistrationWatchers.has(registration)) return;
    offlineRegistrationWatchers.add(registration);
    registration.addEventListener('updatefound', () => watchOfflineInstallation(registration));
}

async function waitForOfflineInstallation(registration, token) {
    const worker = registration.installing;
    if (!worker) return null;
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });
    const state = await observeOfflineWorker(registration, worker, OFFLINE_INSTALL_TIMEOUT, token);
    if (state === 'activated') {
        return requestOfflineStatus(registration, registration.active || worker, token);
    }
    if (state === 'redundant') {
        const activeStatus = await requestOfflineStatus(registration, registration.active, token)
            .catch(() => null);
        if (activeStatus?.state === 'error') return activeStatus;
        throw new Error('Offline installation failed');
    }
    throw new Error('Offline installation timed out');
}

async function registerOfflineWorker() {
    if (document.documentElement.dataset.environment === 'Development') {
        document.querySelector('#offline-status-badge')?.setAttribute('hidden', 'hidden');
        return;
    }
    const serviceWorker = navigator.serviceWorker;
    if (!serviceWorker) {
        updateOfflineStatus({
            state: 'error',
            buildId: null,
            errorCode: 'unsupported',
            detail: 'Offline mode is unavailable'
        });
        return;
    }

    return queueOfflineOperation(async token => {
        updateOfflineStatus({ state: 'updating', buildId: null });
        try {
            const registration = await serviceWorker.register(
                new URL('service-worker.js', document.baseURI));
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            const status = registration.installing
                ? await waitForOfflineInstallation(registration, token)
                : await requestOfflineStatus(registration, registration.active, token);
            if (status) updateOfflineStatus(status);
        } catch (error) {
            console.warn('[SW] Registration failed:', error);
            if (isCurrentOfflineOperation(token)) {
                updateOfflineStatus({
                    state: 'error',
                    buildId: null,
                    errorCode: 'registration-failed',
                    detail: 'Registration failed'
                });
            }
        }
    });
}

function checkOfflineForUpdate() {
    return queueOfflineOperation(async token => {
        updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });
        try {
            const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            await registration.update();
            const status = registration.installing
                ? await waitForOfflineInstallation(registration, token)
                : await requestOfflineStatus(registration, registration.active, token);
            if (status) updateOfflineStatus(status);
        } catch (error) {
            console.warn('[SW] Offline update check failed:', error);
            if (isCurrentOfflineOperation(token)) {
                updateOfflineStatus({
                    state: 'error',
                    buildId: offlineStatus.buildId,
                    errorCode: 'update-failed',
                    detail: 'Update check failed'
                });
            }
        }
    });
}

function repairOfflineCache() {
    return queueOfflineOperation(async token => {
        updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });
        try {
            const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            await registration.update();

            let status;
            if (registration.installing) {
                status = await waitForOfflineInstallation(registration, token);
            } else {
                status = await requestOfflineStatus(registration, registration.active, token);
                if (status?.state === 'error' && status.errorCode === 'missing-resource') {
                    status = await postToOfflineWorker(
                        { type: 'repair-offline-cache' }, OFFLINE_REPAIR_TIMEOUT, registration.active);
                    if (!status) throw new Error('Offline repair timed out');
                }
                if (status?.state === 'error') throw new Error(status.detail || 'Offline retry failed');
            }
            if (status) updateOfflineStatus(status);
        } catch (error) {
            console.warn('[SW] Offline cache repair failed:', error);
            if (isCurrentOfflineOperation(token)) {
                updateOfflineStatus({
                    state: 'error',
                    buildId: offlineStatus.buildId,
                    errorCode: 'repair-failed',
                    detail: 'Retry failed'
                });
            }
        }
    });
}

function initOfflineBadge() {
    const badge = document.querySelector('#offline-status-badge');
    if (!badge) return;
    if (document.documentElement.dataset.environment === 'Development') {
        badge.setAttribute('hidden', 'hidden');
        return;
    }
    if (badge.dataset.offlineBound === 'true') return;

    badge.dataset.offlineBound = 'true';
    badge.addEventListener('click', () => {
        if (offlineStatus.state === 'updating' || offlineStatus.errorCode === 'unsupported') return;
        if (offlineStatus.state === 'ready') void checkOfflineForUpdate();
        if (offlineStatus.state === 'error') void repairOfflineCache();
    });
    updateOfflineStatus(offlineStatus);
}

function loadAndroidBanner() {
    if (!navigator.onLine || document.querySelector('script[data-android-banner]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.dataset.androidBanner = 'true';
    script.src = 'https://keepandroidopen.org/banner.js?id=header&hidebutton=off';
    script.addEventListener('error', () => {});
    document.body.appendChild(script);
}

if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'offline-status') updateOfflineStatus(event.data);
    });

    window.addEventListener('online', () => {
        if (offlineStatusRegistration) void checkOfflineForUpdate();
    });
}
