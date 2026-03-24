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
  const name = `Week2 E2E Space ${Date.now()}`;
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

async function apiCreatePage(request, adminToken, spaceId, title, parentId) {
  const res = await request.post(`${backendBaseUrl}/api/v1/spaces/${spaceId}/pages`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { title, parentId },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return body.id;
}

async function apiDeleteSpace(request, adminToken, spaceId) {
  const res = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  // backend 软删一般返回 204；兼容部分实现返回 200
  expect([200, 204]).toContain(res.status());
}

async function loginAsTokenAndGoToSpace(page, spaceId, token) {
  // 更稳健的方式：先进入一个非受保护页面，再写入 localStorage，最后跳转 space 页
  // 否则在某些情况下 addInitScript 可能未按预期生效，导致 PrivateRoute 重定向/页面不渲染。
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(
    ({ key, token }) => localStorage.setItem(key, token),
    { key: TOKEN_KEY, token }
  );
  await page.goto(`${uiBaseUrl}/space/${spaceId}`);
}

test.describe('Week 2 E2E (UI + permissions + page tree)', () => {
  test('M-01~M-03: three-column/class + content-toolbar/readView/editView + tree/rightbar/toc (admin)', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1240, height: 820 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId;
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ]);
      await apiCreatePage(request, admin.token, spaceId, 'e2e-root', null);
      await loginAsTokenAndGoToSpace(page, spaceId, admin.token);

      await expect(page.locator('.space-layout')).toBeVisible();
      const sidebarWidth = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
      const rightbarWidth = await page.locator('.rightbar').evaluate((el) => el.getBoundingClientRect().width);
      expect(sidebarWidth).toBeGreaterThan(250);
      expect(sidebarWidth).toBeLessThan(280);
      expect(rightbarWidth).toBeGreaterThan(220);
      expect(rightbarWidth).toBeLessThan(260);

      // content-toolbar + readView/editView
      await expect(page.locator('.content-toolbar')).toBeVisible();
      await expect(page.locator('#readView')).toHaveCount(1);
      await expect(page.locator('#editView')).toHaveCount(1);
      // 初始未选中页面时，readView 可能隐藏、editView 可能可见；只要求容器存在。
      const readVisible = await page.locator('#readView').isVisible().catch(() => false);
      const editVisible = await page.locator('#editView').isVisible().catch(() => false);
      expect(readVisible || editVisible).toBeTruthy();

      // tree/rightbar/toc
      await expect(page.locator('.tree-node', { hasText: 'e2e-root' })).toBeVisible();
      const rightbarSectionCount = await page.locator('.rightbar-section').count();
      expect(rightbarSectionCount).toBeGreaterThanOrEqual(2);
      await expect(page.locator('.toc a')).toBeVisible();
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // cleanup 失败不影响本次断言
        }
      }
    }
  });

  test('M-04~M-07: admin New/Rename/Delete + reload consistency (no ghost)', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1240, height: 820 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId;
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ]);

      // New page (prompt)
      const promptRoot = 'e2e-admin-root';
      const renameTitle = 'e2e-admin-root-renamed';
      await loginAsTokenAndGoToSpace(page, spaceId, admin.token);

      page.once('dialog', async (dialog) => {
        if (dialog.type() === 'prompt') await dialog.accept(promptRoot);
        else await dialog.accept();
      });
      await expect(page.getByRole('button', { name: 'New page' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'New page' }).click();

      // Wait for new node then select it
      await expect(page.locator('.tree-node', { hasText: promptRoot })).toBeVisible();
      await page.locator('.tree-node', { hasText: promptRoot }).click();

      // Rename
      page.once('dialog', async (dialog) => {
        if (dialog.type() === 'prompt') await dialog.accept(renameTitle);
        else await dialog.accept();
      });
      await expect(page.getByRole('button', { name: 'Rename' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Rename' }).click();

      await expect(page.locator('.tree-node', { hasText: renameTitle })).toBeVisible();

      // Delete (confirm)
      page.once('dialog', async (dialog) => {
        if (dialog.type() === 'confirm') await dialog.accept();
        else await dialog.accept();
      });
      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Delete' }).click();

      // Deleted node should disappear
      await expect(page.locator('.tree-node', { hasText: renameTitle })).toHaveCount(0);

      // Reload consistency (no ghost)
      await page.reload();
      await expect(page.locator('.tree-node', { hasText: renameTitle })).toHaveCount(0);
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // cleanup 失败不影响本次断言
        }
      }
    }
  });

  test('M-05: demo read-only hides New/Rename/Delete buttons', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1240, height: 820 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId;
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ]);
      await apiCreatePage(request, admin.token, spaceId, 'e2e-demo-root', null);
      await loginAsTokenAndGoToSpace(page, spaceId, demo.token);

      // The action buttons should be hidden in read-only mode
      await expect(page.getByRole('button', { name: 'New page' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Rename' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);

      await expect(page.locator('.tree-node', { hasText: 'e2e-demo-root' })).toBeVisible({ timeout: 10000 });
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // cleanup 失败不影响本次断言
        }
      }
    }
  });

  test('M-06: demo permission revoked -> 403 UI shows error text', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1240, height: 820 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceId;
    try {
      spaceId = await apiCreateSpace(request, admin.token);
      // give only admin; revoke demo read permission
      await apiSetPermissions(request, admin.token, spaceId, [
        { userId: admin.user.id, permission: 'admin' },
      ]);
      await apiCreatePage(request, admin.token, spaceId, 'e2e-private', null);
      await loginAsTokenAndGoToSpace(page, spaceId, demo.token);

      await expect(page.locator('.error-text')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.error-text')).toContainText("You don't have permission");
    } finally {
      if (spaceId) {
        try {
          await apiDeleteSpace(request, admin.token, spaceId);
        } catch {
          // cleanup 失败不影响本次断言
        }
      }
    }
  });
});

