#!/usr/bin/env node
/**
 * Week 4 API automation (search + permissions)
 * Usage:
 *   node tests/week4/week4-api-automation.mjs --help
 *   node tests/week4/week4-api-automation.mjs --baseUrl http://localhost:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

if (args.includes('--help')) {
  console.log(`
Week 4 API automation

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
    // ignore non-json
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
    body: JSON.stringify({ name, description: 'e2e week4', icon: '🧪', sortOrder: 999 }),
  });
  const body = await res.json();
  assert([201, 200].includes(res.status), `create space failed: ${res.status}`);
  return body.id;
}

async function apiSetPermissions(adminToken, spaceId, permissions) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ permissions }),
  });
  assert(res.status === 204, `set permissions failed: ${res.status}`);
}

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
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

async function apiSearch(token, q) {
  const { res, body } = await request(`/api/v1/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert(res.ok, `search failed: ${res.status}`);
  return body;
}

async function apiDeleteSpace(adminToken, spaceId) {
  const res = await fetch(`${config.baseUrl}/api/v1/spaces/${spaceId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  // best-effort: 200 or 204 are ok
  assert([200, 204].includes(res.status), `delete space failed: ${res.status}`);
}

async function main() {
  console.log(`Running week4 API tests against ${config.baseUrl}`);

  const results = [];
  let adminToken = '';
  let demoToken = '';
  let adminUser = null;
  let demoUser = null;
  let spaceA = '';
  let spaceB = '';

  try {
    const admin = await apiLogin(config.adminUser, config.adminPass);
    adminToken = admin.token;
    adminUser = admin.user;
    const demo = await apiLogin(config.demoUser, config.demoPass);
    demoToken = demo.token;
    demoUser = demo.user;

    spaceA = await apiCreateSpace(adminToken, `Week4 Space A ${Date.now()}`);
    spaceB = await apiCreateSpace(adminToken, `Week4 Space B ${Date.now()}`);

    // demo: only read spaceA
    await apiSetPermissions(adminToken, spaceA, [
      { userId: adminUser.id, permission: 'admin' },
      { userId: demoUser.id, permission: 'read' },
    ]);
    await apiSetPermissions(adminToken, spaceB, [
      { userId: adminUser.id, permission: 'admin' },
    ]);

    const pA1 = await apiCreatePage(adminToken, spaceA, 'week4-alpha page', tiptapDocWithText('week4-alpha'));
    const pB1 = await apiCreatePage(adminToken, spaceB, 'week4-beta page', tiptapDocWithText('week4-beta'));

    results.push(
      await runCase('A-01 search permission filtered for demo', async () => {
        const adminRes = await apiSearch(adminToken, 'week4-');
        const demoRes = await apiSearch(demoToken, 'week4-');

        // admin sees both pages
        const adminPageIds = (adminRes?.results ?? []).map((r) => r.pageId);
        assert(adminPageIds.includes(pA1), 'admin should see spaceA page');
        assert(adminPageIds.includes(pB1), 'admin should see spaceB page');

        // demo sees only spaceA page
        const demoPageIds = (demoRes?.results ?? []).map((r) => r.pageId);
        assert(demoPageIds.includes(pA1), 'demo should see spaceA page');
        assert(!demoPageIds.includes(pB1), 'demo should not see spaceB page');
      })
    );
  } finally {
    // cleanup
    if (spaceA) {
      try {
        await apiDeleteSpace(adminToken, spaceA);
      } catch {
        // best-effort cleanup
      }
    }
    if (spaceB) {
      try {
        await apiDeleteSpace(adminToken, spaceB);
      } catch {
        // best-effort cleanup
      }
    }
  }

  const passed = results.filter((x) => x.pass).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

