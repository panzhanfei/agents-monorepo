import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Express } from 'express';
import { z } from 'zod';

export const parseDotEnvToMap = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) !== true) {
      continue;
    }
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
};

export const formatEnvRawValue = (value: string): string => {
  if (value === '') {
    return '';
  }
  if (/[\r\n"\\]/.test(value) || /^\s|\s$/.test(value) || value.includes('#')) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return value;
};

export const mergeEnvFileContent = (
  existingRaw: string,
  updates: Record<string, string>
): string => {
  const keyRe = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;
  const usedKeys = new Set<string>();

  if (existingRaw.trim() === '') {
    const body = Object.entries(updates)
      .map(([k, v]) => `${k}=${formatEnvRawValue(v)}`)
      .join('\n');
    return body === '' ? '' : `${body}\n`;
  }

  const lines = existingRaw.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) {
      out.push(line);
      continue;
    }
    const m = keyRe.exec(line);
    if (m === null || m[1] === undefined) {
      out.push(line);
      continue;
    }
    const key = m[1];
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      usedKeys.add(key);
      out.push(`${key}=${formatEnvRawValue(updates[key] ?? '')}`);
    } else {
      out.push(line);
    }
  }

  const append: string[] = [];
  for (const [k, v] of Object.entries(updates)) {
    if (!usedKeys.has(k)) {
      append.push(`${k}=${formatEnvRawValue(v)}`);
    }
  }

  if (append.length === 0) {
    return out.join('\n');
  }
  const needsGap = out.length > 0 && out[out.length - 1] !== '';
  return `${out.join('\n')}${needsGap ? '\n\n' : '\n'}${append.join('\n')}\n`;
};

const putBodySchema = z
  .object({
    values: z.record(z.string(), z.string()),
  })
  .strict();

export const registerConsoleEnvRoutes = (opts: {
  readonly app: Express;
  readonly monorepoRoot: string;
}): void => {
  const { app, monorepoRoot } = opts;

  app.get('/api/console-env', async (_req, res, next) => {
    try {
      const envPath = path.join(monorepoRoot, '.env');
      let raw = '';
      try {
        raw = await fs.readFile(envPath, 'utf8');
      } catch (e) {
        if (
          e instanceof Error &&
          'code' in e &&
          (e as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          raw = '';
        } else {
          throw e;
        }
      }
      const values = parseDotEnvToMap(raw);
      res.json({ ok: true, envPath, exists: fsSync.existsSync(envPath), values });
    } catch (e) {
      next(e);
    }
  });

  app.put('/api/console-env', async (req, res, next) => {
    try {
      const parsed = putBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          ok: false,
          message: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        });
        return;
      }

      const envPath = path.join(monorepoRoot, '.env');
      let existingRaw = '';
      try {
        existingRaw = await fs.readFile(envPath, 'utf8');
      } catch (e) {
        if (
          e instanceof Error &&
          'code' in e &&
          (e as NodeJS.ErrnoException).code === 'ENOENT'
        ) {
          existingRaw = '';
        } else {
          throw e;
        }
      }

      let backupPath: string | undefined;
      if (fsSync.existsSync(envPath)) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        backupPath = `${envPath}.bak.${stamp}`;
        await fs.copyFile(envPath, backupPath);
      }

      const merged = mergeEnvFileContent(existingRaw, parsed.data.values);
      await fs.mkdir(path.dirname(envPath), { recursive: true });
      await fs.writeFile(envPath, merged, 'utf8');

      const values = parseDotEnvToMap(merged);
      res.json({
        ok: true,
        envPath,
        backupPath,
        values,
      });
    } catch (e) {
      next(e);
    }
  });
};
