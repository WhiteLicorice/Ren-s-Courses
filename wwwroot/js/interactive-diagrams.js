// wwwroot/js/interactive-diagrams.js

const MERMAID_SCRIPT_URL = 'vendor/mermaid/mermaid.min.js';

// Playback pacing. No research names one correct pan speed, so these are the
// comprehension-first defaults. They stay named constants for later tuning.
//
// A step holds its opening view, pans across whatever the viewport hides, then
// holds the right edge. A step that fits keeps the opening hold and nothing
// else.
//
// Every hold is five times the first draft, which asked readers to take in a
// whole diagram in two seconds. The pan speed is deliberately unchanged: it
// governs reading while the drawing moves, not how long a still view lasts.
const PLAY_INITIAL_HOLD_MS = 10000;
const PLAY_VIEWPORT_TRAVERSAL_MS = 8000;
const PLAY_END_HOLD_MS = 5000;

// Readers who ask for reduced motion get static pages instead of a pan. Each
// page keeps a tenth of the previous view, so nothing falls between two pages.
const PLAY_REDUCED_MOTION_HOLD_MS = 10000;
const PLAY_REDUCED_MOTION_PAGE_FRACTION = 0.9;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const PLAY_HOLD_MS = {
    opening: PLAY_INITIAL_HOLD_MS,
    page: PLAY_REDUCED_MOTION_HOLD_MS,
    edge: PLAY_END_HOLD_MS
};

// A normal Mermaid label must never render below this size. Everything the
// layout does follows from that floor.
const MIN_LABEL_PX = 14;

// Used when a drawing carries no measurable label at all.
const FALLBACK_LABEL_PX = 16;

const VIEWBOX_PADDING = 8;
const SUPPORTED_NARROW_DIRECTIONS = new Set(['TB', 'BT']);

// A complete flowchart or graph declaration on its own line. Only such a line
// can take a new direction token without disturbing the rest of the source.
// The .NET twin lives in Models/DiagramNarrowDirection.cs.
const FLOWCHART_DECLARATION = /^([ \t]*)(flowchart|graph)(?:[ \t]+(?:TB|TD|BT|RL|LR))?([ \t]*;?[ \t]*\r?)$/;

const LABEL_SELECTOR = 'text, tspan, .nodeLabel, .edgeLabel, '
    + 'foreignObject span, foreignObject p, foreignObject div';

const RENDER_ERROR = 'This diagram could not be rendered. Check the Mermaid source shown below.';
const LOAD_ERROR = 'The interactive diagram renderer could not be loaded.';

let mermaidPromise;
let configuredMermaid;
let renderId = 0;
const diagramStates = [];

// Theme-independent rendering. Mermaid light and dark differ only in colour,
// so each step renders once with sentinel colours that become CSS variables.
// Flipping data-theme then repaints with no Mermaid call.
//
// Reserved sentinel range #100000-#10FFFF (documented in README "Custom
// themes"). Author hexes must stay outside it; DiagramContentHygieneTests
// fails the build if any material uses it.
const SENTINEL_BASE = 0x100000;
const SENTINEL_MAX = 0x10FFFF;
const EXTRA_COLOR_KEYS = ['dropShadow'];

let paletteState = null;

// Mermaid hardcodes a feDropShadow flood colour that is not a themeVariable:
// black on a light canvas, white on a dark one. Each theme names its own.
const FALLBACK_REGISTRY = [
    { site: 'light', mermaid: 'default', shadowFlood: '#000000' },
    { site: 'dark', mermaid: 'dark', shadowFlood: '#FFFFFF' }
];

/** Site theme names must be safe inside a [data-theme="..."] selector. */
const THEME_NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

function getSiteThemeRegistry() {
    if (Array.isArray(window.siteThemeRegistry) && window.siteThemeRegistry.length > 0) {
        const entries = window.siteThemeRegistry
            .filter(entry => entry
                && typeof entry.site === 'string'
                && typeof entry.mermaid === 'string'
                && THEME_NAME.test(entry.site))
            .map(entry => ({
                site: entry.site,
                mermaid: entry.mermaid,
                shadowFlood: typeof entry.shadowFlood === 'string' ? entry.shadowFlood : '#000000'
            }));
        if (entries.length > 0) return entries;
    }
    return FALLBACK_REGISTRY.map(entry => ({ ...entry }));
}

/**
 * The theme a bare `:root` block falls back to when nothing sets `data-theme`.
 * This mirrors `wwwroot/css/site.css`, whose unattributed `:root` holds the
 * dark tokens. `Models/SiteThemeRegistry.RootDefault` is the C# twin.
 */
function getRootDefaultSite(registry) {
    const named = typeof window.siteThemeRootDefault === 'string'
        ? registry.find(entry => entry.site === window.siteThemeRootDefault)
        : null;
    return named
        ?? registry.find(entry => entry.site === 'dark')
        ?? registry[registry.length - 1];
}

function isColorValue(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    try {
        if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
            return CSS.supports('color', value);
        }
    } catch {
        // Fall through to the regex below when CSS.supports is unavailable.
    }
    return /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-zA-Z]+)$/.test(value.trim());
}

function extractInnerColor(value) {
    if (typeof value !== 'string') return null;
    const hex = value.match(/#[0-9a-fA-F]{6}\b/);
    if (hex) return hex[0];
    const rgb = value.match(/rgba?\([^)]*\)/);
    if (rgb) return rgb[0];
    return null;
}

function toSentinelHex(index) {
    const value = SENTINEL_BASE + index;
    if (value > SENTINEL_MAX) throw new Error('Sentinel range exhausted');
    return `#${value.toString(16).padStart(6, '0')}`;
}

function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? { r, g, b } : null;
}

function parseRgbComponents(text) {
    const parts = text.split(',').map(p => Number.parseFloat(p.trim()));
    if (parts.length < 3 || parts.some(v => !Number.isFinite(v))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length >= 4 ? parts[3] : null };
}

