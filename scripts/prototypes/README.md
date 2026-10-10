# Controller prototypes

Throwaway checks for `docs/controller-design.md` section 14. Each runs one or two tiny
`claude -p` calls on the subscription and writes `results/<n>-<name>.txt`. Run them from a
plain terminal, not from inside a Claude Code session (a nested `claude -p` is refused there):

```
bash scripts/prototypes/run-all.sh
```

Then paste the `results/` files to the session, or run one at a time. Untested as written;
each script says what PASS means.
