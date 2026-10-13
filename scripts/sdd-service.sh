#!/bin/bash
# Manage the SDD controller as a systemd user service (controller-tasks.md T9,
# controller-design.md §2). The controller is the always-on dashboard process
# `node <checkout>/dist/index.js --dashboard --port <port>`. This script writes
# the user units, and the watchdog units (sdd-watchdog.service/.timer), enables
# and starts them. Nothing here runs a model.
#
# Usage:
#   scripts/sdd-service.sh install     write the units, daemon-reload, enable --now
#   scripts/sdd-service.sh uninstall   disable --now, remove the units, daemon-reload
#   scripts/sdd-service.sh status      systemctl status + the last /api/health
#   scripts/sdd-service.sh print       write every unit to stdout; touch nothing
#
# The checkout is this script's own repo root, override with SDD_CHECKOUT.
# The port defaults to 5000, override with SDD_PORT. The unit finds node through
# the baked PATH (from the installing shell) with `/usr/bin/env node`; on a
# version manager (fnm, nvm) whose node path is per-shell or transient, pass a
# stable absolute path with SDD_NODE_BIN, e.g. SDD_NODE_BIN="$(readlink -f "$(command -v node)")".
#
# gh credentials: `install` copies GH_TOKEN, GITHUB_TOKEN (and GH_HOST, if set)
# from the installing shell into <controller home>/service.env (mode 0600) and
# the unit reads it with EnvironmentFile. Without this the controller's children
# (the supervisor step, gh in the merge stage) run unauthenticated. The token is
# never printed or logged. The alternative is `gh auth login`, which persists in
# ~/.config/gh/hosts.yml and needs no env file.
set -euo pipefail

REPO="${SDD_CHECKOUT:-$(cd "$(dirname "$0")/.." && pwd -P)}"
PORT="${SDD_PORT:-5000}"
NODE_BIN="${SDD_NODE_BIN:-/usr/bin/env node}"
UNIT_DIR="$HOME/.config/systemd/user"
SDD_HOME_DIR="${SDD_HOME:-$HOME/.local/state/sdd}"
ENV_FILE="$SDD_HOME_DIR/service.env"
MODE="${1:-}"

controller_unit() {
  cat <<EOF
[Unit]
Description=SDD controller (spec-workflow-mcp dashboard)
After=default.target
# Restart=always with no rate limit: a boot loop still keeps trying, and the
# watchdog is what notices three restarts in an hour.
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=$REPO
ExecStart=$NODE_BIN $REPO/dist/index.js --dashboard --port $PORT
Restart=always
RestartSec=5
Environment="HOME=$HOME"
Environment="PATH=$PATH"
# The operator's gh credentials (GH_TOKEN/GITHUB_TOKEN/GH_HOST), so gh in the
# merge stage and the supervisor step are authenticated. The leading dash makes
# it optional: a missing file is not a startup error (use gh auth login instead).
EnvironmentFile=-$ENV_FILE
# A controller step never carries a key or token (ADR 0004, controller-tasks.md T1).
UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN

[Install]
WantedBy=default.target
EOF
}

watchdog_service_unit() {
  cat <<EOF
[Unit]
Description=SDD controller watchdog (one health probe)

[Service]
Type=oneshot
ExecStart=$REPO/scripts/sdd-watchdog.sh
Environment="SDD_PORT=$PORT"
Environment="PATH=$PATH"
EOF
}

watchdog_timer_unit() {
  cat <<EOF
[Unit]
Description=Probe the SDD controller health every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
AccuracySec=10s

[Install]
WantedBy=timers.target
EOF
}

# Write <controller home>/service.env with the operator's gh credentials from the
# installing shell. Only keys that are set are written. The token is never echoed.
write_env_file() {
  mkdir -p "$SDD_HOME_DIR"
  ( umask 077; : > "$ENV_FILE" )
  chmod 0600 "$ENV_FILE"
  {
    if [ -n "${GH_TOKEN:-}" ]; then printf 'GH_TOKEN=%s\n' "$GH_TOKEN"; fi
    if [ -n "${GITHUB_TOKEN:-}" ]; then printf 'GITHUB_TOKEN=%s\n' "$GITHUB_TOKEN"; fi
    if [ -n "${GH_HOST:-}" ]; then printf 'GH_HOST=%s\n' "$GH_HOST"; fi
  } >> "$ENV_FILE"
}

