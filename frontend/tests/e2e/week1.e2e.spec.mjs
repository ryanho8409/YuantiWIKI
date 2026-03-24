import { test, expect } from '@playwright/test';

test.describe('Week 1 E2E (auth + space list)', () => {
  test('M-01: 未登录访问 / 自动跳转 /login', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });

  test('M-02: /login 页面结构与按钮类', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.login-page')).toBeVisible();
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toHaveClass(/btn-primary/);
  });

  test('M-03~M-05: admin 登录成功后顶栏与首页卡片', async ({ page }) => {
    await page.goto('/login');

    const inputs = page.locator('form input');
    await inputs.nth(0).fill('admin');
    await inputs.nth(1).fill('admin123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');

    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.logo')).toContainText('Yuanti Wiki');
    await expect(page.locator('.nav .user')).toContainText('admin');

    await expect(page.locator('.space-grid')).toBeVisible();
    const spaceCardCount = await page.locator('.space-card').count();
    expect(spaceCardCount).toBeGreaterThan(0);
  });

  test('M-06: 登录失败显示错误文案且不跳转', async ({ page }) => {
    await page.goto('/login');

    const inputs = page.locator('form input');
    await inputs.nth(0).fill('admin');
    await inputs.nth(1).fill('__wrong_password__');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.error-text')).toBeVisible();
    await expect(page.locator('.error-text')).toContainText('Invalid username or password');
  });
});

