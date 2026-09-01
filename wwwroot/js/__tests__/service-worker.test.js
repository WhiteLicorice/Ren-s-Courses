'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TextDecoder, TextEncoder } = require('util');

const source = fs.readFileSync(
    path.join(__dirname, '../../../Offline/service-worker.template.js'), 'utf8');
const BUILD_ID = 'a'.repeat(64);
const OLD_BUILD_ID = 'b'.repeat(64);
const SCOPE = 'https://offline.test/';

class TestHeaders {
    constructor(headers = {}) {
        this.values = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    }

    get(name) {
        return this.values.get(name.toLowerCase()) || null;
    }
}

class TestResponse {
    constructor(body = '', options = {}) {
        this.body = body && typeof body !== 'string' && typeof body.byteLength === 'number'
            ? new Uint8Array(body)
            : new TextEncoder().encode(String(body));
        this.status = options.status || 200;
        this.statusText = options.statusText || '';
        this.headers = options.headers instanceof TestHeaders
            ? options.headers
            : new TestHeaders(options.headers);
        this.redirected = options.redirected === true;
    }

    get ok() {
        return this.status >= 200 && this.status < 300;
    }

    clone() {
        return new TestResponse(this.body, {
            status: this.status,
            statusText: this.statusText,
            headers: this.headers,
            redirected: this.redirected,
        });
    }

    async arrayBuffer() {
        return this.body.slice().buffer;
    }

    async text() {
        return new TextDecoder().decode(this.body);
    }

    async json() {
        return JSON.parse(await this.text());
    }
}

class TestRequest {
    constructor(url, options = {}) {
        this.url = new URL(url, SCOPE).href;
        this.method = options.method || 'GET';
        this.mode = options.mode || 'same-origin';
    }
}

const Request = TestRequest;
const Response = TestResponse;

