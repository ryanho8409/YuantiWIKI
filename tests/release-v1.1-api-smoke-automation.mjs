#!/usr/bin/env node
/**
 * Release V1.1 API Smoke (P0) - scenes A-D
 *
 * Coverage:
 * - A: UNAUTHORIZED contract (401 + code)
 * - B: FORBIDDEN contract (403 + code)
 * - C: NOT_FOUND contract (404 + code)
 * - D: business conflict HAS_CHILDREN (409 + code)
 *
 * Usage:
 *   node tests/release-v1.1-api-smoke-automation.mjs --baseUrl http://localhost:3000
 */

import fs from 'fs';

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

const config = {
  baseUrl: getArg('baseUrl', 'http://localhost:3000'),
  adminUser: getArg('adminUser', 'admin'),
  adminPass: getArg('adminPass', 'admin123'),
  demoUser: getArg('demoUser', 'demo'),
  demoPass: getArg('demoPass', 'demo123'),
};

function tiptapDocWithText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

async function request(path, init = {}) {
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  if (init.body != null && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    body: init.body,
    headers,
  });
  const ct = res.headers.get('content-type') ?? '';
  let body = null;
  if (ct.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  }
  return { res, body };
}

async function apiLogin(username, password) {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: status=${res.status} body=${body ? JSON.stringify(body) : 'no-body'}`);
  }
  if (!body?.token) throw new Error('login response missing token');
  return { token: body.token, user: body.user };
}

async function runCase(name, fn) {
  const started = Date.now();
  try {
    await fn();
    console.log(`PASS ${name} (${Date.now() - started}ms)`);
    return { name, pass: true };
  } catch (err) {
    console.error(`FAIL ${name} (${Date.now() - started}ms)`);
    console.error(err instanceof Error ? err.message : String(err));
    return { name, pass: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const results = [];

  const admin = await apiLogin(config.adminUser, config.adminPass);
  const demo = await apiLogin(config.demoUser, config.demoPass);

  // A: UNAUTHORIZED
  results.push(
    await runCase('A: 401 UNAUTHORIZED contract', async () => {
      const { res, body } = await request('/api/v1/auth/me', {
        method: 'GET',
      });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
      if (body?.code !== 'UNAUTHORIZED') {
        throw new Error(`expected code=UNAUTHORIZED, got ${body?.code}`);
      }
      if (typeof body?.message !== 'string' || !body.message) throw new Error('missing message');
    })
  );

  // B: FORBIDDEN
  results.push(
    await runCase('B: 403 FORBIDDEN contract', async () => {
      const { res, body } = await request('/api/v1/admin/users', {
        method: 'GET',
        headers: { Authorization: `Bearer ${demo.token}` },
      });
      if (res.status !== 403) throw new Error(`expected 403, got ${res.status}`);
      if (body?.code !== 'FORBIDDEN') {
        throw new Error(`expected code=FORBIDDEN, got ${body?.code}`);
      }
      if (typeof body?.message !== 'string' || !body.message) throw new Error('missing message');
    })
  );

  // C: NOT_FOUND
  results.push(
    await runCase('C: 404 NOT_FOUND contract', async () => {
      const { res, body } = await request('/api/v1/spaces/does-not-exist/pages/does-not-exist', {
        method: 'GET',
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
      if (body?.code !== 'NOT_FOUND') {
        throw new Error(`expected code=NOT_FOUND, got ${body?.code}`);
      }
      if (typeof body?.message !== 'string' || !body.message) throw new Error('missing message');
    })
  );

  // D: 409 HAS_CHILDREN
  results.push(
    await runCase('D: 409 HAS_CHILDREN business conflict', async () => {
      // create space
      const spaceRes = await request('/api/v1/spaces', {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({
          name: `ReleaseV1.1 API Smoke ${Date.now()}`,
          description: 'api smoke',
          icon: '🧪',
          sortOrder: 997,
        }),
      });
      if (spaceRes.res.status !== 201) {
        throw new Error(`create space expected 201, got ${spaceRes.res.status}`);
      }
      const spaceId = spaceRes.body.id;

      // create parent page (v0)
      const parentRes = await request(`/api/v1/spaces/${encodeURIComponent(spaceId)}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({
          title: `parent-${Date.now()}`,
          parentId: null,
          content: tiptapDocWithText('parent'),
        }),
      });
      if (parentRes.res.status !== 201) throw new Error(`create parent page got ${parentRes.res.status}`);
      const parentPageId = parentRes.body.id;

      // create child page to make conflict on delete
      const childRes = await request(`/api/v1/spaces/${encodeURIComponent(spaceId)}/pages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${admin.token}` },
        body: JSON.stringify({
          title: `child-${Date.now()}`,
          parentId: parentPageId,
          content: tiptapDocWithText('child'),
        }),
      });
      if (childRes.res.status !== 201) throw new Error(`create child page got ${childRes.res.status}`);

      // delete parent should 409
      const delRes = await request(`/api/v1/spaces/${encodeURIComponent(spaceId)}/pages/${encodeURIComponent(parentPageId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${admin.token}` },
      });
      if (delRes.res.status !== 409) throw new Error(`expected 409, got ${delRes.res.status}`);
      if (delRes.body?.code !== 'HAS_CHILDREN') {
        throw new Error(`expected code=HAS_CHILDREN, got ${delRes.body?.code}`);
      }
      if (typeof delRes.body?.message !== 'string' || !delRes.body.message) throw new Error('missing message');

      // best-effort cleanup: delete space (ignore failures)
      try {
        await request(`/api/v1/spaces/${encodeURIComponent(spaceId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${admin.token}` },
        });
      } catch {
        // ignore
      }
    })
  );

  const passed = results.filter((x) => x.pass).length;
  const failed = results.length - passed;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed`);

  const resultMap = {};
  for (const r of results) {
    const m = r.name.match(/^([A-D]):/);
    if (m) resultMap[m[1]] = r.pass ? 'Pass' : `Fail: ${r.error ?? 'unknown error'}`;
  }

  const outPath = 'tests/.release-v1.1-results-api.json';
  fs.writeFileSync(outPath, JSON.stringify({ version: 'v1.1', scope: 'api', results: resultMap }, null, 2), 'utf8');
  console.log(`Wrote ${outPath}`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

