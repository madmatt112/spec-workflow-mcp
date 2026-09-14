// Data model for the SDD lifecycle diagrams.
//
// Edit this file to change what the diagrams say. Then run
// `node docs/diagrams/render.mjs` to regenerate every SVG and index.html.
// Layout and styling live in render.mjs; content lives here.
//
// Colours are OKLCH triples [L, C, H] so the values sit on the same scale as
// matthewfield.ca's tokens (src/styles/tokens.css there). The renderer
// converts them to hex, so the SVGs work in every viewer.

// ---------------------------------------------------------------------------
// Phase families. One hue per family. `light` is used on the white ground,
// `dark` on the near-black ground.
export const families = {
  steering: { label: 'Steering', light: [0.5, 0.13, 42], dark: [0.75, 0.12, 55] },
  decomposition: { label: 'Decomposition', light: [0.52, 0.12, 85], dark: [0.76, 0.13, 85] },
  documents: { label: 'Spec documents', light: [0.52, 0.14, 240], dark: [0.74, 0.13, 240] },
  build: { label: 'Implementation', light: [0.5, 0.15, 150], dark: [0.74, 0.15, 150] },
  reflect: { label: 'Retrospective and close-out', light: [0.5, 0.13, 300], dark: [0.74, 0.12, 300] },
};

// Neutral tokens, copied from the site's tokens.css (:root and .dark).
export const neutrals = {
  light: {
    background: [1, 0, 0],
    foreground: [0.145, 0, 0],
    muted: [0.97, 0, 0],
    mutedForeground: [0.5, 0, 0],
    border: [0.88, 0, 0],
    brand: [0.5, 0.13, 42],
    destructive: [0.5, 0.22, 27.325],
  },
  dark: {
    background: [0.145, 0, 0],
    foreground: [0.985, 0, 0],
    muted: [0.269, 0, 0],
    mutedForeground: [0.74, 0, 0],
    border: [0.32, 0, 0],
    brand: [0.75, 0.12, 55],
    destructive: [0.704, 0.191, 22.216],
  },
};

// Agent roles. The `roles` verbosity level prints the right-hand names.
export const roles = {
  supervisor: 'sdd-continue',
  docOrch: 'sdd-document-orchestrator',
  implOrch: 'sdd-implementation-orchestrator',
  retroOrch: 'sdd-retro-orchestrator',
  closeoutOrch: 'sdd-closeout-orchestrator',
  drafter: 'sdd-drafter',
  reviewer: 'sdd-reviewer',
  reviser: 'sdd-reviser',
  adjudicator: 'sdd-adjudicator',
  implementer: 'sdd-implementer',
  verifier: 'sdd-verifier',
  analyst: 'sdd-retro-analyst',
  human: 'you',
  agent: 'your coding agent',
};

// What each role does, for the legend at the `legend` verbosity level.
export const roleDoes = {
  supervisor: 'runs the loop, holds the retrospective conversation',
  docOrch: 'runs one document phase to approval',
  implOrch: 'works the task queue, opens the PR',
  retroOrch: 'compiles the retrospective findings',
  closeoutOrch: 'lands the approved retrospective plan',
  drafter: 'writes version 1 of a document',
  reviewer: 'adversarial review with a verdict',
  reviser: 'writes the next version from the findings',
  adjudicator: 'rules on deadlocks, fixes what it accepts',
  implementer: 'implements one task or fix, commits',
  verifier: 'independent review, end-to-end checks',
  analyst: 'turns findings into proposals',
  human: 'decides, approves, answers questions',
  agent: 'the coding agent in your session',
};

// Who is in the loop at a stage.
//   human   – a person decides, in every mode
//   manual  – a person approves in manual mode; the harness approves itself
//   agent   – agents only
export const modes = {
  human: { label: 'Human decides', short: 'HUMAN' },
  manual: { label: 'Human approves in manual mode, harness self-approves', short: 'MANUAL GATE' },
  agent: { label: 'Agents only', short: 'AGENTS' },
};