async function cloneResponse(response) {
    return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

class MemoryCache {
    constructor(name, fault) {
        this.name = name;
        this.fault = fault;
        this.entries = new Map();
        this.putAttempts = [];
    }

    key(request) {
        return new URL(request.url || request, SCOPE).href;
    }

    async match(request) {
        const response = this.entries.get(this.key(request));
        return response ? cloneResponse(response) : undefined;
    }

    async put(request, response) {
        const key = this.key(request);
        this.putAttempts.push({ key, response });
        if (this.fault?.put?.(this.name, key)) throw new Error(`cache put failed: ${key}`);
        this.entries.set(key, await cloneResponse(response));
    }

    async delete(request) {
        return this.entries.delete(this.key(request));
    }

    async keys() {
        return [...this.entries.keys()].map(url => new Request(url));
    }
}

class MemoryCaches {
    constructor(fault = {}) {
        this.fault = fault;
        this.caches = new Map();
        this.deleteAttempts = [];
    }

    async open(name) {
        if (!this.caches.has(name)) this.caches.set(name, new MemoryCache(name, this.fault));
        return this.caches.get(name);
    }

    async delete(name) {
        this.deleteAttempts.push(name);
        if (this.fault.delete?.(name)) throw new Error(`cache delete failed: ${name}`);
        return this.caches.delete(name);
    }

    async keys() {
        return [...this.caches.keys()];
    }
}

function responseFor(body, contentType = 'text/plain') {
    return new Response(body, { headers: { 'Content-Type': contentType } });
}

function manifestFor(buildId = BUILD_ID, routes = ['./', 'articles/about'], assets = ['app.js', 'app.css']) {
    return { schemaVersion: 1, buildId, routes, assets };
}

function urlFor(pathname) {
    return new URL(pathname, SCOPE).href;
}

function routeKeys(route) {
    const url = new URL(route, SCOPE);
    const keys = [url.href];
    if (!url.pathname.endsWith('/')) keys.push(`${url.href}/`);
    return keys;
}

async function seedCache(cache, manifest, entries = {}) {
    await cache.put(new Request(urlFor('offline-manifest.json')), responseFor(JSON.stringify(manifest), 'application/json'));
    for (const route of manifest.routes) {
        const body = entries[route] || `cached ${route}`;
        for (const key of routeKeys(route)) await cache.put(new Request(key), responseFor(body, 'text/html'));
    }
    for (const asset of manifest.assets) {
        if (entries[asset] === null) continue;
        await cache.put(new Request(urlFor(asset)), responseFor(entries[asset] || `cached ${asset}`));
    }
}

function createWorker({ manifest = manifestFor(), fetchFailures = new Set(), fault = {} } = {}) {
    const caches = new MemoryCaches(fault);
    const listeners = new Map();
    const clients = [];
    const fetches = [];
    const self = {
        location: new URL(SCOPE),
        registration: { scope: SCOPE },
        clients: {
            matchAll: jest.fn(async () => clients),
            claim: jest.fn(() => Promise.resolve()),
        },
        skipWaiting: jest.fn(() => Promise.resolve()),
        addEventListener: jest.fn((type, listener) => listeners.set(type, listener)),
    };
    const context = {
        self,
        caches,
        fetch: jest.fn(async request => {
            const url = new URL(request.url || request, SCOPE);
            fetches.push(url.pathname);
            if (fetchFailures.has(url.pathname)) throw new Error(`fetch failed: ${url.pathname}`);
            if (url.pathname === '/offline-manifest.json') {
                return responseFor(JSON.stringify(manifest), 'application/json');
            }
            if (manifest.routes.some(route => new URL(route, SCOPE).pathname === url.pathname)) {
                return responseFor(`network ${url.pathname}`, 'text/html');
            }
            return responseFor(`network ${url.pathname}`);
        }),
        Request: TestRequest,
        Response: TestResponse,
        URL,
        AbortController,
        Promise,
        setTimeout,
        clearTimeout,
        console,
    };
    vm.runInNewContext(source.replace(
        "const OFFLINE_BUILD_ID = '__OFFLINE_BUILD_ID__';",
        `const OFFLINE_BUILD_ID = '${BUILD_ID}';`), context);

    async function dispatch(type, data = {}) {
        const waits = [];
        const event = {
            ...data,
            waitUntil(promise) { waits.push(Promise.resolve(promise)); },
        };
        listeners.get(type)(event);
        return Promise.all(waits);
    }

    async function readMeta() {
        const cache = await caches.open('ren-courses-offline-meta');
        const response = await cache.match(new Request(urlFor('__offline-status.json')));
        return response ? response.json() : null;
    }

    return { caches, clients, fetches, self, listeners, dispatch, readMeta };
}

async function seedMeta(caches, meta) {
    const cache = await caches.open('ren-courses-offline-meta');
    await cache.put(new Request(urlFor('__offline-status.json')), responseFor(JSON.stringify(meta), 'application/json'));
}

function readyMeta(buildId = BUILD_ID, overrides = {}) {
    return {
        activeBuildId: buildId,
        state: 'ready',
        errorCode: null,
        detail: null,
        failedBuildId: null,
        ...overrides,
    };
}

async function snapshotEntries(caches, buildId) {
    const cache = await caches.open(`ren-courses-offline-${buildId}`);
    const entries = {};
    for (const request of await cache.keys()) {
        const response = await cache.match(request);
        entries[request.url] = [...new Uint8Array(await response.arrayBuffer())];
    }
    return entries;
}

test('ready status requires a valid active snapshot and no stored failure', async () => {
    const worker = createWorker();
    const manifest = manifestFor();
    await seedCache(await worker.caches.open(`ren-courses-offline-${BUILD_ID}`), manifest);
    await seedMeta(worker.caches, readyMeta());
    const reply = { postMessage: jest.fn(), close: jest.fn() };

    await worker.dispatch('message', { data: { type: 'get-offline-status' }, ports: [reply] });
    expect(reply.postMessage).toHaveBeenCalledWith(expect.objectContaining({ state: 'ready' }));
    expect(reply.close).toHaveBeenCalled();

    await seedMeta(worker.caches, readyMeta(BUILD_ID, {
        state: 'error',
        errorCode: 'installation-failed',
        detail: 'saved failure',
        failedBuildId: BUILD_ID,
    }));
    const errorReply = { postMessage: jest.fn(), close: jest.fn() };
    await worker.dispatch('message', { data: { type: 'get-offline-status' }, ports: [errorReply] });
    expect(errorReply.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        state: 'error',
        errorCode: 'installation-failed',
        detail: 'saved failure',
    }));
});

