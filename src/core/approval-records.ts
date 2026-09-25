import { promises as fs } from 'fs';
import { join } from 'path';
import { PathUtils } from './path-utils.js';
import type { ApprovalRequest } from '../dashboard/approval-storage.js';

/**
 * Read-only access to approval records on disk.
 *
 * Records live at `.spec-workflow/approvals/<categoryName>/<id>.json`. This
 * module reads them without starting an `ApprovalStorage` watcher, so callers
 * that only need to know "is this document approved?" (the `spec-status` tool)
 * do not pay for chokidar.
 */

export type DocumentName = 'requirements' | 'design' | 'tasks';

export const DOCUMENT_NAMES: DocumentName[] = ['requirements', 'design', 'tasks'];

export interface DocumentApprovalState {
  /** True when the newest record for the document is `approved`. */
  approved: boolean;
  /** Id of the newest record for the document, whatever its status. */
  approvalId?: string;
  /** Status of the newest record for the document. */
  approvalStatus?: ApprovalRequest['status'];
  /** `respondedAt` of the newest record when it is approved. */
  approvedAt?: string;
}

/**
 * Normalise an approval `filePath` for comparison: forward slashes only, no
 * leading `./` or `/`.
 */
export function normalizeApprovalFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

/**
 * Read every approval record under `.spec-workflow/approvals/`, newest first.
 * Unreadable files and hidden directories (`.snapshots`) are skipped.
 */
export async function readApprovalRecords(projectPath: string): Promise<ApprovalRequest[]> {
  const approvalsDir = PathUtils.getApprovalsPath(projectPath);
  const records: ApprovalRequest[] = [];

  let categories: import('fs').Dirent[];
  try {
    categories = await fs.readdir(approvalsDir, { withFileTypes: true });
  } catch {
    return records;
  }

  for (const category of categories) {
    if (!category.isDirectory() || category.name.startsWith('.')) continue;
    const categoryDir = join(approvalsDir, category.name);
    let files: string[];
    try {
      files = await fs.readdir(categoryDir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.readFile(join(categoryDir, file), 'utf-8');
        const record = JSON.parse(content) as ApprovalRequest;
        if (record && typeof record.id === 'string' && typeof record.filePath === 'string') {
          records.push(record);
        }
      } catch {
        // Skip unreadable or malformed records
      }
    }
  }

  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * The content of the newest prior version of a spec document that was rejected
 * — sent back for revision — or null when there is none (retro P10). Versions
 * are the approval snapshots on disk at
 * `.spec-workflow/approvals/<specName>/.snapshots/<phase>.md/`; a version counts
 * as rejected when its snapshot trigger is `revision_requested` or its recorded
 * status is `rejected`/`needs-revision`. Read-only; starts no watcher. Any
 * missing or malformed file yields null, so a caller degrades to no suppression.
 */
export async function readRejectedPriorContent(
  projectPath: string,
  specName: string,
  phase: DocumentName
): Promise<string | null> {
  const snapshotsDir = join(PathUtils.getApprovalsPath(projectPath), specName, '.snapshots', `${phase}.md`);

  let metadata: { snapshots?: { version?: number; filename?: string; trigger?: string }[] };
  try {
    metadata = JSON.parse(await fs.readFile(join(snapshotsDir, 'metadata.json'), 'utf-8'));
  } catch {
    return null;
  }
  const entries = Array.isArray(metadata.snapshots) ? [...metadata.snapshots] : [];
  // Newest version first, so the most recent rejected pass wins.
  entries.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  for (const entry of entries) {
    if (!entry || typeof entry.filename !== 'string') continue;
    let snapshot: { trigger?: string; status?: string; content?: unknown };
    try {
      snapshot = JSON.parse(await fs.readFile(join(snapshotsDir, entry.filename), 'utf-8'));
    } catch {
      continue;
    }
    const rejected =
      snapshot.trigger === 'revision_requested' ||
      entry.trigger === 'revision_requested' ||
      snapshot.status === 'rejected' ||
      snapshot.status === 'needs-revision';
    if (rejected && typeof snapshot.content === 'string') return snapshot.content;
  }
  return null;
}

/** The newest record whose `filePath` matches `filePath` after normalisation, or null. */
export function findLatestApprovalForFile(records: ApprovalRequest[], filePath: string): ApprovalRequest | null {
  const wanted = normalizeApprovalFilePath(filePath);
  let latest: ApprovalRequest | null = null;
  for (const record of records) {
    if (normalizeApprovalFilePath(record.filePath) !== wanted) continue;
    if (!latest || new Date(record.createdAt).getTime() > new Date(latest.createdAt).getTime()) {
      latest = record;
    }
  }
  return latest;
}

/**
 * Derive the approval state of a spec's three documents from the records on
 * disk. A document is approved when its newest record is `approved`; a newer
 * pending record for the same document means the approved version was
 * superseded.
 */
export async function deriveDocumentApprovalStates(
  projectPath: string,
  specName: string
): Promise<Record<DocumentName, DocumentApprovalState>> {
  const records = await readApprovalRecords(projectPath);
  const states = {} as Record<DocumentName, DocumentApprovalState>;

  for (const doc of DOCUMENT_NAMES) {
    const latest = findLatestApprovalForFile(records, `.spec-workflow/specs/${specName}/${doc}.md`);
    if (!latest) {
      states[doc] = { approved: false };
      continue;
    }
    const approved = latest.status === 'approved';
    states[doc] = {
      approved,
      approvalId: latest.id,
      approvalStatus: latest.status,
      approvedAt: approved ? latest.respondedAt : undefined
    };
  }

  return states;
}
