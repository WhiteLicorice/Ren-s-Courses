// @ts-check
'use strict';

const { test, expect } = require('@playwright/test');

test('diagram steps are pre-rendered in a compact, stable stage', async ({ page }) => {
  await page.goto('/articles/demo-interactive-bfs');

  const widget = page.locator('[data-interactive-diagram]');
  await expect(widget).toHaveAttribute('data-diagram-initialized', 'true');

  const measurements = await widget.evaluate(element => {
    const canvases = [...element.querySelectorAll('[data-diagram-canvas]')];
    const before = element.getBoundingClientRect();
    element.querySelector('[data-diagram-action="next"]').click();
    const after = element.getBoundingClientRect();

    return {
      renderedSteps: canvases.filter(canvas => canvas.querySelector('svg')).length,
      totalSteps: canvases.length,
      canvasHeight: canvases[0].getBoundingClientRect().height,
      widgetHeightBefore: before.height,
      widgetHeightAfter: after.height,
      visibleStepHasSvg: !!element.querySelector('[data-diagram-step]:not([hidden]) svg')
    };
  });

  expect(measurements.renderedSteps).toBe(measurements.totalSteps);
  expect(measurements.canvasHeight).toBeLessThanOrEqual(288);
  expect(measurements.widgetHeightBefore).toBeLessThan(700);
  expect(measurements.widgetHeightAfter).toBe(measurements.widgetHeightBefore);
  expect(measurements.visibleStepHasSvg).toBe(true);
});

test('diagram stage follows the drawing aspect ratio', async ({ page }) => {
  const stageHeight = async slug => {
    await page.goto(`/articles/${slug}`);
    const widget = page.locator('[data-interactive-diagram]');
    await expect(widget).toHaveAttribute('data-diagram-initialized', 'true');
    return widget.locator('[data-diagram-step]:not([hidden]) [data-diagram-canvas]')
      .evaluate(canvas => canvas.getBoundingClientRect().height);
  };

  const bfsHeight = await stageHeight('demo-interactive-bfs');
  const bubbleSortHeight = await stageHeight('demo-interactive-bubble-sort');

  expect(bfsHeight).toBeGreaterThan(bubbleSortHeight);
  expect(bubbleSortHeight).toBeLessThanOrEqual(128);
});
