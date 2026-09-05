const OFFLINE_BUILD_ID = '5c943cfa60a4208b9e3ff44215c2f0b642251a377162edd8587ee5500554c948';
const OFFLINE_SCHEMA_VERSION = 1;
const SNAPSHOT_PREFIX = 'ren-courses-offline-';
const META_CACHE_NAME = 'ren-courses-offline-meta';
const LEGACY_CACHE_PREFIXES = [
    'ren-courses-online-first-v2',
    'ren-courses-online-first-v3',
    'ren-courses-online-first-v4',
    'ren-courses-online-first-v5'
];
const MANIFEST_PATH = 'offline-manifest.json';
const STATUS_PATH = '__offline-status.json';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 250, 750];
const CACHE_CONCURRENCY = 4;
const NAVIGATION_FALLBACK_TIMEOUT = 3000;

function snapshotCacheName(buildId = OFFLINE_BUILD_ID) {
    return `${SNAPSHOT_PREFIX}${buildId}`;
}

function scopeUrl(path) {
    return new URL(path, self.registration.scope);
}

function requestFor(url, cache = 'no-store') {
    return new Request(url.href || url, { method: 'GET', cache });
}

function failureDetail(error) {
    return error instanceof Error ? error.message : String(error);
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function retry(operation, label) {
    let lastError;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        if (RETRY_DELAYS[attempt]) await wait(RETRY_DELAYS[attempt]);

        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt + 1 < MAX_ATTEMPTS) {
                console.warn(`[SW] Retry ${attempt + 1}/${MAX_ATTEMPTS - 1} for ${label}:`, error);
            }
        }
    }

    throw lastError || new Error(`Request failed: ${label}`);
}

async function mapLimited(items, limit, operation) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
        while (true) {
            const index = nextIndex;
            nextIndex += 1;
            if (index >= items.length) return;

            try {
                results[index] = {
                    status: 'fulfilled',
                    value: await operation(items[index], index)
                };
            } catch (reason) {
                results[index] = { status: 'rejected', reason };
            }
        }
    }

    await Promise.all(Array.from(
        { length: Math.min(limit, items.length) },
        () => runWorker()));

    return results;
}

async function fetchManifest() {
    const url = scopeUrl(MANIFEST_PATH);
    const response = await retry(async () => {
        const result = await fetch(requestFor(url));
        if (!result.ok) throw new Error(`Offline manifest returned ${result.status}`);
        return result;
    }, url.href);
    const manifest = await response.clone().json();

    if (manifest.schemaVersion !== OFFLINE_SCHEMA_VERSION) {
        throw new Error(`Unsupported offline manifest schema: ${manifest.schemaVersion}`);
    }
    if (manifest.buildId !== OFFLINE_BUILD_ID) {
        throw new Error(`Offline manifest build ID does not match worker: ${manifest.buildId}`);
    }
    if (!Array.isArray(manifest.routes) || !Array.isArray(manifest.assets)) {
        throw new Error('Offline manifest routes and assets must be arrays');
    }
    if (manifest.routes.some(route => typeof route !== 'string')
        || manifest.assets.some(asset => typeof asset !== 'string')) {
        throw new Error('Offline manifest entries must be strings');
    }

    return { manifest, response, url };
}

function routeUrl(route) {
    return scopeUrl(route);
}

function assetUrl(asset) {
    return scopeUrl(asset);
}

function routeAliases(url) {
    const aliases = [new URL(url.href)];
    if (!url.pathname.endsWith('/')) {
        const slash = new URL(url.href);
        slash.pathname += '/';
        aliases.push(slash);
    }
    return aliases;
}

async function normalizedHtmlResponse(response) {
    if (!response.redirected) return response;

    return new Response(await response.clone().arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
    });
}

async function fetchRequiredResource(resource) {
    if (resource.manifest) return { resource, response: resource.response.clone() };

    const response = await retry(async () => {
        const result = await fetch(requestFor(resource.url));
        if (!result.ok) throw new Error(`Required resource returned ${result.status}: ${resource.url.href}`);

        if (resource.route) {
            const contentType = result.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                throw new Error(`Offline route is not HTML: ${resource.url.href}`);
            }
        }
        return resource.route ? normalizedHtmlResponse(result) : result;
    }, resource.url.href);

    return { resource, response };
}

async function cacheRoute(cache, url, response) {
    for (const alias of routeAliases(url)) {
        if (await cache.match(requestFor(alias, 'default'))) continue;
        await cache.put(requestFor(alias, 'default'), response.clone());
    }
}

function requiredResources(manifest) {
    const resources = new Map();
    manifest.routes.forEach(route => {
        const url = routeUrl(route);
        resources.set(url.href, { url, route: true });
    });
    manifest.assets.forEach(asset => {
        const url = assetUrl(asset);
        if (!resources.has(url.href)) resources.set(url.href, { url, route: false });
    });
    return [...resources.values()];
}

