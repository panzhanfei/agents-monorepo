import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentsConfigSchema,
  resolveAgentsConfigPath,
  type IAgentsConfig,
} from '@agents/agents-config';
import { loadMonorepoEnvFromEntry } from '@agents/logger';
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

  /** apps/agent-console/server → 往上三级仓库根 */
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
});

const pipelineInvokeBodySchema = z
  .object({
    text: z.string().min(1).max(200_000),
    channelId: z.string().min(1).optional(),
    parentMessageId: z.string().min(1).optional(),
    rootMessageId: z.string().min(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const validateAgentsYamlRaw = (
  yamlText: string
):
  | { ok: true; data: IAgentsConfig }
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
): Promise<{ backupPath?: string }> => {
  let backupPath: string | undefined;

  if (fsSync.existsSync(yamlPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${yamlPath}.bak.${stamp}`;
    await fs.copyFile(yamlPath, backupPath);
  }

  await fs.writeFile(
    yamlPath,
    `${YAML.stringify(data, {
      indent: 2,
      lineWidth: 0,
    })}\n`,
    'utf8'
  );
  return { backupPath };
};

const targetProjectsPutSchema = z
  .object({
    defaultProjectId: z.string().min(1).optional(),
    defaultBranch: z.string().optional(),
    source: z.enum(['git', 'local']).optional(),
    workspacePath: z.string().optional(),
    gitRepoUrl: z.string().optional(),
    projects: z
      .array(
        z
          .object({
            id: z
              .string()
              .min(1)
              .regex(/^[a-zA-Z0-9][-a-zA-Z0-9_]*$/),
            workspacePath: z.string().min(1),
            label: z.string().optional(),
          })
          .strict()
      )
      .min(1),
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
      res.json({
        ok: true,
        yamlPath,
        yamlRaw: raw,
        parsedUnknown: parsed,
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
      const { backupPath } = await writeValidatedAgentsYaml(
        yamlPath,
        result.data
      );
      const rawOut = await fs.readFile(yamlPath, 'utf8');
      res.json({
        ok: true,
        yamlPath,
        backupPath,
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

      const nextTarget: Record<string, unknown> = {
        ...(prevTarget ?? {}),
      };

      if (parsed.data.source !== undefined)
        nextTarget.source = parsed.data.source;
      if (parsed.data.workspacePath !== undefined)
        nextTarget.workspacePath = parsed.data.workspacePath;
      if (parsed.data.gitRepoUrl !== undefined)
        nextTarget.gitRepoUrl = parsed.data.gitRepoUrl;
      if (parsed.data.defaultBranch !== undefined)
        nextTarget.defaultBranch = parsed.data.defaultBranch;
      if (parsed.data.defaultProjectId !== undefined)
        nextTarget.defaultProjectId = parsed.data.defaultProjectId;
      nextTarget.projects = parsed.data.projects;

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

      const { backupPath } = await writeValidatedAgentsYaml(
        yamlPath,
        valid.data
      );

      const rawOut = await fs.readFile(yamlPath, 'utf8');

      res.json({
        ok: true,
        yamlPath,
        backupPath,
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
          messages: parsed.data.messages,
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

      const url = `${base}/v1/mock-feishu`;
      const body: Record<string, unknown> = {
        text: parsed.data.text,
        ...(parsed.data.channelId !== undefined
          ? { channelId: parsed.data.channelId }
          : {}),
        ...(parsed.data.parentMessageId !== undefined
          ? { parentMessageId: parsed.data.parentMessageId }
          : {}),
        ...(parsed.data.rootMessageId !== undefined
          ? { rootMessageId: parsed.data.rootMessageId }
          : {}),
        ...(parsed.data.metadata !== undefined
          ? { metadata: parsed.data.metadata }
          : {}),
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
