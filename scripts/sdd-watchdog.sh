#!/bin/bash
# One probe of the SDD controller, run every minute by sdd-watchdog.timer
# (controller-tasks.md T9, controller-design.md §2/§8). It probes the health
# endpoint AND the systemd unit, keeps a small state file in the controller
# home, and raises ONE alert when a condition holds — and not again until it
# clears. The controller restarts itself (Restart=always); the watchdog only
# notices and tells the operator. Never a model.
#
# Why both probes (2026-10-14): a hand-started dashboard held port 5000 and kept
# the health endpoint green for ten hours while the real unit crash-looped. A
# port-only watchdog cannot see that. And the watchdog of that day needed `node`
# for its arithmetic, so it died of the same broken PATH as the controller and
# evaluated nothing. This version is plain bash: curl and systemctl only.
#
# Conditions (any one raises the alert):
#   - the health endpoint failed FAIL_THRESHOLD consecutive probes;
#   - the unit auto-restarted RESTART_THRESHOLD times within the last hour;
#   - the unit is loaded but not active (failed, activating/auto-restart,
#     inactive) for UNIT_THRESHOLD consecutive probes, whatever the port says.
#
# An alert is appended to <home>/watchdog-alerts.log (always), sent with
# notify-send (best effort), and written as an `error` wait so the dashboard's
# Now page shows it (best effort: needs SDD_CHECKOUT with a built dist/ and a
# node binary, SDD_NODE_BIN or `node` on PATH). The wait survives a controller
# restart, so the operator sees it even when the alert fired while they were
# away.
#
# Usage:
#   scripts/sdd-watchdog.sh            one probe (for the timer)
#   scripts/sdd-watchdog.sh --dry-run  one probe that only appends to the alert
#                                      log, and prints each step
#
# Environment:
#   SDD_PORT                        controller port (default 5000)
#   SDD_HOME / XDG_STATE_HOME       the controller home (watchdog.state lives there)
#   SDD_CHECKOUT                    the checkout whose dist/ writes the error wait
#   SDD_NODE_BIN                    node binary for the error wait (else `node`)
#   SDD_WATCHDOG_UNIT               the unit to watch (default sdd-controller.service)
#   SDD_WATCHDOG_SYSTEMCTL          the systemctl command (tests pass a stub)
#   SDD_WATCHDOG_FAIL_THRESHOLD     consecutive health failures before alert (10)
#   SDD_WATCHDOG_RESTART_THRESHOLD  restarts/hour before alert (3)
#   SDD_WATCHDOG_UNIT_THRESHOLD     consecutive not-active probes before alert (3)
set -euo pipefail

PORT="${SDD_PORT:-5000}"
UNIT="${SDD_WATCHDOG_UNIT:-sdd-controller.service}"
SYSTEMCTL="${SDD_WATCHDOG_SYSTEMCTL:-systemctl}"
FAIL_THRESHOLD="${SDD_WATCHDOG_FAIL_THRESHOLD:-10}"
RESTART_THRESHOLD="${SDD_WATCHDOG_RESTART_THRESHOLD:-3}"
UNIT_THRESHOLD="${SDD_WATCHDOG_UNIT_THRESHOLD:-3}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Controller home: $SDD_HOME, else <state home>/sdd (mirrors state.ts / state-files.ts).
if [ -n "${SDD_HOME:-}" ]; then
  HOME_DIR="$SDD_HOME"
else
  HOME_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/sdd"
fi
STATE_FILE="$HOME_DIR/watchdog.state"
ALERT_LOG="$HOME_DIR/watchdog-alerts.log"
mkdir -p "$HOME_DIR"

step() { [ "$DRY_RUN" = 1 ] && echo "[dry-run] $*" || true; }

# --- probe 1: the health endpoint. Healthy = HTTP 200 whose body carries "ok".
step "curl http://127.0.0.1:$PORT/api/health"
HEALTH_PID=""
if body="$(curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null)" && echo "$body" | grep -q '"ok"'; then
  HEALTHY=1
  HEALTH_PID="$(printf '%s' "$body" | sed -n 's/.*"pid":[[:space:]]*\([0-9]*\).*/\1/p' | head -n1)"
else
  HEALTHY=0
fi

# --- probe 2: the unit. A unit systemctl cannot show (no systemctl, or a unit
# that is not loaded, as in a test) reads as absent: LoadState not-found, no
# restarts, and the unit rule stays silent.
LOAD_STATE="not-found"; ACTIVE_STATE="inactive"; SUB_STATE="dead"; NRESTARTS=0; MAIN_PID=0
step "$SYSTEMCTL --user show $UNIT"
if props="$("$SYSTEMCTL" --user show "$UNIT" -p LoadState -p ActiveState -p SubState -p NRestarts -p MainPID 2>/dev/null)"; then
  while IFS='=' read -r key value; do
    case "$key" in
      LoadState) LOAD_STATE="$value" ;;
      ActiveState) ACTIVE_STATE="$value" ;;
      SubState) SUB_STATE="$value" ;;
      NRestarts) NRESTARTS="${value:-0}" ;;
      MainPID) MAIN_PID="${value:-0}" ;;
    esac
  done <<EOF
$props
EOF
fi
case "$NRESTARTS" in ''|*[!0-9]*) NRESTARTS=0 ;; esac
case "$MAIN_PID" in ''|*[!0-9]*) MAIN_PID=0 ;; esac
UNIT_LOADED=0
[ "$LOAD_STATE" = "loaded" ] && UNIT_LOADED=1
UNIT_ACTIVE=0
[ "$ACTIVE_STATE" = "active" ] && UNIT_ACTIVE=1