function requiredSnapshotResources(manifest) {
    return [
        {
            url: scopeUrl(MANIFEST_PATH),
            route: false,
            manifest: true
        },
        ...requiredResources(manifest)
    ];
}

async function storeResource(cache, result) {
    if (result.resource.manifest) {
        if (await cache.match(requestFor(result.resource.url, 'default'))) return;
        await cache.put(requestFor(result.resource.url, 'default'), result.response.clone());
        return;
    }
    if (result.resource.route) {
        await cacheRoute(cache, result.resource.url, result.response);
        return;
    }
    if (await cache.match(requestFor(result.resource.url, 'default'))) return;
    await cache.put(requestFor(result.resource.url, 'default'), result.response.clone());
}

async function missingSnapshotResources(cache, manifest) {
    const resources = requiredSnapshotResources(manifest);
    const missing = [];
    for (const resource of resources) {
        const aliases = resource.route ? routeAliases(resource.url) : [resource.url];
        const present = await Promise.all(aliases.map(alias =>
            cache.match(requestFor(alias, 'default'))));
        if (!present.every(Boolean)) missing.push(resource);
    }
    return missing;
}

async function validateSnapshot(cache, manifest) {
    const resources = requiredSnapshotResources(manifest);
    const missing = [];
    for (const resource of resources) {
        const aliases = resource.route ? routeAliases(resource.url) : [resource.url];
        for (const alias of aliases) {
            const response = await cache.match(requestFor(alias, 'default'));
            if (!response) missing.push(alias.href);
        }
    }
    return missing;
}

async function installSnapshot() {
    let previousMeta = null;
    let manifest = null;
    let cacheName = null;
    let cacheIsActive = false;

    try {
        previousMeta = await readMeta();
        const fetched = await fetchManifest();
        manifest = fetched.manifest;
        const cacheNameForBuild = snapshotCacheName(manifest.buildId);
        cacheName = cacheNameForBuild;
        cacheIsActive = previousMeta?.activeBuildId === manifest.buildId;
        if (!cacheIsActive) await caches.delete(cacheNameForBuild);
        const cache = await caches.open(cacheNameForBuild);

        const missingResources = await missingSnapshotResources(cache, manifest);
        if (cacheIsActive && missingResources.length === 0) {
            await self.skipWaiting();
            return;
        }

        const resources = missingResources.map(resource => resource.manifest
            ? { ...resource, response: fetched.response }
            : resource);
        const results = await mapLimited(resources, CACHE_CONCURRENCY,
            resource => fetchRequiredResource(resource));
        const failure = results.find(result => result.status === 'rejected');
        if (failure) throw failure.reason;

        const storeResults = await mapLimited(results.map(result => result.value), CACHE_CONCURRENCY,
            result => storeResource(cache, result));
        const storeFailure = storeResults.find(result => result.status === 'rejected');
        if (storeFailure) throw storeFailure.reason;
        const remaining = await validateSnapshot(cache, manifest);
        if (remaining.length) {
            throw new Error(`Offline snapshot is incomplete: ${remaining.join(', ')}`);
        }

        await self.skipWaiting();
    } catch (error) {
        if (cacheName && !cacheIsActive) {
            await caches.delete(cacheName).catch(deleteError =>
                console.warn('[SW] Failed to remove incomplete snapshot:', deleteError));
        }
        await recordError({
            previousMeta,
            errorCode: 'installation-failed',
            detail: failureDetail(error),
            failedBuildId: manifest?.buildId || OFFLINE_BUILD_ID
        });
        throw error;
    }
}

function metaRequest() {
    return requestFor(scopeUrl(STATUS_PATH), 'default');
}

async function readMeta() {
    const cache = await caches.open(META_CACHE_NAME);
    const response = await cache.match(metaRequest());
    return response ? response.json() : null;
}

async function writeMeta(meta) {
    const cache = await caches.open(META_CACHE_NAME);
    await cache.put(metaRequest(), new Response(JSON.stringify(meta), {
        headers: { 'Content-Type': 'application/json' }
    }));
}

async function recordError({ previousMeta, errorCode, detail, failedBuildId }) {
    try {
        await writeMeta({
            activeBuildId: previousMeta?.activeBuildId || null,
            state: 'error',
            errorCode,
            detail,
            failedBuildId: failedBuildId || previousMeta?.failedBuildId || OFFLINE_BUILD_ID
        });
        await notifyStatus();
    } catch (metadataError) {
        console.warn('[SW] Failed to persist offline error:', metadataError);
    }
}

