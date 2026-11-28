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
let offlineOnlineOperation = null;
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

function updateOfflineStatus(status, token = null) {
    if (token !== null && !isCurrentOfflineOperation(token)) return false;

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
    return true;
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

function observeOfflineWorker(worker) {
    const existing = offlineWorkerObservers.get(worker);
    if (existing) return existing.promise;

    let settled = false;
    let resolvePromise;
    const promise = new Promise(resolve => {
        resolvePromise = resolve;
    });
    const observer = { promise };
    offlineWorkerObservers.set(worker, observer);

    const finish = state => {
        if (state !== 'activated' && state !== 'redundant') return;
        worker.removeEventListener('statechange', onStateChange);
        if (!settled) {
            settled = true;
            resolvePromise(state);
        }
    };
    const onStateChange = () => finish(worker.state);

    worker.addEventListener('statechange', onStateChange);
    finish(worker.state);
    return promise;
}

async function requestOfflineStatus(registration = null, targetWorker = null, token = null) {
    const currentRegistration = registration || offlineStatusRegistration || await navigator.serviceWorker.ready;
    offlineStatusRegistration = currentRegistration;
    const worker = targetWorker || currentRegistration.installing || null;
    const messageType = currentRegistration.installing && worker === currentRegistration.installing
        ? 'get-offline-installation-status'
        : 'get-offline-status';
    const status = await postToOfflineWorker(
        { type: messageType }, OFFLINE_STATUS_TIMEOUT, worker);
    if (!status) throw new Error('Offline status request timed out');
    updateOfflineStatus(status, token);
    return status;
}

async function recordOfflineError(registration, errorCode, detail, token, targetWorker = null) {
    const worker = targetWorker || registration?.installing || registration?.active
        || navigator.serviceWorker.controller;
    if (!worker) return null;
    const status = await postToOfflineWorker({
        type: 'record-offline-error',
        errorCode,
        detail
    }, OFFLINE_STATUS_TIMEOUT, worker);
    if (status) updateOfflineStatus(status, token);
    return status;
}

async function showOfflineError(registration, token, errorCode, detail, targetWorker = null) {
    let persisted = null;
    try {
        persisted = await recordOfflineError(registration, errorCode, detail, token, targetWorker);
    } catch (error) {
        console.warn('[SW] Offline error persistence failed:', error);
    }
    if (persisted || !isCurrentOfflineOperation(token)) return;
    updateOfflineStatus({
        state: 'error',
        buildId: offlineStatus.buildId,
        errorCode,
        detail
    }, token);
}

function installationError(code, message) {
    const error = new Error(message);
    error.offlineErrorCode = code;
    return error;
}

function watchOfflineInstallation(registration) {
    const worker = registration.installing;
    if (!worker) return;
    const token = offlineOperationToken;
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId }, token);
    void observeOfflineWorker(worker).then(async state => {
        if (state === 'activated') {
            await requestOfflineStatus(registration, registration.active || worker, token)
                .catch(error => console.warn('[SW] Late offline activation status failed:', error));
            return;
        }
        await showOfflineError(registration, token, 'installation-failed', 'Installation failed', worker);
    });
}

function watchOfflineRegistration(registration) {
    if (offlineRegistrationWatchers.has(registration)) return;
    offlineRegistrationWatchers.add(registration);
    registration.addEventListener('updatefound', () => watchOfflineInstallation(registration));
}

async function waitForOfflineInstallation(registration, token, retryStarted = false) {
    const worker = registration.installing;
    if (!worker) return null;
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId }, token);
    const installationStatus = await requestOfflineStatus(registration, worker, token);
    if (!retryStarted && installationStatus?.state === 'error') return installationStatus;

    const terminal = observeOfflineWorker(worker);
    const timeout = new Promise(resolve => setTimeout(
        () => resolve('timeout'), OFFLINE_INSTALL_TIMEOUT));
    const state = await Promise.race([terminal, timeout]);
    if (state === 'activated') {
        return requestOfflineStatus(registration, registration.active || worker, token);
    }
    if (state === 'redundant') {
        const activeStatus = await requestOfflineStatus(registration, registration.active, token)
            .catch(() => null);
        if (activeStatus?.state === 'error') return activeStatus;
        const error = installationError('installation-failed', 'Offline installation failed');
        error.offlineWorker = worker;
        throw error;
    }
    terminal.then(terminalState => {
        if (terminalState !== 'activated') return;
        return requestOfflineStatus(registration, registration.active || worker, token);
    }).catch(error => console.warn('[SW] Late offline activation status failed:', error));
    const error = installationError('installation-timeout', 'Offline installation timed out');
    error.offlineWorker = worker;
    throw error;
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
        updateOfflineStatus({ state: 'updating', buildId: null }, token);
        let registration = null;
        try {
            registration = await serviceWorker.register(
                new URL('service-worker.js', document.baseURI));
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            if (registration.installing) await waitForOfflineInstallation(registration, token);
            else await requestOfflineStatus(registration, registration.active, token);
        } catch (error) {
            console.warn('[SW] Registration failed:', error);
            await showOfflineError(
                registration,
                token,
                error.offlineErrorCode || 'registration-failed',
                error.offlineErrorCode ? error.message : 'Registration failed',
                error.offlineWorker || registration?.installing);
        }
    });
}

function checkOfflineForUpdate() {
    return queueOfflineOperation(async token => {
        updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId }, token);
        let registration = null;
        try {
            registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            await registration.update();
            if (registration.installing) {
                await waitForOfflineInstallation(registration, token, true);
            } else {
                await requestOfflineStatus(registration, registration.active, token);
            }
        } catch (error) {
            console.warn('[SW] Offline update check failed:', error);
            await showOfflineError(
                registration,
                token,
                error.offlineErrorCode || 'update-failed',
                error.offlineErrorCode ? error.message : 'Update check failed',
                error.offlineWorker || registration?.installing);
        }
    });
}

function repairOfflineCache() {
    return queueOfflineOperation(async token => {
        updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId }, token);
        let registration = null;
        try {
            registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
            offlineStatusRegistration = registration;
            watchOfflineRegistration(registration);
            await registration.update();

            let status;
            if (registration.installing) {
                status = await waitForOfflineInstallation(registration, token, true);
            } else {
                status = await requestOfflineStatus(registration, registration.active, token);
                if (status?.state === 'error') {
                    status = await postToOfflineWorker(
                        { type: 'repair-offline-cache' }, OFFLINE_REPAIR_TIMEOUT, registration.active);
                    if (!status) throw new Error('Offline repair timed out');
                    updateOfflineStatus(status, token);
                }
                if (status?.state === 'error') throw new Error(status.detail || 'Offline retry failed');
            }
        } catch (error) {
            console.warn('[SW] Offline cache repair failed:', error);
            await showOfflineError(
                registration,
                token,
                error.offlineErrorCode || 'repair-failed',
                error.offlineErrorCode ? error.message : 'Retry failed',
                error.offlineWorker || registration?.installing);
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
        if (event.data?.type !== 'offline-status') return;
        const installing = offlineStatusRegistration?.installing;
        if (installing && event.source && event.source !== installing
            && event.data.state === 'ready') return;
        updateOfflineStatus(event.data, offlineOperationToken);
    });

    window.addEventListener('online', () => {
        if (!offlineStatusRegistration || offlineOnlineOperation) return;
        offlineOnlineOperation = checkOfflineForUpdate()
            .finally(() => { offlineOnlineOperation = null; });
    });
}
