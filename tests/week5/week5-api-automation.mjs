#!/usr/bin/env node
/**
 * Week 5 API automation (page permissions override)
 * Usage:
 *   node tests/week5/week5-api-automation.mjs --help
 *   node tests/week5/week5-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 5 API automation

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
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore
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

async function apiLogin(username, password) {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  assert(res.ok, `login failed: ${res.status}`);
  assert(body?.token, 'login should return token');
  return { token: body.token, user: body.user };
}

async function apiCreateSpace(token, name) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'e2e week5', icon: '🧪', sortOrder: 999 }),
  });
  const body = await res.json();
  assert(res.status === 201 || res.status === 200, `create space failed: ${res.status}`);
  return body.id;
}

async function apiSetSpacePermissions(adminToken, spaceId, permissions) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  assert(res.status === 204, `set space permissions failed: ${res.status}`);
}

async function apiCreatePage(adminToken, spaceId, title, contentDoc) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ title, parentId: null, content: contentDoc }),
  });
  assert(res.status === 201, `create page failed: ${res.status}`);
  return body.id;
}

async function apiPatchPageContent(token, spaceId, pageId, contentDoc) {
  const { res } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: contentDoc }),
  });
  return res.status;
}

async function apiGetPageDetail(token, spaceId, pageId) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body };
}

async function apiGetVersions(token, spaceId, pageId) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}/versions`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.ok, `get versions failed: ${res.status}`);
  return body.versions;
}

async function apiRestoreVersion(token, spaceId, pageId, versionId) {
  const { res } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}/versions/${versionId}/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.status;
}

async function apiGetPagePermissions(adminToken, spaceId, pageId) {
  const { res, body } = await request(`/api/v1/spaces/${spaceId}/pages/${pageId}/permissions`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.ok, `get page permissions failed: ${res.status}`);
  return body;
}

async function apiSetPagePermissions(adminToken, spaceId, pageId, perms) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}/pages/${pageId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions: perms }),
  });
  assert(res.status === 204, `set page permissions failed: ${res.status}`);
}

async function apiDeleteSpace(adminToken, spaceId) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(res.status === 200 || res.status === 204, `delete space failed: ${res.status}`);
}

async function main() {
  console.log(`Running week5 API tests against ${config.baseUrl}`);

  let adminToken = '';
  let demoToken = '';
  let adminUser = null;
  let demoUser = null;
  let spaceId = '';
  let pageId = '';
  let versionIdToRestore = '';

  try {
    const admin = await apiLogin(config.adminUser, config.adminPass);
    adminToken = admin.token;
    adminUser = admin.user;

    const demo = await apiLogin(config.demoUser, config.demoPass);
    demoToken = demo.token;
    demoUser = demo.user;

    spaceId = await apiCreateSpace(adminToken, `Week5 Space ${Date.now()}`);

    // demo: space-level write first
    await apiSetSpacePermissions(adminToken, spaceId, [
      { userId: adminUser.id, permission: 'admin' },
      { userId: demoUser.id, permission: 'write' },
    ]);

    pageId = await apiCreatePage(adminToken, spaceId, 'week5-root', tiptapDocWithText('v1'));
    // create v2 snapshot
    await apiPatchPageContent(adminToken, spaceId, pageId, tiptapDocWithText('v2'));

    const versions = await apiGetVersions(adminToken, spaceId, pageId);
    assert(versions.length >= 2, 'should have at least 2 versions');
    versionIdToRestore = versions[1].id; // older one

    const results = [];
    results.push(
      await runCase('A-01: demo PATCH/restore allowed by space write', async () => {
        const patchStatus = await apiPatchPageContent(demoToken, spaceId, pageId, tiptapDocWithText('v3'));
        assert(patchStatus === 200, `expected PATCH 200, got ${patchStatus}`);
        const restoreStatus = await apiRestoreVersion(demoToken, spaceId, pageId, versionIdToRestore);
        assert(restoreStatus === 200, `expected RESTORE 200, got ${restoreStatus}`);
      })
    );

    results.push(
      await runCase('A-02: set page permission to read -> demo cannot PATCH/restore', async () => {
        await apiSetPagePermissions(adminToken, spaceId, pageId, [
          { userId: demoUser.id, permission: 'read' },
        ]);
        const me = await apiGetPageDetail(demoToken, spaceId, pageId);
        assert(me.status === 200, `expected page detail 200, got ${me.status}`);

        const patchStatus = await apiPatchPageContent(demoToken, spaceId, pageId, tiptapDocWithText('v4'));
        assert(patchStatus === 403, `expected PATCH 403, got ${patchStatus}`);

        const restoreStatus = await apiRestoreVersion(demoToken, spaceId, pageId, versionIdToRestore);
        assert(restoreStatus === 403, `expected RESTORE 403, got ${restoreStatus}`);
      })
    );

    results.push(
      await runCase('A-03: inherit from space -> demo restore allowed again', async () => {
        // inherit: delete override by setting permission=inherit
        await apiSetPagePermissions(adminToken, spaceId, pageId, [
          { userId: demoUser.id, permission: 'inherit' },
        ]);

        const restoreStatus = await apiRestoreVersion(demoToken, spaceId, pageId, versionIdToRestore);
        assert(restoreStatus === 200, `expected RESTORE 200, got ${restoreStatus}`);
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

