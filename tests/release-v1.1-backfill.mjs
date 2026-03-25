#!/usr/bin/env node
/**
 * Backfill results into tests/release-v1.1-test-plan.md
 *
 * It reads:
 *  - tests/.release-v1.1-results-api.json  (A-D)
 *  - tests/.release-v1.1-results-e2e.json (E-L)
 */

import fs from 'fs';

const planPath = 'tests/release-v1.1-test-plan.md';
const apiPath = 'tests/.release-v1.1-results-api.json';
const e2ePath = 'tests/.release-v1.1-results-e2e.json';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function trunc(s, max = 60) {
  if (!s) return s;
  const str = String(s);
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function replaceScenarioResult(md, letter, value) {
  const safe = trunc(value, 80);
  const display = value === 'Pass' ? 'Pass' : `Fail: ${safe}`;
  // Replace whatever is currently in backticks after "- 结果："
  const re = new RegExp(
    `(场景\\s*${letter}[^\\n]*\\n[\\s\\S]*?\\n- 结果：)\\\`[^\\\`]*\\\``,
    'm'
  );
  if (!re.test(md)) {
    throw new Error(`cannot find placeholder for scenario ${letter}`);
  }
  return md.replace(re, `$1\`${display}\``);
}

function main() {
  if (!fs.existsSync(planPath)) throw new Error(`missing plan file: ${planPath}`);

  const md = fs.readFileSync(planPath, 'utf8');

  const apiData = fs.existsSync(apiPath) ? readJson(apiPath) : null;
  const e2eData = fs.existsSync(e2ePath) ? readJson(e2ePath) : null;

  let out = md;

  const apiResults = apiData?.results ?? {};
  const e2eResults = e2eData?.results ?? {};

  const merged = { ...apiResults, ...e2eResults };

  for (const letter of ['A', 'B', 'C', 'D']) {
    if (apiResults[letter]) out = replaceScenarioResult(out, letter, apiResults[letter]);
  }

  for (let i = 'E'.charCodeAt(0); i <= 'L'.charCodeAt(0); i++) {
    const letter = String.fromCharCode(i);
    if (e2eResults[letter]) out = replaceScenarioResult(out, letter, e2eResults[letter]);
  }

  for (const letter of ['M', 'N']) {
    if (e2eResults[letter]) out = replaceScenarioResult(out, letter, e2eResults[letter]);
  }

  // Conclusion auto-fill
  const p0Letters = [
    'A','B','C','D',
    'E','F','G','H','I','J','K','L',
  ];
  const p1Letters = ['M', 'N'];

  const isPass = (v) => typeof v === 'string' && v.trim() === 'Pass';

  const p0Total = p0Letters.length;
  const p0Passed = p0Letters.filter((k) => isPass(merged[k])).length;
  const p0AllPass = p0Passed === p0Total;

  const p1Total = p1Letters.length;
  const p1Passed = p1Letters.filter((k) => isPass(merged[k])).length;

  const allowPublish = p0AllPass ? '是' : '否';

  out = out.replace(
    /- 本次通过率（按 P0 计算）：\s*\`[^`]*\`/,
    `- 本次通过率（按 P0 计算）： \`${p0Passed} / ${p0Total}\``,
  );
  out = out.replace(
    /- 是否允许发布：\s*\`[^`]*\`/,
    `- 是否允许发布： \`${allowPublish}\``,
  );

  // Optional P1 summary line (add if missing, otherwise update)
  if (/- P1 通过率：/.test(out)) {
    out = out.replace(
      /- P1 通过率：\s*\`[^`]*\`/,
      `- P1 通过率： \`${p1Passed} / ${p1Total}\``,
    );
  } else {
    out = out.replace(
      /(- 是否允许发布： \`[^`]*\`\s*\n)/,
      `$1- P1 通过率： \`${p1Passed} / ${p1Total}\`\n`,
    );
  }

  fs.writeFileSync(planPath, out, 'utf8');
  console.log(`Backfilled ${planPath}`);
}

main();