function harvestPalettes(mermaid) {
    const registry = getSiteThemeRegistry();
    const palettes = {};
    const allKeys = new Set();

    for (const entry of registry) {
        try {
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: entry.mermaid });
        } catch {
            // Harvest must never break rendering; a failed theme still yields its keys below.
        }
        let variables = null;
        try {
            variables = mermaid.mermaidAPI?.getConfig?.()?.themeVariables ?? null;
        } catch {
            variables = null;
        }
        if (!variables || typeof variables !== 'object') continue;

        const palette = {};
        for (const [key, value] of Object.entries(variables)) {
            if (isColorValue(value)) {
                palette[key] = value;
                allKeys.add(key);
            } else if (EXTRA_COLOR_KEYS.includes(key)) {
                const inner = extractInnerColor(value);
                if (inner && isColorValue(inner)) {
                    palette[key] = inner;
                    allKeys.add(key);
                }
            }
        }
        palettes[entry.site] = palette;
    }

    const keys = [...allKeys].sort();
    const sentinelMap = {};
    const sentinelToKey = {};
    const rgbToKey = {};
    keys.forEach((key, index) => {
        const sentinel = toSentinelHex(index);
        sentinelMap[key] = sentinel;
        sentinelToKey[sentinel.toLowerCase()] = key;
        const rgb = hexToRgb(sentinel);
        if (rgb) rgbToKey[`${rgb.r},${rgb.g},${rgb.b}`] = key;
    });

    return { keys, palettes, sentinelMap, sentinelToKey, rgbToKey, registry };
}

