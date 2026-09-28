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

      await page.goto(view.path);

      await expect(toolButton(page)).toHaveText('☾ Dark');

      const frame = await previewFrame(page);
      await expect.poll(async () => await htmlMode(frame)).toBe('dark');
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

      await toolButton(page).click();
      await expect(toolButton(page)).toHaveText('☀ Light');
      await page.reload();
      await expect(toolButton(page)).toHaveText('☀ Light');
      const reloadedFrame = await previewFrame(page);
      await expect.poll(async () => await htmlMode(reloadedFrame)).toBe('light');

      expect(pageErrors).toStrictEqual([]);
    });
  }
});
