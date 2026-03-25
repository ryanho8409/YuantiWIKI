#!/usr/bin/env node
/**
 * Release V1.1 soft-delete test data (spaces)
 *
 * It finds spaces created by release-v1.1 automation and soft-deletes them via API:
 *   DELETE /api/v1/spaces/:id  (soft delete)
 *
 * Usage:
 *   node tests/release-v1.1-soft-delete-test-data.mjs --baseUrl http://127.0.0.1:3000
 */

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const idx = args.findIndex((x) => x === `--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
}

const config = {
  baseUrl: getArg('baseUrl', 'http://127.0.0.1:3000'),
  adminUser: getArg('adminUser', 'admin'),
  adminPass: getArg('adminPass', 'admin123'),
};

const MATCHERS = [
  /^ReleaseV1\.1\b/i,
  /\bAPI Smoke\b/i,
  /\bE2E Space\b/i,
  /\brelease-v1\.1-e2e\b/i,
];

async function request(path, init = {}) {
  const headers = init.headers ? new Headers(init.headers) : new Headers();
  if (init.body != null && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${config.baseUrl}${path}`, {
    method: init.method,
    headers,
    body: init.body,
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

async function login() {
  const { res, body } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: config.adminUser, password: config.adminPass }),
  });
  if (!res.ok || !body?.token) {
    throw new Error(`login failed: status=${res.status} body=${body ? JSON.stringify(body) : 'no-body'}`);
  }
  return body.token;
}

function isTargetSpaceName(name) {
  if (typeof name !== 'string') return false;
  return MATCHERS.some((re) => re.test(name));
}

async function main() {
  const token = await login();

  const { res, body } = await request('/api/v1/spaces', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !Array.isArray(body)) {
    throw new Error(`list spaces failed: status=${res.status} body=${body ? JSON.stringify(body) : 'no-body'}`);
  }

  const targets = body.filter((s) => s && isTargetSpaceName(s.name));
  if (targets.length === 0) {
    console.log('No Release V1.1 test spaces found. Nothing to delete.');
    return;
  }

  console.log(`Found ${targets.length} test spaces to soft-delete:`);
  for (const s of targets) {
    console.log(`- ${s.id} ${s.name}`);
  }

  let ok = 0;
  let fail = 0;
  for (const s of targets) {
    const del = await request(`/api/v1/spaces/${encodeURIComponent(s.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (del.res.status === 204) {
      ok++;
      continue;
    }
    fail++;
    console.error(`Failed to delete space ${s.id} (${s.name}): status=${del.res.status} body=${del.body ? JSON.stringify(del.body) : 'no-body'}`);
  }

  console.log(`Done. Deleted ${ok}/${targets.length}. Failed ${fail}.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

