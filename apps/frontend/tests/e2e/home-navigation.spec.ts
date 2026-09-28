import { type Page, expect, test } from '@playwright/test';

const collectPageErrors = (page: Page) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  return pageErrors;
};

const homeHeading = (page: Page) => page.getByRole('heading', { name: 'Get started' });
const previewLink = (page: Page) => page.getByRole('link', { name: 'Preview Design System' });
const homeLink = (page: Page) => page.getByRole('link', { name: 'Home' });
const previewModeSwitcher = (page: Page) =>
  page.getByRole('button', { name: /^Switch to (?:light|dark) mode$/u });

test('the home page renders and its counter increments', async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto('/');

  await expect(page).toHaveTitle('Frontend');
  await expect(homeHeading(page)).toBeVisible();
  await expect(previewLink(page)).toHaveAttribute('href', '/preview');

  const counter = page.locator('#counter');
  await expect(counter).toHaveText('Count is 0');
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText('Count is 2');

  expect(pageErrors).toStrictEqual([]);
});

test('navigates from home to /preview and back, including browser history', async ({ page }) => {
  const pageErrors = collectPageErrors(page);

  await page.goto('/');
  await expect(homeHeading(page)).toBeVisible();

  await previewLink(page).click();
  await expect(page).toHaveURL(/\/preview$/u);
  await expect(previewModeSwitcher(page)).toBeVisible();
  await expect(homeHeading(page)).toHaveCount(0);

  await homeLink(page).click();
  await expect(page).toHaveURL(/\/$/u);
  await expect(homeHeading(page)).toBeVisible();
  await expect(previewModeSwitcher(page)).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/preview$/u);
  await expect(previewModeSwitcher(page)).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/$/u);
  await expect(homeHeading(page)).toBeVisible();

  expect(pageErrors).toStrictEqual([]);
});