# --- state: key=value lines, read without sourcing.
failures=0; notified=0; last_nrestarts=0; restart_times=""; unit_bad=0
if [ -f "$STATE_FILE" ]; then
  while IFS='=' read -r key value; do
    case "$key" in
      failures) failures="$value" ;;
      notified) notified="$value" ;;
      last_nrestarts) last_nrestarts="$value" ;;
      restart_times) restart_times="$value" ;;
      unit_bad) unit_bad="$value" ;;
    esac
  done < "$STATE_FILE"
fi
for v in failures notified last_nrestarts unit_bad; do
  case "${!v}" in ''|*[!0-9]*) printf -v "$v" '%s' 0 ;; esac
done

NOW="$(date +%s)"

# Restarts: NRestarts counts automatic restarts since the unit was loaded. A
# counter below the last seen value was reset (reboot, reset-failed); count it
# from zero. Each probe appends one "<epoch>:<count>" pair and prunes the hour.
if [ "$NRESTARTS" -ge "$last_nrestarts" ]; then delta=$((NRESTARTS - last_nrestarts)); else delta="$NRESTARTS"; fi
pruned=""
restarts_in_hour=0
for pair in $restart_times; do
  t="${pair%%:*}"; c="${pair##*:}"
  case "$t" in ''|*[!0-9]*) continue ;; esac
  case "$c" in ''|*[!0-9]*) continue ;; esac
  if [ $((NOW - t)) -lt 3600 ]; then
    pruned="${pruned:+$pruned }$pair"
    restarts_in_hour=$((restarts_in_hour + c))
  fi
done
if [ "$delta" -gt 0 ]; then
  pruned="${pruned:+$pruned }$NOW:$delta"
  restarts_in_hour=$((restarts_in_hour + delta))
fi
restart_times="$pruned"
last_nrestarts="$NRESTARTS"

# Consecutive counters.
if [ "$HEALTHY" = 1 ]; then failures=0; else failures=$((failures + 1)); fi
if [ "$UNIT_LOADED" = 1 ] && [ "$UNIT_ACTIVE" = 0 ]; then unit_bad=$((unit_bad + 1)); else unit_bad=0; fi

# Decide: the most specific condition names the message.
MSG=""
if [ "$unit_bad" -ge "$UNIT_THRESHOLD" ]; then
  port_state="down"
  if [ "$HEALTHY" = 1 ]; then
    port_state="green"
    if [ -n "$HEALTH_PID" ] && [ "$HEALTH_PID" != "$MAIN_PID" ]; then
      port_state="green, served by pid $HEALTH_PID (not the unit)"
    fi
  fi
  MSG="controller unit $UNIT is $ACTIVE_STATE/$SUB_STATE for $unit_bad probes (NRestarts $NRESTARTS); port $PORT is $port_state"
elif [ "$failures" -ge "$FAIL_THRESHOLD" ]; then
  MSG="controller health down for $failures consecutive probes (port $PORT)"
elif [ "$restarts_in_hour" -ge "$RESTART_THRESHOLD" ]; then
  MSG="controller restarted $restarts_in_hour times in the last hour"
fi

DECISION="QUIET"
if [ -n "$MSG" ]; then
  if [ "$notified" = 0 ]; then DECISION="NOTIFY"; notified=1; fi
else
  notified=0
fi

# Persist (atomic: temp file then rename).
tmp="$STATE_FILE.$$.tmp"
{
  echo "failures=$failures"
  echo "notified=$notified"
  echo "last_nrestarts=$last_nrestarts"
  echo "restart_times=$restart_times"
  echo "unit_bad=$unit_bad"
} > "$tmp"
mv -f "$tmp" "$STATE_FILE"

step "health=$([ "$HEALTHY" = 1 ] && echo ok || echo down) unit=$LOAD_STATE/$ACTIVE_STATE/$SUB_STATE failures=$failures restarts_in_hour=$restarts_in_hour unit_bad=$unit_bad decision=$DECISION"

# Write the alert as an `error` wait so the dashboard's Now page shows it.
# Best effort: needs a built checkout and a node binary; a miss is logged only.
write_error_wait() { # <message>
  local checkout="${SDD_CHECKOUT:-}"
  local waits="$checkout/dist/controller/waits.js"
  local node_bin="${SDD_NODE_BIN:-}"
  [ -n "$node_bin" ] || node_bin="$(command -v node 2>/dev/null || true)"
  if [ -z "$checkout" ] || [ ! -f "$waits" ] || [ -z "$node_bin" ]; then
    echo "$(date -u +%FT%TZ) (no error wait written: checkout or node unavailable)" >> "$ALERT_LOG"
    return 0
  fi
  REPO_WAITS="$waits" SDD_HOME="$HOME_DIR" WAIT_TEXT="$1" \
    "$node_bin" -e 'import(process.env.REPO_WAITS).then((m) => m.createWait({
      kind: "error", runId: "watchdog", projectId: "sdd-controller",
      spec: "watchdog", specDir: process.env.SDD_HOME,
      questions: [{ id: "ack", text: process.env.WAIT_TEXT, options: ["Acknowledge"] }],
    })).then(() => process.exit(0)).catch((e) => { console.error("watchdog: could not write the error wait:", e.message); process.exit(1); })' \
    || echo "$(date -u +%FT%TZ) (error wait failed)" >> "$ALERT_LOG"
}

if [ "$DECISION" = "NOTIFY" ]; then
  echo "$(date -u +%FT%TZ) $MSG" >> "$ALERT_LOG"
  if [ "$DRY_RUN" = 0 ]; then
    if command -v notify-send >/dev/null 2>&1; then
      notify-send "SDD controller" "$MSG" 2>/dev/null || true
    fi
    write_error_wait "$MSG"
  fi
  step "alerted: $MSG"
fi
