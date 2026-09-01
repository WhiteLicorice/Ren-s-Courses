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
});

function normalizeCleanPageUrl() {
    const { pathname, search, hash } = window.location;
    if (pathname.length > 1 && pathname.endsWith('/')) {
        window.history.replaceState(window.history.state, '',
            `${pathname.slice(0, -1)}${search}${hash}`);
    }
}

normalizeCleanPageUrl();

const OFFLINE_STATUS_TIMEOUT = 3000;
const OFFLINE_REPAIR_TIMEOUT = 30000;
let offlineStatusRegistration = null;
let offlineStatus = {
    state: 'updating',
    buildId: null,
    errorCode: null,
    detail: null
};

const OFFLINE_STATE_COPY = {
    ready: { label: 'Ready', icon: '✓' },
    updating: { label: 'Updating', icon: '↻' },
    error: { label: 'Error', icon: '!' }
};

function conciseOfflineDetail(status) {
    return typeof status.detail === 'string' && status.detail.trim()
        ? status.detail.trim()
        : 'Offline content is not complete';
}

function updateOfflineStatus(status) {
    const state = OFFLINE_STATE_COPY[status?.state] ? status.state : 'error';
    const copy = OFFLINE_STATE_COPY[state];
    const detail = state === 'error' ? conciseOfflineDetail(status) : null;
    offlineStatus = {
        state,
        buildId: status?.buildId ?? null,
        errorCode: status?.errorCode ?? null,
        detail
    };

    const badge = document.querySelector('#offline-status-badge');
    if (!badge) return;

    badge.dataset.offlineState = state;
    badge.querySelector('[data-offline-icon]')?.replaceChildren(copy.icon);
    const label = badge.querySelector('[data-offline-label]');
    if (label) label.textContent = copy.label;

    const accessibleLabel = state === 'ready'
        ? 'Ready. Select to check for updates.'
        : state === 'updating'
            ? 'Updating offline content.'
            : `Error. ${detail}. Select to retry.`;
    badge.setAttribute('aria-label', accessibleLabel);
    badge.title = accessibleLabel;
    badge.setAttribute('aria-disabled', state === 'updating' ? 'true' : 'false');
}

window.updateOfflineStatus = updateOfflineStatus;

function postToOfflineWorker(message, timeout = OFFLINE_STATUS_TIMEOUT, targetWorker = null) {
    const worker = targetWorker || navigator.serviceWorker.controller || offlineStatusRegistration?.active;
    if (!worker) return Promise.resolve(null);

    return new Promise(resolve => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => resolve(null), timeout);
        channel.port1.onmessage = event => {
            clearTimeout(timer);
            resolve(event.data);
        };
        worker.postMessage(message, [channel.port2]);
    });
}

function waitForOfflineWorkerChange(registration) {
    const worker = registration.installing;
    if (!worker) return Promise.resolve(null);
    if (worker.state === 'activated') return Promise.resolve('activated');
    if (worker.state === 'redundant') return Promise.resolve('redundant');

    return new Promise(resolve => {
        const onStateChange = () => {
            if (worker.state !== 'activated' && worker.state !== 'redundant') return;
            worker.removeEventListener('statechange', onStateChange);
            resolve(worker.state);
        };
        worker.addEventListener('statechange', onStateChange);
    });
}

async function requestOfflineStatus() {
    try {
        const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
        offlineStatusRegistration = registration;
        const status = await postToOfflineWorker({ type: 'get-offline-status' });
        if (!status) throw new Error('Offline status request timed out');
        updateOfflineStatus(status);
    } catch (error) {
        console.warn('[SW] Offline status request failed:', error);
        updateOfflineStatus({
            state: 'error',
            buildId: null,
            errorCode: 'status-failed',
            detail: 'Status check failed'
        });
    }
}

async function checkOfflineForUpdate() {
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });

    try {
        const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
        offlineStatusRegistration = registration;
        await registration.update();
        const updateState = await waitForOfflineWorkerChange(registration);
        if (updateState === 'redundant') throw new Error('Offline update installation failed');
        await requestOfflineStatus();
    } catch (error) {
        console.warn('[SW] Offline update check failed:', error);
        updateOfflineStatus({
            state: 'error',
            buildId: offlineStatus.buildId,
            errorCode: 'update-failed',
            detail: 'Update check failed'
        });
    }
}

