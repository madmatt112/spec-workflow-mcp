#!/usr/bin/env node
/**
 * Copy the harness assets (agents, skills, and commands when present) from `harness/` into every
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
const ASSET_DIRS = ['agents', 'skills', 'commands'];

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

  if (checkOnly && drift) {
    console.log('\nPlugin assets are out of sync with harness/. Run "npm run sync:plugin-assets".');
    process.exit(1);
  }
}

main();
