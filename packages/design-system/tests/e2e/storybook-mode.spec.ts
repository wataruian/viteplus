import { type Frame, type Page, expect, test } from '@playwright/test';

const toolButton = (page: Page) => page.locator('button[title^="Switch to"]');

const previewFrame = async (page: Page): Promise<Frame> => {
  const handle = await page.locator('#storybook-preview-iframe').elementHandle();
  const frame = await handle.contentFrame();
  if (!frame) {
    throw new Error('Storybook preview iframe not found');
  }
  return frame;
};

const htmlMode = async (frame: Frame) =>
  await frame.evaluate(() => globalThis.document.documentElement.className);

const settleTimeoutMs = 30_000;
const quietPeriodMs = 1000;

const trackPreviewNavigations = (page: Page) => {
  const navigations = { count: 0 };
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) {
      navigations.count += 1;
    }
  });
  return navigations;
};

const waitForSettledPreview = async (
  page: Page,
  navigations: { count: number },
  mode: 'dark' | 'light',
): Promise<Frame> => {
  const frame = await previewFrame(page);
  await expect
    .poll(
      async () => {
        const before = navigations.count;
        await page.waitForTimeout(quietPeriodMs);
        if (navigations.count !== before) {
          return 'still navigating';
        }
        return await htmlMode(frame).catch(() => 'navigating');
      },
      { timeout: settleTimeoutMs },
    )
    .toBe(mode);
  return frame;
};

const tagNode = async (frame: Frame, selector: string) => {
  await frame.waitForSelector(selector);
  await frame.evaluate((sel) => {
    const element = globalThis.document.querySelector<HTMLElement>(sel);
    if (element) {
      element.dataset['e2eProbe'] = 'kept';
    }
  }, selector);
};

const isTagged = async (frame: Frame) =>
  await frame.evaluate(() => globalThis.document.querySelector('[data-e2e-probe="kept"]') !== null);

const backgroundOf = async (frame: Frame, selector: string) =>
  await frame.evaluate((sel) => {
    const element = globalThis.document.querySelector(sel);
    return element ? globalThis.getComputedStyle(element).backgroundColor : '';
  }, selector);

const views = [
  {
    name: 'docs page',
    node: '#storybook-docs .sbdocs-wrapper',
    path: '/?path=/docs/design-system-button--docs',
  },
  {
    name: 'variant (story) page',
    node: '#storybook-root > div',
    path: '/?path=/story/design-system-button--primary',
  },
] as const;

test.describe('Storybook light/dark mode toggle', () => {
  for (const view of views) {
    test(`toggles in place and persists on the ${view.name}`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      const navigations = trackPreviewNavigations(page);
      await page.goto(view.path);

      await expect(toolButton(page)).toHaveText('☾ Dark');

      const frame = await waitForSettledPreview(page, navigations, 'dark');
      const navigationsBeforeToggling = navigations.count;
      await tagNode(frame, view.node);
      const darkBackground = await backgroundOf(frame, view.node);

      await toolButton(page).click();
      await expect(toolButton(page)).toHaveText('☀ Light');
      await expect.poll(async () => await htmlMode(frame)).toBe('light');
      await expect.poll(async () => await backgroundOf(frame, view.node)).not.toBe(darkBackground);
      expect(await isTagged(frame)).toBe(true);

      await toolButton(page).click();
      await expect.poll(async () => await htmlMode(frame)).toBe('dark');
      await expect.poll(async () => await backgroundOf(frame, view.node)).toBe(darkBackground);
      expect(await isTagged(frame)).toBe(true);
      expect(navigations.count, 'toggling must not reload the preview').toBe(
        navigationsBeforeToggling,
      );

      await toolButton(page).click();
      await expect(toolButton(page)).toHaveText('☀ Light');
      await page.reload();
      await expect(toolButton(page)).toHaveText('☀ Light');
      await waitForSettledPreview(page, navigations, 'light');

      expect(pageErrors).toStrictEqual([]);
    });
  }
});
