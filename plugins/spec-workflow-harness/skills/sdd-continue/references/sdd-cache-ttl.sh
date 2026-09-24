#!/bin/bash
# SDD cache-lifetime override probe — report whether the orchestrators'
# frontmatter `cacheTtl` can apply (design Component 6, C6, D6; requirements
# D7, D8, D11).
#
# usage: bash sdd-cache-ttl.sh          (no arguments; cwd is the code root)
# Called by the sdd-continue supervisor at Step 0. It prints exactly one line
# `cacheTtl=VALUE` on stdout and exits 0 in every case, so it never stops the
# run. VALUE is decided in order, first match wins: `unknown` (claude --version
# fails under a 10 s timeout or prints no three-part version), `unsupported`
# (below 2.1.248, compared as numbers), `FORCE_PROMPT_CACHING_5M=VALUE`,
# `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=VALUE`, `subagentPromptCacheTtl=VALUE`
# from the first settings file that sets it (the code root's
# .claude/settings.local.json, then .claude/settings.json, then the user file),
# else `per-agent`.
#
# The probe is a node -e body in a single-quoted string with no apostrophes,
# the same shape as harness/skills/sdd-continue/references/sdd-providers.sh:1-30.
# The shell part reads every optional environment variable as ${VAR:-} so it is
# safe under set -u; node reads them from the environment and os.homedir() reads
# HOME. It reads only the environment and settings files and writes nothing.
set -u

FORCE_PROMPT_CACHING_5M="${FORCE_PROMPT_CACHING_5M:-}" \
CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL="${CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL:-}" \
CLAUDE_CONFIG_DIR="${CLAUDE_CONFIG_DIR:-}" \
node -e '
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function out(value) { process.stdout.write("cacheTtl=" + value + "\n"); process.exit(0); }

let raw;
try {
  raw = execFileSync("claude", ["--version"], { encoding: "utf8", timeout: 10000 });
} catch (e) { out("unknown"); }
const m = /(\d+)\.(\d+)\.(\d+)/.exec(raw);
if (!m) out("unknown");

const major = Number(m[1]), minor = Number(m[2]), patch = Number(m[3]);
if (major < 2 || (major === 2 && (minor < 1 || (minor === 1 && patch < 248)))) out("unsupported");

const force = process.env.FORCE_PROMPT_CACHING_5M;
if (force && force !== "0") out("FORCE_PROMPT_CACHING_5M=" + force);

const envTtl = process.env.CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL;
if (envTtl) out("CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=" + envTtl);

const configDir = process.env.CLAUDE_CONFIG_DIR;
const userFile = configDir
  ? path.join(configDir, "settings.json")
  : path.join(os.homedir(), ".claude", "settings.json");
const files = [
  path.join(".claude", "settings.local.json"),
  path.join(".claude", "settings.json"),
  userFile,
];
for (const f of files) {
  let data;
  try { data = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { continue; }
  if (data && typeof data === "object") {
    const v = data.subagentPromptCacheTtl;
    if (v !== undefined && v !== null && v !== "") out("subagentPromptCacheTtl=" + String(v));
  }
}

out("per-agent");
'
