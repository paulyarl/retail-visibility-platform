#!/usr/bin/env node
/**
 * deploy-api.cjs — branch-aware Fly deploys for the RVP API.
 *
 * Usage:
 *   node scripts/deploy-api.cjs stg       Deploy working tree → visibleshelf-api-staging
 *   node scripts/deploy-api.cjs prod      Deploy working tree → visibleshelf-api (requires main)
 *   node scripts/deploy-api.cjs promote   stg deploy → verify → merge to main → prod deploy
 *
 * Guarantees:
 *   - `stg` must run on the staging branch (deploys build from the working tree).
 *   - `prod` must run on main, clean, with staging already merged — staging
 *     always ships first.
 *   - `promote` pauses for manual verification between the two deploys.
 *   - Every deploy recompiles apps/api/dist from HEAD first, so a stale local
 *     build can never ship.
 */
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const mode = process.argv[2];
const STG_VERIFY_URL = 'https://aps.visibleshelf.store';
const PRD_VERIFY_URL = 'https://api.visibleshelf.com';

if (!['stg', 'prod', 'promote'].includes(mode)) {
  console.error('Usage: node scripts/deploy-api.cjs <stg|prod|promote>');
  process.exit(1);
}

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();
const branch = () => git('branch --show-current');
const clean = () => git('status --porcelain') === '';

function fail(msg) {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fail(`command failed: ${cmd} ${args.join(' ')}`);
}

// The Dockerfile ships apps/api/dist as-is when it exists, so a leftover
// local build would deploy stale code. Always wipe and recompile from the
// current HEAD before deploying.
const API_DIST = path.join(__dirname, '..', 'apps', 'api', 'dist');
let builtHead = null;

function buildApi() {
  const head = git('rev-parse HEAD');
  if (builtHead === head) return;
  console.log(`\n==> Building API from ${head.slice(0, 9)} (fresh dist)`);
  fs.rmSync(API_DIST, { recursive: true, force: true });
  run('pnpm', ['-C', 'apps/api', 'build']);
  if (!fs.existsSync(path.join(API_DIST, 'index.js'))) fail('build produced no apps/api/dist/index.js');
  builtHead = head;
}

function deployStg() {
  buildApi();
  console.log('\n==> Deploying staging (visibleshelf-api-staging)');
  run('fly', ['deploy', '--config', 'fly.staging.toml']);
  console.log(`    Verify: ${STG_VERIFY_URL}/api/health`);
}

function deployProd() {
  buildApi();
  console.log('\n==> Deploying production (visibleshelf-api)');
  run('fly', ['deploy']);
  console.log(`    Verify: ${PRD_VERIFY_URL}/api/health`);
}

function fetchQuiet() {
  try { git('fetch origin --quiet'); } catch { fail('git fetch failed'); }
}

function assertOnBranch(want) {
  const got = branch();
  if (got !== want) fail(`must be on '${want}' — currently on '${got || 'detached HEAD'}'`);
}

function assertSynced(b) {
  fetchQuiet();
  const local = git(`rev-parse ${b}`);
  let remote;
  try { remote = git(`rev-parse origin/${b}`); } catch { remote = null; }
  if (remote && local !== remote) fail(`'${b}' differs from origin — push/pull first`);
}

function mergedInto(from, into) {
  try { execSync(`git merge-base --is-ancestor ${from} ${into}`); return true; }
  catch { return false; }
}

function ask(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(prompt, () => { rl.close(); res(); }));
}

async function promote() {
  assertOnBranch('staging');
  if (!clean()) fail('working tree must be clean — uncommitted changes would ship to prod');
  assertSynced('staging');

  deployStg();
  console.log('\n──────────────────────────────────────────────');
  console.log(`Staging live. Verify before promoting:`);
  console.log(`  ${STG_VERIFY_URL}/api/health`);
  console.log(`  https://www.visibleshelf.store`);
  console.log('──────────────────────────────────────────────');
  await ask('Press Enter to promote staging → production (Ctrl+C to abort) ');

  console.log('\n==> Merging staging → main');
  run('git', ['checkout', 'main']);
  run('git', ['pull', 'origin', 'main']);
  run('git', ['merge', '--no-edit', 'staging']);
  run('git', ['push', 'origin', 'main']);

  deployProd();

  console.log('\n==> Syncing main back to staging');
  run('git', ['checkout', 'staging']);
  run('git', ['merge', '--no-edit', 'main']);
  run('git', ['push', 'origin', 'staging']);

  console.log('\n✓ Promoted. Back on staging.');
}

if (mode === 'stg') {
  assertOnBranch('staging');
  deployStg();
} else if (mode === 'prod') {
  assertOnBranch('main');
  if (!clean()) fail('working tree must be clean — uncommitted changes would ship to prod');
  fetchQuiet();
  if (!mergedInto('staging', 'main') && !mergedInto('origin/staging', 'main')) {
    fail('staging is not merged into main — deploy staging first (pnpm deployapi:promote)');
  }
  deployProd();
} else {
  promote().catch((e) => fail(e.message));
}
