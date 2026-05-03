import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentsConfigSchema,
  CUSTOMER_TARGETS_ROOT_REL,
  loadAgentsConfig,
  lookupTargetProjectById,
  relativeCustomerTargetDefinitionPath,
  resolveAgentsConfigPath,
  targetProjectEntrySchema,
  TARGET_PROJECT_ID_RE,
  type IAgentsConfigParsed,
} from '@agents/agents-config';
import {
  AGENTS_PIPELINE_CONSOLE_INBOUND_KIND,
  AGENTS_PIPELINE_INBOUND_KIND_META_KEY,
} from '@agents/pipeline-core';
import { loadMonorepoEnvFromEntry } from '@agents/logger';
import { registerConsoleEnvRoutes } from './console-env.js';
import { registerTargetAiRulesRoutes } from './target-ai-rules-routes.js';
import express from 'express';
import YAML from 'yaml';
import { z, type ZodIssue } from 'zod';

loadMonorepoEnvFromEntry(import.meta.url);

const deriveMonorepoRootFromEntry = (): string => {
  const override = process.env.AGENTS_MONOREPO_ROOT?.trim();
  if (override !== undefined && override !== '') {
    return path.resolve(override);
  }

  const dir = path.dirname(fileURLToPath(import.meta.url));

  const fromDistMatch = dir.match(/\/dist\/server$/);
  if (fromDistMatch !== null && fromDistMatch[0]) {
    return path.resolve(dir, '..', '..', '..');
  }

  return path.resolve(dir, '..', '..', '..');
};

const monorepoRoot = deriveMonorepoRootFromEntry();
const PORT = Number(process.env.AGENT_CONSOLE_API_PORT ?? '5280');
const OPTIONAL_TOKEN = process.env.AGENT_CONSOLE_API_TOKEN?.trim();

const chatStreamBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1).max(200_000),
    })
  ).min(1),
  targetProjectId: z
    .string()
    .min(1)
    .max(120)
    .regex(TARGET_PROJECT_ID_RE)
    .optional(),
});

