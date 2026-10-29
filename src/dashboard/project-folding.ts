/**
 * Decides which project-registry candidates fold into another candidate's
 * entry, and into which parent (design.md C2; requirements R1 AC1 to AC3,
 * AC9).
 */

export interface FoldCandidate {
  projectId: string;
  projectPath: string;
  workflowRootPath: string;
}

export interface ClassifyResult {
  linked: boolean;
  mainTree: string | null;
}

/**
 * Computes folded-id -> parent-id for `candidates`.
 *
 * `classify` is called once per candidate whose `projectPath` differs from
 * its `workflowRootPath`, never for an equal-path candidate (which counts as
 * not linked). Parents are drawn only from candidates `classify` reports as
 * not linked (equal-path candidates qualify by that same rule), so a linked
 * candidate never becomes a parent.
 *
 * For a linked candidate: it folds into a not-linked parent whose
 * `projectPath` equals the candidate's `mainTree` and whose
 * `workflowRootPath` equals the candidate's own (R1 AC1); else into a
 * not-linked parent whose `projectPath` and `workflowRootPath` both equal
 * the candidate's `workflowRootPath` (R1 AC2); else it is left out of the
 * map (R1 AC3).
 *
 * A `classify` throw leaves the candidate out of the map and is reported
 * through `onError`, keyed by `projectId`.
 */
export function computeFolds(
  candidates: FoldCandidate[],
  classify: (workspacePath: string) => ClassifyResult,
  onError?: (projectId: string, error: unknown) => void
): Map<string, string> {
  const notLinked: FoldCandidate[] = [];
  const linked: Array<{ candidate: FoldCandidate; mainTree: string | null }> = [];

  for (const candidate of candidates) {
    if (candidate.projectPath === candidate.workflowRootPath) {
      notLinked.push(candidate);
      continue;
    }

    let result: ClassifyResult;
    try {
      result = classify(candidate.projectPath);
    } catch (error) {
      onError?.(candidate.projectId, error);
      continue;
    }

    if (result.linked) {
      linked.push({ candidate, mainTree: result.mainTree });
    } else {
      notLinked.push(candidate);
    }
  }

  const folds = new Map<string, string>();
  for (const { candidate, mainTree } of linked) {
    const mainTreeParent = notLinked.find(
      (parent) =>
        parent.projectPath === mainTree &&
        parent.workflowRootPath === candidate.workflowRootPath
    );
    if (mainTreeParent) {
      folds.set(candidate.projectId, mainTreeParent.projectId);
      continue;
    }

    const storeParent = notLinked.find(
      (parent) =>
        parent.projectPath === candidate.workflowRootPath &&
        parent.workflowRootPath === candidate.workflowRootPath
    );
    if (storeParent) {
      folds.set(candidate.projectId, storeParent.projectId);
    }
  }

  return folds;
}
