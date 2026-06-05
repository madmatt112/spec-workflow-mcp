import { describe, it, expect, afterEach } from 'vitest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';
import {
  STEERING_DOCS,
  STEERING_DOC_NAMES,
  STEERING_DOC_FILES,
  STEERING_TEMPLATE_NAMES,
} from '../steering-docs.js';
import { SpecParser as CoreParser } from '../parser.js';
import { SpecParser as DashboardParser } from '../../dashboard/parser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', 'markdown', 'templates');

describe('steering-docs registry', () => {
  it('includes design-system as a first-class type', () => {
    const designSystem = STEERING_DOCS.find((d) => d.name === 'design-system');
    expect(designSystem).toBeDefined();
    expect(designSystem?.fileName).toBe('design-system.md');
    expect(designSystem?.templateName).toBe('design-system-template');
  });

  it('keeps the original three steering docs', () => {
    expect(STEERING_DOC_NAMES).toEqual(
      expect.arrayContaining(['product', 'tech', 'structure', 'design-system'])
    );
  });

  it('has unique names, file names, and template names', () => {
    expect(new Set(STEERING_DOC_NAMES).size).toBe(STEERING_DOC_NAMES.length);
    expect(new Set(STEERING_DOC_FILES).size).toBe(STEERING_DOC_FILES.length);
    expect(new Set(STEERING_TEMPLATE_NAMES).size).toBe(STEERING_TEMPLATE_NAMES.length);
  });

  it('does not collide with the per-spec design-template', () => {
    // The per-spec Design phase template is 'design-template'; the steering
    // design-system doc must use a distinct template name.
    expect(STEERING_TEMPLATE_NAMES).not.toContain('design-template');
    expect(STEERING_TEMPLATE_NAMES).toContain('design-system-template');
  });
});

describe('design-system template altitude', () => {
  // Locks the steering-not-spec / direction-over-values framing so it can't
  // silently regress back to prompting for concrete values.
  it('frames the doc as steering (direction & rules), not a value spec', async () => {
    const content = await fs.readFile(join(TEMPLATES_DIR, 'design-system-template.md'), 'utf-8');
    expect(content).toMatch(/Steering, not spec/i);
    expect(content).toMatch(/direction and rules/i);
    // The "Deferred:" convention must be offered as a first-class answer.
    expect(content).toContain('Deferred:');
    // Should steer toward semantic roles and the token source of truth (DRY).
    expect(content).toMatch(/semantic roles/i);
    expect(content).toMatch(/source of truth/i);
    // Should warn against duplicating the sibling steering docs.
    expect(content).toMatch(/Don't restate the other steering docs/i);
  });
});

describe('design-system consumption loop', () => {
  // A steering doc is only "first-class" if downstream spec work references it.
  // The per-spec design template must prompt alignment with design-system.md,
  // conditionally and degrading to N/A.
  it('the per-spec design template prompts alignment with design-system.md', async () => {
    const content = await fs.readFile(join(TEMPLATES_DIR, 'design-template.md'), 'utf-8');
    expect(content).toMatch(/### Design System \(design-system\.md\)/);
    // Conditional + graceful: must offer N/A for non-UI specs / projects without the doc.
    expect(content).toMatch(/if applicable/i);
    expect(content).toContain('N/A');
  });
});

describe('steering status reflects the registry', () => {
  const dirs: string[] = [];

  async function createSteeringProject(files: string[]): Promise<string> {
    const dir = join(tmpdir(), `specwf-steering-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const steeringDir = join(dir, '.spec-workflow', 'steering');
    await fs.mkdir(steeringDir, { recursive: true });
    for (const file of files) {
      await fs.writeFile(join(steeringDir, file), `# ${file}\n`, 'utf-8');
    }
    dirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('core parser reports design-system when present', async () => {
    const project = await createSteeringProject(['product.md', 'tech.md', 'structure.md', 'design-system.md']);
    const status = await new CoreParser(project).getProjectSteeringStatus();
    expect(status.exists).toBe(true);
    expect(status.documents['design-system']).toBe(true);
    expect(status.documents.product).toBe(true);
  });

  it('core parser reports design-system false when absent (legacy projects)', async () => {
    const project = await createSteeringProject(['product.md', 'tech.md', 'structure.md']);
    const status = await new CoreParser(project).getProjectSteeringStatus();
    expect(status.documents.product).toBe(true);
    expect(status.documents.tech).toBe(true);
    expect(status.documents.structure).toBe(true);
    expect(status.documents['design-system']).toBe(false);
  });

  it('dashboard parser reports design-system when present', async () => {
    const project = await createSteeringProject(['product.md', 'design-system.md']);
    const status = await new DashboardParser(project).getProjectSteeringStatus();
    expect(status.documents['design-system']).toBe(true);
    expect(status.documents.tech).toBe(false);
  });

  it('both parsers populate every registry key even with no steering dir', async () => {
    const dir = join(tmpdir(), `specwf-steering-empty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(dir, { recursive: true });
    dirs.push(dir);

    const core = await new CoreParser(dir).getProjectSteeringStatus();
    const dash = await new DashboardParser(dir).getProjectSteeringStatus();
    for (const name of STEERING_DOC_NAMES) {
      expect(core.documents).toHaveProperty(name, false);
      expect(dash.documents).toHaveProperty(name, false);
    }
  });
});
