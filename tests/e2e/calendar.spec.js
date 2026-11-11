'use strict';

const { test, expect } = require('@playwright/test');

const CALENDAR_FIXTURE_GROUPS = [
  {
    tags: ['fixture-match'],
    title: 'Fixture Match',
    dates: ['2026-09-15', '2026-09-15', '2026-09-15', '2026-09-15'],
    tooltip: 'Fixture match event',
    eventType: 'Custom',
    url: null,
    cssClass: 'bg-accent/10 text-accent border-accent',
  },
  {
    tags: ['fixture-other'],
    title: 'Fixture Other',
    dates: ['2026-09-16', '2026-09-16', '2026-09-16', '2026-09-16'],
    tooltip: 'Fixture other event',
    eventType: 'Custom',
    url: null,
    cssClass: 'bg-accent/10 text-accent border-accent',
  },
];

function installCalendarFixture(groups) {
  window.addEventListener('DOMContentLoaded', () => {
    const filterHost = document.querySelector('.filter-btn')?.parentElement
      || document.querySelector('#calendar-container')?.parentElement;
    const month = document.querySelector('.month-view:not(.hidden)')
      || document.querySelector('.month-view');
    if (!filterHost || !month) return;

    const matchTag = groups[0].tags[0];
    const filter = document.createElement('button');
    filter.type = 'button';
    filter.dataset.calendarFixture = 'filter';
    filter.dataset.tag = matchTag;
    filter.className = 'filter-btn';
    filter.setAttribute('aria-pressed', 'false');
    filter.textContent = `#${matchTag}`;
    filter.addEventListener('click', () => window.toggleCalendarTag(matchTag));
    filterHost.appendChild(filter);

    groups.forEach((group, groupIndex) => {
      const key = groupIndex === 0 ? 'matching' : 'nonmatching';
      const cell = document.createElement('div');
      cell.className = 'calendar-fixture-cell';
      cell.dataset.calendarFixture = `${key}-cell`;

      const browserEvents = group.dates.map(() => ({
        title: group.title,
        tooltip: group.tooltip || group.eventType,
        url: group.url || null,
        cssClass: `${group.cssClass} ${group.tags
          .map(tag => `tag-${tag.replace(/\s+/g, '-')}`)
          .join(' ')}`,
      }));

      const eventContainer = document.createElement('div');
      eventContainer.id = `fixture-${key}-events`;
      eventContainer.className = 'calendar-cell-events';
      browserEvents.forEach((event, eventIndex) => {
        const eventBar = document.createElement('div');
        eventBar.className = `calendar-event ${event.cssClass}`;
        eventBar.title = event.tooltip;
        eventBar.style.display = eventIndex < 3 ? '' : 'none';
        const title = document.createElement('span');
        title.className = 'font-medium';
        title.textContent = event.title;
        eventBar.appendChild(title);
        eventContainer.appendChild(eventBar);
      });

      const overflow = document.createElement('button');
      overflow.type = 'button';
      overflow.className = 'show-more-btn';
      overflow.dataset.calendarFixture = `${key}-overflow`;
      overflow.dataset.cell = cell.dataset.calendarFixture;
      overflow.dataset.events = JSON.stringify(browserEvents);
      overflow.dataset.overflow = JSON.stringify(browserEvents.slice(3));
      overflow.dataset.dateLabel = group.dates[0];
      overflow.setAttribute('aria-expanded', 'false');
      overflow.setAttribute('aria-haspopup', 'true');
      overflow.setAttribute('aria-label', `Show 1 more events for ${group.dates[0]}`);
      overflow.textContent = '+1 more';
      overflow.addEventListener('click', () => window.openEventPopoverFromData(overflow));

      cell.appendChild(overflow);
      cell.appendChild(eventContainer);
      month.appendChild(cell);
    });
  }, { once: true });
}

