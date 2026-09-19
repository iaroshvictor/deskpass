// End-to-end: the sign-in screen as a real browser sees it.
//
// Covers what DDP-level tests cannot — that the UI renders at all, that a
// wrong password is refused, and that a successful login reaches the desktop.
// Recorded before the security changes so a regression in the logged-in UI is
// visible afterwards.
//
//   npx playwright test tests/e2e
import { test, expect } from '@playwright/test';

const APP = process.env.DESKPASS_HTTP_URL || 'http://localhost:3000';
const USER = process.env.DESKPASS_TEST_USER || 'admin';
const PASS = process.env.DESKPASS_TEST_PASS || 'admin';

// The first load compiles and ships a multi-megabyte dev bundle; on a loaded
// machine that is slow but not broken.
const FIRST_LOAD = 120_000;
// The dev bundle is ~9 MB and Meteor proxies /__rspack__/* to the rspack dev
// server. That proxy gives up after roughly ten seconds and resets the
// connection, which kills the dev server outright (it has no handler for
// ECONNRESET), leaving every later page load without a bundle. Fetching the
// bundle straight from the dev server avoids both the timeout and the reset.
// Harmless in production mode, where no such route exists.
const DEV_SERVER = process.env.DESKPASS_DEV_SERVER_URL || 'http://127.0.0.1:8889';

// Off by default: rewriting the request to another port is itself a way to
// break the load, and the proxy path works once the bundle is already
// compiled. Set DESKPASS_BYPASS_PROXY=1 to try it when the proxy times out.
test.beforeEach(async ({ page }) => {
  if (process.env.DESKPASS_BYPASS_PROXY !== '1') return;
  await page.route('**/__rspack__/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/__rspack__', '');
    return route.continue({ url: DEV_SERVER + path });
  });
});


async function signIn(page, username, password) {
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button').first().click();
}

test.describe('sign-in', () => {
  test('an anonymous visitor sees the sign-in form', async ({ page }) => {
    await page.goto(APP);
    await expect(page.locator('.signinBox')).toBeVisible({ timeout: FIRST_LOAD });
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test('a wrong password does not get in', async ({ page }) => {
    await page.goto(APP);
    await expect(page.locator('.signinBox')).toBeVisible({ timeout: FIRST_LOAD });
    await signIn(page, USER, 'definitely-not-the-password');
    // Still on the sign-in screen a moment later.
    await page.waitForTimeout(3000);
    await expect(page.locator('.signinBox')).toBeVisible();
  });

  test('valid credentials open the desktop', async ({ page }) => {
    // Baseline for the remediation work: adding authorisation guards must not
    // break the logged-in UI.
    await page.goto(APP);
    await expect(page.locator('.signinBox')).toBeVisible({ timeout: FIRST_LOAD });
    await signIn(page, USER, PASS);
    await expect(page.locator('.signinBox')).toBeHidden({ timeout: 60_000 });
  });
});

test.describe('client health', () => {
  test('the first load produces no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(APP);
    await expect(page.locator('.signinBox')).toBeVisible({ timeout: FIRST_LOAD });
    expect(errors, `console errors on first load:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
