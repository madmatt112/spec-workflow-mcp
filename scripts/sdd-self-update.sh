#!/bin/bash
# The staged self-update of the SDD controller (controller-tasks.md T9,
# controller-design.md §2/§11, foundation-review-adversarial.md "self-rebuild
# bricks the controller"). The harness repo's post-merge command runs this. It
# never lets the controller replace itself with an untested build: it builds the
# new commit in a staging worktree, boots it once with --smoke on a scratch port,
# and only then swaps dist/ in and restarts. On any failure it leaves the running
# dist/ untouched and writes an `error` wait naming the commit and the step.
#
# Usage:
#   scripts/sdd-self-update.sh             pull, stage, smoke, swap, restart
#   scripts/sdd-self-update.sh --no-restart  do everything but the restart
#   scripts/sdd-self-update.sh --dry-run   print every step; change nothing
#
# Environment:
#   SDD_CHECKOUT              the live checkout (default: this script's repo root)
#   SDD_HOME / XDG_STATE_HOME the controller home (runs, waits, the pointer)
#   SDD_SMOKE_PORT            scratch port for the smoke boot (default 5999)
set -euo pipefail

REPO="${SDD_CHECKOUT:-$(cd "$(dirname "$0")/.." && pwd -P)}"
STAGING="$REPO/.claude/worktrees/self-update"
SMOKE_PORT="${SDD_SMOKE_PORT:-5999}"
DRY_RUN=0
NO_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-restart) NO_RESTART=1 ;;
    *) echo "usage: $(basename "$0") [--dry-run] [--no-restart]" >&2; exit 2 ;;
  esac
done

if [ -n "${SDD_HOME:-}" ]; then
  HOME_DIR="$SDD_HOME"
else
  HOME_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/sdd"
fi

log()  { echo "[sdd-self-update] $*"; }
would(){ echo "[dry-run] would: $*"; }

TARGET_COMMIT="$(git -C "$REPO" rev-parse origin/main 2>/dev/null || echo origin/main)"

write_error_wait() { # <step>
  local step="$1"
  if [ "$DRY_RUN" = 1 ]; then would "write an error wait (commit $TARGET_COMMIT, step $step)"; return; fi
  log "writing an error wait: self-update failed at $step"
  REPO_WAITS="$REPO/dist/controller/waits.js" \
  SDD_HOME="$HOME_DIR" \
  SPEC_DIR="$HOME_DIR" \
  WAIT_TEXT="staged self-update of $TARGET_COMMIT failed at $step; dist/ left unchanged" \
    node -e 'import(process.env.REPO_WAITS).then((m) => m.createWait({
      kind: "error", runId: "self-update", projectId: "spec-workflow-mcp",
      spec: "self-update", specDir: process.env.SPEC_DIR,
      questions: [{ id: "ack", text: process.env.WAIT_TEXT, options: ["Acknowledge"] }],
    })).then(() => { console.error("error wait written"); process.exit(0); })
       .catch((e) => { console.error("could not write error wait:", e.message); process.exit(1); })' \
    || log "warning: could not write the error wait"
}

# ---------------------------------------------------------------------------
# (a) Refuse while a step is in flight: a live controller step, or (until the
#     bootstrap retires the pointer) any line in the legacy active-run file.
# ---------------------------------------------------------------------------
log "checking for in-flight runs"
if [ -f "$HOME_DIR/active-run" ] && grep -q '[^[:space:]]' "$HOME_DIR/active-run" 2>/dev/null; then
  if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] in-flight: the legacy active-run pointer has a line (would refuse)";
  else log "refusing: the legacy active-run pointer has a live run"; exit 1; fi
fi
if [ -f "$REPO/dist/controller/state.js" ]; then
  if ! REPO_STATE="$REPO/dist/controller/state.js" SDD_HOME="$HOME_DIR" node -e '
      import(process.env.REPO_STATE).then(async (m) => {
        const runs = await m.listRuns();
        const live = runs.filter((r) => r.inFlight && m.isProcessAlive(r.inFlight.pid, r.inFlight.startTime));
        process.exit(live.length ? 3 : 0);
      }).catch(() => process.exit(0));'; then
    if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] in-flight: a controller step is alive (would refuse)";
    else log "refusing: a controller step is in flight"; exit 1; fi
  fi
else
  if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] no dist/controller/state.js; checked only the active-run pointer";
  else log "note: no built state module; checked only the active-run pointer"; fi
fi

# ---------------------------------------------------------------------------
# (b) Fetch, then move the live checkout to origin/main.
#     Usually a fast-forward. But while a controller run works a spec whose
#     store lives in this repo, it commits store documents (docs(sdd): ...)
#     onto the live checkout's local main and pushes only at run end. Once
#     origin/main gains a merged PR, local main is both ahead (the store
#     commits) and behind (the merge), so a plain --ff-only fails. In that one
#     case, if every file the local-only commits changed is under
#     .spec-workflow/ or is HANDOFF.md, rebase them onto origin/main; refuse if
#     any local-only commit touches another path, or if the rebase conflicts.
#     No force-push and no push: the controller pushes the store at run end.
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = 1 ]; then
  would "git -C $REPO fetch origin"
  would "fast-forward to origin/main (or rebase store-only local commits if main has diverged)"