// ---------------------------------------------------------------------------
// Diagram 1: the journey.
// A step with `loop: true` runs the review loop (drawn once as the motif).
// A step with `human: true` needs a person in every mode.
export const journey = {
  title: 'The SDD journey',
  subtitle: 'From the first line of product.md to a closed spec, and around again.',
  entries: [
    { id: 'blank', label: 'Blank project' },
    { id: 'existing', label: 'Existing codebase' },
  ],
  groups: [
    {
      id: 'once',
      label: 'Project setup',
      note: 'once per product',
      stages: [
        {
          n: 1,
          id: 'steering',
          family: 'steering',
          title: 'Write the steering documents',
          mode: 'human',
          steps: [
            { id: '1.1', verb: 'Draft product.md', role: 'agent', loop: true },
            { id: '1.2', verb: 'Draft tech.md', role: 'agent', loop: true },
            { id: '1.3', verb: 'Draft structure.md', role: 'agent', loop: true },
            { id: '1.4', verb: 'Draft design-system.md', role: 'agent', loop: true, optional: true },
          ],
        },
        {
          n: 2,
          id: 'decomposition',
          family: 'decomposition',
          title: 'Decompose into specs',
          mode: 'human',
          steps: [
            { id: '2.1', verb: 'Read every steering document', role: 'agent' },
            { id: '2.2', verb: 'Account for existing code', role: 'human', human: true },
            { id: '2.3', verb: 'Group capabilities into specs', role: 'agent' },
            { id: '2.4', verb: 'Order specs by dependency', role: 'agent' },
            { id: '2.5', verb: 'Answer the open questions', role: 'human', human: true },
            { id: '2.6', verb: 'Approve decomposition.md', role: 'agent', loop: true },
            { id: '2.7', verb: 'Generate the INDEX roadmap', role: 'agent' },
          ],
        },
      ],
    },
    {
      id: 'perSpec',
      label: 'One spec',
      note: 'repeats in dependency order',
      stages: [
        {
          n: 3,
          id: 'requirements',
          family: 'documents',
          title: 'Requirements',
          mode: 'manual',
          steps: [
            { id: '3.1', verb: 'Draft v1', role: 'drafter' },
            { id: '3.2', verb: 'Converge by review', role: 'reviewer', loop: true },
            { id: '3.3', verb: 'Approve, prune, commit', role: 'docOrch' },
          ],
        },
        {
          n: 4,
          id: 'design',
          family: 'documents',
          title: 'Design',
          mode: 'manual',
          steps: [
            { id: '4.1', verb: 'Draft v1', role: 'drafter' },
            { id: '4.2', verb: 'Converge by review', role: 'reviewer', loop: true },
            { id: '4.3', verb: 'Approve, prune, commit', role: 'docOrch' },
          ],
        },
        {
          n: 5,
          id: 'tasks',
          family: 'documents',
          title: 'Tasks',
          mode: 'manual',
          steps: [
            { id: '5.1', verb: 'Draft v1', role: 'drafter' },
            { id: '5.2', verb: 'Converge by review', role: 'reviewer', loop: true },
            { id: '5.3', verb: 'Approve, prune, commit', role: 'docOrch' },
          ],
        },
        {
          n: 6,
          id: 'implementation',
          family: 'build',
          title: 'Implementation',
          mode: 'agent',
          steps: [
            { id: '6.1', verb: 'Implement each task', role: 'implementer' },
            { id: '6.2', verb: 'Verify each task', role: 'verifier', loop: true },
            { id: '6.3', verb: 'Verify end to end', role: 'verifier' },
            { id: '6.4', verb: 'Open the PR', role: 'implOrch' },
            { id: '6.5', verb: 'Wait for green checks', role: 'implOrch', loop: true },
          ],
        },
        {
          n: 7,
          id: 'retrospective',
          family: 'reflect',
          title: 'Retrospective',
          mode: 'human',
          steps: [
            { id: '7.1', verb: 'Compile the findings', role: 'retroOrch' },
            { id: '7.2', verb: 'Write the proposals', role: 'analyst' },
            { id: '7.3', verb: 'Decide what to approve', role: 'human', human: true },
            { id: '7.4', verb: 'Write the plan', role: 'supervisor' },
          ],
        },
        {
          n: 8,
          id: 'closeout',
          family: 'reflect',
          title: 'Close-out',
          mode: 'agent',
          steps: [
            { id: '8.1', verb: 'Land each proposal', role: 'implementer' },
            { id: '8.2', verb: 'Verify each item', role: 'verifier', loop: true },
            { id: '8.3', verb: 'Open the follow-up PRs', role: 'closeoutOrch' },
            { id: '8.4', verb: 'Mark the plan CLOSED', role: 'closeoutOrch' },
          ],
        },
      ],
    },
  ],
  // The loop-back edge from the last stage to the first per-spec stage.
  loopBack: { from: 'closeout', to: 'requirements', label: 'next spec' },
  // The review-loop motif, drawn once and referenced by every step marked loop.
  motif: {
    title: 'The review loop',
    note: 'Every step marked with the loop mark runs this until the reviewer says converged.',
    steps: [
      { verb: 'Draft', role: 'drafter' },
      { verb: 'Adversarial review', role: 'reviewer' },
      { verb: 'Revise', role: 'reviser' },
      { verb: 'Approve', role: 'docOrch' },
    ],
    back: 'iterate',
    forward: 'converged',
  },
};

