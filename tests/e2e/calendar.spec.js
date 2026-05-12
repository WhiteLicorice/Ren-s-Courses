'use strict';

const { test, expect } = require('@playwright/test');

test.describe('Calendar Page (/calendar)', () => {
  test.beforeEach(async ({ page }) => {
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

  test('tag filter buttons are rendered (if tagged events exist)', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    if (await filterBtns.count() === 0) test.skip();
    await expect(filterBtns.first()).toBeVisible();
  });

  test('clicking a tag filter button activates it (bg-accent-dim)', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    if (await filterBtns.count() === 0) test.skip();

    await filterBtns.first().click();

    // toggleCalendarTag → _updateCalendarChips adds bg-accent-dim to active chip.
    await page.waitForFunction(
      () => document.querySelector('.filter-btn.bg-accent-dim') !== null
    );
    await expect(page.locator('.filter-btn.bg-accent-dim').first()).toBeVisible();
  });

  test('activating a filter makes the reset button visible', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn');
    if (await filterBtns.count() === 0) test.skip();

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
    if (await filterBtns.count() === 0) test.skip();

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

  // ── Event popover ───────────────────────────────────────────────────────────

  test('show-more button opens the event popover', async ({ page }) => {
    // Only check visible show-more buttons (those inside the non-hidden month-view).
    // The static output may contain show-more buttons in hidden month-views that
    // cannot be clicked.
    const showMoreBtn = page.locator('.month-view:not(.hidden) .show-more-btn').first();
    if (await showMoreBtn.count() === 0) test.skip();

    await showMoreBtn.click();

    const popover = page.locator('#calendar-popover');
    // Use string (not regex) — regex \bhidden\b also matches overflow-hidden which
    // is a permanent CSS utility class on the popover.
    await expect(popover).not.toHaveClass('hidden');
    await expect(popover).toBeVisible();
  });

  test('popover close button hides the popover', async ({ page }) => {
    const showMoreBtn = page.locator('.month-view:not(.hidden) .show-more-btn').first();
    if (await showMoreBtn.count() === 0) test.skip();

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
    if (await showMoreBtn.count() === 0) test.skip();

    await showMoreBtn.click();
    await expect(page.locator('#calendar-popover')).toBeVisible();

    // openEventPopoverFromData populates #calendar-popover-events with spans.
    const events = page.locator('#calendar-popover-events .calendar-event');
    expect(await events.count()).toBeGreaterThan(0);
  });
});