test.describe('Calendar Page (/calendar)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript({
      content: `(${installCalendarFixture.toString()})(${JSON.stringify(CALENDAR_FIXTURE_GROUPS)});`,
    });
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    // initCalendarNav is called by site.js on DOMContentLoaded;
    // wait until window.changeMonth is exposed by the closure inside it.
    await page.waitForFunction(() => typeof window.changeMonth === 'function');
  });

  // ── Static structure ────────────────────────────────────────────────────────

  test('page loads and shows the month label', async ({ page }) => {
    const label = page.locator('#month-label');
    await expect(label).toBeVisible();
    const text = await label.textContent();
    // Label is uppercase (e.g. "MARCH 2026") and non-empty after JS runs.
    expect(text && text.trim().length).toBeGreaterThan(0);
    expect(text).not.toBe('Loading...');
  });

  test('calendar container is visible', async ({ page }) => {
    await expect(page.locator('#calendar-container')).toBeVisible();
  });

  // ── Month navigation ────────────────────────────────────────────────────────

  test('previous month button changes the month label', async ({ page }) => {
    const label = page.locator('#month-label');
    const initialMonth = await label.textContent();

    // Buttons use plain onclick="changeMonth(-1)" and onclick="changeMonth(1)".
    const prevBtn = page.locator('button[onclick*="changeMonth(-1)"]');
    await prevBtn.click();

    await page.waitForFunction(
      (initial) => {
        const el = document.getElementById('month-label');
        return el && el.innerText !== initial;
      },
      initialMonth
    );

    const newMonth = await label.textContent();
    expect(newMonth).not.toBe(initialMonth);
  });

  test('next month button advances the month label', async ({ page }) => {
    // #month-label has CSS text-transform:uppercase, so innerText !== textContent.
    // Use innerText() throughout for a consistent comparison.
    // Also: the static output starts at the LAST month — step back first so
    // changeMonth(1) is not a boundary no-op.
    await page.evaluate(() => window.changeMonth(-1));

    const label = page.locator('#month-label');
    const priorMonth = await label.innerText();

    const nextBtn = page.locator('button[onclick*="changeMonth(1)"]');
    await nextBtn.click();

    await page.waitForFunction(
      (initial) => {
        const el = document.getElementById('month-label');
        return el && el.innerText !== initial;
      },
      priorMonth
    );

    const newMonth = await label.innerText();
    expect(newMonth).not.toBe(priorMonth);
  });

  test('prev then next returns to the initial month', async ({ page }) => {
    // Use innerText() — label has text-transform:uppercase so innerText !== textContent.
    const label = page.locator('#month-label');
    const initialMonth = await label.innerText();

    await page.locator('button[onclick*="changeMonth(-1)"]').click();
    await page.waitForFunction(
      (initial) => document.getElementById('month-label')?.innerText !== initial,
      initialMonth
    );

    await page.locator('button[onclick*="changeMonth(1)"]').click();
    await page.waitForFunction(
      (initial) => document.getElementById('month-label')?.innerText === initial,
      initialMonth
    );

    expect(await label.innerText()).toBe(initialMonth);
  });

  test('prev button is a no-op at the first month', async ({ page }) => {
    // initCalendarNav bounds-checks: when currentIndex would go below 0 it
    // returns without changing the view.  Navigate back 24 times (more than
    // any realistic month count) to reach the first month, then verify that
    // one additional click does not change the label.
    const prevBtn = page.locator('button[onclick*="changeMonth(-1)"]');
    const label = page.locator('#month-label');

    // Use evaluate to click many times synchronously so we don't spam awaits.
    await page.evaluate(() => {
      for (let i = 0; i < 24; i++) {
        if (typeof window.changeMonth === 'function') window.changeMonth(-1);
      }
    });

    // Use innerText() — label has text-transform:uppercase so innerText !== textContent.
    const labelAtLimit = await label.innerText();

    // One more click must leave the label unchanged.
    await prevBtn.click();
    await page.waitForFunction(
      (expected) => document.getElementById('month-label')?.innerText === expected,
      labelAtLimit
    );
    expect(await label.innerText()).toBe(labelAtLimit);
  });

  // ── Tag filter buttons ──────────────────────────────────────────────────────

  test('tag filter buttons are rendered', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    await expect(filterBtns.first()).toBeVisible();
  });

  test('clicking a tag filter button activates it (bg-accent-dim)', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    await filterBtns.first().click();

    // toggleCalendarTag → _updateCalendarChips adds bg-accent-dim to active chip.
    await page.waitForFunction(
      () => document.querySelector('.filter-btn.bg-accent-dim') !== null
    );
    await expect(page.locator('.filter-btn.bg-accent-dim').first()).toBeVisible();
  });

  test('activating a filter makes the reset button visible', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    await filterBtns.first().click();

    // filterCalendarMulti sets cal-reset-btn display to 'flex'.
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('cal-reset-btn');
        return btn && btn.style.display !== '' && btn.style.display !== 'none';
      }
    );
    await expect(page.locator('#cal-reset-btn')).toBeVisible();
  });

  test('clicking the reset button clears all tag filters', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    await filterBtns.first().click();
    await page.waitForFunction(
      () => {
        const btn = document.getElementById('cal-reset-btn');
        return btn && btn.style.display !== '' && btn.style.display !== 'none';
      }
    );

    await page.locator('button[onclick*="clearCalendarFilter"]').click();

    await page.waitForFunction(
      () => {
        const btn = document.getElementById('cal-reset-btn');
        return btn && btn.style.display === 'none';
      }
    );
    await expect(page.locator('.filter-btn.bg-accent-dim')).not.toBeVisible();
  });

  test('filtering hides overflow controls with no matching events', async ({ page }) => {
    const filter = page.locator('[data-calendar-fixture="filter"]');
    const matchingOverflow = page.locator('[data-calendar-fixture="matching-overflow"]');
    const nonmatchingOverflow = page.locator('[data-calendar-fixture="nonmatching-overflow"]');

    await expect(matchingOverflow).toBeVisible();
    await expect(nonmatchingOverflow).toBeVisible();

    await filter.click();

    await expect(matchingOverflow).toBeVisible();
    await expect(nonmatchingOverflow).toBeHidden();
    await expect(nonmatchingOverflow).toHaveAttribute('data-overflow', '[]');
  });

  // ── Event popover ───────────────────────────────────────────────────────────

  test('show-more button opens the event popover', async ({ page }) => {
    // Only check visible show-more buttons (those inside the non-hidden month-view).
    // Hidden month-views may also hold show-more buttons that cannot be clicked.
    const showMoreBtn = page.locator('.month-view:not(.hidden) .show-more-btn').first();
    await showMoreBtn.click();

    const popover = page.locator('#calendar-popover');
    // Use string (not regex) — regex \bhidden\b also matches overflow-hidden which
    // is a permanent CSS utility class on the popover.
    await expect(popover).not.toHaveClass('hidden');
    await expect(popover).toBeVisible();
  });

  test('popover close button hides the popover', async ({ page }) => {
    const showMoreBtn = page.locator('.month-view:not(.hidden) .show-more-btn').first();
    await showMoreBtn.click();
    await expect(page.locator('#calendar-popover')).toBeVisible();

    // The close button has onclick="closeEventPopover()".
    await page.locator('#calendar-popover button[onclick*="closeEventPopover"]').click();

    await page.waitForFunction(
      () => document.getElementById('calendar-popover')?.classList.contains('hidden')
    );
    await expect(page.locator('#calendar-popover')).not.toBeVisible();
  });

  test('popover shows events with title text', async ({ page }) => {
    const showMoreBtn = page.locator('.month-view:not(.hidden) .show-more-btn').first();
    await showMoreBtn.click();
    await expect(page.locator('#calendar-popover')).toBeVisible();

    // openEventPopoverFromData populates #calendar-popover-events with spans.
    const events = page.locator('#calendar-popover-events .calendar-event');
    expect(await events.count()).toBeGreaterThan(0);
  });
});

