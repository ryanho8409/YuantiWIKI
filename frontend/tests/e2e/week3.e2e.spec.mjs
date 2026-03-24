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

async function apiCreateSpace(request, adminToken) {
  const name = `Week3 E2E Space ${Date.now()}`;
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name, description: 'e2e', icon: '🧪', sortOrder: 999 },
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

async function apiPatchPageContent(request, adminToken, spaceId, pageId, content) {
  const res = await request.patch(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { content },
  });
  expect(res.status()).toBe(200);
}

async function apiDeleteSpace(request, adminToken, spaceId) {
  const res = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect([200, 204]).toContain(res.status());
}

async function loginAsTokenAndGoToPage(page, spaceId, pageId, token) {
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(({ key, token }) => localStorage.setItem(key, token), {
    key: TOKEN_KEY,
    token,
  });
  await page.goto(`${uiBaseUrl}/space/${spaceId}/page/${pageId}`);
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

test.describe('Week 3 E2E (TipTap JSON + History/Restore)', () => {
  test('M-01~M-03: admin read/edit/save/history/restore works', async ({ page, request }) => {
    await page.setViewportSize({ width: 1240, height: 850 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId = '';
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ]);

      const v1 = tiptapDocWithText('week3 e2e v1');
      const v2 = 'week3 e2e v2';

      const pageId = await apiCreatePage(request, admin.token, spaceId, 'week3-root', v1);

      await loginAsTokenAndGoToPage(page, spaceId, pageId, admin.token);

      // readView contains ProseMirror
      await expect(page.locator('#readView')).toBeVisible();
      await expect(page.locator('#readView .ProseMirror')).toBeVisible();
      await expect(page.locator('#readView .ProseMirror')).toContainText('week3 e2e v1');

      // content-toolbar actions
      await expect(page.locator('.content-toolbar')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Page settings' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'History' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();

      // Edit -> Save
      await page.getByRole('button', { name: 'Edit' }).click();
      await expect(page.locator('#editView')).toBeVisible();
      // TipTap 初始化可能有延迟，给更长等待窗口
      await expect(page.locator('#editView .ProseMirror')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('#editView .doc-body.editable .ProseMirror')).toBeVisible({ timeout: 15000 });

      await page.locator('#editView .ProseMirror').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.type(v2);

      await page.getByRole('button', { name: 'Save' }).click();

      // 保存状态指示器至少切换到 saving 或 saved
      await page.waitForFunction(
        () =>
          document.querySelector('.save-indicator.saving') ||
          document.querySelector('.save-indicator.saved'),
        { timeout: 3000 }
      );

      await expect(page.locator('#readView')).toBeVisible();
      await expect(page.locator('#readView .ProseMirror')).toContainText(v2);
      await expect(page.locator('.save-indicator')).toBeVisible();

      // History -> Restore older
      await page.getByRole('button', { name: 'History' }).click();
      await expect(page.locator('.version-panel.open')).toBeVisible();

      const restoreButtons = page.locator('.version-item-actions').getByRole('button', { name: 'Restore' });
      // 等待 versions 列表加载完成（否则可能还没渲染 Restore 按钮）
      await page.waitForFunction(
        () => document.querySelectorAll('.version-item-actions button').length >= 2
      );
      const restoreCount = await restoreButtons.count();
      expect(restoreCount).toBeGreaterThanOrEqual(2);
      const versionItemCount = await page.locator('.version-item').count();
      expect(versionItemCount).toBeGreaterThan(1);

      // restore second entry (older)
      await restoreButtons.nth(1).click();

      // After restore, content should become v1 again
      await expect(page.locator('#readView .ProseMirror')).toContainText('week3 e2e v1');

      // Close History panel
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.version-panel.open')).toHaveCount(0);
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // best effort cleanup
        }
      }
    }
  });

  test('M-04~M-06: demo read-only hides Edit/Save/Restore', async ({ page, request }) => {
    await page.setViewportSize({ width: 1240, height: 850 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId = '';
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ]);

      const v1 = tiptapDocWithText('week3 e2e v1 demo');
      const pageId = await apiCreatePage(request, admin.token, spaceId, 'week3-root', v1);

      await loginAsTokenAndGoToPage(page, spaceId, pageId, demo.token);

      await expect(page.locator('#readView')).toBeVisible();
      await expect(page.locator('#readView .ProseMirror')).toBeVisible();

      // UI buttons should not exist
      await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cancel' })).toHaveCount(0);

      // History can open, but Restore buttons should not be shown
      await page.getByRole('button', { name: 'History' }).click();
      await expect(page.locator('.version-panel.open')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Restore' })).toHaveCount(0);

      // Revoke demo read permission, then reload to ensure UI shows unified error text
      // (demo role is a normal user, so permission check won't be bypassed)
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
      ]);
      await page.reload();
      await expect(page.locator('.error-text')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.error-text')).toContainText("You don't have permission");
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // best effort cleanup
        }
      }
    }
  });

  test('M-07: Restore permission revoked shows error-text', async ({ page, request }) => {
    await page.setViewportSize({ width: 1240, height: 850 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId = '';
    let pageId = '';
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      // 给 demo write，让 UI 里 Restore 按钮可见
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'write' },
      ]);

      const v1 = tiptapDocWithText('week3 restore v1');
      const v2 = tiptapDocWithText('week3 restore v2');

      pageId = await apiCreatePage(request, admin.token, spaceId, 'week3-root', v1);
      await apiPatchPageContent(request, admin.token, spaceId, pageId, v2);

      await loginAsTokenAndGoToPage(page, spaceId, pageId, demo.token);

      await page.getByRole('button', { name: 'History' }).click();
      await expect(page.locator('.version-panel.open')).toBeVisible();

      const restoreButtons = page
        .locator('.version-item-actions')
        .getByRole('button', { name: 'Restore' });

      await page.waitForFunction(
        () => document.querySelectorAll('.version-item-actions button').length >= 2
      );

      const restoreCount = await restoreButtons.count();
      expect(restoreCount).toBeGreaterThanOrEqual(2);

      // 撤销 demo write -> read（不刷新页面，确保按钮仍可点击）
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
      ]);

      await restoreButtons.nth(1).click();

      await expect(page.locator('.error-text')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.error-text')).toContainText("You don't have permission");
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // best effort cleanup
        }
      }
    }
  });
});