test('same-build reinstall does not modify a complete active snapshot', async () => {
    const worker = createWorker();
    const manifest = manifestFor();
    const cache = await worker.caches.open(`ren-courses-offline-${BUILD_ID}`);
    await seedCache(cache, manifest);
    await seedMeta(worker.caches, readyMeta());
    cache.putAttempts = [];
    worker.fetches.length = 0;

    await worker.dispatch('install');

    expect(worker.fetches).toEqual(['/offline-manifest.json']);
    expect(cache.putAttempts).toHaveLength(0);
    expect(worker.self.skipWaiting).toHaveBeenCalled();
});

test('same-build repair fetches all missing entries before writing only absent entries', async () => {
    const manifest = manifestFor(BUILD_ID, ['./', 'articles/about'], ['app.js', 'missing.css']);
    const worker = createWorker({ manifest });
    const cache = await worker.caches.open(`ren-courses-offline-${BUILD_ID}`);
    await cache.put(new Request(urlFor('offline-manifest.json')), responseFor(JSON.stringify(manifest), 'application/json'));
    for (const key of routeKeys('./')) await cache.put(new Request(key), responseFor('old root', 'text/html'));
    await cache.put(new Request(urlFor('app.js')), responseFor('old app'));
    await seedMeta(worker.caches, readyMeta());
    cache.putAttempts = [];
    worker.fetches.length = 0;

    await worker.dispatch('install');

    expect(worker.fetches).toEqual(expect.arrayContaining([
        '/offline-manifest.json', '/articles/about', '/missing.css',
    ]));
    expect(worker.fetches).not.toContain('/');
    expect(worker.fetches).not.toContain('/app.js');
    const writtenPaths = cache.putAttempts.map(attempt => new URL(attempt.key).pathname);
    expect(writtenPaths).toEqual(expect.arrayContaining([
        '/articles/about', '/articles/about/', '/missing.css',
    ]));
    expect(writtenPaths).not.toContain('/');
    expect(writtenPaths).not.toContain('/app.js');
    expect(await (await cache.match(new Request(urlFor('app.js')))).text()).toBe('old app');
});

test.each([
    ['manifest fetch failure', { fetchFailures: new Set(['/offline-manifest.json']) }],
    ['required resource failure', { fetchFailures: new Set(['/articles/about']) }],
    ['manifest cache write failure', { fault: { put: (name, key) => name.endsWith(BUILD_ID) && key.endsWith('/offline-manifest.json') } }],
    ['clean route cache write failure', { fault: { put: (name, key) => name.endsWith(BUILD_ID) && key.endsWith('/articles/about') } }],
    ['route alias cache write failure', { fault: { put: (name, key) => name.endsWith(BUILD_ID) && key.endsWith('/articles/about/') } }],
    ['asset cache write failure', { fault: { put: (name, key) => name.endsWith(BUILD_ID) && key.endsWith('/app.css') } }],
])('%s preserves the previous complete active snapshot and records both builds', async (_name, options) => {
    const manifest = manifestFor(BUILD_ID);
    const worker = createWorker({ manifest, ...options });
    const oldManifest = manifestFor(OLD_BUILD_ID);
    const oldCache = await worker.caches.open(`ren-courses-offline-${OLD_BUILD_ID}`);
    await seedCache(oldCache, oldManifest, { './': 'old root', 'articles/about': 'old article' });
    await seedMeta(worker.caches, readyMeta(OLD_BUILD_ID));
    const before = await snapshotEntries(worker.caches, OLD_BUILD_ID);

    await expect(worker.dispatch('install')).rejects.toThrow();

    expect(await snapshotEntries(worker.caches, OLD_BUILD_ID)).toEqual(before);
    expect(await worker.readMeta()).toEqual(expect.objectContaining({
        activeBuildId: OLD_BUILD_ID,
        state: 'error',
        errorCode: 'installation-failed',
        failedBuildId: BUILD_ID,
    }));
});