function ensurePaletteStylesheet(harvest) {
    if (typeof document === 'undefined') return;
    const { keys, palettes, registry } = harvest;
    if (keys.length === 0) return;

    const block = (entry) => {
        const palette = palettes[entry.site] ?? {};
        const lines = keys
            .map(key => (palette[key] ? `  --dg-${key}: ${palette[key]};` : null))
            .filter(Boolean);
        lines.push(`  --dg-shadowFlood: ${entry.shadowFlood};`);
        return lines.join('\n');
    };

    // One block per registry entry, so adding a theme in C# needs no JS change.
    // `:root` repeats the fallback theme for the case where nothing has set
    // data-theme yet. Every block carries the same specificity, and this sheet
    // is the first child of <head>, so authored CSS still wins.
    const root = getRootDefaultSite(registry);
    const rule = (selector, entry) => `${selector} {\n${block(entry)}\n}`;
    const css = [rule(':root', root)]
        .concat(registry.map(entry => rule(`[data-theme="${entry.site}"]`, entry)))
        .join('\n') + '\n';

    let style = document.getElementById('diagram-palette');
    if (!style) {
        style = document.createElement('style');
        style.id = 'diagram-palette';
        const head = document.head ?? document.getElementsByTagName('head')[0];
        if (head) head.insertBefore(style, head.firstChild);
        else document.documentElement.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
}

/**
 * Colours an author wrote into the Mermaid source. These must survive the
 * rewrite untouched: a semantic colour stays fixed across themes by design.
 *
 * Mermaid accepts author colours on `classDef`, `style` and `linkStyle` lines,
 * and re-serialises them into the style block in a normalised form. So collect
 * the shorthand, the expanded hex and the `rgb()` spelling of each. The
 * palette-coverage test in `tests/e2e/interactive-diagrams.spec.js` builds the
 * same set, and the two must stay in step.
 */
function collectAuthorColors(sources) {
    const allowed = new Set();
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    const add = (hex) => {
        const lower = hex.toLowerCase();
        allowed.add(lower);
        const rgb = hexToRgb(lower.length === 9 ? lower.slice(0, 7) : lower);
        if (!rgb) return;
        allowed.add(`#${[rgb.r, rgb.g, rgb.b].map(v => v.toString(16).padStart(2, '0')).join('')}`);
        allowed.add(`rgb(${rgb.r},${rgb.g},${rgb.b})`);
        allowed.add(`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
    };
    for (const source of sources) {
        for (const line of String(source ?? '').split('\n')) {
            if (!/^\s*(classDef|style|linkStyle)\s/.test(line)) continue;
            for (const match of line.match(hexRe) || []) add(match);
        }
    }
    return allowed;
}

/**
 * Apply `fn` to every place Mermaid can emit a fixed colour, and nowhere else.
 *
 * That is the generated <style> block, the filter and marker <defs>, and any
 * presentation attribute on any element. The last one matters: Mermaid ships
 * inline icon sprites for architecture diagrams whose paths carry
 * `style="fill: none; stroke: #fff"`, far outside <style> and <defs>. Bare text
 * content is never touched, so a label that reads `rgb(0,0,0)` survives.
 */
function withinPaintContexts(svg, fn) {
    let out = svg.replace(
        /(<(style|defs)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi,
        (full, open, tag, body, close) => open + fn(body) + close);
    out = out.replace(
        /\b(style|fill|stroke|color|stop-color|flood-color)="([^"]*)"/gi,
        (full, name, value) => `${name}="${fn(value, name)}"`);
    return out;
}

function rewriteDiagramSvg(svgString, harvest, authorAllowed) {
    if (typeof svgString !== 'string' || svgString.length === 0) return svgString;
    const { sentinelToKey, rgbToKey } = harvest;
    let out = svgString;

    // Direct hex sentinels inside the reserved range. Author classDef hexes
    // live outside the range and never match here.
    out = out.replace(/#[0-9a-fA-F]{6}\b/g, (match) => {
        const lower = match.toLowerCase();
        const num = parseInt(lower.slice(1), 16);
        if (num < SENTINEL_BASE || num > SENTINEL_MAX) return match;
        if (authorAllowed?.has(lower)) return match;
        const key = sentinelToKey[lower];
        return key ? `var(--dg-${key})` : match;
    });

    // rgb()/rgba() derivatives. khroma emits fractional components, so parse
    // tolerantly and round to the sentinel integer triple.
    out = out.replace(/rgba?\(\s*([0-9]*\.?[0-9]+\s*,\s*[0-9]*\.?[0-9]+\s*,\s*[0-9]*\.?[0-9]+(?:\s*,\s*[0-9]*\.?[0-9]+)?)\s*\)/g, (full, inner) => {
        const parsed = parseRgbComponents(inner);
        if (!parsed) return full;
        const r = Math.round(parsed.r);
        const g = Math.round(parsed.g);
        const b = Math.round(parsed.b);
        const key = rgbToKey[`${r},${g},${b}`];
        if (!key) return full;
        // Author colours that happen to round onto a sentinel are guarded by
        // the hygiene test reserving the whole range, so a match is ours.
        if (parsed.a !== null && parsed.a !== undefined) {
            const alpha = Number(parsed.a);
            if (!Number.isFinite(alpha)) return full;
            if (alpha >= 0.999) return `var(--dg-${key})`;
            if (alpha <= 0.001) return 'transparent';
            const pct = (alpha * 100).toFixed(2).replace(/\.?0+$/, '');
            return `color-mix(in srgb, var(--dg-${key}) ${pct}%, transparent)`;
        }
        return `var(--dg-${key})`;
    });

    // Everything below rewrites a colour Mermaid hardcodes outside
    // `themeVariables`. Black and white both mean "ink drawn on the diagram
    // canvas": Mermaid authored them against its own default canvas, so they are
    // opposites only because they assume opposite backgrounds. `lineColor` is
    // Mermaid's own canvas ink and is legible in both themes by construction.
    // Measured 2026-09-06 against the pinned bundle, contrast versus `background`:
    // lineColor 12.63 light / 8.44 dark; white left alone 1.00 light (invisible);
    // white mapped to `background` 1.00 in both, which is why ink must never map
    // to the canvas. The architecture-beta fixture is the gate for this.
    const ink = harvest.keys.includes('lineColor') ? 'var(--dg-lineColor)' : null;

    const shadowForAlpha = (alpha) => {
        if (!Number.isFinite(alpha)) return null;
        if (alpha >= 0.999) return 'var(--dg-shadowFlood)';
        if (alpha <= 0.001) return 'transparent';
        const pct = (alpha * 100).toFixed(2).replace(/\.?0+$/, '');
        return `color-mix(in srgb, var(--dg-shadowFlood) ${pct}%, transparent)`;
    };

    const isBlackOrWhite = /^#(?:000|000000|fff|ffffff)$/i;

    out = withinPaintContexts(out, (body, attribute) => {
        let region = body;

        // An attribute whose whole value is the literal, such as fill="#fff".
        if (attribute && isBlackOrWhite.test(region.trim())) {
            if (attribute.toLowerCase() === 'flood-color') return 'var(--dg-shadowFlood)';
            if (authorAllowed?.has(region.trim().toLowerCase())) return region;
            return ink ?? region;
        }

        // feDropShadow flood-color. Mermaid picks it from the theme name, and the
        // name is always `base` here, so it is always the light-canvas black.
        region = region.replace(/flood-color(\s*[:=]\s*)(["']?)#(?:000000|000|ffffff|fff)\2/gi,
            (full, sep, quote) => `flood-color${sep}${quote}var(--dg-shadowFlood)${quote}`);

        const mapInk = (full, prop, sep, hex) => {
            if (!ink) return full;
            if (authorAllowed?.has(hex.toLowerCase())) return full;
            return `${prop}${sep}${ink}`;
        };
        region = region.replace(
            /(fill|stroke|color|stop-color)(\s*[:=]\s*["']?)(#(?:000000|000|ffffff|fff))(?![0-9a-fA-F])/gi,
            mapInk);

        // Black with alpha is a shadow, in the comma form and in the modern
        // space-separated form Mermaid emits for sequence diagrams.
        region = region.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9]*\.?[0-9]+)\s*\)/g,
            (full, a) => (authorAllowed?.has(full) ? full : shadowForAlpha(Number(a)) ?? full));
        region = region.replace(/rgb\(\s*0\s+0\s+0\s*\/\s*([0-9]*\.?[0-9]+%?)\s*\)/g, (full, a) => {
            const raw = a.trim();
            const alpha = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw);
            return shadowForAlpha(alpha) ?? full;
        });

        // Bare black and white without alpha.
        const mapBare = (full) => (ink && !authorAllowed?.has(full) ? ink : full);
        region = region.replace(/rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/g, mapBare);
        region = region.replace(/rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/g, mapBare);

        return region;
    });

    return out;
}

function createMotionQuery() {
    if (typeof window.matchMedia !== 'function') return null;
    try {
        return window.matchMedia(REDUCED_MOTION_QUERY);
    } catch {
        return null;
    }
}

/**
 * Give the browser a turn between renders, so each step is its own short task
 * instead of one long block that stalls a scroll.
 *
 * `window.__diagramSchedule` is a seam. A harness with no real event loop, such
 * as jsdom under fake timers, sets it to a microtask so an awaited render chain
 * still settles. Nothing in the site sets it.
 */
function yieldToBrowser() {
    if (typeof window.__diagramSchedule === 'function') return window.__diagramSchedule();
    try {
        if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
            return scheduler.yield();
        }
    } catch {
        // Fall through to the MessageChannel/setTimeout fallbacks below.
    }
    if (typeof MessageChannel !== 'undefined') {
        return new Promise(resolve => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => {
                channel.port1.close();
                channel.port2.close();
                resolve();
            };
            channel.port2.postMessage(0);
        });
    }
    return new Promise(resolve => setTimeout(resolve, 0));
}

async function getMermaid(providedMermaid) {
    if (providedMermaid) return providedMermaid;

    if (!mermaidPromise) {
        mermaidPromise = new Promise((resolve, reject) => {
            if (window.mermaid) {
                resolve(window.mermaid);
                return;
            }

            const script = document.createElement('script');
            script.src = new URL(MERMAID_SCRIPT_URL, document.baseURI).href;
            script.async = true;
            script.onload = () => window.mermaid
                ? resolve(window.mermaid)
                : reject(new Error('The local Mermaid bundle did not expose a renderer'));
            script.onerror = () => reject(new Error('The local Mermaid bundle could not be loaded'));
            document.head.appendChild(script);
        });
    }

    return mermaidPromise;
}

function configureMermaid(mermaid) {
    if (configuredMermaid === mermaid && paletteState) return paletteState;

    const harvest = harvestPalettes(mermaid);
    configuredMermaid = mermaid;
    paletteState = harvest;

    // The harvest reads mermaid.mermaidAPI.getConfig().themeVariables. A Mermaid
    // upgrade could rename or move that, and an empty harvest would otherwise
    // render every diagram in the `base` theme with no colour variables at all.
    // Fall back to the plain per-theme render the site used before this change.
    if (harvest.keys.length === 0) {
        const site = typeof document !== 'undefined'
            ? document.documentElement.getAttribute('data-theme')
            : null;
        const entry = harvest.registry.find(candidate => candidate.site === site)
            ?? getRootDefaultSite(harvest.registry);
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: entry?.mermaid ?? 'dark'
        });
        return harvest;
    }

    ensurePaletteStylesheet(harvest);

    // Render once with sentinels. Do not override fontFamily or fontSize:
    // leaving them at base defaults keeps geometry identical across themes.
    mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables: harvest.sentinelMap
    });
    return harvest;
}

// --- Source selection ------------------------------------------------------

/**
 * Return the source with its first flowchart declaration set to `direction`.
 * Every other character survives. Returns null when the definition carries no
 * rewritable declaration, which includes every non-flowchart diagram type.
 */
function rewriteFlowchartDirection(source, direction) {
    if (!SUPPORTED_NARROW_DIRECTIONS.has(direction)) return null;

    const lines = source.split('\n');
    for (let index = 0; index < lines.length; index++) {
        const match = FLOWCHART_DECLARATION.exec(lines[index]);
        if (!match) continue;

        lines[index] = `${match[1]}${match[2]} ${direction}${match[3]}`;
        return lines.join('\n');
    }
    return null;
}

/**
 * Build the narrow variant of a whole widget. A widget reflows only when every
 * step can honour the direction, so a mixed diagram keeps one consistent
 * layout instead of reflowing part of a walkthrough.
 */
function buildNarrowSources(sources, direction) {
    if (!SUPPORTED_NARROW_DIRECTIONS.has(direction)) return null;

    const narrow = [];
    for (const source of sources) {
        const rewritten = rewriteFlowchartDirection(source, direction);
        if (!rewritten) return null;
        narrow.push(rewritten);
    }
    return narrow;
}

// --- Measurement -----------------------------------------------------------

function readViewBox(svg) {
    const parts = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    return parts?.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0
        ? { width: parts[2], height: parts[3] }
        : null;
}

/**
 * Force the SVG to fill its stage and reframe its viewport around the real
 * drawing bounds. Mermaid's own viewBox and intrinsic size cannot be trusted.
 * Returns the drawing size in view-box units, or null when nothing is usable.
 */
function normalizeSvg(svg) {
    svg.style.setProperty('display', 'block', 'important');
    svg.style.setProperty('height', '100%', 'important');
    svg.style.setProperty('max-width', 'none', 'important');
    svg.style.setProperty('width', '100%', 'important');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const drawing = svg.querySelector('.root');
    if (drawing && typeof drawing.getBBox === 'function') {
        let bounds = null;
        try {
            bounds = drawing.getBBox();
        } catch {
            bounds = null;
        }

        const usable = bounds
            && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)
            && bounds.width > 0 && bounds.height > 0;

        if (usable) {
            const width = bounds.width + VIEWBOX_PADDING * 2;
            const height = bounds.height + VIEWBOX_PADDING * 2;
            svg.setAttribute('viewBox',
                `${bounds.x - VIEWBOX_PADDING} ${bounds.y - VIEWBOX_PADDING} ${width} ${height}`);
            return { width, height };
        }
    }

    return readViewBox(svg);
}

/** Smallest positive label size in the drawing, in view-box units. */
function measureLabelSize(svg) {
    const scope = svg.querySelector('.root') ?? svg;
    let smallest = null;

    for (const label of scope.querySelectorAll(LABEL_SELECTOR)) {
        if (!label.textContent || !label.textContent.trim()) continue;
        const size = Number.parseFloat(window.getComputedStyle(label).fontSize);
        if (!Number.isFinite(size) || size <= 0) continue;
        if (smallest === null || size < smallest) smallest = size;
    }

    return smallest ?? FALLBACK_LABEL_PX;
}

function readAvailableWidth(state) {
    const step = state.steps.find(candidate => !candidate.element.hidden) ?? state.steps[0];
    if (!step) return 0;

    const width = step.viewport.getBoundingClientRect?.().width || step.viewport.clientWidth || 0;
    return width > 0 ? width : 0;
}

// --- Layout ----------------------------------------------------------------

/**
 * Decide the stage size of every step at the given width. A step is scaled to
 * fill the width unless that would push its labels below the floor, in which
 * case it keeps the wider readable size and the viewport scrolls.
 */
function planLayout(measurements, availableWidth) {
    let fits = true;

    const stages = measurements.map(measurement => {
        if (!measurement) return null;

        const fitScale = availableWidth / measurement.width;
        const readableScale = MIN_LABEL_PX / measurement.labelPx;
        if (readableScale > fitScale + 1e-6) fits = false;

        const scale = Math.max(fitScale, readableScale);
        return { width: measurement.width * scale, height: measurement.height * scale };
    });

    return { fits, stages };
}

function applyLayout(state, plan, availableWidth) {
    const heights = plan.stages.filter(Boolean).map(stage => stage.height);
    const reserved = heights.length > 0 ? Math.round(Math.max(...heights)) : 0;

    state.steps.forEach((step, index) => {
        const stage = plan.stages[index];
        if (!stage) {
            // Nothing measurable. Give the drawing the article width and let it
            // keep its own height rather than collapsing to nothing.
            step.stage.style.width = `${Math.round(availableWidth)}px`;
            step.stage.style.removeProperty('height');
            step.stage.querySelector('svg')?.style.removeProperty('height');
            step.overflow = 0;
            return;
        }

        const width = Math.round(stage.width);
        step.stage.style.width = `${width}px`;
        step.stage.style.height = `${Math.round(stage.height)}px`;
        step.overflow = Math.max(0, width - availableWidth);
    });

    // One reserved stage height keeps the page still while stepping.
    if (reserved > 0) {
        state.steps.forEach(step => {
            step.viewport.style.height = `${reserved}px`;
        });
    }
}

/** Make hidden steps measurable without letting them paint. */
function withStepsMeasurable(state, action) {
    const restored = state.steps.map(step => {
        const wasHidden = step.element.hidden;
        const style = step.element.getAttribute('style');
        if (wasHidden) {
            step.element.hidden = false;
            step.element.style.setProperty('visibility', 'hidden');
        }
        return { step, wasHidden, style };
    });

    try {
        return action();
    } finally {
        restored.forEach(({ step, wasHidden, style }) => {
            if (!wasHidden) return;
            step.element.hidden = true;
            if (style === null) step.element.removeAttribute('style');
            else step.element.setAttribute('style', style);
        });
    }
}

/**
 * Reserve the tallest complete step area, so Previous, Next and Play never
 * move the surrounding page. Titles and descriptions count, not only stages.
 */
function reserveStepHeight(state) {
    state.steps.forEach(step => step.element.style.removeProperty('min-height'));

    let tallest = 0;
    withStepsMeasurable(state, () => {
        state.steps.forEach(step => {
            tallest = Math.max(tallest, step.element.offsetHeight || 0);
        });
    });

    if (tallest <= 0) return;
    state.steps.forEach(step => {
        step.element.style.minHeight = `${Math.round(tallest)}px`;
    });
}

function updateOverflowCues(step) {
    const overflow = step.overflow ?? 0;
    const scrollable = overflow > 1;

    step.hint.hidden = !scrollable;
    if (scrollable) step.viewport.setAttribute('tabindex', '0');
    else step.viewport.removeAttribute('tabindex');

    const scrollLeft = step.viewport.scrollLeft || 0;
    if (scrollable && scrollLeft > 1) step.viewport.dataset.overflowLeft = 'true';
    else delete step.viewport.dataset.overflowLeft;

    if (scrollable && scrollLeft < overflow - 1) step.viewport.dataset.overflowRight = 'true';
    else delete step.viewport.dataset.overflowRight;
}

function scrollRatio(step) {
    const overflow = step.overflow ?? 0;
    if (overflow <= 0) return 0;
    return Math.min(1, Math.max(0, (step.viewport.scrollLeft || 0) / overflow));
}

/**
 * Move a viewport under our own command. Recording the target first is what
 * lets the scroll listener tell our movement from the reader's.
 */
function setScrollLeft(step, target) {
    step.viewport.scrollLeft = target;
    // Read back what the browser actually took. Its own maximum can sit a
    // fraction below the measured overflow, and a clamp must never be mistaken
    // for the reader taking the diagram over.
    step.commandedScrollLeft = step.viewport.scrollLeft || 0;
}

function setScrollRatio(step, ratio) {
    setScrollLeft(step, (step.overflow ?? 0) * ratio);
}

function atRightEdge(step) {
    const overflow = step.overflow ?? 0;
    return overflow <= 1 || (step.viewport.scrollLeft || 0) >= overflow - 0.5;
}

// --- Rendering lifecycle ---------------------------------------------------

function measureHostCell(state, name) {
    if (!state.measureHost?.isConnected) {
        const host = document.createElement('div');
        host.dataset.diagramMeasureHost = '';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;left:-99999px;top:0;'
            + 'visibility:hidden;pointer-events:none;';
        document.body.appendChild(host);
        state.measureHost = host;
    }

    let cell = state.measureHost.querySelector(`[data-diagram-variant="${name}"]`);
    if (!cell) {
        cell = document.createElement('div');
        cell.dataset.diagramVariant = name;
        state.measureHost.appendChild(cell);
    }
    cell.replaceChildren();
    cell.style.width = `${Math.round(readAvailableWidth(state)) || 0}px`;
    return cell;
}

/**
 * Render one variant off screen and measure it there, so the visible SVG stays
 * on the page for the whole recalculation.
 */
async function runRender(state, name) {
    const cell = measureHostCell(state, name);
    const results = [];

    for (const source of state.sources[name]) {
        const slot = document.createElement('div');
        cell.appendChild(slot);

        try {
            const result = await state.mermaid.render(`learning-diagram-${renderId++}`, source);
            // Rewrite after render returns: the string is already past
            // securityLevel sanitisation, so no var() is ever exposed to DOMPurify.
            let svgText = result.svg;
            try {
                if (paletteState && paletteState.keys.length > 0) {
                    svgText = rewriteDiagramSvg(svgText, paletteState, collectAuthorColors([source]));
                }
            } catch {
                // A rewrite failure must never blank a working diagram.
            }
            slot.innerHTML = svgText;
            const svg = slot.querySelector('svg');
            if (!svg) {
                results.push({});
                await yieldToBrowser();
                continue;
            }

            const size = normalizeSvg(svg);
            results.push({
                node: svg,
                bind: result.bindFunctions,
                measurement: size
                    ? { width: size.width, height: size.height, labelPx: measureLabelSize(svg) }
                    : null
            });
        } catch {
            results.push({});
        }
        // Each render is its own task of ~40ms instead of one 280ms block.
        await yieldToBrowser();
    }

    return results;
}

async function renderVariant(state, name) {
    const previous = state.variants[name];
    const results = await runRender(state, name);
    const complete = results.every(result => result.node);

    // A failed recalculation must never replace a working diagram. Keep the
    // last good measurements and retry on the next pass.
    if (!complete && state.committed && previous) {
        previous.stale = true;
        previous.nodesAvailable = false;
        return previous;
    }

    const variant = {
        results,
        measurements: results.map(result => result.measurement ?? null),
        stale: false,
        nodesAvailable: true
    };
    state.variants[name] = variant;
    return variant;
}

function measureVariant(state, name) {
    const variant = state.variants[name];
    if (variant && !variant.stale) return variant;
    return renderVariant(state, name);
}

async function commitVariant(state, name) {
    let variant = state.variants[name];
    if (!variant || variant.stale || !variant.nodesAvailable) {
        variant = await renderVariant(state, name);
    }
    if (!variant.nodesAvailable) return false;

    // One update for every step, so no reader sees a half-replaced widget.
    state.steps.forEach((step, index) => {
        const result = variant.results[index];
        if (!result?.node) {
            step.stage.replaceChildren();
            step.source.hidden = false;
            step.error.textContent = RENDER_ERROR;
            step.error.hidden = false;
            return;
        }

        step.stage.replaceChildren(result.node);
        if (result.bind) result.bind(step.stage);
        step.source.hidden = true;
        step.error.hidden = true;
        step.error.textContent = '';
    });

    variant.nodesAvailable = false;
    state.committed = true;
    return true;
}

async function refresh(state, { rerender = false } = {}) {
    const availableWidth = readAvailableWidth(state);
    if (availableWidth <= 0) return;

    if (rerender) {
        Object.values(state.variants).forEach(variant => {
            variant.stale = true;
        });
    }

    const canonical = await measureVariant(state, 'canonical');
    if (state.committed && !canonical.measurements.some(Boolean)) return;

    let selected = 'canonical';
    let plan = planLayout(canonical.measurements, availableWidth);
    let mode = plan.fits ? 'fit' : 'pan';

    if (!plan.fits && state.sources.narrow) {
        const narrow = await measureVariant(state, 'narrow');
        const narrowPlan = planLayout(narrow.measurements, availableWidth);
        if (narrow.measurements.some(Boolean) && narrowPlan.fits) {
            selected = 'narrow';
            plan = narrowPlan;
            mode = 'narrow';
        }
    }

    if (rerender || !state.committed || state.selected !== selected) {
        if (!await commitVariant(state, selected)) return;
        state.selected = selected;
    }

    state.mode = mode;
    state.availableWidth = availableWidth;
    state.widget.dataset.diagramLayout = mode;
    applyLayout(state, plan, availableWidth);
    reserveStepHeight(state);
    state.steps.forEach(updateOverflowCues);
}

function observeResize(state) {
    if (typeof ResizeObserver !== 'function') return;

    state.observer = new ResizeObserver(() => {
        if (!state.widget.isConnected) {
            state.observer.disconnect();
            pruneDisconnectedStates();
            return;
        }
        if (state.frame) return;

        state.frame = window.requestAnimationFrame(() => {
            state.frame = null;
            if (!state.widget.isConnected) {
                state.observer.disconnect();
                pruneDisconnectedStates();
                return;
            }

            // Only a real width change is work. Height changes are our own
            // output, so ignoring them is what stops an observer loop.
            const availableWidth = readAvailableWidth(state);
            if (availableWidth <= 0 || Math.abs(availableWidth - state.availableWidth) < 1) return;
            refresh(state, { rerender: false });
        });
    });

    state.observer.observe(state.widget);
}

// --- Controls --------------------------------------------------------------

/**
 * Show one step. Manual navigation carries the horizontal position across
 * proportionally, so a reader keeps their place in a wide drawing. Playback
 * asks for `preserveScroll: false`, because every automatic step must open at
 * its left edge whatever the previous step ended on.
 */
function showStep(state, index, { preserveScroll = true } = {}) {
    const previous = state.steps[state.current];
    const ratio = preserveScroll && previous ? scrollRatio(previous) : 0;

    state.current = index;
    state.steps.forEach((step, stepIndex) => {
        step.element.hidden = stepIndex !== index;
    });

    const step = state.steps[index];
    setScrollRatio(step, ratio);
    updateOverflowCues(step);

    // Only a real step change may reach the live region. A pan writes the same
    // sentence hundreds of times, and every write is another announcement.
    const status = `Step ${index + 1} of ${state.steps.length}`;
    if (state.status.textContent !== status) state.status.textContent = status;

    state.previousButton.disabled = index === 0;
    state.nextButton.disabled = index === state.steps.length - 1;
}

// --- Playback --------------------------------------------------------------
//
// One session object drives a widget's walkthrough. It holds the phase, the
// hold that is still owed, and the pan position. At most one timeout and one
// animation frame are outstanding, and both are cancelled together.
//
// `state.playback` is the live session and doubles as the generation token:
// every scheduled callback checks that it still owns it, so a phase cancelled
// a moment earlier can never change the step later. Pause moves the session to
// `state.paused` instead of discarding it. Manual input discards it.

function createSession() {
    return {
        phase: null,
        holdMs: null,
        holdStartedAt: 0,
        timestamp: null,
        panLeft: 0,
        timeout: null,
        frame: null
    };
}

function cancelSession(session) {
    if (session.timeout !== null) {
        clearTimeout(session.timeout);
        session.timeout = null;
    }
    if (session.frame !== null) {
        window.cancelAnimationFrame(session.frame);
        session.frame = null;
    }
}

function releasePlayButton(state) {
    state.playButton.textContent = 'Play';
    state.playButton.setAttribute('aria-pressed', 'false');
}

/** End playback and forget the session. The next Play starts a fresh one. */
function stopPlayback(state) {
    if (state.playback) cancelSession(state.playback);
    state.playback = null;
    state.paused = null;
    releasePlayButton(state);
}

/** End playback but keep the phase, the remaining hold and the position. */
function pausePlayback(state) {
    const session = state.playback;
    if (!session) return;

    cancelSession(session);
    if (session.holdMs !== null) {
        session.holdMs = Math.max(0, session.holdMs - (Date.now() - session.holdStartedAt));
    }
    state.playback = null;
    state.paused = session;
    releasePlayButton(state);
}

/** True while the session that scheduled a callback is still the live one. */
function sessionIsLive(state, session) {
    if (state.playback !== session) return false;
    if (state.widget.isConnected) return true;
    stopPlayback(state);
    return false;
}

function startHold(state, session) {
    session.holdStartedAt = Date.now();
    session.timeout = setTimeout(() => {
        session.timeout = null;
        if (!sessionIsLive(state, session)) return;
        finishPhase(state, session);
    }, session.holdMs);
}

function requestPanFrame(state, session) {
    session.frame = window.requestAnimationFrame(timestamp => runPan(state, session, timestamp));
}

function enterPhase(state, session, phase) {
    session.phase = phase;

    if (phase !== 'pan') {
        session.holdMs = PLAY_HOLD_MS[phase];
        startHold(state, session);
        return;
    }

    session.holdMs = null;
    session.timestamp = null;
    session.panLeft = state.steps[state.current].viewport.scrollLeft || 0;
    requestPanFrame(state, session);
}

/** Re-enter the phase a pause interrupted, with whatever hold was left. */
function resumePhase(state, session) {
    if (session.phase === 'pan') {
        session.timestamp = null;
        requestPanFrame(state, session);
        return;
    }
    startHold(state, session);
}

function prefersReducedMotion(state) {
    return state.motionQuery?.matches === true;
}

/** One static page forward, keeping a tenth of the current view. */
function pageForward(state, step) {
    const overflow = step.overflow ?? 0;
    const page = readAvailableWidth(state) * PLAY_REDUCED_MOTION_PAGE_FRACTION;
    const target = page > 0
        ? Math.min(overflow, (step.viewport.scrollLeft || 0) + page)
        : overflow;

    setScrollLeft(step, target);
    updateOverflowCues(step);
}

function advanceStep(state, session) {
    if (state.current >= state.steps.length - 1) {
        stopPlayback(state);
        return;
    }

    showStep(state, state.current + 1, { preserveScroll: false });
    enterPhase(state, session, 'opening');
}

function finishPhase(state, session) {
    const step = state.steps[state.current];

    if (prefersReducedMotion(state)) {
        if (atRightEdge(step)) {
            advanceStep(state, session);
            return;
        }
        pageForward(state, step);
        enterPhase(state, session, 'page');
        return;
    }

    // The end hold is the last thing a step does. Anything else that still
    // hides content on the right has a pan to run.
    if (session.phase !== 'edge' && !atRightEdge(step)) {
        enterPhase(state, session, 'pan');
        return;
    }
    advanceStep(state, session);
}

/**
 * Move the current step one frame further left to right. The overflow and the
 * viewport width are read again every frame, so a resize or a theme rerender
 * during playback changes the speed rather than breaking the pan.
 */
function runPan(state, session, timestamp) {
    session.frame = null;
    if (!sessionIsLive(state, session)) return;

    const step = state.steps[state.current];
    const overflow = step.overflow ?? 0;

    // A resize can remove the overflow while the pan is running.
    if (overflow <= 1) {
        advanceStep(state, session);
        return;
    }

    const speed = readAvailableWidth(state) / PLAY_VIEWPORT_TRAVERSAL_MS;
    if (!(speed > 0)) {
        // Nothing measurable to pace against. Show the far edge rather than stall.
        session.panLeft = overflow;
        setScrollLeft(step, overflow);
        updateOverflowCues(step);
        enterPhase(state, session, 'edge');
        return;
    }

    // The first frame only starts the clock. There is no earlier timestamp to
    // measure against, and guessing one would jump the drawing.
    if (session.timestamp === null) {
        session.timestamp = timestamp;
        requestPanFrame(state, session);
        return;
    }

    const elapsed = Math.max(0, timestamp - session.timestamp);
    session.timestamp = timestamp;
    session.panLeft = Math.min(overflow, session.panLeft + speed * elapsed);
    setScrollLeft(step, session.panLeft);
    updateOverflowCues(step);

    if (session.panLeft >= overflow) {
        enterPhase(state, session, 'edge');
        return;
    }
    requestPanFrame(state, session);
}

function startPlayback(state) {
    if (state.steps.length < 2) return;

    const resumed = state.paused;
    state.paused = null;
    state.playButton.textContent = 'Pause';
    state.playButton.setAttribute('aria-pressed', 'true');

    if (resumed) {
        state.playback = resumed;
        resumePhase(state, resumed);
        return;
    }

    // A fresh walkthrough restarts from the top once the last step is done, and
    // always opens its step at the left edge.
    if (state.current === state.steps.length - 1) showStep(state, 0, { preserveScroll: false });
    const step = state.steps[state.current];
    setScrollLeft(step, 0);
    updateOverflowCues(step);

    const session = createSession();
    state.playback = session;
    enterPhase(state, session, 'opening');
}

/**
 * A reader can change the motion preference while a diagram is playing. Drop
 * the current phase and carry the same step on from where it stands.
 */
function observeMotionPreference(state) {
    if (typeof state.motionQuery?.addEventListener !== 'function') return;

    state.motionQuery.addEventListener('change', () => {
        const session = state.playback;
        if (!session || !sessionIsLive(state, session)) return;

        cancelSession(session);
        if (prefersReducedMotion(state)) enterPhase(state, session, 'page');
        else if (atRightEdge(state.steps[state.current])) enterPhase(state, session, 'edge');
        else enterPhase(state, session, 'pan');
    });
}

function collectSteps(widget) {
    return Array.from(widget.querySelectorAll('[data-diagram-step]')).map(element => ({
        element,
        viewport: element.querySelector('[data-diagram-viewport]'),
        stage: element.querySelector('[data-diagram-canvas]'),
        hint: element.querySelector('[data-diagram-scroll-hint]'),
        source: element.querySelector('[data-diagram-source]'),
        error: element.querySelector('[data-diagram-error]'),
        overflow: 0,
        commandedScrollLeft: 0
    }));
}

async function enhanceDiagram(widget, mermaid) {
    const steps = collectSteps(widget);
    if (steps.length === 0 || steps.some(step => !step.viewport || !step.stage)) return;

    const canonical = steps.map(step => step.source.textContent.trim());
    const state = {
        widget,
        mermaid,
        steps,
        current: 0,
        playback: null,
        paused: null,
        motionQuery: createMotionQuery(),
        committed: false,
        selected: null,
        mode: null,
        availableWidth: 0,
        variants: {},
        sources: {
            canonical,
            narrow: buildNarrowSources(canonical, widget.dataset.diagramNarrowDirection ?? '')
        },
        status: widget.querySelector('[data-diagram-status]'),
        previousButton: widget.querySelector('[data-diagram-action="previous"]'),
        nextButton: widget.querySelector('[data-diagram-action="next"]'),
        playButton: widget.querySelector('[data-diagram-action="play"]')
    };

    state.previousButton.addEventListener('click', () => {
        stopPlayback(state);
        if (state.current > 0) showStep(state, state.current - 1);
    });
    state.nextButton.addEventListener('click', () => {
        stopPlayback(state);
        if (state.current < state.steps.length - 1) showStep(state, state.current + 1);
    });
    state.playButton.addEventListener('click', () => {
        if (state.playback) pausePlayback(state);
        else startPlayback(state);
    });
    observeMotionPreference(state);

    steps.forEach(step => {
        step.viewport.addEventListener('scroll', () => {
            updateOverflowCues(step);
            // A scroll we did not command is the reader taking over.
            const moved = Math.abs((step.viewport.scrollLeft || 0) - (step.commandedScrollLeft ?? 0));
            if ((step.overflow ?? 0) > 1 && moved > 1) stopPlayback(state);
        });
    });

    await refresh(state, { rerender: true });

    widget.querySelector('[data-diagram-controls]').hidden = false;
    state.playButton.disabled = steps.length < 2;
    widget.dataset.diagramInitialized = 'true';
    observeResize(state);
    diagramStates.push(state);
    showStep(state, 0);
}

function pruneDisconnectedStates() {
    for (let i = diagramStates.length - 1; i >= 0; i--) {
        const state = diagramStates[i];
        if (!state.widget.isConnected) {
            try {
                state.observer?.disconnect?.();
            } catch {
                // Never let cleanup break rendering.
            }
            try {
                state.measureHost?.remove?.();
            } catch {
                // Never let cleanup break rendering.
            }
            diagramStates.splice(i, 1);
        }
    }
}

/**
 * Resolve on the next idle period, so the 3.5 MB Mermaid bundle is fetched and
 * parsed while the browser has nothing better to do. The timeout caps the wait
 * on a page that never goes idle. Safari has no requestIdleCallback, so it
 * takes the timer path.
 */
function whenIdle(timeout = 2000) {
    return new Promise(resolve => {
        try {
            if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(() => resolve(), { timeout });
                return;
            }
        } catch {
            // Fall through to the timer below.
        }
        setTimeout(resolve, 0);
    });
}

window.initInteractiveDiagrams = async (providedMermaid) => {
    const widgets = Array.from(document.querySelectorAll('[data-interactive-diagram]'))
        .filter(widget => !widget.dataset.diagramInitialized);
    if (widgets.length === 0) {
        pruneDisconnectedStates();
        return;
    }

    // Keep the source hidden from the first frame for every widget at init,
    // whether or not that widget has been rendered yet.
    widgets.forEach(widget => {
        widget.dataset.diagramInitialized = 'loading';
        widget.querySelectorAll('[data-diagram-source]').forEach(source => source.hidden = true);
    });

    pruneDisconnectedStates();

    // A widget that cannot render must show its authored source again. The
    // source was hidden for every widget at init to stop the raw definition
    // flickering, so leaving a failed widget alone would leave an empty box.
    const failWidget = (widget) => {
        if (widget.dataset.diagramInitialized === 'true') return;
        widget.dataset.diagramInitialized = 'error';
        const error = widget.querySelector('[data-diagram-error]');
        const visibleSource = widget.querySelector('[data-diagram-step]:not([hidden]) [data-diagram-source]');
        if (visibleSource) visibleSource.hidden = false;
        if (error) {
            error.textContent = LOAD_ERROR;
            error.hidden = false;
        }
    };

    const failWidgets = () => widgets.forEach(failWidget);

    // Fast path for tests and any caller that already holds a renderer:
    // enhance immediately, yielding between widgets.
    if (providedMermaid) {
        try {
            const mermaid = await getMermaid(providedMermaid);
            configureMermaid(mermaid);
            for (const widget of widgets) {
                await enhanceDiagram(widget, mermaid);
                await yieldToBrowser();
            }
        } catch {
            failWidgets();
        }
        return;
    }

    if (typeof IntersectionObserver !== 'function') {
        try {
            const mermaid = await getMermaid();
            configureMermaid(mermaid);
            for (const widget of widgets) {
                await enhanceDiagram(widget, mermaid);
                await yieldToBrowser();
            }
        } catch {
            failWidgets();
        }
        return;
    }

    // Warm the bundle during idle, so the 3.5 MB parse never lands in the
    // middle of a scroll. Rendering still waits for the observer below.
    await whenIdle();

    let mermaid;
    try {
        mermaid = await getMermaid();
        configureMermaid(mermaid);
    } catch {
        failWidgets();
        return;
    }

    // Start rendering well before visibility: one viewport of lead time.
    const pending = new Set(widgets);
    let observer;
    let frame = null;

    const stop = () => {
        observer.disconnect();
        window.removeEventListener('scroll', onScroll);
        if (frame) cancelAnimationFrame(frame);
        frame = null;
    };

    const start = (widget) => {
        if (!pending.has(widget)) return;
        pending.delete(widget);
        observer.unobserve(widget);
        enhanceDiagram(widget, mermaid).catch(() => failWidget(widget));
        if (pending.size === 0) stop();
    };

    // IntersectionObserver only reports a THRESHOLD CROSSING. A reader who jumps
    // the page in one step, through an anchor link, an End keypress or a fast
    // fling, takes a widget from below the band to above it without ever
    // intersecting, so the ratio stays 0 and no entry is ever queued. Confirmed
    // on articles/cmsc-124-act3: after window.scrollTo(0, scrollHeight) both
    // widgets sat above the viewport and stayed empty boxes for as long as the
    // reader did not scroll back. This sweep catches exactly that case.
    const sweep = () => {
        for (const widget of [...pending]) {
            if (widget.getBoundingClientRect().bottom < 0) start(widget);
        }
    };

    function onScroll() {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            sweep();
        });
    }

    observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) start(entry.target);
        }
    }, { rootMargin: '800px 0px' });

    widgets.forEach(widget => observer.observe(widget));
    // Both listeners come off as soon as the last widget renders.
    window.addEventListener('scroll', onScroll, { passive: true });
    sweep();
};
