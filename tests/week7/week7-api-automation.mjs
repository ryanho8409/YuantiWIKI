#!/usr/bin/env node
/**
 * Week 7 API automation
 * Coverage:
 * - admin-only endpoints (/admin/users, /admin/pages)
 * - space permission semantics (Admin/Edit/Read Only)
 *
 * Usage:
 *   node tests/week7/week7-api-automation.mjs --help
 *   node tests/week7/week7-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 7 API automation

Options:
  --baseUrl    Backend base url (default: http://localhost:3000)
  --adminUser  Admin username (default: admin)
  --adminPass  Admin password (default: admin123)
  --demoUser   Demo username (default: demo)
  --demoPass   Demo password (default: demo123)
`);
  process.exit(0);
}

const config = {
  baseUrl: getArg('baseUrl', 'http://localhost:3000'),
  adminUser: getArg('adminUser', 'admin'),
  adminPass: getArg('adminPass', 'admin123'),
  demoUser: getArg('demoUser', 'demo'),
  demoPass: getArg('demoPass', 'demo123'),
};

async function request(path, init = {}) {
  // 注意：不要用 `...init` 再覆盖 headers。Node/undici 下可能导致 body 与 Content-Type 组合异常，登录偶发 401。
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  if (init.body != null && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    body: init.body,
    headers,
    signal: init.signal,
  });

  let body = null;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      // ignore
    }
  }
  return { res, body };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function runCase(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    return { name, pass: true };
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(`  ${err instanceof Error ? err.message : String(err)}`);
    return { name, pass: false };
  }
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function apiLogin(user, pass) {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: user, password: pass }),
  });
  if (!res.ok) {
    const detail = body ? JSON.stringify(body) : 'no-body';
    throw new Error(`login failed: ${res.status} body=${detail}`);
  }
  assert(body?.token, 'login should return token');
  return { token: body.token, user: body.user };
}

async function apiCreateSpace(token, name) {
  const { res, body } = await request('/api/v1/spaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, description: 'e2e week7', icon: '🧪', sortOrder: 997 }),
  });
  assert(res.status === 201 || res.status === 200, `create space failed: ${res.status}`);
  return body.id;
}

async function apiDeleteSpace(token, spaceId) {
  const { res } = await request(`/api/v1/spaces/${spaceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.status === 200 || res.status === 204, `delete space failed: ${res.status}`);
}

async function apiCreatePage(token, spaceId, title, content) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, parentId: null, content }),
  });
  assert(res.status === 201, `create page failed: ${res.status}`);
  return body.id;
}

async function apiPatchPage(token, spaceId, pageId, content) {
  const { res } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content }),
  });
  return res.status;
}

async function apiDeletePage(token, spaceId, pageId) {
  const { res } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function setPermissionsCompat(adminToken, spaceId, permissions) {
  const payloadEdit = {
    permissions: permissions.map((x) => ({ userId: x.userId, permission: x.permission })),
  };
  const payloadWrite = {
    permissions: permissions.map((x) => ({
      userId: x.userId,
      permission: x.permission === 'edit' ? 'write' : x.permission,
    })),
  };

  // Prefer week7 semantics: admin/edit/read. Fallback for legacy backend: admin/write/read.
  let { res } = await request(`/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payloadEdit),
  });
  if (res.status === 204) return 'edit';

  ({ res } = await request(`/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payloadWrite),
  }));
  assert(res.status === 204, `set permissions failed with edit/write modes, last=${res.status}`);
  return 'write';
}

async function main() {
  console.log(`Running week7 API tests against ${config.baseUrl}`);
  let adminToken = '';
  let demoToken = '';
  let adminUser = null;
  let demoUser = null;
  let spaceId = '';
  let pageIdByDemo = '';

  try {
    const admin = await apiLogin(config.adminUser, config.adminPass);
    adminToken = admin.token;
    adminUser = admin.user;

    const demo = await apiLogin(config.demoUser, config.demoPass);
    demoToken = demo.token;
    demoUser = demo.user;

    const results = [];

    results.push(
      await runCase('A-01: admin can access /api/v1/admin/users', async () => {
        const { res, body } = await request('/api/v1/admin/users', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(res.status === 200, `expected 200, got ${res.status}`);
        assert(Array.isArray(body?.list) || Array.isArray(body), 'response should be list-like');
      })
    );

    results.push(
      await runCase('A-02: demo cannot access /api/v1/admin/users (403)', async () => {
        const { res } = await request('/api/v1/admin/users', {
          headers: { Authorization: `Bearer ${demoToken}` },
        });
        assert(res.status === 403, `expected 403, got ${res.status}`);
      })
    );

    results.push(
      await runCase('A-03: admin can access /api/v1/admin/pages', async () => {
        const { res, body } = await request('/api/v1/admin/pages?page=1&pageSize=20', {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(res.status === 200, `expected 200, got ${res.status}`);
        assert(Array.isArray(body?.list) || Array.isArray(body), 'response should be list-like');
      })
    );

    results.push(
      await runCase('A-04: demo cannot access /api/v1/admin/pages (403)', async () => {
        const { res } = await request('/api/v1/admin/pages?page=1&pageSize=20', {
          headers: { Authorization: `Bearer ${demoToken}` },
        });
        assert(res.status === 403, `expected 403, got ${res.status}`);
      })
    );

    results.push(
      await runCase('A-05: Edit permission can create/update page but cannot delete', async () => {
        spaceId = await apiCreateSpace(adminToken, `Week7 Space ${Date.now()}`);
        const mode = await setPermissionsCompat(adminToken, spaceId, [
          { userId: adminUser.id, permission: 'admin' },
          { userId: demoUser.id, permission: 'edit' },
        ]);
        assert(mode === 'edit' || mode === 'write', `unexpected permission mode: ${mode}`);

        pageIdByDemo = await apiCreatePage(
          demoToken,
          spaceId,
          `week7-demo-edit-${Date.now()}`,
          tiptapDocWithText('created by demo with edit')
        );

        const patchStatus = await apiPatchPage(
          demoToken,
          spaceId,
          pageIdByDemo,
          tiptapDocWithText('updated by demo with edit')
        );
        assert(patchStatus === 200, `PATCH expected 200, got ${patchStatus}`);

        const delStatus = await apiDeletePage(demoToken, spaceId, pageIdByDemo);
        assert(delStatus === 403, `DELETE expected 403 for edit, got ${delStatus}`);
      })
    );

    results.push(
      await runCase('A-06: Read Only permission cannot create page', async () => {
        assert(spaceId, 'space should exist from previous case');
        await setPermissionsCompat(adminToken, spaceId, [
          { userId: adminUser.id, permission: 'admin' },
          { userId: demoUser.id, permission: 'read' },
        ]);

        const { res } = await request(`/api/v1/spaces/${spaceId}/pages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${demoToken}` },
          body: JSON.stringify({
            title: `week7-demo-read-${Date.now()}`,
            parentId: null,
            content: tiptapDocWithText('should fail'),
          }),
        });
        assert(res.status === 403, `expected 403, got ${res.status}`);
      })
    );

    const passed = results.filter((x) => x.pass).length;
    const failed = results.length - passed;
    console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    if (spaceId) {
      try {
        await apiDeleteSpace(adminToken, spaceId);
      } catch {
        // best effort cleanup
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

