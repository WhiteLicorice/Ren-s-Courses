// wwwroot/site.js

/**
 * MAIN ENTRY POINT
 * Initializes all dynamic features once the DOM is ready.
 * * Note: Individual feature files (calendar.js, toc.js, etc.) must be 
 * loaded BEFORE this file in App.razor for these calls to work.
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
let offlineStatusRegistration = null;
let offlineStatusToast = null;
let offlineStatusTimer = null;

function ensureOfflineStatusToast() {
    if (offlineStatusToast) return offlineStatusToast;

    offlineStatusToast = document.createElement('div');
    offlineStatusToast.id = 'offline-status-toast';
    offlineStatusToast.setAttribute('role', 'status');
    offlineStatusToast.setAttribute('aria-live', 'polite');
    document.body.appendChild(offlineStatusToast);
    return offlineStatusToast;
}

function showOfflineStatus(status) {
    const toast = ensureOfflineStatusToast();
    clearTimeout(offlineStatusTimer);
    toast.replaceChildren();

    const message = document.createElement('span');
    const isReady = status.localReady && status.externalReady;
    toast.dataset.offlineStatus = isReady ? 'ready' : 'warning';
    toast.dataset.offlineStatusVersion = status.version || '';
    message.textContent = isReady
        ? 'Offline mode is ready.'
        : 'Offline setup is incomplete. Reconnect to finish.';
    toast.appendChild(message);

    if (!isReady) {
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.textContent = 'Retry';
        retryButton.addEventListener('click', () => retryOfflineSetup(retryButton));
        toast.appendChild(retryButton);
        toast.hidden = false;
        return;
    }

    const announcedKey = `offline-cache-announced:${status.version}`;
    if (localStorage.getItem(announcedKey)) {
        toast.hidden = true;
        return;
    }

    localStorage.setItem(announcedKey, 'true');
    toast.hidden = false;
    offlineStatusTimer = setTimeout(() => {
        toast.hidden = true;
    }, 5000);
}

function postToOfflineWorker(message, timeout = OFFLINE_STATUS_TIMEOUT) {
    const worker = navigator.serviceWorker.controller || offlineStatusRegistration?.active;
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

async function requestOfflineStatus() {
    try {
        const registration = offlineStatusRegistration || await navigator.serviceWorker.ready;
        offlineStatusRegistration = registration;
        const status = await postToOfflineWorker({ type: 'get-offline-status' });
        if (status) showOfflineStatus(status);
    } catch (error) {
        console.warn('[SW] Offline status request failed:', error);
    }
}

async function retryOfflineSetup(button) {
    button.disabled = true;
    try {
        const status = await postToOfflineWorker({ type: 'retry-external-assets' }, 30000);
        if (status) showOfflineStatus(status);
    } finally {
        button.disabled = false;
    }
}

function watchOfflineInstallation(registration) {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') requestOfflineStatus();
        if (worker.state === 'redundant') {
            showOfflineStatus({
                version: 'installation-failed',
                localReady: false,
                externalReady: false,
            });
        }
    });
}

if ('serviceWorker' in navigator) {
    const swUrl = new URL('service-worker.js', document.baseURI);
    navigator.serviceWorker.register(swUrl).then(registration => {
        offlineStatusRegistration = registration;
        watchOfflineInstallation(registration);
        registration.addEventListener('updatefound', () => watchOfflineInstallation(registration));
        requestOfflineStatus();
    }).catch(err => {
        console.warn('[SW] registration failed:', err);
        showOfflineStatus({ version: 'registration-failed', localReady: false, externalReady: false });
    });

    navigator.serviceWorker.addEventListener('controllerchange', requestOfflineStatus);
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'offline-status') showOfflineStatus(event.data);
    });

    window.addEventListener('online', () => {
        const controller = navigator.serviceWorker.controller;
        if (!controller) return;

        postToOfflineWorker({ type: 'retry-external-assets' }, 30000).then(status => {
            if (status) showOfflineStatus(status);
        });
        controller.postMessage({ type: 'refresh-route', url: window.location.href });
    });
}