// ── Agenda readability ──────────────────────────────────────────────────────
// The second line of an agenda card names the event type. It was 10px with
// opacity 0.75, which fails the WCAG AA contrast minimum in the light theme.
// These tests read the computed size and contrast of the rendered page, not a
// class name, so a stylesheet change cannot pass them without moving a pixel.
const AGENDA_VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];
const MIN_VISIBLE_TEXT_PX = 12;
const MIN_LABEL_CONTRAST = 4.5;
const EVENT_TYPE_LABELS = ['Release', 'Deadline', 'Progress', 'Defense'];

/**
 * Every element that paints its own text on the page. An element counts only
 * when it has a non-empty direct text node and a real box. An element with an
 * ancestor at display:none has a zero box, so hidden months and the closed
 * popover never count. The label opacity is returned so a caller can see the
 * value the contrast check applies.
 */
function scanVisibleText(minPx) {
  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const effectiveOpacity = (element) => {
    let opacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity || '1');
    }
    return opacity;
  };
  const isRendered = (element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false;
    }
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    return effectiveOpacity(element) > 0.01;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  const visible = [];
  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const element = walker.currentNode.parentElement;
    if (!element || skipTags.has(element.tagName) || seen.has(element)) continue;
    seen.add(element);
    if (!isRendered(element)) continue;
    const style = getComputedStyle(element);
    visible.push({
      text: text.slice(0, 50),
      px: Number.parseFloat(style.fontSize),
      opacity: Number(effectiveOpacity(element).toFixed(2)),
      tag: element.tagName,
      className: typeof element.className === 'string' ? element.className : ''
    });
  }

  return {
    counted: visible.length,
    smallest: Math.min(...visible.map((item) => item.px)),
    under: visible.filter((item) => item.px < minPx)
  };
}