else
  log "fetching origin"
  git -C "$REPO" fetch origin
  TARGET_COMMIT="$(git -C "$REPO" rev-parse origin/main)"
  ahead="$(git -C "$REPO" rev-list --count origin/main..HEAD)"
  behind="$(git -C "$REPO" rev-list --count HEAD..origin/main)"
  if [ "$ahead" -ne 0 ] && [ "$behind" -ne 0 ]; then
    log "local main has diverged ($ahead ahead, $behind behind); inspecting the local-only commits"
    changed="$(git -C "$REPO" diff --name-only origin/main...HEAD)"
    outside=""
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      case "$f" in
        .spec-workflow/*|HANDOFF.md) ;;
        *) outside="${outside:+$outside }$f" ;;
      esac
    done <<EOF
$changed
EOF
    if [ -n "$outside" ]; then
      log "refusing: local-only commits touch paths outside the spec store: $outside"
      exit 1
    fi
    # A live controller run leaves ledger and other store files modified but
    # uncommitted. Those are fine (autostash); a dirty path elsewhere is not.
    dirty="$(git -C "$REPO" status --porcelain --untracked-files=no | cut -c4-)"
    dirty_outside=""
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      case "$f" in
        .spec-workflow/*|HANDOFF.md) ;;
        *) dirty_outside="${dirty_outside:+$dirty_outside }$f" ;;
      esac
    done <<EOF
$dirty
EOF
    if [ -n "$dirty_outside" ]; then
      log "refusing: uncommitted changes outside the spec store: $dirty_outside"
      exit 1
    fi
    log "rebasing $ahead store-only local commit(s) onto $TARGET_COMMIT"
    stash_before="$(git -C "$REPO" rev-parse -q --verify refs/stash || true)"
    if ! git -C "$REPO" rebase --autostash origin/main; then
      git -C "$REPO" rebase --abort 2>/dev/null || true
      stash_after="$(git -C "$REPO" rev-parse -q --verify refs/stash || true)"
      if [ "$stash_after" != "$stash_before" ]; then
        log "note: autostash entry left in place as $stash_after (stash@{0}); not dropped"
      fi
      log "refusing: rebasing the local store commits onto origin/main failed; left local main unmoved"
      exit 1
    fi
  else
    log "fast-forwarding to $TARGET_COMMIT"
    git -C "$REPO" pull --ff-only origin main
  fi
fi

# ---------------------------------------------------------------------------
# (c) Build the new commit in a staging worktree (never in the live checkout).
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = 1 ]; then
  would "git -C $REPO worktree add $STAGING origin/main (or reuse it)"
  would "npm ci in $STAGING"
  would "npm run build in $STAGING"
else
  if [ -d "$STAGING" ]; then
    log "reusing the staging worktree"
    git -C "$STAGING" fetch origin
    git -C "$STAGING" reset --hard origin/main
  else
    log "adding the staging worktree"
    git -C "$REPO" worktree add "$STAGING" origin/main
  fi
  log "building in staging"
  if ! ( cd "$STAGING" && npm ci --no-audit --no-fund && npm run build ); then
    write_error_wait "build"
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# (d) Smoke-boot the staged build on a scratch port with an isolated home copy.
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = 1 ]; then
  would "node $STAGING/dist/index.js --dashboard --smoke --port $SMOKE_PORT (isolated SDD_HOME copy)"
else
  SMOKE_HOME="$(mktemp -d)"
  cp -a "$HOME_DIR/." "$SMOKE_HOME/" 2>/dev/null || true
  log "smoke-booting the staged build on port $SMOKE_PORT"
  if ! SDD_HOME="$SMOKE_HOME" node "$STAGING/dist/index.js" --dashboard --smoke --port "$SMOKE_PORT"; then
    rm -rf "$SMOKE_HOME"
    write_error_wait "smoke boot"
    exit 1
  fi
  rm -rf "$SMOKE_HOME"
  log "smoke boot passed"
fi

# ---------------------------------------------------------------------------
# (e) Swap dist/ in and restart.
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = 1 ]; then
  would "npm ci in $REPO"
  would "rsync -a --delete $STAGING/dist/ $REPO/dist/"
  if [ "$NO_RESTART" = 1 ]; then would "skip restart (--no-restart)"; else would "systemctl --user restart sdd-controller.service"; fi
  log "dry run complete; nothing changed"
  exit 0
fi

log "refreshing production dependencies in the live checkout"
( cd "$REPO" && npm ci --no-audit --no-fund )
log "swapping dist/ in"
rsync -a --delete "$STAGING/dist/" "$REPO/dist/"
if [ "$NO_RESTART" = 1 ]; then
  log "skipping restart (--no-restart); the new dist/ is live on the next start"
else
  log "restarting the controller"
  systemctl --user restart sdd-controller.service
fi
log "self-update complete at $TARGET_COMMIT"