async function readSnapshotManifest(cache) {
    const response = await cache.match(requestFor(scopeUrl(MANIFEST_PATH), 'default'));
    if (!response) throw new Error('Offline manifest is missing from the active snapshot');

    const manifest = await response.json();
    if (manifest.schemaVersion !== OFFLINE_SCHEMA_VERSION
        || manifest.buildId !== OFFLINE_BUILD_ID) {
        throw new Error('Active snapshot manifest does not match the worker');
    }
    return manifest;
}

async function activeSnapshot() {
    const meta = await readMeta();
    const buildId = meta?.activeBuildId || null;
    const cache = buildId ? await caches.open(snapshotCacheName(buildId)) : null;
    return { cache, meta, buildId };
}

async function getOfflineStatus() {
    const { cache, meta, buildId } = await activeSnapshot();
    if (meta?.state === 'error') {
        return {
            type: 'offline-status',
            state: 'error',
            buildId,
            errorCode: meta.errorCode || 'offline-error',
            detail: meta.detail || 'Offline cache installation failed'
        };
    }
    if (!cache || !buildId) {
        return {
            type: 'offline-status',
            state: 'error',
            buildId: null,
            errorCode: 'cache-invalid',
            detail: 'Offline manifest is missing from the active snapshot'
        };
    }
    try {
        const manifest = await readSnapshotManifest(cache);
        const missing = await validateSnapshot(cache, manifest);
        if (missing.length) {
            return {
                type: 'offline-status',
                state: 'error',
                buildId,
                errorCode: 'missing-resource',
                detail: `Missing ${missing.length} required resource${missing.length === 1 ? '' : 's'}`
            };
        }
        return {
            type: 'offline-status',
            state: 'ready',
            buildId,
            errorCode: null,
            detail: null
        };
    } catch (error) {
        return {
            type: 'offline-status',
            state: 'error',
            buildId: meta?.activeBuildId || null,
            errorCode: 'cache-invalid',
            detail: failureDetail(error)
        };
    }
}

async function repairOfflineCache() {
    const { cache, buildId } = await activeSnapshot();
    if (!cache || !buildId) throw new Error('The active snapshot is missing');
    if (buildId !== OFFLINE_BUILD_ID) {
        throw new Error('The active snapshot does not belong to this worker');
    }

    let manifest;
    let manifestResponse;
    try {
        manifest = await readSnapshotManifest(cache);
    } catch (error) {
        const fetched = await fetchManifest();
        if (fetched.manifest.buildId !== buildId) throw error;
        manifest = fetched.manifest;
        manifestResponse = fetched.response;
    }

    const missing = await missingSnapshotResources(cache, manifest);
    const resources = missing.map(resource => resource.manifest
        ? { ...resource, response: manifestResponse }
        : resource);

    const results = await mapLimited(resources, CACHE_CONCURRENCY,
        resource => fetchRequiredResource(resource));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    const storeResults = await mapLimited(results.map(result => result.value), CACHE_CONCURRENCY,
        result => storeResource(cache, result));
    const storeFailure = storeResults.find(result => result.status === 'rejected');
    if (storeFailure) throw storeFailure.reason;

    const remaining = await validateSnapshot(cache, manifest);
    if (remaining.length) throw new Error(`Offline repair is incomplete: ${remaining.join(', ')}`);
    await writeMeta({
        activeBuildId: buildId,
        state: 'ready',
        errorCode: null,
        detail: null,
        failedBuildId: null
    });
    return getOfflineStatus();
}

async function installationStatus() {
    const meta = await readMeta();
    if (meta?.state === 'error') return getOfflineStatus();
    return {
        type: 'offline-status',
        state: 'updating',
        buildId: meta?.activeBuildId || null,
        errorCode: null,
        detail: null
    };
}

async function recordClientError(message) {
    const previousMeta = await readMeta();
    await writeMeta({
        activeBuildId: previousMeta?.activeBuildId || null,
        state: 'error',
        errorCode: message.errorCode || 'offline-error',
        detail: message.detail || 'Offline operation failed',
        failedBuildId: message.failedBuildId
            || previousMeta?.failedBuildId
            || OFFLINE_BUILD_ID
    });
    return getOfflineStatus();
}

async function cleanupOldCaches() {
    const current = snapshotCacheName();
    const names = await caches.keys();
    await Promise.all(names
        .filter(name => (name.startsWith(SNAPSHOT_PREFIX) && name !== META_CACHE_NAME && name !== current)
            || LEGACY_CACHE_PREFIXES.some(prefix => name.startsWith(prefix)))
        .map(name => caches.delete(name)));
}

async function notifyStatus() {
    const status = await getOfflineStatus();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage(status));
    return status;
}

