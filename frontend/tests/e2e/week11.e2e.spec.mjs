import { test, expect } from '@playwright/test';

const uiBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173';
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'yuanti_wiki_token';
const THEME_KEY = 'yuanti-theme';

async function apiLogin(request, username, password) {
  const res = await request.post(`${backendBaseUrl}/api/v1/auth/login`, {
    data: { username, password },
  });
  if (res.status() !== 200) {
    const detail = await res.text();
    throw new Error(`apiLogin failed: status=${res.status()} body=${detail}`);
  }
  const body = await res.json();
  expect(body?.token).toBeTruthy();
  return body.token;
}

test.describe('Week 11 E2E (dark logo switching)', () => {
  test('W11-01: dark 模式下 login/header 使用 logo_dark.png', async ({ page, request }) => {
    // Ensure theme is dark before app bootstraps.
    await page.addInitScript(({ k }) => localStorage.setItem(k, 'dark'), { k: THEME_KEY });

    // Login page should use dark logo.
    await page.goto(`${uiBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 20000 });

    const loginLogo = page.locator('.login-left-logo');
    await expect(loginLogo).toBeVisible();
    await expect(loginLogo).toHaveAttribute('src', /logo_dark\.png/);

    // Header logo should also use dark logo after authenticated layout renders.
    const token = await apiLogin(request, process.env.PW_ADMIN_USER || 'admin', process.env.PW_ADMIN_PASS || 'admin123');
    await page.evaluate(
      ({ tokenKey, tokenValue }) => localStorage.setItem(tokenKey, tokenValue),
      { tokenKey: TOKEN_KEY, tokenValue: token },
    );
    await page.goto(`${uiBaseUrl}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark', { timeout: 20000 });

    const headerLogo = page.locator('.brand-logo--header');
    await expect(headerLogo).toBeVisible({ timeout: 20000 });
    await expect(headerLogo).toHaveAttribute('src', /logo_dark\.png/);
  });
});