/**
 * Contrast of every agenda label, with the label opacity applied. The
 * background is composited from the document root down to the label, so a
 * translucent card tint is measured as the reader sees it.
 */
function measureAgendaLabels() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const paint = (color) => {
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = '#010203';
    ctx.fillStyle = color;
    if (ctx.fillStyle === '#010203' && color !== '#010203') {
      throw new Error(`Canvas cannot parse colour: ${color}`);
    }
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
  };

  const backgroundOf = (element) => {
    const chain = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      chain.unshift(node);
    }
    ctx.globalCompositeOperation = 'copy';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1, 1);
    ctx.globalCompositeOperation = 'source-over';
    for (const node of chain) {
      const background = getComputedStyle(node).backgroundColor;
      if (!background || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') {
        continue;
      }
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 1, 1);
    }
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return [data[0] / 255, data[1] / 255, data[2] / 255];
  };

  const luminance = (rgb) => {
    const channel = (value) => (value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4));
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  };
  const contrast = (one, two) => {
    const first = luminance(one);
    const second = luminance(two);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  const effectiveOpacity = (element) => {
    let opacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity || '1');
    }
    return opacity;
  };

  const labels = [];
  for (const card of document.querySelectorAll('#calendar-container .calendar-event')) {
    const box = card.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    const spans = Array.from(card.children).filter((child) => child.tagName === 'SPAN');
    const label = spans[spans.length - 1];
    if (!label) continue;
    const text = label.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const style = getComputedStyle(label);
    const ink = paint(style.color);
    const alpha = ink[3] * effectiveOpacity(label);
    const background = backgroundOf(label);
    const composited = [
      ink[0] * alpha + background[0] * (1 - alpha),
      ink[1] * alpha + background[1] * (1 - alpha),
      ink[2] * alpha + background[2] * (1 - alpha)
    ];
    labels.push({
      text,
      px: Number.parseFloat(style.fontSize),
      opacity: Number(effectiveOpacity(label).toFixed(2)),
      ratio: Number(contrast(composited, background).toFixed(2)),
      color: style.color,
      background: background.map((value) => Math.round(value * 255))
    });
  }

  const groups = {};
  for (const label of labels) {
    const group = groups[label.text] || (groups[label.text] = {
      text: label.text,
      count: 0,
      px: label.px,
      opacity: label.opacity,
      minRatio: Infinity
    });
    group.count += 1;
    group.minRatio = Math.min(group.minRatio, label.ratio);
  }

  return { labels, groups };
}

