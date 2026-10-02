#!/usr/bin/env node
/**
 * Keep this repo's `.spec-workflow/templates/*.md` in sync with `src/markdown/templates`
 * at build time (retro P10).
 *
 * The server overwrites the store's `templates/*.md` from the built templates on every
 * startup (`WorkspaceInitializer.copyTemplate`). After a template edit under
 * `src/markdown/templates`, the next restart therefore leaves the checked-in store copies
 * dirty. Regenerating them as part of the build keeps the tree clean: a build after a
 * template edit updates the store copies so they already match what the server will write.
 *
 * Runs only where a `.spec-workflow/templates` directory exists (this repo); in a consumer
 * build that has no store it is a no-op. `--check` exits 1 on drift instead of writing,
 * for use in CI.
 *
 * Usage:
 *   node scripts/sync-store-templates.cjs          # copy
 *   node scripts/sync-store-templates.cjs --check  # exit 1 if any store copy drifts
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'markdown', 'templates');
const STORE = path.join(ROOT, '.spec-workflow', 'templates');
const check = process.argv.includes('--check');

if (!fs.existsSync(STORE) || !fs.existsSync(SRC)) {
  // No store templates here (a consumer build): nothing to sync.
  process.exit(0);
}

const drift = [];
for (const name of fs.readdirSync(STORE).sort()) {
  if (!name.endsWith('.md')) continue;
  const srcPath = path.join(SRC, name);
  if (!fs.existsSync(srcPath)) continue; // a store-only file (e.g. a custom template)
  const srcText = fs.readFileSync(srcPath, 'utf8');
  const storeText = fs.readFileSync(path.join(STORE, name), 'utf8');
  if (srcText !== storeText) {
    drift.push(name);
    if (!check) fs.writeFileSync(path.join(STORE, name), srcText);
  }
}

if (check && drift.length) {
  console.error(`store templates drift from src/markdown/templates: ${drift.join(', ')}`);
  process.exit(1);
}
console.log(`store templates: ${drift.length} ${check ? 'drifted' : 'synced'}`);