linger_hint() {
  local linger
  linger="$(loginctl show-user "$USER" --property=Linger --value 2>/dev/null || echo no)"
  if [ "$linger" != "yes" ]; then
    echo "note: linger is off, so the controller stops at logout." >&2
    echo "      run: loginctl enable-linger $USER" >&2
  fi
}

case "$MODE" in
  print)
    echo "# ==== $UNIT_DIR/sdd-controller.service ===="
    controller_unit
    echo
    echo "# ==== $UNIT_DIR/sdd-watchdog.service ===="
    watchdog_service_unit
    echo
    echo "# ==== $UNIT_DIR/sdd-watchdog.timer ===="
    watchdog_timer_unit
    ;;

  install)
    [ -f "$REPO/dist/index.js" ] || { echo "no build at $REPO/dist/index.js — run npm run build first" >&2; exit 1; }
    mkdir -p "$UNIT_DIR"
    controller_unit      > "$UNIT_DIR/sdd-controller.service"
    watchdog_service_unit > "$UNIT_DIR/sdd-watchdog.service"
    watchdog_timer_unit   > "$UNIT_DIR/sdd-watchdog.timer"
    echo "wrote the controller and watchdog units to $UNIT_DIR"
    write_env_file
    if [ -s "$ENV_FILE" ]; then
      echo "wrote $ENV_FILE with the operator's gh credentials (mode 0600)"
    else
      echo "note: no GH_TOKEN/GITHUB_TOKEN in this shell; $ENV_FILE is empty." >&2
      echo "      gh in the service will be unauthenticated. Either re-run install" >&2
      echo "      with GH_TOKEN set, or run 'gh auth login' (persists in ~/.config/gh)." >&2
    fi
    systemctl --user daemon-reload
    systemctl --user enable --now sdd-controller.service
    systemctl --user enable --now sdd-watchdog.timer
    echo "enabled and started sdd-controller.service and sdd-watchdog.timer"
    echo "confirm gh can authenticate under the service with: $(basename "$0") status"
    linger_hint
    ;;

  uninstall)
    systemctl --user disable --now sdd-watchdog.timer 2>/dev/null || true
    systemctl --user disable --now sdd-controller.service 2>/dev/null || true
    rm -f "$UNIT_DIR/sdd-controller.service" "$UNIT_DIR/sdd-watchdog.service" "$UNIT_DIR/sdd-watchdog.timer"
    systemctl --user daemon-reload
    echo "removed the controller and watchdog units from $UNIT_DIR"
    ;;

  status)
    systemctl --user status sdd-controller.service --no-pager 2>&1 || true
    echo
    if [ -f "$ENV_FILE" ]; then
      echo "gh credentials: $ENV_FILE present (mode $(stat -c '%a' "$ENV_FILE" 2>/dev/null || echo '?'))"
    else
      echo "gh credentials: $ENV_FILE absent — gh may be unauthenticated in the service."
      echo "                Re-run 'install' with GH_TOKEN set, or use 'gh auth login'."
    fi
    echo
    echo "gh auth under the service environment:"
    if command -v systemd-run >/dev/null 2>&1; then
      systemd-run --user --wait --pipe -p "EnvironmentFile=-$ENV_FILE" gh auth status 2>&1 \
        || echo "  gh auth status failed; run 'gh auth status' to check the credentials"
    else
      echo "  run 'gh auth status' to confirm the service can reach GitHub"
    fi
    echo
    echo "last health (http://127.0.0.1:$PORT/api/health):"
    curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null || echo "  unreachable"
    echo
    ;;

  *)
    echo "usage: $(basename "$0") install|uninstall|status|print" >&2
    exit 2
    ;;
esac
