import { type Page, expect, test } from '@playwright/test';

const htmlMode = async (page: Page) =>
  await page.evaluate(() => globalThis.document.documentElement.className);

const pageBackground = async (page: Page) =>
  await page.evaluate(
    () => globalThis.getComputedStyle(globalThis.document.documentElement).backgroundColor,
  );

test('the /preview mode switcher toggles light/dark in place', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/preview');
  await page.addStyleTag({ content: '*, :root { transition: none !important; }' });

  const toLight = page.getByRole('button', { name: 'Switch to light mode' });
  await expect(toLight).toBeVisible();
  await expect.poll(async () => await htmlMode(page)).toContain('dark');
  const darkBackground = await pageBackground(page);

  await toLight.evaluate((element) => {
    element.dataset['e2eProbe'] = 'kept';
  });

  await toLight.click();
  await expect.poll(async () => await htmlMode(page)).toContain('light');
  await expect.poll(async () => await pageBackground(page)).not.toBe(darkBackground);
  await expect(page.locator('[data-e2e-probe="kept"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect.poll(async () => await htmlMode(page)).toContain('dark');
  await expect.poll(async () => await pageBackground(page)).toBe(darkBackground);
  await expect(page.locator('[data-e2e-probe="kept"]')).toHaveCount(1);

  expect(pageErrors).toStrictEqual([]);
});
