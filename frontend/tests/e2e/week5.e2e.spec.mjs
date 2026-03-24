import { test, expect } from '@playwright/test';

const uiBaseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const backendBaseUrl = process.env.PW_BACKEND_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'yuanti_wiki_token';

async function apiLogin(request, username, password) {
  const res = await request.post(`${backendBaseUrl}/api/v1/auth/login`, {
    data: { username, password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body?.token).toBeTruthy();
  return { token: body.token, user: body.user };
}

async function apiCreateSpace(request, adminToken, name) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name, description: 'e2e week5', icon: '🧪', sortOrder: 999 },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id;
}

async function apiSetPermissions(request, adminToken, spaceId, perms) {
  const res = await request.put(`${backendBaseUrl}/api/v1/spaces/${spaceId}/permissions`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { permissions: perms },
  });
  expect(res.status()).toBe(204);
}

async function apiCreatePage(request, adminToken, spaceId, title, content) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { title, parentId: null, content },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id;
}

async function apiPatchPageContent(request, token, spaceId, pageId, content) {
  const res = await request.patch(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { content },
  });
  return res.status();
}

async function apiDeleteSpace(request, adminToken, spaceId) {
  const res = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect([200, 204]).toContain(res.status());
}

async function loginAsTokenAndGoToPage(page, spaceId, pageId, token) {
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(({ key, token }) => localStorage.setItem(key, token), { key: TOKEN_KEY, token });
  await page.goto(`${uiBaseUrl}/space/${spaceId}/page/${pageId}`);
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

test.describe('Week 5 E2E (Page permissions)', () => {
  test('M-01~M-02: Page settings override to Can view (demo) hides Edit & Restore', async ({
    page,
    request,
    browser,
  }) => {
    test.setTimeout(60000);
    page.setViewportSize({ width: 1240, height: 850 });
    const demoContext = await browser.newContext();
    const demoPage = await demoContext.newPage();

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId = '';
    try {
      spaceId = await apiCreateSpace(request, admin.token, `Week5 E2E Space ${Date.now()}`);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'write' },
      ]);

      const v1 = tiptapDocWithText('week5 v1');
      const v2 = tiptapDocWithText('week5 v2');
      const pageId = await apiCreatePage(request, admin.token, spaceId, 'week5-root', v1);
      await apiPatchPageContent(request, admin.token, spaceId, pageId, v2);

      // demo opens page + history with write permission
      await loginAsTokenAndGoToPage(demoPage, spaceId, pageId, demo.token);
      await expect(demoPage.locator('#readView')).toBeVisible();
      await expect(demoPage.getByRole('button', { name: 'Edit' })).toHaveCount(1);
      await demoPage.getByRole('button', { name: 'History' }).click();
      const restoreLocator = demoPage.locator('#versionPanel').getByRole('button', { name: 'Restore' });
      await demoPage.waitForFunction(() => document.querySelectorAll('#versionPanel button').length > 0, {
        timeout: 15000,
      });
      const restoreCount = await restoreLocator.count();
      expect(restoreCount).toBeGreaterThan(0);

      // admin opens Page settings and sets demo -> Can view
      await loginAsTokenAndGoToPage(page, spaceId, pageId, admin.token);
      await expect(page.locator('#readView')).toBeVisible({ timeout: 15000 });
      const pageSettingsBtn = page.getByRole('button', { name: 'Page settings' });
      await expect(pageSettingsBtn).toBeVisible({ timeout: 15000 });
      await expect(pageSettingsBtn).toBeEnabled({ timeout: 15000 });
      await pageSettingsBtn.click();
      await expect(page.locator('.page-settings.open')).toBeVisible();

      // change demo permission dropdown
      const demoRow = page.locator('.page-settings table tbody tr', { hasText: 'Demo user' });
      await demoRow.locator('select.perm-select').selectOption('read');

      const saveBtn = page.locator('.page-settings.open').getByRole('button', { name: 'Save' });
      await saveBtn.click();

      await expect(page.locator('.page-settings.open')).toHaveCount(0, { timeout: 15000 });

      // Restore may still be visible for a short time on demo (refetch interval).
      // Clicking it should produce unified 403 .error-text.
      const restoreBtn = demoPage.locator('#versionPanel').getByRole('button', { name: 'Restore' }).first();
      await restoreBtn.click({ timeout: 5000 });
      await expect(demoPage.locator('.error-text')).toContainText("You don't have permission");

      // demo UI should react: Edit hidden and Restore hidden
      await expect(demoPage.getByRole('button', { name: 'Edit' })).toHaveCount(0, { timeout: 15000 });
      await expect(demoPage.getByRole('button', { name: 'Restore' })).toHaveCount(0, { timeout: 15000 });
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // best-effort cleanup
        }
      }
      await demoContext.close();
    }
  });
});