function offlineErrorResponse(url) {
    return new Response(`Offline resource unavailable: ${url}`, {
        status: 503,
        statusText: 'Offline resource unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
}

async function findCachedNavigation(cache, request) {
    const url = new URL(request.url);
    const aliases = routeAliases(url);
    for (const alias of aliases) {
        const response = await cache.match(requestFor(alias, 'default'));
        if (response) return response;
    }
    return null;
}

async function handleNavigation(request) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NAVIGATION_FALLBACK_TIMEOUT);
    const networkRequest = fetch(request, { signal: controller.signal })
        .finally(() => clearTimeout(timeout));
    let cached = null;
    try {
        const snapshot = await activeSnapshot();
        if (snapshot.cache) {
            cached = await findCachedNavigation(snapshot.cache, request);
        }
    } catch {
        cached = null;
    }

    if (cached) {
        try {
            const response = await Promise.race([
                networkRequest,
                wait(NAVIGATION_FALLBACK_TIMEOUT).then(() => cached)
            ]);
            if (!response.ok) return cached;
            return response;
        } catch {
            return cached;
        }
    }

    try {
        return await networkRequest;
    } catch (error) {
        console.warn('[SW] Navigation fetch failed:', request.url, error);
        return offlineErrorResponse(request.url);
    }
}

async function handleLocalAsset(request) {
    try {
        const { cache } = await activeSnapshot();
        if (cache) {
            const cached = await cache.match(request);
            if (cached) return cached;
        }
        return await fetch(request);
    } catch (error) {
        console.warn('[SW] Local asset fetch failed:', request.url, error);
        return offlineErrorResponse(request.url);
    }
}

function replyToMessage(event, payload) {
    const port = event.ports?.[0];
    if (!port) return;
    try {
        port.postMessage(payload);
    } catch (error) {
        console.warn('[SW] Failed to reply to offline message:', error);
    } finally {
        port.close?.();
    }
}

self.addEventListener('install', event => {
    event.waitUntil(installSnapshot().catch(error => {
        console.warn('[SW] Snapshot installation failed:', error);
        throw error;
    }));
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        let previousMeta = null;
        try {
            previousMeta = await readMeta();
            const cache = await caches.open(snapshotCacheName());
            const manifest = await readSnapshotManifest(cache);
            const missing = await validateSnapshot(cache, manifest);
            if (missing.length) throw new Error(`Cannot activate incomplete snapshot: ${missing.join(', ')}`);
            await writeMeta({
                activeBuildId: OFFLINE_BUILD_ID,
                state: 'ready',
                errorCode: null,
                detail: null,
                failedBuildId: null
            });
            await cleanupOldCaches();
            await self.clients.claim();
        } catch (error) {
            await recordError({
                previousMeta,
                errorCode: 'activation-failed',
                detail: failureDetail(error),
                failedBuildId: OFFLINE_BUILD_ID
            });
            throw error;
        }
    })());
});

self.addEventListener('message', event => {
    const message = event.data || {};

    if (message.type === 'get-offline-status') {
        event.waitUntil(getOfflineStatus()
            .then(status => {
                replyToMessage(event, status);
            })
            .catch(error => {
                replyToMessage(event, {
                    type: 'offline-status',
                    state: 'error',
                    buildId: null,
                    errorCode: 'status-failed',
                    detail: failureDetail(error)
                });
            }));
        return;
    }

    if (message.type === 'get-offline-installation-status') {
        event.waitUntil(installationStatus()
            .then(status => replyToMessage(event, status))
            .catch(error => replyToMessage(event, {
                type: 'offline-status',
                state: 'error',
                buildId: null,
                errorCode: 'status-failed',
                detail: failureDetail(error)
            })));
        return;
    }

    if (message.type === 'record-offline-error') {
        event.waitUntil(recordClientError(message)
            .then(status => replyToMessage(event, status))
            .catch(error => replyToMessage(event, {
                type: 'offline-status',
                state: 'error',
                buildId: null,
                errorCode: message.errorCode || 'offline-error',
                detail: failureDetail(error)
            })));
        return;
    }

    if (message.type === 'repair-offline-cache') {
        event.waitUntil(repairOfflineCache()
            .then(status => {
                replyToMessage(event, status);
            })
            .catch(async error => {
                const detail = failureDetail(error);
                const previousMeta = await readMeta().catch(() => null);
                await recordError({
                    previousMeta,
                    errorCode: 'repair-failed',
                    detail,
                    failedBuildId: previousMeta?.failedBuildId || null
                });
                const status = await getOfflineStatus().catch(statusError => ({
                    type: 'offline-status',
                    state: 'error',
                    buildId: previousMeta?.activeBuildId || null,
                    errorCode: 'repair-failed',
                    detail: failureDetail(statusError)
                }));
                replyToMessage(event, status);
            }));
    }
});

self.addEventListener('fetch', event => {
    const { request } = event;
    if (request.method !== 'GET') return;

    if (request.mode === 'navigate') {
        event.respondWith(handleNavigation(request));
        return;
    }

    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        event.respondWith(handleLocalAsset(request));
    }
});