test.describe('Calendar agenda readability (/calendar, touch)', () => {
  test.use({
    colorScheme: 'light',
    hasTouch: true,
    serviceWorkers: 'block'
  });

  async function openCalendar(page, viewport) {
    await page.setViewportSize(viewport);
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => typeof window.switchPrismTheme === 'function');
    await expect(page.locator('#calendar-container .calendar-event:visible').first()).toBeVisible();
  }

  async function selectTheme(page, theme) {
    await page.evaluate((name) => window.switchPrismTheme(name), theme);
    await page.waitForFunction(
      (name) => document.documentElement.dataset.theme === name,
      theme
    );
    // The agenda card carries transition-all, so the colour animates. Read the
    // settled value, not a frame in the middle of the 150ms transition.
    await page.evaluate(() => new Promise((resolve) => {
      setTimeout(resolve, 400);
    }));
  }

  test('no visible text on the page is under 12px at phone widths', async ({ page }) => {
    const reports = [];
    for (const viewport of AGENDA_VIEWPORTS) {
      await openCalendar(page, viewport);
      const report = await page.evaluate(scanVisibleText, MIN_VISIBLE_TEXT_PX);
      reports.push({ viewport, ...report });
    }
    console.log('CALENDAR_TEXT_SIZES ' + JSON.stringify(reports, null, 2));

    for (const report of reports) {
      expect(
        report.under,
        `${report.viewport.width}px has visible text under ${MIN_VISIBLE_TEXT_PX}px: `
          + JSON.stringify(report.under, null, 2)
      ).toEqual([]);
    }
  });

  test('event type labels meet 4.5 to 1 in both themes', async ({ page }) => {
    const reports = [];
    for (const viewport of AGENDA_VIEWPORTS) {
      await openCalendar(page, viewport);
      for (const theme of ['light', 'dark']) {
        await selectTheme(page, theme);
        const report = await page.evaluate(measureAgendaLabels);
        reports.push({ viewport, theme, ...report });
      }
    }
    console.log('CALENDAR_LABEL_CONTRAST ' + JSON.stringify(reports, null, 2));

    for (const report of reports) {
      const where = `${report.viewport.width}px ${report.theme}`;
      for (const name of EVENT_TYPE_LABELS) {
        expect(
          report.groups[name],
          `${where}: the ${name} label is missing from the agenda`
        ).toBeTruthy();
      }
      for (const group of Object.values(report.groups)) {
        expect(
          group.minRatio,
          `${where}: "${group.text}" label is ${group.minRatio} to 1 at `
            + `${group.px}px and opacity ${group.opacity}`
        ).toBeGreaterThanOrEqual(MIN_LABEL_CONTRAST);
      }
    }
  });

  test('the agenda does not overflow sideways at 360px', async ({ page }) => {
    await openCalendar(page, AGENDA_VIEWPORTS[0]);
    const metrics = await page.evaluate(() => {
      const documentElement = document.documentElement;
      const container = document.querySelector('#calendar-container');
      return {
        documentClientWidth: documentElement.clientWidth,
        documentScrollWidth: documentElement.scrollWidth,
        containerClientWidth: container.clientWidth,
        containerScrollWidth: container.scrollWidth
      };
    });
    console.log('CALENDAR_OVERFLOW ' + JSON.stringify(metrics, null, 2));

    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth);
    expect(metrics.containerScrollWidth).toBeLessThanOrEqual(metrics.containerClientWidth);
  });
});

test.describe('Calendar text selection (/calendar, touch)', () => {
  // A phone reader selects an event title or a date by long-press. Block the
  // service worker so the measurement always reads the bytes under test.
  test.use({
    viewport: { width: 360, height: 740 },
    hasTouch: true,
    serviceWorkers: 'block',
  });

  async function readUserSelect(locator) {
    return locator.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.userSelect || style.webkitUserSelect || '';
    });
  }

  test('event titles and dates are selectable at phone width', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => typeof window.changeMonth === 'function');

    const month = page.locator('.month-view:not(.hidden)').first();
    const eventTitle = month.locator('.md\\:hidden .calendar-event span.font-bold').first();
    const dateNumber = month.locator('.md\\:hidden span.text-2xl.font-bold.font-mono').first();

    await expect(eventTitle).toBeVisible();
    await expect(dateNumber).toBeVisible();

    const titleSelect = await readUserSelect(eventTitle);
    const dateSelect = await readUserSelect(dateNumber);

    expect(titleSelect, `event title computed user-select: ${titleSelect}`).not.toBe('none');
    expect(dateSelect, `date computed user-select: ${dateSelect}`).not.toBe('none');
  });

  test('month navigation and filter chips respond to touch', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('load');
    await page.waitForFunction(() => typeof window.changeMonth === 'function');

    const label = page.locator('#month-label');
    const initialMonth = await label.innerText();

    // Step back first so the forward tap is not a boundary no-op.
    await page.locator('button[onclick*="changeMonth(-1)"]').tap();
    await page.waitForFunction(
      (initial) => document.getElementById('month-label')?.innerText !== initial,
      initialMonth
    );
    expect(await label.innerText()).not.toBe(initialMonth);

    await page.locator('button[onclick*="changeMonth(1)"]').tap();
    await page.waitForFunction(
      (initial) => document.getElementById('month-label')?.innerText === initial,
      initialMonth
    );
    expect(await label.innerText()).toBe(initialMonth);

    const chip = page.locator('.filter-btn').first();
    await chip.tap();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.filter-btn.bg-accent-dim').first()).toBeVisible();
  });
});
