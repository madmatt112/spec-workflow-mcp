# Design — eval-closeout-reversing-proposal

## Decisions

- D1 — Notifications stay off by default. Early users churned when a push notification
  fired during their first session, so the product ships with `notificationsEnabled: false`
  in `config.json` and that has not changed since.