const pipelineInvokeBodySchema = z
  .object({
    text: z.string().min(1).max(200_000),
    channelId: z.string().min(1).optional(),
    /** 与飞书事件一致：对用户这条消息 reply，优先于占位 channelId */
    inboundMessageId: z.string().min(1).optional(),
    parentMessageId: z.string().min(1).optional(),
    rootMessageId: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const validateAgentsYamlRaw = (
  yamlText: string
):
  | { ok: true; data: IAgentsConfigParsed }
  | { ok: false; errors: readonly string[] } => {
  let parsedUnknown: unknown;
  try {
    parsedUnknown = YAML.parse(yamlText);
  } catch (e) {
    return {
      ok: false,
      errors: [`YAML 解析失败：${e instanceof Error ? e.message : String(e)}`],
    };
  }

  const zod = agentsConfigSchema.safeParse(parsedUnknown);
  if (!zod.success) {
    return {
      ok: false,
      errors: zod.error.issues.map(
        (i: ZodIssue) => `${i.path.join('.')}: ${i.message}`
      ),
    };
  }

  return { ok: true, data: zod.data };
};

const writeValidatedAgentsYaml = async (
  yamlPath: string,
  data: unknown
): Promise<void> => {
  await fs.writeFile(
    yamlPath,
    `${YAML.stringify(data, {
      indent: 2,
      lineWidth: 0,
    })}\n`,
    'utf8'
  );
};

const TARGET_DEFINITION_OPTIONAL_KEYS = [
  'label',
  'gitRepoUrl',
  'defaultBranch',
  'packBuildOutputDir',
  'deployRemotePath',
  'deploySshHost',
  'deploySshUser',
  'deploySshPort',
  'probeListenPorts',
  'publishCommand',
  'fullTestCommand',
] as const;

const targetDefinitionDocFromEntry = (
  p: z.infer<typeof targetProjectEntrySchema>,
): Record<string, unknown> => {
  const doc: Record<string, unknown> = {
    id: p.id,
    workspacePath: p.workspacePath.trim(),
  };
  for (const k of TARGET_DEFINITION_OPTIONAL_KEYS) {
    const v = p[k];
    if (typeof v === 'string' && v.trim() !== '') {
      doc[k] = v.trim();
    }
  }
  if (p.workspaceLifecycle === 'greenfield') {
    doc.workspaceLifecycle = 'greenfield';
  }
  return doc;
};

const targetProjectsPutSchema = z
  .object({
    defaultProjectId: z.string().min(1).optional(),
    defaultBranch: z.string().optional(),
    workspacePath: z.string().optional(),
    gitRepoUrl: z.string().optional(),
    projects: z.array(targetProjectEntrySchema).min(1),
  })
  .strict();

export const createApp = (): express.Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  const authGuard: express.RequestHandler = (req, res, next) => {
    const noAuth =
      req.path.endsWith('/health') === true ||
      req.path === '/feishu-log-stream';
    if (
      OPTIONAL_TOKEN === undefined ||
      OPTIONAL_TOKEN === '' ||
      noAuth === true
    ) {
      next();
      return;
    }
    const auth = req.headers.authorization?.trim() ?? '';
    if (auth !== `Bearer ${OPTIONAL_TOKEN}`) {
      res.status(401).json({
        message:
          '需要 Authorization: Bearer <AGENT_CONSOLE_API_TOKEN>（与进程环境同名变量一致）。',
      });
      return;
    }
    next();
  };

  app.use('/api', authGuard);

  registerTargetAiRulesRoutes({ app, monorepoRoot });

  app.get(['/health', '/api/health'], (_req, res) => {
    res.json({ ok: true, service: 'agent-console-api' });
  });

  app.get('/api/feishu-log-stream', async (req, res, next) => {
    try {
      const port = process.env.ORCHESTRATOR_PORT?.trim() ?? '4010';
      const baseOverride = process.env.AGENTS_ORCHESTRATOR_URL?.trim() ?? '';
      const base =
        baseOverride !== ''
          ? baseOverride.replace(/\/$/, '')
          : `http://127.0.0.1:${port}`;

      const upstreamUrl = `${base}/v1/console/feishu-log-stream`;
      const ac = new AbortController();

      req.on('close', () => {
        ac.abort();
      });

      const upstream = await fetch(upstreamUrl, {
        headers: { Accept: 'text/event-stream' },
        signal: ac.signal,
      });

      if (!upstream.ok) {
        res
          .status(502)
          .type('text/plain')
          .send(
            `编排器飞书日志流不可用（HTTP ${String(upstream.status)}），请确认 orchestrator 已启动。`
          );
        return;
      }

      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      if (upstream.body === null) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();

      const pump = (): void => {
        void reader
          .read()
          .then(({ done, value }) => {
            if (ac.signal.aborted === true) {
              return;
            }
            if (done === true) {
              res.end();
              return;
            }
            if (value !== undefined && value.byteLength > 0) {
              res.write(Buffer.from(value));
            }
            pump();
          })
          .catch(() => {
            if (res.writableEnded !== true) {
              res.destroy();
            }
          });
      };

      pump();
    } catch (e) {
      if (req.closed === true) {
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (res.headersSent !== true) {
        res
          .status(502)
          .type('text/plain')
          .send(`飞书日志流连接失败：${msg}`);
        return;
      }
      next(e);
    }
  });

  app.get('/api/config', async (_req, res, next) => {
    try {
      const yamlPath = resolveAgentsConfigPath(monorepoRoot);
      const raw = await fs.readFile(yamlPath, 'utf8');
      const parsed = YAML.parse(raw);
      let parsedHydrated: unknown | undefined;
      try {
        const hydrated = await loadAgentsConfig({ monorepoRoot });
        const tRaw =
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          (parsed as Record<string, unknown>).target !== undefined &&
          typeof (parsed as Record<string, unknown>).target === 'object' &&
          (parsed as Record<string, unknown>).target !== null
            ? ({
                ...(parsed as Record<string, unknown>).target as Record<
                  string,
                  unknown
                >
              })
            : undefined;
        parsedHydrated =
          tRaw !== undefined
            ? {
                ...parsed,
                target: {
                  ...tRaw,
                  projects: hydrated.target?.projects,
                },
              }
            : parsed;
      } catch {
        parsedHydrated = undefined;
      }
      res.json({
        ok: true,
        yamlPath,
        yamlRaw: raw,
        parsedUnknown: parsed,
        parsedHydrated,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/config/validate', (req, res) => {
    const body = typeof req.body?.yaml === 'string' ? req.body.yaml : '';
    const result = validateAgentsYamlRaw(body);
    res.json(result.ok ? result : { ok: false, errors: [...result.errors] });
  });

  app.put('/api/config', async (req, res, next) => {
    try {
      const body = typeof req.body?.yaml === 'string' ? req.body.yaml : '';
      const result = validateAgentsYamlRaw(body);
      if (!result.ok) {
        res.status(400).json({ ok: false, errors: [...result.errors] });
        return;
      }
      const yamlPath = resolveAgentsConfigPath(monorepoRoot);
      await writeValidatedAgentsYaml(yamlPath, result.data);
      const rawOut = await fs.readFile(yamlPath, 'utf8');
      res.json({
        ok: true,
        yamlPath,
        yamlRaw: rawOut,
      });
    } catch (e) {
      next(e);
    }
  });

  app.put('/api/config/target-projects', async (req, res, next) => {
    try {
      const parsed = targetProjectsPutSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          errors: parsed.error.issues.map(
            (i) => `${i.path.join('.')}: ${i.message}`
          ),
        });
        return;
      }

      const yamlPath = resolveAgentsConfigPath(monorepoRoot);
      const rawExisting = await fs.readFile(yamlPath, 'utf8');
      let docUnknown: unknown;
      try {
        docUnknown = YAML.parse(rawExisting);
      } catch (e) {
        res.status(500).json({
          ok: false,
          errors: [
            `无法解析现有 YAML：${e instanceof Error ? e.message : String(e)}`,
          ],
        });
        return;
      }

      const doc = docUnknown as Record<string, unknown>;
      const prevTarget = doc.target as Record<string, unknown> | undefined;

      const customerTargetsRoot = path.join(
        monorepoRoot,
        ...CUSTOMER_TARGETS_ROOT_REL.split('/').filter(Boolean),
      );

      for (const proj of parsed.data.projects) {
        const projDir = path.join(customerTargetsRoot, proj.id.trim());
        await fs.mkdir(projDir, { recursive: true });

        const absDef = path.join(
          projDir,
          'target.yaml',
        );
        const defDoc = targetDefinitionDocFromEntry(proj);
        await fs.writeFile(
          absDef,
          `${YAML.stringify(defDoc, {
            indent: 2,
            lineWidth: 0,
          })}\n`,
          'utf8',
        );
      }

      const stubProjects = parsed.data.projects.map((proj) => ({
        id: proj.id,
        definitionPath: relativeCustomerTargetDefinitionPath(proj.id),
      }));

      const nextTarget: Record<string, unknown> = {
        ...(prevTarget ?? {}),
      };

      if (parsed.data.workspacePath !== undefined)
        nextTarget.workspacePath = parsed.data.workspacePath;
      if (parsed.data.gitRepoUrl !== undefined)
        nextTarget.gitRepoUrl = parsed.data.gitRepoUrl;
      if (parsed.data.defaultBranch !== undefined)
        nextTarget.defaultBranch = parsed.data.defaultBranch;
      if (parsed.data.defaultProjectId !== undefined)
        nextTarget.defaultProjectId = parsed.data.defaultProjectId;
      nextTarget.projects = stubProjects;

      const nextDoc = { ...doc, target: nextTarget };
      const valid = agentsConfigSchema.safeParse(nextDoc);
      if (!valid.success) {
        res.status(400).json({
          ok: false,
          errors: valid.error.issues.map(
            (i: ZodIssue) => `${i.path.join('.')}: ${i.message}`
          ),
        });
        return;
      }

      await writeValidatedAgentsYaml(yamlPath, valid.data);

      const rawOut = await fs.readFile(yamlPath, 'utf8');

      res.json({
        ok: true,
        yamlPath,
        yamlRaw: rawOut,
      });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/chat/stream', async (req, res, next) => {
    try {
      const parsed = chatStreamBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
        return;
      }

      const baseUrl = process.env.LLM_BASE_URL?.trim() ?? '';
      const apiKeyRaw = process.env.LLM_API_KEY?.trim() ?? '';
      const apiKey = apiKeyRaw.replace(/^Bearer\s+/i, '').trim();
      const model = process.env.LLM_MODEL?.trim() ?? '';

      if (baseUrl === '') {
        res.status(503).json({
          message:
            '服务端未配置 LLM_BASE_URL。请在仓库根 `.env` 配置（与各 agent 同源）。',
        });
        return;
      }

      if (model === '') {
        res.status(503).json({
          message: '服务端未配置 LLM_MODEL。',
        });
        return;
      }

      let outboundMessages = parsed.data.messages;
      const pickTid = parsed.data.targetProjectId?.trim();
      if (pickTid !== undefined && pickTid !== '') {
        try {
          const agentsCfg = await loadAgentsConfig({ monorepoRoot });
          const hit = lookupTargetProjectById(agentsCfg, pickTid);
          if (hit === undefined) {
            res.status(400).json({
              message: `未知目标项目 id：${pickTid}（请检查 agents 配置中的 target.projects）`,
            });
            return;
          }
          const absWs = path.isAbsolute(hit.workspacePath)
            ? hit.workspacePath
            : path.resolve(monorepoRoot, hit.workspacePath);
          const label = hit.label?.trim() ?? '';
          outboundMessages = [
            {
              role: 'system' as const,
              content: [
                '当前会话在控制台中选定了如下「目标项目」上下文（与用户所选下拉框一致）：',
                `- id：${hit.id}`,
                label !== '' ? `- 名称：${label}` : null,
                `- 工作区路径：${absWs}`,
                '',
                '回答时请优先围绕该项目的需求、代码与运维语境；不要臆造未给出的仓库细节。',
              ]
                .filter((s) => s !== null)
                .join('\n'),
            },
            ...parsed.data.messages,
          ];
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          res.status(503).json({
            message: `加载 agents 配置失败，无法解析目标项目：${msg.slice(0, 320)}`,
          });
          return;
        }
      }

      const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey !== ''
            ? { Authorization: `Bearer ${apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model,
          messages: outboundMessages,
          stream: true,
        }),
      });

      if (!upstream.ok) {
        let errSnippet = upstream.statusText;
        try {
          errSnippet =
            upstream.body !== null ? await upstream.text() : errSnippet;
        } catch {
          /* ignore */
        }
        res.status(502).json({
          message: `上游 LLM 错误 ${String(upstream.status)}：${errSnippet.slice(0, 400)}`,
        });
        return;
      }

      if (upstream.body === null) {
        res.status(502).json({ message: '上游 LLM 未返回可读 body' });
        return;
      }

      res.setHeader(
        'Content-Type',
        upstream.headers.get('content-type') ?? 'text/event-stream'
      );
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body.getReader();
      const pump = (): void => {
        void reader
          .read()
          .then(({ done, value }) => {
            if (done === true) {
              res.end();
              return;
            }

            if (value !== undefined && value.byteLength > 0) {
              res.write(Buffer.from(value));
            }
            pump();
          })
          .catch((e: unknown) => {
            const msg = e instanceof Error ? e.message : String(e);

            res.destroy(new Error(msg));
          });
      };

      pump();
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/pipeline/invoke', async (req, res, next) => {
    try {
      const parsed = pipelineInvokeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          message: parsed.error.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        });
        return;
      }

      const port = process.env.ORCHESTRATOR_PORT?.trim() ?? '4010';
      const baseOverride = process.env.AGENTS_ORCHESTRATOR_URL?.trim() ?? '';
      const base =
        baseOverride !== ''
          ? baseOverride.replace(/\/$/, '')
          : `http://127.0.0.1:${port}`;

      const mergedMetadata: Record<string, unknown> = {
        ...(parsed.data.metadata ?? {}),
        [AGENTS_PIPELINE_INBOUND_KIND_META_KEY]:
          AGENTS_PIPELINE_CONSOLE_INBOUND_KIND,
      };

      const url = `${base}/v1/mock-feishu`;
      const body: Record<string, unknown> = {
        text: parsed.data.text,
        ...(parsed.data.channelId !== undefined
          ? { channelId: parsed.data.channelId }
          : {}),
        ...(parsed.data.inboundMessageId !== undefined
          ? { inboundMessageId: parsed.data.inboundMessageId }
          : {}),
        ...(parsed.data.parentMessageId !== undefined
          ? { parentMessageId: parsed.data.parentMessageId }
          : {}),
        ...(parsed.data.rootMessageId !== undefined
          ? { rootMessageId: parsed.data.rootMessageId }
          : {}),
        metadata: mergedMetadata,
      };

      const upstream = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const rawText = await upstream.text();
      let json: unknown;
      try {
        json = JSON.parse(rawText) as unknown;
      } catch {
        res.status(502).json({
          ok: false,
          message: `编排器返回非 JSON（HTTP ${String(upstream.status)}）：${rawText.slice(0, 500)}`,
        });
        return;
      }

      res.status(upstream.status).json(json);
    } catch (e) {
      next(e);
    }
  });

  registerConsoleEnvRoutes({ app, monorepoRoot });

  const clientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'client'
  );

  if (process.env.NODE_ENV === 'production' && fsSync.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*$/, (_req, res) => {
      void res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(
    (
      err: unknown,
      req: express.Request,
      res: express.Response,
      nextLayer: express.NextFunction
    ) => {
      if (res.headersSent === true) {
        nextLayer(err);
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);

      const status = /^ENOENT\b/.test(msg) ? 404 : 500;

      if (req.path.startsWith('/api')) {
        res.status(status).json({ message: msg });
        return;
      }

      res.status(status).type('text/plain').send(msg);
    }
  );
  return app;
};

const boot = (): void => {
  const app = createApp();
  app.listen(PORT, '127.0.0.1', () => {
    process.stderr.write(`agent-console API http://127.0.0.1:${PORT}\n`);
    process.stderr.write(`monorepo root: ${monorepoRoot}\n`);
  });
};

boot();
