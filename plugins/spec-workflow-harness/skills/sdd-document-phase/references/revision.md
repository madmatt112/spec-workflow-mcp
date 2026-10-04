# Document-phase revision and legacy rules

The core skill routes here from a Step 0 `nextStep` of **Step R** (`MODE: revision`).
Every brief comes from a `harness` `brief` server kind, and all bookkeeping goes through
`book.sh` as the core skill's **Bookkeeping** rule describes. The legacy rules below stay
in force for every phase and mode.

## Step R — Revision input

`MODE: revision` means a human left `needs-revision` comments, or the supervisor
re-opened this phase after a design defect.

1. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying `path: reviews/reviser-brief-<PHASE>-v<D+1>.md`, `variant: revision`, `phase:
   <PHASE>`, `D: <D>`, `docPath: <document path>`, `specDir: <spec dir>`, `findings:
   <REVISION_INPUT, numbered RI-1, RI-2, …>`, `memoryPath: <memory file path>`,
   `closedByRuling: <none | list>`, and the graph values when `GRAPH` is a path. Every item
   is a MUST_FIX; the reviser may still reject one with a reason.
2. Spawn `sdd-reviser`. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the
   new Revision History line. Record the reviser's `spawn.usage` and the checkpoint commit
   in one `book.sh` call: `event spawn.usage agent=sdd-reviser role="revise v<D+1>"
   phase=<PHASE> result=<…> -- commit "docs(sdd): <SPEC> <PHASE> v<D+1> revision"`.
3. D = D + 1. Run the Lint step. Go to Step 2. At least one review round runs before approval, even if
   the document had converged before. The cap rule applies as written: a revised
   document already at v4 or later that iterates goes to Step 4a.

## Legacy rules that stay in force

- Never wait on dashboard state; never poll; never treat `BLOCKED` as a stop.
- Load steering documents by phase (the briefs do this): requirements ⇒ `product.md`
  and the decomposition entry; design ⇒ `tech.md`, `structure.md`, `design-system.md`
  when present; tasks ⇒ `structure.md` and this spec's `design.md`.
- Surface any cut scope in the phase report.
- One version of the document in context at a time. Workers read the whole document;
  you do not.
