'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '../code-features.js'), 'utf8');

function loadScript() {
    // eslint-disable-next-line no-new-func
    new Function(source)();
}

function buildDOM(langClass = 'language-python') {
    document.body.innerHTML = `
        <div class="prose">
            <pre class="${langClass}"><code>print("hello")</code></pre>
        </div>
    `;
}

afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
});

describe('addCodeFeatures — wrapping', () => {
    test('wraps <pre> in a .code-wrapper div', () => {
        buildDOM();
        loadScript();
        window.addCodeFeatures();
        expect(document.querySelector('.code-wrapper')).not.toBeNull();
        expect(document.querySelector('.code-wrapper pre')).not.toBeNull();
    });

    test('does not double-wrap when called twice', () => {
        buildDOM();
        loadScript();
        window.addCodeFeatures();
        window.addCodeFeatures();
        expect(document.querySelectorAll('.code-wrapper').length).toBe(1);
    });

    test('no-op when no .prose pre blocks exist', () => {
        document.body.innerHTML = '<div class="prose"><p>No code</p></div>';
        loadScript();
        expect(() => window.addCodeFeatures()).not.toThrow();
        expect(document.querySelector('.code-wrapper')).toBeNull();
    });
});

describe('addCodeFeatures — language label', () => {
    test.each([
        ['language-python', 'python'],
        ['language-cs', 'c#'],
        ['language-csharp', 'c#'],
        ['language-bash', 'bash'],
        ['language-js', 'js'],
        ['language-nasm', 'asm'],
    ])('sets data-language for %s', (cls, expected) => {
        buildDOM(cls);
        loadScript();
        window.addCodeFeatures();
        expect(document.querySelector('.code-wrapper').getAttribute('data-language')).toBe(expected);
    });

    test('uses raw lang for unknown language class', () => {
        buildDOM('language-cobol');
        loadScript();
        window.addCodeFeatures();
        expect(document.querySelector('.code-wrapper').getAttribute('data-language')).toBe('cobol');
    });

    test('no data-language attribute when <pre> has no language class', () => {
        buildDOM('');
        loadScript();
        window.addCodeFeatures();
        expect(document.querySelector('.code-wrapper').hasAttribute('data-language')).toBe(false);
    });
});

describe('addCodeFeatures — copy button', () => {
    test('injects a .copy-button inside the wrapper', () => {
        buildDOM();
        loadScript();
        window.addCodeFeatures();
        expect(document.querySelector('.copy-button')).not.toBeNull();
    });

    test('copy button click writes code text to clipboard', async () => {
        buildDOM();
        loadScript();
        window.addCodeFeatures();

        const writeTextMock = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: writeTextMock },
            configurable: true,
        });

        document.querySelector('.copy-button').click();
        // Let the microtask queue drain.
        await Promise.resolve();
        expect(writeTextMock).toHaveBeenCalledWith('print("hello")');
    });

    test('copy button adds "copied" class after successful copy', async () => {
        buildDOM();
        loadScript();
        window.addCodeFeatures();

        jest.useFakeTimers();
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });

        const btn = document.querySelector('.copy-button');
        btn.click();
        await Promise.resolve();
        expect(btn.classList.contains('copied')).toBe(true);
        jest.runAllTimers();
        expect(btn.classList.contains('copied')).toBe(false);
        jest.useRealTimers();
    });
});
