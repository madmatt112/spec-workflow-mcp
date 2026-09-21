#!/usr/bin/env node
/**
 * Copy the harness assets (agents, skills, hooks, and commands when present) from `harness/` into every
 * Claude Code plugin root under `plugins/`.
 *
 * `harness/` is the single source of truth. Each plugin root gets an exact copy
 * of `harness/agents`, `harness/skills` and `harness/commands`; files that no
 * longer exist in `harness/` are removed from the plugins.
 *
 * Usage:
 *   node scripts/sync-plugin-assets.cjs          # copy
 *   node scripts/sync-plugin-assets.cjs --check  # exit 1 if any plugin drifts (CI)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'harness');
const PLUGINS_DIR = path.join(ROOT, 'plugins');
const ASSET_DIRS = ['agents', 'skills', 'commands', 'hooks'];
const AGENTS_DIR = path.join(SOURCE, 'agents');
const PROFILES_PATH = path.join(SOURCE, 'agent-profiles.json');

function listFiles(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full, base));
    } else if (entry.isFile()) {
      out.push(path.relative(base, full));
    }
  }
  return out.sort();
}

function pluginRoots() {
  if (!fs.existsSync(PLUGINS_DIR)) return [];
  return fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(PLUGINS_DIR, e.name, '.claude-plugin', 'plugin.json')))
    .map(e => path.join(PLUGINS_DIR, e.name));
}

function diffAssetDir(assetDir, pluginRoot) {
  const src = path.join(SOURCE, assetDir);
  const dst = path.join(pluginRoot, assetDir);
  const srcFiles = listFiles(src);
  const dstFiles = listFiles(dst);
  const problems = [];
  for (const rel of srcFiles) {
    const dstPath = path.join(dst, rel);
    if (!fs.existsSync(dstPath)) {
      problems.push(`missing ${path.relative(ROOT, dstPath)}`);
    } else if (!fs.readFileSync(path.join(src, rel)).equals(fs.readFileSync(dstPath))) {
      problems.push(`differs ${path.relative(ROOT, dstPath)}`);
    }
  }
  for (const rel of dstFiles) {
    if (!srcFiles.includes(rel)) {
      problems.push(`stale ${path.relative(ROOT, path.join(dst, rel))}`);
    }
  }
  return problems;
}

function syncAssetDir(assetDir, pluginRoot) {
  const src = path.join(SOURCE, assetDir);
  const dst = path.join(pluginRoot, assetDir);
  fs.rmSync(dst, { recursive: true, force: true });
  if (!fs.existsSync(src)) return 0;
  fs.cpSync(src, dst, { recursive: true });
  return listFiles(src).length;
}

/**
 * Build the agent-profiles.json text from the twelve agent frontmatters.
 * For each harness/agents/*.md in sorted order, read the lines between the first
 * two `---`, split each on its first `:`, take `model` and `effort` as written
 * ("" when missing), derive `role` from the description (the capture of
 * /^SDD ([^:]+):/) else the name without `sdd-`. A file without `name` is skipped
 * with one stderr line. Returns `{ model, effort, role }` per name, keys sorted,
 * serialised with a trailing newline so repeated runs are byte-identical.
 */
function buildProfiles() {
  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md')).sort();
  const profiles = {};
  for (const file of files) {
    const lines = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8').split('\n');
    if (lines[0].trim() !== '---') continue;
    const end = lines.indexOf('---', 1);
    if (end === -1) continue;
    const front = {};
    for (const line of lines.slice(1, end)) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      front[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    if (!front.name) {
      console.error(`skipping ${path.relative(ROOT, path.join(AGENTS_DIR, file))}: no name in frontmatter`);
      continue;
    }
    const model = front.model || '';
    const effort = front.effort || '';
    const match = /^SDD ([^:]+):/.exec(front.description || '');
    const role = match ? match[1] : front.name.replace(/^sdd-/, '');
    profiles[front.name] = { model, effort, role };
  }
  return JSON.stringify(profiles, null, 2) + '\n';
}

function syncProfiles(checkOnly) {
  const rel = path.relative(ROOT, PROFILES_PATH);
  const expected = Buffer.from(buildProfiles());
  if (checkOnly) {
    const current = fs.existsSync(PROFILES_PATH) ? fs.readFileSync(PROFILES_PATH) : null;
    if (!current || !current.equals(expected)) {
      console.log(`✘ ${rel}`);
      return true;
    }
    console.log(`✔ ${rel}`);
    return false;
  }
  fs.writeFileSync(PROFILES_PATH, expected);
  const count = Object.keys(JSON.parse(expected.toString())).length;
  console.log(`✔ ${rel} (${count} agent(s))`);
  return false;
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const roots = pluginRoots();
  if (roots.length === 0) {
    console.error('No plugin roots found under plugins/ (expected <root>/.claude-plugin/plugin.json)');
    process.exit(1);
  }

  let drift = false;
  for (const root of roots) {
    const name = path.relative(ROOT, root);
    for (const assetDir of ASSET_DIRS) {
      if (checkOnly) {
        const problems = diffAssetDir(assetDir, root);
        if (problems.length > 0) {
          drift = true;
          console.log(`✘ ${name}/${assetDir}`);
          for (const p of problems) console.log(`   └─ ${p}`);
        } else {
          console.log(`✔ ${name}/${assetDir}`);
        }
      } else {
        const count = syncAssetDir(assetDir, root);
        console.log(`✔ ${name}/${assetDir} (${count} file(s))`);
      }
    }
  }

  if (syncProfiles(checkOnly)) drift = true;

  if (checkOnly && drift) {
    console.log('\nPlugin assets are out of sync with harness/. Run "npm run sync:plugin-assets".');
    process.exit(1);
  }
}

main();
