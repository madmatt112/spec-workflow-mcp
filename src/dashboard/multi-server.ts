import fastify, { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCors from '@fastify/cors';
import { join, dirname, resolve } from 'path';
import { readFile } from 'fs/promises';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import open from 'open';
import { WebSocket } from 'ws';
import { validateAndCheckPort, DASHBOARD_TEST_MESSAGE } from './utils.js';
import { ProjectManager } from './project-manager.js';
import { TaskReviewManager } from '../core/task-review-manager.js';
import { DeferralStorage } from '../core/deferral-storage.js';
import { IndexGenerator } from '../core/index-generator.js';
import { DashboardSessionManager } from '../core/dashboard-session.js';
import {
  getSecurityConfig,
  RateLimiter,
  AuditLogger,
  createSecurityHeadersMiddleware,
  getCorsConfig,
  isLocalhostAddress,
  DEFAULT_SECURITY_CONFIG
} from '../core/security-utils.js';
import { SecurityConfig, TddBlock } from '../types.js';
import { HarnessLauncher } from './harness/launcher.js';
import { HarnessHub } from './harness/hub.js';
import { buildSetupView, validateSetup, toRunFile, writeRunFile, readAgentRules } from './harness/run-setup.js';
import type { HarnessMessage, SetupInput, SetupView } from './harness/types.js';
import type { ProjectContext } from './project-manager.js';
import { buildSpecDetail } from './shell/spec-rows.js';
import type { ShellMessage } from './shell/types.js';
import { answerWait, attachAdvice, listWaitsForWire } from '../controller/waits.js';
import { listRunsForWire } from '../controller/runs.js';
import { Controller } from '../controller/controller.js';
import { createDocumentGates } from '../controller/phases/gates.js';
import { listRuns, readRateLimit } from '../controller/state.js';
import { installAccessControl, loadOrCreateSecret, secretPath } from '../controller/access.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const multiServerWarnedKeys = new Set<string>();
function warnOnce(baseKey: string, instanceId: string, message: string): void {
  const dedupKey = `${baseKey}:${instanceId}`;
  if (multiServerWarnedKeys.has(dedupKey)) return;
  multiServerWarnedKeys.add(dedupKey);
  console.warn(`[spec-workflow] retry: ${message} (key=${baseKey}, id=${instanceId})`);
}

export function _resetMultiServerWarningsForTests(): void {
  multiServerWarnedKeys.clear();
}

interface WebSocketConnection {
  socket: WebSocket;
  projectId?: string;
  isAlive?: boolean;
  views?: Set<'harness' | 'overview'>;
}

export interface MultiDashboardOptions {
  autoOpen?: boolean;
  port?: number;
  bindAddress?: string; // Network binding address
  allowExternalAccess?: boolean; // Explicit opt-in for non-localhost binding
  security?: Partial<SecurityConfig>; // Security features configuration
  harness?: { cli?: string; stopGraceMs?: number; pollMs?: number }; // Harness launcher options (C7)
}

export class MultiProjectDashboardServer {
  private app: FastifyInstance;
  private projectManager: ProjectManager;
  private sessionManager: DashboardSessionManager;
  private harnessLauncher: HarnessLauncher;
  private harnessHub: HarnessHub;
  private controller: Controller;
  private options: MultiDashboardOptions;
  private bindAddress: string;
  private allowExternalAccess: boolean;
  private securityConfig: SecurityConfig;
  private rateLimiter?: RateLimiter;
  private auditLogger?: AuditLogger;
  private actualPort: number = 0;
  private clients: Set<WebSocketConnection> = new Set();
  private packageVersion: string = 'unknown';
  /** Cached `dist/build-info.json` `builtAt`, read once for `/api/health`. */
  private builtAt?: string | null;
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly HEARTBEAT_INTERVAL_MS = 30000;
  private readonly HEARTBEAT_TIMEOUT_MS = 10000;
  // Debounce spec broadcasts to coalesce rapid updates
  private pendingSpecBroadcasts: Map<string, NodeJS.Timeout> = new Map();
  private readonly SPEC_BROADCAST_DEBOUNCE_MS = 300;

  constructor(options: MultiDashboardOptions = {}) {
    this.options = options;
    this.projectManager = new ProjectManager();
    this.sessionManager = new DashboardSessionManager();

    // Harness launcher and hub (design C7). The hub starts a watch only while a
    // page of its view is open, and pushes reach only that view's subscribers.
    this.harnessLauncher = new HarnessLauncher({
      cli: options.harness?.cli,
      stopGraceMs: options.harness?.stopGraceMs,
      pollMs: options.harness?.pollMs,
    });
    this.harnessHub = new HarnessHub(
      this.projectManager,
      this.harnessLauncher,
      (m: HarnessMessage) => this.sendToHarness((m as { projectId: string }).projectId, m),
      (m: HarnessMessage | ShellMessage) => this.sendToOverview(m),
    );

    // The controller (controller-tasks.md T6; controller-design.md §1-3). It owns
    // the queue and drives each run through its phases; the launch route enqueues
    // to it. Its steps and the supervisor run on the same cli the launcher uses
    // (tests pass a stub). It resolves a project's roots from the project manager
    // and reuses the launcher's `ensureWorktree` for worktree isolation.
    this.controller = new Controller({
      resolveProject: (projectId) => {
        const project = this.projectManager.getProject(projectId);
        return project
          ? { projectPath: project.projectPath, workspacePath: project.workspacePath }
          : undefined;
      },
      // T5b's real gate A/B: each writes a `gate-a`/`gate-b` wait and the run
      // resumes on the answer (controller-design.md §5, §7).
      gates: createDocumentGates(),
      ensureWorktree: async ({ projectPath, workspacePath, spec }) => {
        const rules = readAgentRules(join(projectPath, '.spec-workflow'));
        if (rules.worktree !== 'yes') return { worktree: workspacePath, branch: `feat/${spec}` };
        const dir = await this.harnessLauncher.ensureWorktree(
          { workspacePath } as ProjectContext, spec, rules.worktreeSetup,
        );
        return { worktree: dir, branch: `feat/${spec}` };
      },
      claudeBin: () => process.env.CONTROLLER_CLAUDE_BIN ?? options.harness?.cli ?? 'claude',
    });

    // Initialize network binding configuration
    this.bindAddress = options.bindAddress || '127.0.0.1';
    this.allowExternalAccess = options.allowExternalAccess || false;

    // Validate network binding security
    if (!isLocalhostAddress(this.bindAddress) && !this.allowExternalAccess) {
      throw new Error(
        `SECURITY ERROR: Binding to '${this.bindAddress}' (non-localhost) requires explicit allowExternalAccess=true. ` +
        'This exposes your dashboard to network access. Use 127.0.0.1 for localhost-only access.'
      );
    }

    // Initialize security features configuration with the actual port
    // This ensures CORS allowedOrigins and CSP are port-aware
    this.securityConfig = getSecurityConfig(options.security, options.port);

    this.app = fastify({ logger: false });
  }

  async start() {
    // Security warning if binding to non-localhost address
    if (!isLocalhostAddress(this.bindAddress)) {
      console.error('');
      console.error('⚠️  ═══════════════════════════════════════════════════════════');
      console.error(`⚠️  SECURITY WARNING: Dashboard binding to ${this.bindAddress}`);
      console.error('⚠️  This exposes your dashboard to network-based attacks!');
      console.error('⚠️  Recommendation: Use 127.0.0.1 for localhost-only access');
      console.error('⚠️  ═══════════════════════════════════════════════════════════');
      console.error('');
    }

    // Display security status
    console.error('🔒 Security Configuration:');
    console.error(`   - Bind Address: ${this.bindAddress}`);
    console.error(`   - Rate Limiting: ${this.securityConfig.rateLimitEnabled ? 'ENABLED ✓' : 'DISABLED ⚠️'}`);
    console.error(`   - Audit Logging: ${this.securityConfig.auditLogEnabled ? 'ENABLED ✓' : 'DISABLED ⚠️'}`);
    console.error(`   - CORS: ${this.securityConfig.corsEnabled ? 'ENABLED ✓' : 'DISABLED ⚠️'}`);
    console.error(`   - Allowed Origins: ${this.securityConfig.allowedOrigins.join(', ')}`);
    console.error('');

    // Fetch package version once at startup
    try {
      const response = await fetch('https://registry.npmjs.org/@madmatt112org/spec-workflow-mcp/latest');
      if (response.ok) {
        const packageInfo = await response.json() as { version?: string };
        this.packageVersion = packageInfo.version || 'unknown';
      }
    } catch {
      // Fallback to local package.json version if npm request fails
      try {
        const packageJsonPath = join(__dirname, '..', '..', 'package.json');
        const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonContent) as { version?: string };
        this.packageVersion = packageJson.version || 'unknown';
      } catch {
        // Keep default 'unknown' if both npm and local package.json fail
      }
    }

    // Initialize security components
    if (this.securityConfig.rateLimitEnabled) {
      this.rateLimiter = new RateLimiter(this.securityConfig);
    }

    if (this.securityConfig.auditLogEnabled) {
      this.auditLogger = new AuditLogger(this.securityConfig);
      await this.auditLogger.initialize();
    }

    // Initialize project manager
    await this.projectManager.initialize();

    // Register CORS plugin if enabled
    const corsConfig = getCorsConfig(this.securityConfig);
    if (corsConfig !== false) {
      await this.app.register(fastifyCors, corsConfig as any);
    }

    // Register security middleware (apply to all routes)
    // Pass the actual port for CSP connect-src WebSocket configuration
    this.app.addHook('onRequest', createSecurityHeadersMiddleware(this.options.port));

    if (this.rateLimiter) {
      this.app.addHook('onRequest', this.rateLimiter.middleware());
    }

    if (this.auditLogger) {
      this.app.addHook('onRequest', this.auditLogger.middleware());
    }

    // Shared-secret access control (controller-design.md §17). The secret is
    // generated on first start and kept in the harness home. The hook and the
    // login/logout routes are installed before every other route so the hook
    // covers the static assets, the WebSocket upgrade and the API.
    const secret = await loadOrCreateSecret();
    installAccessControl(this.app, secret);
    console.error(`🔐 Access: dashboard bound to ${this.bindAddress}; shared secret in ${secretPath()}`);

    // Register plugins
    await this.app.register(fastifyStatic, {
      root: join(__dirname, 'public'),
      prefix: '/',
    });

    await this.app.register(fastifyWebsocket);

    // WebSocket endpoint for real-time updates
    const self = this;
    await this.app.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (socket, req) => {
        const connection: WebSocketConnection = { socket, isAlive: true };

        // Get projectId from query parameter
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const projectId = url.searchParams.get('projectId') || undefined;

        connection.projectId = projectId;
        self.clients.add(connection);

        // Handle pong for heartbeat
        socket.on('pong', () => {
          connection.isAlive = true;
        });

        // Send projects list
        socket.send(
          JSON.stringify({
            type: 'projects-update',
            data: { projects: self.projectManager.getProjectsList() }
          })
        );

        // Handle client disconnect
        const cleanup = () => {
          self.clients.delete(connection);
          socket.removeAllListeners();
          // A closed page may have been the last subscriber of a view (C7).
          void self.harnessHub.reconcile(self.clients);
        };

        socket.on('close', cleanup);
        socket.on('error', cleanup);
        socket.on('disconnect', cleanup);
        socket.on('end', cleanup);

        // Handle subscription messages
        socket.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'harness-subscribe' && msg.projectId) {
              // Watch this project's harness view; snapshot to this socket alone.
              connection.projectId = msg.projectId;
              (connection.views ??= new Set()).add('harness');
              self.harnessHub.reconcile(self.clients)
                .then(() => {
                  for (const m of self.harnessHub.snapshotFor(msg.projectId)) {
                    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
                  }
                })
                .catch((error) => console.error('Error handling harness-subscribe:', error));
            } else if (msg.type === 'harness-unsubscribe') {
              connection.views?.delete('harness');
              void self.harnessHub.reconcile(self.clients);
            } else if (msg.type === 'overview-subscribe') {
              (connection.views ??= new Set()).add('overview');
              self.harnessHub.reconcile(self.clients)
                .then(() => {
                  for (const m of self.harnessHub.overviewSnapshot()) {
                    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m));
                  }
                })
                .catch((error) => console.error('Error handling overview-subscribe:', error));
            } else if (msg.type === 'overview-unsubscribe') {
              connection.views?.delete('overview');
              void self.harnessHub.reconcile(self.clients);
            }
          } catch (error) {
            // Ignore invalid messages
          }
        });
      });
    });

    // Serve Claude icon as favicon
    this.app.get('/favicon.ico', async (request, reply) => {
      return reply.sendFile('claude-icon.svg');
    });

    // Setup project manager event handlers
    this.setupProjectManagerEvents();

    // Register API routes
    this.registerApiRoutes();

    // Validate and set port (always provided by caller)
    if (!this.options.port) {
      throw new Error('Dashboard port must be specified');
    }

    await validateAndCheckPort(this.options.port, this.bindAddress);
    this.actualPort = this.options.port;

    // Reattach any launches on disk before we accept connections (design C7).
    await this.harnessLauncher.restore();

    // Start the controller: acquire its lock, recover in-flight runs, subscribe
    // to wait answers, and start the scheduler (controller-tasks.md T6, §8).
    try {
      await this.controller.start();
    } catch (error) {
      console.error('Failed to start the controller:', error);
    }

    // Start server with configured network binding
    await this.app.listen({
      port: this.actualPort,
      host: this.bindAddress
    });

    // Start WebSocket heartbeat monitoring
    this.startHeartbeat();

    // Register dashboard in the session manager
    const dashboardUrl = `http://localhost:${this.actualPort}`;
    await this.sessionManager.registerDashboard(dashboardUrl, this.actualPort, process.pid);

    // Open browser if requested
    if (this.options.autoOpen) {
      await open(dashboardUrl);
    }

    return dashboardUrl;
  }

  private setupProjectManagerEvents() {
    // Broadcast projects update when projects change
    this.projectManager.on('projects-update', (projects) => {
      this.broadcastToAll({
        type: 'projects-update',
        data: { projects }
      });
    });

    // Broadcast deferral changes (deferred decisions and deferred specs). The
    // shell overview socket carries no fixed project, so the push reaches each
    // socket whose project matches or whose overview view is open, once per
    // socket (design D12, Requirement 7 AC 2).
    this.projectManager.on('deferral-change', async (event) => {
      try {
        const { projectId } = event;
        const project = this.projectManager.getProject(projectId);
        if (project) {
          this.sendToProjectOrOverview(projectId, {
            type: 'deferrals-update',
            projectId,
            data: await this.buildDeferralsPayload(project.projectPath)
          });
        }
      } catch (error) {
        console.error('Error broadcasting deferral changes:', error);
        // Don't propagate error to prevent event system crash
      }
    });
  }

  /**
   * Assemble the deferrals view: deferred decisions from the deferral store plus
   * whole specs marked deferred. Shared by the REST route and the WebSocket
   * broadcast so both always return the same shape.
   */
  private async buildDeferralsPayload(projectPath: string) {
    const storage = new DeferralStorage(projectPath);
    const indexGenerator = new IndexGenerator(projectPath);
    const [deferrals, duplicateGroups, deferredSpecs] = await Promise.all([
      storage.list(),
      storage.findDuplicateGroups(),
      indexGenerator.listDeferredSpecs(),
    ]);
    return { deferrals, duplicateGroups, deferredSpecs };
  }

  private registerApiRoutes() {
    // Health check / test endpoint (used by utils.ts to detect running dashboard)
    this.app.get('/api/test', async () => {
      return { message: DASHBOARD_TEST_MESSAGE };
    });

    // Controller health (controller-tasks.md T9, design §2/§8/§9). No auth —
    // T8's auth layer exempts this route, the watchdog and the staged
    // self-update smoke check both poll it with no credential. Never throws:
    // every read is best-effort so the route still answers while the home is
    // empty or a record is unreadable.
    this.app.get('/api/health', async () => {
      let slotsInUse = 0;
      try {
        slotsInUse = (await listRuns()).filter((r) => r.status === 'running').length;
      } catch {
        // No home yet, or an unreadable run record: report zero rather than 500.
      }
      const slotsTotal = Number(process.env.SDD_SLOTS) > 0 ? Number(process.env.SDD_SLOTS) : 2;

      let windows: unknown = null;
      try {
        windows = (await readRateLimit()) ?? null;
      } catch {
        windows = null;
      }

      return {
        ok: true,
        version: this.packageVersion,
        uptimeSeconds: Math.round(process.uptime()),
        pid: process.pid,
        slots: { inUse: slotsInUse, total: slotsTotal },
        windows,
        builtAt: await this.readBuiltAt(),
      };
    });

    // Projects list
    this.app.get('/api/projects/list', async () => {
      return this.projectManager.getProjectsList();
    });

    // Add project manually
    this.app.post('/api/projects/add', async (request, reply) => {
      const { projectPath } = request.body as { projectPath: string };
      if (!projectPath) {
        return reply.code(400).send({ error: 'projectPath is required' });
      }
      try {
        const projectId = await this.projectManager.addProjectByPath(projectPath);
        return { projectId, success: true };
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    });

    // Remove project
    this.app.delete('/api/projects/:projectId', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        await this.projectManager.removeProjectById(projectId);
        return { success: true };
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    });

    // Project info
    this.app.get('/api/projects/:projectId/info', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      const steeringStatus = await project.parser.getProjectSteeringStatus();
      return {
        projectId,
        projectName: project.projectName,
        projectPath: project.originalProjectPath,  // Return original path for display
        steering: steeringStatus,
        version: this.packageVersion
      };
    });

    // List deferred decisions (with detected duplicate groups) and deferred specs
    this.app.get('/api/projects/:projectId/deferrals', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }
      return await this.buildDeferralsPayload(project.projectPath);
    });

    // Per-spec task review summary
    this.app.get('/api/projects/:projectId/specs/:specName/task-reviews/summary', async (request, reply) => {
      const { projectId, specName } = request.params as { projectId: string; specName: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) return reply.code(404).send({ error: 'Project not found' });

      try {
        const specPath = join(project.projectPath, '.spec-workflow', 'specs', specName);
        const reviewManager = new TaskReviewManager(specPath);
        const allReviews = await reviewManager.loadAllReviews();

        // Group by taskId, keep latest version
        const summary: Record<string, { verdict: string; version: number; tdd?: TddBlock }> = {};
        for (const review of allReviews) {
          const existing = summary[review.taskId];
          if (!existing || review.version > existing.version) {
            summary[review.taskId] = { verdict: review.verdict, version: review.version, tdd: review.tdd };
          }
        }

        return { summary };
      } catch (error: any) {
        return reply.code(500).send({ error: error.message });
      }
    });

    // Shell spec detail panel (design C8). 404 for an unknown project or a bad,
    // missing or foreign spec name; otherwise the SpecDetail with no file content.
    this.app.get('/api/shell/projects/:projectId/specs/:specName', async (request, reply) => {
      const { projectId, specName } = request.params as { projectId: string; specName: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) return reply.code(404).send({ error: 'Project not found' });
      const detail = await buildSpecDetail(project, specName);
      if (!detail) return reply.code(404).send({ error: 'Spec not found' });
      return detail;
    });

    // ── Harness control-pane routes (design C7; Requirement 3) ──
    // These sit under the same global security hooks as every route above and add
    // no other check. No request-body text ever reaches a shell.

    // Read-only run-setup view.
    this.app.get('/api/projects/:projectId/harness/setup', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }
      return await buildSetupView(project);
    });

    // Save the run-setup file.
    this.app.put('/api/projects/:projectId/harness/setup', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      const input = request.body as SetupInput;
      const view = await buildSetupView(project);

      const notLaunchable = this.harnessNotLaunchable(view, input.spec);
      if (notLaunchable) {
        return reply.code(409).send({ error: 'not-launchable', reason: notLaunchable });
      }

      const validationError = validateSetup(input, view);
      if (validationError) {
        return reply.code(400).send(validationError);
      }

      const workflowRoot = join(project.projectPath, '.spec-workflow');
      const file = toRunFile(input, view, () => new Date());
      writeRunFile(workflowRoot, file);
      return { file };
    });

    // Launch = enqueue (controller-tasks.md T6). The launchability/routed-spec
    // check stays here; the controller's `enqueue` applies the run-level guards
    // (one run per spec store, no live run on the project). The saved setup is
    // written first so the supervisor step reads the operator's model/roles.
    this.app.post('/api/projects/:projectId/harness/launch', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      // Launch always records; a headless run cannot answer a gate (Carried R3-minor-2).
      const input: SetupInput = { ...(request.body as SetupInput), gates: 'record' };
      const view = await buildSetupView(project);

      const notLaunchable = this.harnessNotLaunchable(view, input.spec);
      if (notLaunchable) {
        return reply.code(409).send({ error: 'not-launchable', reason: notLaunchable });
      }

      const validationError = validateSetup(input, view);
      if (validationError) {
        return reply.code(400).send(validationError);
      }

      const workflowRoot = join(project.projectPath, '.spec-workflow');
      writeRunFile(workflowRoot, toRunFile(input, view, () => new Date()));

      try {
        const runId = await this.controller.enqueue({ projectId, spec: input.spec });
        return { runId };
      } catch (error: any) {
        return reply.code(409).send({ error: 'run-live', reason: error?.message || 'could not enqueue' });
      }
    });

    // Stop the running or stopping run for a project (Req 3 AC 9).
    this.app.post('/api/projects/:projectId/harness/stop', async (request, reply) => {
      const { projectId } = request.params as { projectId: string };
      const project = this.projectManager.getProject(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      const record = this.harnessLauncher.get(projectId);
      if (!record || (record.state !== 'running' && record.state !== 'stopping')) {
        return reply.code(404).send({ error: 'not-running' });
      }

      const launch = await this.harnessLauncher.stop(projectId);
      return { launch };
    });

    // ── Controller wait routes (controller-tasks.md T4; controller-design.md §7) ──
    // Under the same global security hooks as every route above; add nothing else.

    // Open and answered waits, newest first.
    this.app.get('/api/controller/waits', async () => {
      return { waits: await listWaitsForWire() };
    });

    // Answer one wait: body `{ answers: {questionId: value}, by }`.
    this.app.post('/api/controller/waits/:id/answer', async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { answers?: Record<string, string>; by?: string };
      const record = await answerWait(id, body.answers ?? {}, body.by ?? 'operator');
      if (!record) return reply.code(404).send({ error: 'wait-not-found' });
      return { ok: true };
    });

    // Attach an advisor's second opinion: body `{ advice }`.
    this.app.post('/api/controller/waits/:id/advice', async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { advice?: string };
      const record = await attachAdvice(id, body.advice ?? '');
      if (!record) return reply.code(404).send({ error: 'wait-not-found' });
      return { ok: true };
    });

    // ── Controller run routes (controller-tasks.md T6; controller-design.md §13) ──

    // Every controller run, path-free, newest first.
    this.app.get('/api/controller/runs', async () => {
      return { runs: await listRunsForWire() };
    });

    // Cancel a run: signal its in-flight step, abandon it, keep the worktree/branch/PR.
    this.app.post('/api/controller/runs/:id/cancel', async (request, reply) => {
      const { id } = request.params as { id: string };
      const run = await this.controller.cancel(id);
      if (!run) return reply.code(404).send({ error: 'run-not-found' });
      return { ok: true };
    });

    // Discard a run: cancel it, then remove the worktree, delete the branch, close the PR.
    this.app.post('/api/controller/runs/:id/discard', async (request, reply) => {
      const { id } = request.params as { id: string };
      const run = await this.controller.discard(id);
      if (!run) return reply.code(404).send({ error: 'run-not-found' });
      return { ok: true };
    });
  }

  /**
   * `builtAt` from `dist/build-info.json`, which `copy-static.cjs` writes at
   * build time (commit sha and ISO time). Read once and cached; `null` when the
   * file is missing or unreadable (a dev build run straight from `tsx`).
   */
  private async readBuiltAt(): Promise<string | null> {
    if (this.builtAt !== undefined) return this.builtAt;
    try {
      const raw = await readFile(join(__dirname, '..', 'build-info.json'), 'utf-8');
      const parsed = JSON.parse(raw) as { builtAt?: string };
      this.builtAt = parsed.builtAt ?? null;
    } catch {
      this.builtAt = null;
    }
    return this.builtAt;
  }

  /**
   * The reason a setup or launch is not launchable, or null when it is: a spec
   * store with no launchable spec gives its `disabledReason`; a request for any
   * spec other than the launchable one gives a sentence naming both (design C7).
   */
  private harnessNotLaunchable(view: SetupView, spec: string): string | null {
    if (view.launchable === null) {
      return view.disabledReason ?? 'No spec is launchable.';
    }
    if (view.launchable !== spec) {
      return `The launchable spec is ${view.launchable}, not ${spec}.`;
    }
    return null;
  }

  private broadcastToAll(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((connection) => {
      try {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(messageStr);
        }
      } catch (error) {
        console.error('Error broadcasting to client:', error);
        this.scheduleConnectionCleanup(connection);
      }
    });
  }

  /** Send to open clients whose harness view watches this project (design C7). */
  private sendToHarness(projectId: string, message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((connection) => {
      try {
        if (connection.socket.readyState === WebSocket.OPEN
          && connection.projectId === projectId
          && connection.views?.has('harness')) {
          connection.socket.send(messageStr);
        }
      } catch (error) {
        console.error('Error sending to harness client:', error);
        this.scheduleConnectionCleanup(connection);
      }
    });
  }

  /**
   * Send once to each open client whose project matches or whose overview view
   * is open (design D12, Requirement 7 AC 2). A single socket that both binds the
   * project and holds the overview view still receives the message exactly once.
   */
  private sendToProjectOrOverview(projectId: string, message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((connection) => {
      try {
        if (connection.socket.readyState === WebSocket.OPEN
          && (connection.projectId === projectId || connection.views?.has('overview'))) {
          connection.socket.send(messageStr);
        }
      } catch (error) {
        console.error('Error sending deferral update to client:', error);
        this.scheduleConnectionCleanup(connection);
      }
    });
  }

  /** Send to open clients whose overview view is open (design C7). */
  private sendToOverview(message: any) {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((connection) => {
      try {
        if (connection.socket.readyState === WebSocket.OPEN && connection.views?.has('overview')) {
          connection.socket.send(messageStr);
        }
      } catch (error) {
        console.error('Error sending to overview client:', error);
        this.scheduleConnectionCleanup(connection);
      }
    });
  }

  private scheduleConnectionCleanup(connection: WebSocketConnection) {
    // Use setImmediate to avoid modifying Set during iteration
    setImmediate(() => {
      try {
        this.clients.delete(connection);
        connection.socket.removeAllListeners();
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close();
        }
      } catch {
        // Ignore cleanup errors
      }
      // A cleaned-up connection may have been the last subscriber of a view (C7).
      void this.harnessHub.reconcile(this.clients);
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((connection) => {
        if (connection.socket.readyState === WebSocket.OPEN) {
          try {
            // Mark as waiting for pong
            connection.isAlive = false;
            connection.socket.ping();
          } catch {
            this.scheduleConnectionCleanup(connection);
          }
        }
      });

      // Check for dead connections after timeout
      setTimeout(() => {
        this.clients.forEach((connection) => {
          if (connection.isAlive === false) {
            console.error('Connection did not respond to heartbeat, cleaning up');
            this.scheduleConnectionCleanup(connection);
          }
        });
      }, this.HEARTBEAT_TIMEOUT_MS);
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  async stop() {
    // Stop heartbeat monitoring
    this.stopHeartbeat();

    // Close the harness watches before the clients; never stop a launched run (C7).
    this.harnessHub.close();

    // Release the controller lock and stop its scheduler; runs survive (§8).
    try {
      await this.controller.stop();
    } catch (error) {
      console.error('Failed to stop the controller:', error);
    }

    // Clear pending spec broadcasts
    for (const timeout of this.pendingSpecBroadcasts.values()) {
      clearTimeout(timeout);
    }
    this.pendingSpecBroadcasts.clear();

    // Close all WebSocket connections
    this.clients.forEach((connection) => {
      try {
        connection.socket.removeAllListeners();
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.close();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });
    this.clients.clear();

    // Stop project manager
    await this.projectManager.stop();

    // Close the Fastify server
    await this.app.close();

    // Unregister from the session manager
    try {
      await this.sessionManager.unregisterDashboard();
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  getUrl(): string {
    return `http://localhost:${this.actualPort}`;
  }
}
