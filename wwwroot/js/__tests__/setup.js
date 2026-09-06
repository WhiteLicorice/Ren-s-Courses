'use strict';

// ─── innerText polyfill ───────────────────────────────────────────────────────
// jsdom 20+ ships innerText but its implementation occasionally breaks when
// the getter is called with a non-Node `this` (e.g. checking the prototype
// itself). Redefine it unconditionally here so every test file gets a safe
// textContent-backed shim.
Object.defineProperty(HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
    set(v) { this.textContent = v; },
    configurable: true,
    enumerable: true,
});

// ─── IntersectionObserver stub ────────────────────────────────────────────────
// jsdom does not implement IntersectionObserver; provide a no-op stub.
global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
};

// jsdom under fake timers never runs a macrotask while a render chain is
// awaited, so the renderer's between-step yield would hang. Give it a
// microtask. Production takes the real task path, which is what stops a
// mid-scroll stall. See yieldToBrowser in wwwroot/js/interactive-diagrams.js.
window.__diagramSchedule = () => Promise.resolve();