async function repairOfflineCache() {
    const wasError = offlineStatus.state === 'error';
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });

    try {
        const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
        offlineStatusRegistration = registration;
        await registration.update();
        const updateState = await waitForOfflineWorkerChange(registration);
        if (updateState === 'redundant') throw new Error('Offline update installation failed');
        const currentStatus = await postToOfflineWorker(
            { type: 'get-offline-status' }, OFFLINE_STATUS_TIMEOUT,
            updateState === 'activated' ? registration.active : null);
        if (currentStatus?.state === 'ready') {
            if (wasError) {
                await registration.unregister();
                const replacement = await navigator.serviceWorker.register(
                    new URL('service-worker.js', document.baseURI));
                offlineStatusRegistration = replacement;
                watchOfflineInstallation(replacement);
                replacement.addEventListener('updatefound', () => watchOfflineInstallation(replacement));
                const replacementState = await waitForOfflineWorkerChange(replacement);
                if (replacementState === 'redundant') {
                    throw new Error('Offline retry installation failed');
                }
                const replacementStatus = await postToOfflineWorker(
                    { type: 'get-offline-status' }, OFFLINE_REPAIR_TIMEOUT,
                    replacement.active);
                if (!replacementStatus) throw new Error('Offline retry status timed out');
                updateOfflineStatus(replacementStatus);
                return;
            }
            updateOfflineStatus(currentStatus);
            return;
        }

        const status = await postToOfflineWorker(
            { type: 'repair-offline-cache' }, OFFLINE_REPAIR_TIMEOUT);
        if (!status) throw new Error('Offline repair timed out');
        updateOfflineStatus(status);
    } catch (error) {
        console.warn('[SW] Offline cache repair failed:', error);
        updateOfflineStatus({
            state: 'error',
            buildId: offlineStatus.buildId,
            errorCode: 'repair-failed',
            detail: 'Retry failed'
        });
    }
}

function initOfflineBadge() {
    const badge = document.querySelector('#offline-status-badge');
    if (!badge || badge.dataset.offlineBound === 'true') return;

    badge.dataset.offlineBound = 'true';
    badge.addEventListener('click', () => {
        if (offlineStatus.state === 'updating') return;
        if (offlineStatus.state === 'ready') checkOfflineForUpdate();
        if (offlineStatus.state === 'error') repairOfflineCache();
    });
    updateOfflineStatus(offlineStatus);
}

function watchOfflineInstallation(registration) {
    const worker = registration.installing;
    if (!worker || worker.datasetOfflineWatcher === true) return;
    worker.datasetOfflineWatcher = true;
    updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });

    worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') requestOfflineStatus();
        if (worker.state === 'redundant') {
            updateOfflineStatus({
                state: 'error',
                buildId: offlineStatus.buildId,
                errorCode: 'installation-failed',
                detail: 'Installation failed'
            });
        }
    });
}

async function registerOfflineWorker() {
    if (document.documentElement.dataset.environment === 'Development') return;
    if (!('serviceWorker' in navigator)) {
        updateOfflineStatus({
            state: 'error',
            buildId: null,
            errorCode: 'unsupported',
            detail: 'Offline mode is unavailable'
        });
        return;
    }

    updateOfflineStatus({ state: 'updating', buildId: null });
    try {
        const swUrl = new URL('service-worker.js', document.baseURI);
        const registration = await navigator.serviceWorker.register(swUrl);
        offlineStatusRegistration = registration;
        watchOfflineInstallation(registration);
        registration.addEventListener('updatefound', () => watchOfflineInstallation(registration));
        await requestOfflineStatus();
    } catch (error) {
        console.warn('[SW] Registration failed:', error);
        updateOfflineStatus({
            state: 'error',
            buildId: null,
            errorCode: 'registration-failed',
            detail: 'Registration failed'
        });
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', registerOfflineWorker);
    navigator.serviceWorker.addEventListener('controllerchange', requestOfflineStatus);
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'offline-status') updateOfflineStatus(event.data);
    });

    window.addEventListener('online', () => {
        if (!offlineStatusRegistration) return;
        updateOfflineStatus({ state: 'updating', buildId: offlineStatus.buildId });
        checkOfflineForUpdate();
    });
}
