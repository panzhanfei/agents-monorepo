import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  CUSTOMER_TARGETS_ROOT_REL,
  TARGET_PROJECT_ID_RE,
} from '@agents/agents-config';
import type { Express } from 'express';
import multer from 'multer';

const RULE_EXT = new Set(['.md', '.mdc']);

const fileExists = async (abs: string): Promise<boolean> => {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
};

const sanitizeRuleBasename = (originalName: string): string => {
  const base = path.basename(originalName.trim());
  const ext = path.extname(base).toLowerCase();
  if (!RULE_EXT.has(ext)) {
    throw new Error(`仅允许 .md / .mdc 文件名后缀`);
  }

  const stemRaw = path.basename(base, ext);
  const stem = stemRaw
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
  const safeStem = stem === '' ? 'rules' : stem.slice(0, 160);

  return `${safeStem}${ext}`;
};

const uniqueDestName = async (
  dirAbs: string,
  wanted: string,
): Promise<string> => {
  let candidate = wanted;
  let n = 1;
  const ext = path.extname(wanted);
  const stem = path.basename(wanted, ext);

  while (await fileExists(path.join(dirAbs, candidate))) {
    candidate = `${stem}-${String(n)}${ext}`;
    n += 1;
  }
  return candidate;
};

const resolveAiRulesDirAbs = (
  monorepoRoot: string,
  projectId: string,
): string =>
  path.join(
    monorepoRoot,
    ...CUSTOMER_TARGETS_ROOT_REL.split('/').filter(Boolean),
    projectId,
    CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  );

const isContainedInDirectory = (
  ancestorAbs: string,
  maybeDescendantAbs: string,
): boolean => {
  const anc = path.resolve(ancestorAbs);
  const des = path.resolve(maybeDescendantAbs);
  const rel = path.relative(anc, des);
  return !rel.startsWith(`..${path.sep}`) && rel !== '..';
};

const validateProjectParam = (
  raw: string | undefined,
): { ok: true; id: string } | { ok: false } => {
  const id = raw?.trim() ?? '';
  return id !== '' && TARGET_PROJECT_ID_RE.test(id)
    ? { ok: true, id }
    : { ok: false };
};

export const registerTargetAiRulesRoutes = (opts: {
  readonly app: Express;
  readonly monorepoRoot: string;
}): void => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 32,
      fileSize: 2 * 1024 * 1024,
      fieldSize: 128,
      fields: 2,
      parts: 40,
    },
  });

  opts.app.get(
    '/api/target-projects/:projectId/ai-rules',
    async (req, res, next): Promise<void> => {
      try {
        const idCheck = validateProjectParam(req.params.projectId);
        if (!idCheck.ok) {
          res.status(400).json({ ok: false, message: '无效的目标 id' });
          return;
        }

        const dirAbs = resolveAiRulesDirAbs(opts.monorepoRoot, idCheck.id);
        await fs.mkdir(dirAbs, { recursive: true });

        let names: string[] = [];
        try {
          const dirents = await fs.readdir(dirAbs, { withFileTypes: true });
          names = dirents.filter((e) => e.isFile()).map((e) => e.name);
        } catch {
          names = [];
        }

        const listed: { readonly name: string; readonly sizeBytes: number }[] =
          [];

        for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
          if (/\.(md|mdc)$/i.test(name) === false || name.includes('..')) {
            continue;
          }
          try {
            const st = await fs.stat(path.join(dirAbs, name));
            if (st.isFile()) {
              listed.push({ name, sizeBytes: st.size });
            }
          } catch {
            /* ignore */
          }
        }

        res.json({ ok: true, files: listed });
      } catch (e) {
        next(e);
      }
    },
  );

  opts.app.post(
    '/api/target-projects/:projectId/ai-rules',
    (req, res, next) => {
      void upload.array('files', 32)(req, res, (multerErr: unknown) => {
        if (multerErr !== undefined) {
          let status = 400;
          let msg =
            multerErr instanceof Error ? multerErr.message : String(multerErr);
          if (multerErr instanceof multer.MulterError) {
            msg = multerErr.message;
            if (multerErr.code === 'LIMIT_FILE_SIZE') {
              status = 413;
              msg = '单文件超过 2MiB 或未满足 multer limits';
            }
          }
          res.status(status).json({ ok: false, message: msg });
          return;
        }
        next();
      });
    },
    async (req, res, next): Promise<void> => {
      try {
        const idCheck = validateProjectParam(req.params.projectId);
        if (!idCheck.ok) {
          res.status(400).json({ ok: false, message: '无效的目标 id' });
          return;
        }

        const list = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (list.length === 0) {
          res.status(400).json({
            ok: false,
            message: '未收到文件（字段名 files）',
          });
          return;
        }

        const dirAbs = resolveAiRulesDirAbs(opts.monorepoRoot, idCheck.id);
        await fs.mkdir(dirAbs, { recursive: true });

        const written: string[] = [];

        for (const f of list) {
          const fallbackName =
            path.extname(f.originalname ?? '').toLowerCase() === '.md'
              ? 'rules.md'
              : 'rules.mdc';
          const nameIn =
            typeof f.originalname === 'string' && f.originalname.trim() !== ''
              ? f.originalname
              : fallbackName;

          const wanted = sanitizeRuleBasename(nameIn);
          const dest = await uniqueDestName(dirAbs, wanted);

          await fs.writeFile(path.join(dirAbs, dest), f.buffer, 'utf8');

          written.push(dest);
        }

        res.json({ ok: true, writtenNames: written });
      } catch (e) {
        next(e instanceof Error ? e : new Error(String(e)));
      }
    },
  );

  opts.app.delete(
    '/api/target-projects/:projectId/ai-rules/:fileName',
    async (req, res, next): Promise<void> => {
      try {
        const idCheck = validateProjectParam(req.params.projectId);
        if (!idCheck.ok) {
          res.status(400).json({ ok: false, message: '无效的目标 id' });
          return;
        }

        const rawName = decodeURIComponent(req.params.fileName ?? '').trim();
        const bn = path.basename(rawName);

        if (bn.includes('..') || /\.(md|mdc)$/i.test(bn) === false) {
          res.status(400).json({
            ok: false,
            message: '非法文件名或非 .md／.mdc',
          });
          return;
        }

        const dirAbs = resolveAiRulesDirAbs(opts.monorepoRoot, idCheck.id);
        const abs = path.resolve(dirAbs, bn);
        if (!isContainedInDirectory(dirAbs, abs)) {
          res.status(400).json({ ok: false, message: '非法路径' });
          return;
        }

        if (!(await fileExists(abs))) {
          res.status(404).json({ ok: false, message: '文件不存在' });
          return;
        }

        await fs.unlink(abs);

        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
};
