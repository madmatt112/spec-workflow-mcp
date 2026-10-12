#!/bin/bash
# One health probe of the SDD controller, run every minute by sdd-watchdog.timer
# (controller-tasks.md T9, controller-design.md §2/§8). It curls /api/health,
# keeps a small state file in the controller home, and sends ONE notification
# after ten consecutive failures or three restarts within an hour — and not
# again until the condition clears. The controller restarts itself (Restart=
# always); the watchdog only notices and tells the operator. Never a model.
#
# Usage:
#   scripts/sdd-watchdog.sh            one probe (for the timer)
#   scripts/sdd-watchdog.sh --dry-run  one probe that logs instead of calling
#                                      notify-send, and prints each step
#
# Environment:
#   SDD_PORT                        controller port (default 5000)
#   SDD_HOME / XDG_STATE_HOME       the controller home (watchdog.json lives there)
#   SDD_WATCHDOG_FAIL_THRESHOLD     consecutive failures before alert (default 10)
#   SDD_WATCHDOG_RESTART_THRESHOLD  restarts/hour before alert (default 3)
set -euo pipefail

PORT="${SDD_PORT:-5000}"
FAIL_THRESHOLD="${SDD_WATCHDOG_FAIL_THRESHOLD:-10}"
RESTART_THRESHOLD="${SDD_WATCHDOG_RESTART_THRESHOLD:-3}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

# Controller home: $SDD_HOME, else <state home>/sdd (mirrors state.ts / state-files.ts).
if [ -n "${SDD_HOME:-}" ]; then
  HOME_DIR="$SDD_HOME"
else
  HOME_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/sdd"
fi
STATE_FILE="$HOME_DIR/watchdog.json"
ALERT_LOG="$HOME_DIR/watchdog-alerts.log"

step() { [ "$DRY_RUN" = 1 ] && echo "[dry-run] $*" || true; }

# One health probe. Healthy = HTTP 200 whose body carries "ok".
step "curl http://127.0.0.1:$PORT/api/health"
if body="$(curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null)" && echo "$body" | grep -q '"ok"'; then
  HEALTHY=1
else
  HEALTHY=0
fi

# Cumulative restart count of the unit (0 when the unit is absent, as in a test).
NRESTARTS="$(systemctl --user show -p NRestarts --value sdd-controller.service 2>/dev/null || echo 0)"
[ -n "$NRESTARTS" ] || NRESTARTS=0

# Update the state file and decide. All the counting and the one-shot latch live
# in node so the arithmetic and the atomic write are in one place; bash only
# delivers the notification the decision asks for.
RESULT="$(STATE="$STATE_FILE" HEALTHY="$HEALTHY" NRESTARTS="$NRESTARTS" \
  FAIL="$FAIL_THRESHOLD" RESTART="$RESTART_THRESHOLD" node -e '
  const fs = require("fs");
  const path = require("path");
  const p = process.env.STATE;
  let s = { v: 1, consecutiveFailures: 0, notified: false, lastNRestarts: 0, restartTimes: [] };
  try { s = Object.assign(s, JSON.parse(fs.readFileSync(p, "utf8"))); } catch {}
  const healthy = process.env.HEALTHY === "1";
  const nr = parseInt(process.env.NRESTARTS || "0", 10) || 0;
  const failT = parseInt(process.env.FAIL || "10", 10);
  const restartT = parseInt(process.env.RESTART || "3", 10);
  const now = Date.now();
  if (nr > s.lastNRestarts) { for (let i = 0; i < nr - s.lastNRestarts; i++) s.restartTimes.push(now); }
  s.lastNRestarts = nr;
  s.restartTimes = (s.restartTimes || []).filter((t) => now - t < 3600 * 1000);
  s.consecutiveFailures = healthy ? 0 : (s.consecutiveFailures || 0) + 1;
  const shouldAlert = s.consecutiveFailures >= failT || s.restartTimes.length >= restartT;
  let decision = "QUIET";
  if (shouldAlert) { if (!s.notified) { decision = "NOTIFY"; s.notified = true; } }
  else { s.notified = false; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
  process.stdout.write(`${decision}|${s.consecutiveFailures}|${s.restartTimes.length}`);
')"

IFS='|' read -r DECISION CF RESTARTS <<EOF
$RESULT
EOF

step "health=$([ "$HEALTHY" = 1 ] && echo ok || echo down) failures=$CF restarts_in_hour=$RESTARTS decision=$DECISION"

if [ "$DECISION" = "NOTIFY" ]; then
  if [ "$CF" -ge "$FAIL_THRESHOLD" ]; then
    MSG="controller health down for $CF consecutive probes (port $PORT)"
  else
    MSG="controller restarted $RESTARTS times in the last hour"
  fi
  if [ "$DRY_RUN" = 0 ] && command -v notify-send >/dev/null 2>&1; then
    notify-send "SDD controller" "$MSG" || echo "$(date -u +%FT%TZ) $MSG" >> "$ALERT_LOG"
  else
    mkdir -p "$HOME_DIR"
    echo "$(date -u +%FT%TZ) $MSG" >> "$ALERT_LOG"
  fi
  step "alerted: $MSG"
fi