test('activation validation failure keeps the old active build and records the new failure', async () => {
    const worker = createWorker();
    const oldCache = await worker.caches.open(`ren-courses-offline-${OLD_BUILD_ID}`);
    await seedCache(oldCache, manifestFor(OLD_BUILD_ID));
    await seedMeta(worker.caches, readyMeta(OLD_BUILD_ID));
    await worker.caches.open(`ren-courses-offline-${BUILD_ID}`);

    await expect(worker.dispatch('activate')).rejects.toThrow();

    expect(await worker.readMeta()).toEqual(expect.objectContaining({
        activeBuildId: OLD_BUILD_ID,
        state: 'error',
        errorCode: 'activation-failed',
        failedBuildId: BUILD_ID,
    }));
});

test('repair failure preserves existing bytes and leaves the error metadata actionable', async () => {
    const manifest = manifestFor(BUILD_ID, ['./', 'articles/about'], ['app.js', 'missing.css']);
    const worker = createWorker({ manifest, fetchFailures: new Set(['/missing.css']) });
    const cache = await worker.caches.open(`ren-courses-offline-${BUILD_ID}`);
    await cache.put(new Request(urlFor('offline-manifest.json')), responseFor(JSON.stringify(manifest), 'application/json'));
    for (const key of routeKeys('./')) await cache.put(new Request(key), responseFor('old root', 'text/html'));
    await cache.put(new Request(urlFor('app.js')), responseFor('old app'));
    await seedMeta(worker.caches, readyMeta(BUILD_ID, {
        state: 'error', errorCode: 'missing-resource', detail: 'Missing 2 resources', failedBuildId: BUILD_ID,
    }));
    const before = await snapshotEntries(worker.caches, BUILD_ID);
    const reply = { postMessage: jest.fn(), close: jest.fn() };

    await worker.dispatch('message', { data: { type: 'repair-offline-cache' }, ports: [reply] });

    expect(await snapshotEntries(worker.caches, BUILD_ID)).toEqual(before);
    expect(await worker.readMeta()).toEqual(expect.objectContaining({
        activeBuildId: BUILD_ID,
        state: 'error',
        errorCode: 'repair-failed',
        failedBuildId: BUILD_ID,
    }));
    expect(reply.close).toHaveBeenCalled();
});

test('client-detected failures persist through the private worker message', async () => {
    const worker = createWorker();
    await seedMeta(worker.caches, readyMeta(OLD_BUILD_ID));
    const reply = { postMessage: jest.fn(), close: jest.fn() };

    await worker.dispatch('message', {
        data: {
            type: 'record-offline-error',
            errorCode: 'installation-timeout',
            detail: 'Installation timed out',
        },
        ports: [reply],
    });

    expect(await worker.readMeta()).toEqual({
        activeBuildId: OLD_BUILD_ID,
        state: 'error',
        errorCode: 'installation-timeout',
        detail: 'Installation timed out',
        failedBuildId: BUILD_ID,
    });
    expect(reply.close).toHaveBeenCalled();
});

test('unknown offline navigation returns 503 without changing the snapshot', async () => {
    const worker = createWorker({ fetchFailures: new Set(['/not-in-manifest']) });
    const manifest = manifestFor();
    const cache = await worker.caches.open(`ren-courses-offline-${BUILD_ID}`);
    await seedCache(cache, manifest);
    await seedMeta(worker.caches, readyMeta());
    const before = await snapshotEntries(worker.caches, BUILD_ID);
    const event = { request: new Request(urlFor('not-in-manifest'), { mode: 'navigate' }), respondWith: jest.fn() };

    const fetchListener = worker.listeners.get('fetch');
    fetchListener(event);
    const response = await event.respondWith.mock.calls[0][0];

    expect(response.status).toBe(503);
    expect(await snapshotEntries(worker.caches, BUILD_ID)).toEqual(before);
});

test('activation clears all error fields only after the current snapshot validates', async () => {
    const worker = createWorker();
    const manifest = manifestFor();
    await seedCache(await worker.caches.open(`ren-courses-offline-${BUILD_ID}`), manifest);
    await seedMeta(worker.caches, readyMeta(OLD_BUILD_ID, {
        state: 'error', errorCode: 'installation-timeout', detail: 'late failure', failedBuildId: BUILD_ID,
    }));

    await worker.dispatch('activate');

    expect(await worker.readMeta()).toEqual(readyMeta());
});