// ---------------------------------------------------------------------------
// Diagram 2: hierarchical state machine.
// Outer machine: the product. Composite: one spec. Inner: one document phase.
export const fsm = {
  title: 'The SDD state machine',
  subtitle: 'The product is a machine, each spec is a state inside it, each document phase is a state inside that.',
  product: {
    label: 'Product',
    states: [
      { id: 'noSteering', label: 'No steering', family: 'steering' },
      { id: 'steered', label: 'Steering written', family: 'steering' },
      { id: 'decomposed', label: 'Decomposition approved', family: 'decomposition' },
      { id: 'working', label: 'Specs in progress', family: 'documents', composite: true },
      { id: 'done', label: 'Every spec closed', family: 'reflect', final: true },
    ],
    transitions: [
      { from: 'init', to: 'noSteering' },
      { from: 'noSteering', to: 'steered', label: 'product, tech, structure written' },
      { from: 'steered', to: 'decomposed', label: 'decomposition.md approved' },
      { from: 'decomposed', to: 'working', label: 'first spec in INDEX' },
      { from: 'working', to: 'done', label: 'INDEX has no next spec' },
    ],
  },
  spec: {
    label: 'Spec N',
    states: [
      { id: 'requirements', label: 'Requirements', family: 'documents', composite: true },
      { id: 'design', label: 'Design', family: 'documents' },
      { id: 'tasks', label: 'Tasks', family: 'documents' },
      { id: 'implementation', label: 'Implementation', family: 'build' },
      { id: 'retrospective', label: 'Retrospective', family: 'reflect' },
      { id: 'closeout', label: 'Close-out', family: 'reflect' },
    ],
    transitions: [
      { from: 'init', to: 'requirements' },
      { from: 'requirements', to: 'design', label: 'approved' },
      { from: 'design', to: 'tasks', label: 'approved' },
      { from: 'tasks', to: 'implementation', label: 'approved' },
      { from: 'implementation', to: 'retrospective', label: 'complete' },
      { from: 'retrospective', to: 'closeout', label: 'plan APPROVED' },
      { from: 'closeout', to: 'final', label: 'closed' },
      { from: 'implementation', to: 'design', label: 'design-defect', kind: 'back' },
      { from: 'implementation', to: 'implementation', label: 'verify-failed, repair', kind: 'self' },
      { from: 'retrospective', to: 'retrospective', label: 'DRAFT plan, decisions needed', kind: 'self' },
    ],
    note: 'Every state also has a resume self-loop: an orchestrator that spends its budget hands off to a fresh one.',
  },
  document: {
    label: 'One document phase',
    states: [
      { id: 'drafted', label: 'v1 drafted' },
      { id: 'review', label: 'Under review' },
      { id: 'revising', label: 'Revising' },
      { id: 'capped', label: 'Cap reached, v10' },
      { id: 'approved', label: 'Approved', final: true },
    ],
    transitions: [
      { from: 'init', to: 'drafted' },
      { from: 'drafted', to: 'review', label: 'approval requested' },
      { from: 'review', to: 'revising', label: 'iterate' },
      { from: 'revising', to: 'review', label: 'v(N+1) requested' },
      { from: 'review', to: 'approved', label: 'converged' },
      { from: 'review', to: 'capped', label: 'iterate at v9' },
      { from: 'capped', to: 'approved', label: 'narrow check' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Diagram 3: the adversarial review loop, zoomed.
export const reviewLoop = {
  title: 'The adversarial review loop',
  subtitle: 'One document, one phase, up to ten versions.',
  family: 'documents',
  nodes: [
    { id: 'draft', verb: 'Draft v1', role: 'drafter', kind: 'work' },
    { id: 'request', verb: 'Request approval for vN', role: 'docOrch', kind: 'work' },
    { id: 'review', verb: 'Adversarial review, round N', role: 'reviewer', kind: 'work' },
    { id: 'verdict', verb: 'Verdict?', kind: 'decision' },
    { id: 'standoff', verb: 'Standoff? Rule on it', role: 'docOrch', kind: 'work', note: 'A recurring MUST_FIX rejected twice running' },
    { id: 'revise', verb: 'Revise to v(N+1)', role: 'reviser', kind: 'work' },
    { id: 'cap', verb: 'Corrective pass, v10', role: 'adjudicator', kind: 'work', note: 'Only when v9 still has open items' },
    { id: 'narrow', verb: 'Narrow check', role: 'reviewer', kind: 'work' },
    { id: 'approve', verb: 'Approve the final version', role: 'docOrch', kind: 'work' },
    { id: 'clean', verb: 'Prune records, delete prompts, commit', role: 'docOrch', kind: 'work' },
    { id: 'escalate', verb: 'Stop and escalate', kind: 'stop', note: 'Security, secrets, data loss, money, legal' },
  ],
  edges: [
    { from: 'draft', to: 'request' },
    { from: 'request', to: 'review' },
    { from: 'review', to: 'verdict' },
    { from: 'verdict', to: 'approve', label: 'converged, or only minor' },
    { from: 'verdict', to: 'standoff', label: 'iterate, N < 9' },
    { from: 'standoff', to: 'revise' },
    { from: 'revise', to: 'request', label: 'N = N + 1', kind: 'back' },
    { from: 'verdict', to: 'cap', label: 'iterate, N = 9' },
    { from: 'cap', to: 'narrow' },
    { from: 'narrow', to: 'approve', label: 'always' },
    { from: 'approve', to: 'clean' },
    { from: 'review', to: 'escalate', label: 'ESCALATE', kind: 'stop' },
  ],
};

// ---------------------------------------------------------------------------
// Diagram 4: the implementation task loop, zoomed.
export const taskLoop = {
  title: 'The implementation loop',
  subtitle: 'Per task, then the completion gate, then the PR.',
  family: 'build',
  nodes: [
    { id: 'pick', verb: 'Pick the next task, mark [-]', role: 'implOrch', kind: 'work' },
    { id: 'impl', verb: 'Implement and log', role: 'implementer', kind: 'work' },
    { id: 'verify', verb: 'Verify through review-task', role: 'verifier', kind: 'work' },
    { id: 'verdict', verb: 'Verdict?', kind: 'decision' },
    { id: 'fix', verb: 'Fix round, up to 3', role: 'implementer', kind: 'work' },
    { id: 'adjudicate', verb: 'Adjudicate, then narrow verify', role: 'adjudicator', kind: 'work' },
    { id: 'done', verb: 'Mark [x], commit the spec store', role: 'implOrch', kind: 'work' },
    { id: 'more', verb: 'Tasks left?', kind: 'decision' },
    { id: 'e2e', verb: 'Verify end to end', role: 'verifier', kind: 'work', note: 'The decomposition scenario plus the full check suite' },
    { id: 'e2eVerdict', verb: 'Pass?', kind: 'decision' },
    { id: 'close', verb: 'Regenerate INDEX, write HANDOFF, commit', role: 'implOrch', kind: 'work' },
    { id: 'pr', verb: 'Push and open the PR', role: 'implOrch', kind: 'work', note: 'One PR per code repo per spec. Never merge.' },
    { id: 'ci', verb: 'Checks green?', kind: 'decision' },
    { id: 'reconcile', verb: 'Reconcile, up to 3 rounds', role: 'implementer', kind: 'work', note: 'Reproduce locally, fix, verify, push' },
    { id: 'complete', verb: 'Complete, on to retrospective', kind: 'end' },
    { id: 'defect', verb: 'Design defect: reopen design', kind: 'stop' },
    { id: 'failed', verb: 'Verify failed: repair run', kind: 'stop', note: 'The supervisor spawns a repair, at most twice' },
  ],
  edges: [
    { from: 'pick', to: 'impl' },
    { from: 'impl', to: 'verify' },
    { from: 'impl', to: 'defect', label: 'DESIGN-DEFECT', kind: 'stop' },
    { from: 'verify', to: 'verdict' },
    { from: 'verdict', to: 'done', label: 'pass' },
    { from: 'verdict', to: 'fix', label: 'fix-required' },
    { from: 'fix', to: 'verify', label: 'rounds < 3', kind: 'back' },
    { from: 'fix', to: 'adjudicate', label: 'after 3' },
    { from: 'adjudicate', to: 'done' },
    { from: 'done', to: 'more' },
    { from: 'more', to: 'pick', label: 'yes', kind: 'back' },
    { from: 'more', to: 'e2e', label: 'no' },
    { from: 'e2e', to: 'e2eVerdict' },
    { from: 'e2eVerdict', to: 'close', label: 'pass' },
    { from: 'e2eVerdict', to: 'failed', label: 'fail', kind: 'stop' },
    { from: 'close', to: 'pr' },
    { from: 'pr', to: 'ci' },
    { from: 'ci', to: 'complete', label: 'green' },
    { from: 'ci', to: 'reconcile', label: 'red' },
    { from: 'reconcile', to: 'ci', label: 'pushed', kind: 'back' },
    { from: 'reconcile', to: 'failed', label: 'still red', kind: 'stop' },
  ],
};

// ---------------------------------------------------------------------------
// Diagram 5: steering documents into decomposition.
export const steering = {
  title: 'Steering into specs',
  subtitle: 'Four documents describe the product. The decomposition turns them into an ordered queue.',
  docs: [
    { id: 'product', file: 'product.md', says: 'Vision, users, features, success, non-goals' },
    { id: 'tech', file: 'tech.md', says: 'Architecture, stack, performance, security' },
    { id: 'structure', file: 'structure.md', says: 'Folders, naming, module boundaries' },
    { id: 'designSystem', file: 'design-system.md', says: 'Principles, token roles, component rules', optional: true },
  ],
  existing: { label: 'Existing code', says: 'What must be refactored versus built new' },
  decomposition: {
    file: 'decomposition.md',
    sections: [
      'One entry per spec, with its end-to-end verification',
      'Dependency graph and critical path',
      'Cross-spec conventions',
      'What is not a spec',
      'Open questions for you',
    ],
  },
  index: { file: 'INDEX.md', says: 'Generated roadmap. Names the next spec.' },
  specs: [
    { id: 'A', label: 'Spec A', deps: [] },
    { id: 'B', label: 'Spec B', deps: ['A'] },
    { id: 'C', label: 'Spec C', deps: ['A'] },
    { id: 'D', label: 'Spec D', deps: ['B', 'C'] },
  ],
  loop: 'Every steering document, and the decomposition, goes through the review loop before it is approved.',
};

// Verbosity levels and how each prints a step.
export const verbosity = {
  roles: { label: 'With agent roles', showRole: true, legend: false },
  legend: { label: 'Verbs, roles in a legend', showRole: false, legend: true },
  verbs: { label: 'Verbs only', showRole: false, legend: false },
};
