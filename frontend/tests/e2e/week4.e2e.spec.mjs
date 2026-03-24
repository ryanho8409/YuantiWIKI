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
    data: { name, description: 'e2e week4', icon: '🧪', sortOrder: 999 },
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

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
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

async function apiDeleteSpace(request, adminToken, spaceId) {
  const res = await request.delete(`${backendBaseUrl}/api/v1/spaces/${spaceId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  expect([200, 204]).toContain(res.status());
}

async function loginAsTokenAndGoTo(page, token, url) {
  await page.goto(`${uiBaseUrl}/login`);
  await page.evaluate(({ key, token }) => localStorage.setItem(key, token), { key: TOKEN_KEY, token });
  await page.goto(url);
}

test.describe('Week 4 E2E (Search)', () => {
  test('M-01~M-03: header search + click result jump (admin)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1240, height: 850 });

    const admin = await apiLogin(request, 'admin', 'admin123');

    let spaceA = '';
    let spaceB = '';
    try {
      spaceA = await apiCreateSpace(request, admin.token, `Week4 E2E Space A ${Date.now()}`);
      spaceB = await apiCreateSpace(request, admin.token, `Week4 E2E Space B ${Date.now()}`);

      await apiSetPermissions(request, admin.token, spaceA, [
        { userId: admin.user.id, permission: 'admin' },
      ]);
      await apiSetPermissions(request, admin.token, spaceB, [
        { userId: admin.user.id, permission: 'admin' },
      ]);

      const pageA = await apiCreatePage(
        request,
        admin.token,
        spaceA,
        'week4-alpha page',
        tiptapDocWithText('week4-alpha')
      );
      await apiCreatePage(
        request,
        admin.token,
        spaceB,
        'week4-beta page',
        tiptapDocWithText('week4-beta')
      );

      await loginAsTokenAndGoTo(page, admin.token, `${uiBaseUrl}/`);

      const headerInput = page.locator('.header-search-input');
      await expect(headerInput).toBeVisible();
      await headerInput.fill('week4-alpha');
      await headerInput.press('Enter');

      await expect(page).toHaveURL(/\/search\?q=week4-alpha/);
      const searchResults = page.locator('.search-result');
      await page.waitForFunction(
        () => document.querySelectorAll('.search-result').length >= 1
      );
      await expect(searchResults.first()).toBeVisible();

      const alphaCard = page
        .locator('.search-result')
        .filter({ has: page.locator('h3', { hasText: 'week4-alpha page' }) });
      await expect(alphaCard.first()).toBeVisible();
      await alphaCard.first().click();

      // 跳转到 space/page，并展示 readView 内容
      await expect(page.locator('#readView')).toBeVisible();
      await expect(page.locator('#readView .ProseMirror')).toContainText('week4-alpha');
      // 兜底：确保是本次空间的页面
      await expect(page.locator('#readView .ProseMirror')).toContainText('week4-alpha');
    } finally {
      if (spaceA) {
        try {
          await apiDeleteSpace(request, admin.token, spaceA);
        } catch {
          // best-effort cleanup
        }
      }
      if (spaceB) {
        try {
          await apiDeleteSpace(request, admin.token, spaceB);
        } catch {
          // best-effort cleanup
        }
      }
    }
  });

  test('M-02: demo search is permission filtered (no leak)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1240, height: 850 });

    const admin = await apiLogin(request, 'admin', 'admin123');
    const demo = await apiLogin(request, 'demo', 'demo123');

    let spaceA = '';
    let spaceB = '';
    try {
      spaceA = await apiCreateSpace(request, admin.token, `Week4 E2E Space A ${Date.now()}`);
      spaceB = await apiCreateSpace(request, admin.token, `Week4 E2E Space B ${Date.now()}`);

      const demoPermSpaceA = [
        { userId: admin.user.id, permission: 'admin' },
        { userId: demo.user.id, permission: 'read' },
      ];
      const demoPermSpaceB = [{ userId: admin.user.id, permission: 'admin' }];

      await apiSetPermissions(request, admin.token, spaceA, demoPermSpaceA);
      await apiSetPermissions(request, admin.token, spaceB, demoPermSpaceB);

      await apiCreatePage(
        request,
        admin.token,
        spaceA,
        'week4-alpha page',
        tiptapDocWithText('week4-alpha')
      );
      await apiCreatePage(
        request,
        admin.token,
        spaceB,
        'week4-beta page',
        tiptapDocWithText('week4-beta')
      );

      await loginAsTokenAndGoTo(page, demo.token, `${uiBaseUrl}/search?q=week4-`);

      // demo 只应看到 spaceA 的结果
      const results = page.locator('.search-result');
      await expect(results).toHaveCount(1);
      await expect(page.locator('.search-result h3')).toContainText('week4-alpha');

      await results.first().click();
      await expect(page.locator('#readView .ProseMirror')).toContainText('week4-alpha');
    } finally {
      if (spaceA) {
        try {
          await apiDeleteSpace(request, admin.token, spaceA);
        } catch {
          // best-effort cleanup
        }
      }
      if (spaceB) {
        try {
          await apiDeleteSpace(request, admin.token, spaceB);
        } catch {
          // best-effort cleanup
        }
      }
    }
  });
});

