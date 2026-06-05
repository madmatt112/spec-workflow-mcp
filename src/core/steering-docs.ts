/**
 * Registry of first-class steering document types.
 *
 * Steering docs are project-level guidance documents that live in
 * `.spec-workflow/steering/`. This registry is the single source of truth for
 * the set of recognized steering doc types: parsers, the templates copied on
 * server start, the dashboard API allow-lists, and the adversarial-review
 * context collector all derive their list from here.
 *
 * To add a new steering doc type, add one entry below and create the matching
 * `<templateName>.md` under `src/markdown/templates/`. The guide prose
 * (steering-guide / spec-workflow-guide) and the docs are hand-authored and
 * still need a matching paragraph.
 */
export interface SteeringDocDef {
  /** Stable identifier and file stem, e.g. 'design-system' -> design-system.md. Used as the documents-map key and API :name. */
  name: string;
  /** File name under .spec-workflow/steering/. */
  fileName: string;
  /** Template stem under templates/ (and user-templates/ override). Distinct from the per-spec 'design-template'. */
  templateName: string;
  /** Human-readable label for the dashboard. */
  displayName: string;
  /** Position in the steering creation sequence (1-based). */
  order: number;
}

export const STEERING_DOCS: SteeringDocDef[] = [
  { name: 'product', fileName: 'product.md', templateName: 'product-template', displayName: 'Product', order: 1 },
  { name: 'tech', fileName: 'tech.md', templateName: 'tech-template', displayName: 'Technical', order: 2 },
  { name: 'structure', fileName: 'structure.md', templateName: 'structure-template', displayName: 'Structure', order: 3 },
  { name: 'design-system', fileName: 'design-system.md', templateName: 'design-system-template', displayName: 'Design System', order: 4 },
];

/** Steering doc names, e.g. ['product','tech','structure','design-system']. */
export const STEERING_DOC_NAMES: string[] = STEERING_DOCS.map((d) => d.name);

/** Steering doc file names, e.g. ['product.md', ...]. */
export const STEERING_DOC_FILES: string[] = STEERING_DOCS.map((d) => d.fileName);

/** Steering template stems, e.g. ['product-template', ...]. */
export const STEERING_TEMPLATE_NAMES: string[] = STEERING_DOCS.map((d) => d.templateName);
