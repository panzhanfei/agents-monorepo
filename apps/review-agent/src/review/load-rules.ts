import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

const TEXT_EXT = new Set([
  '.md',
  '.mdc',
  '.txt',
  '.yaml',
  '.yml',
  '.json',
]);

export type IRuleLoaderLogger = {
  readonly warn: (msg: string, meta?: Record<string, unknown>) => void;
};

const isInsideWorkspace = (
  workspaceRoot: string,
  absolutePath: string,
): boolean => {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(absolutePath);
  const rel = path.relative(root, target);
  return (
    !rel.startsWith(`..${path.sep}`) &&
    rel !== '..' &&
    !path.isAbsolute(rel)
  );
};

export const loadReviewRulesBundle = async (opts: {
  workspaceRoot: string;
  aiRulesGlob: string;
  customerRulesDir: string;
  extraRelativeFiles: readonly string[];
  monorepoRoot?: string;
  orchestrationRuleDirs?: readonly string[];
  workspaceRuleTreesSkipped?: boolean;
  maxChars: number;
  logger?: IRuleLoaderLogger;
}): Promise<string> => {
  const chunks: string[] = [];
  let total = 0;

  const push = (title: string, body: string): void => {
    const segment = `\n\n### FILE: ${title}\n\n${body}`;
    if (total + segment.length > opts.maxChars) {
      opts.logger?.warn('review_rules_truncated', { title });
      return;
    }
    chunks.push(segment);
    total += segment.length;
  };

  const readUnderContainedRoot = async (
    containmentRoot: string,
    absPath: string,
    title: string,
  ): Promise<void> => {
    if (!isInsideWorkspace(containmentRoot, absPath)) {
      opts.logger?.warn('review_rules_skip_traversal', { title });
      return;
    }
    try {
      const body = await fs.readFile(absPath, 'utf8');
      push(title, body);
    } catch (e) {
      opts.logger?.warn('review_rules_read_failed', {
        title,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const skipWorkspaceTrees = opts.workspaceRuleTreesSkipped === true;

  if (!skipWorkspaceTrees) {
    const aiRelPaths = await fg(opts.aiRulesGlob, {
      cwd: opts.workspaceRoot,
      onlyFiles: true,
      dot: true,
      ignore: ['**/node_modules/**'],
    });

    for (const rel of aiRelPaths.slice(0, 400)) {
      const abs = path.resolve(opts.workspaceRoot, rel);
      await readUnderContainedRoot(opts.workspaceRoot, abs, rel);
    }

    const custRoot = path.resolve(opts.workspaceRoot, opts.customerRulesDir);
    if (isInsideWorkspace(opts.workspaceRoot, custRoot)) {
      let custRelPaths: string[] = [];
      try {
        custRelPaths = await fg('**/*', {
          cwd: custRoot,
          onlyFiles: true,
          dot: true,
          ignore: ['**/node_modules/**'],
        });
      } catch {
        custRelPaths = [];
      }
      for (const cr of custRelPaths.slice(0, 400)) {
        const ext = path.extname(cr).toLowerCase();
        if (ext !== '' && !TEXT_EXT.has(ext)) {
          continue;
        }
        const abs = path.resolve(custRoot, cr);
        const title = path.join(opts.customerRulesDir, cr);
        await readUnderContainedRoot(opts.workspaceRoot, abs, title);
      }
    }

    for (const rel of opts.extraRelativeFiles.slice(0, 80)) {
      const abs = path.resolve(opts.workspaceRoot, rel);
      await readUnderContainedRoot(opts.workspaceRoot, abs, rel);
    }
  }

  const monoRaw = opts.monorepoRoot?.trim() ?? '';
  const orchDirs = opts.orchestrationRuleDirs ?? [];
  if (monoRaw !== '' && orchDirs.length > 0) {
    const monoAbs = path.resolve(monoRaw);
    for (const dirRaw of orchDirs) {
      const orchAbs = path.resolve(dirRaw);
      if (!isInsideWorkspace(monoAbs, orchAbs)) {
        opts.logger?.warn('review_rules_skip_orchestration_dir', {
          dir: orchAbs,
        });
        continue;
      }
      let dirStat;
      try {
        dirStat = await fs.stat(orchAbs);
      } catch {
        continue;
      }
      if (!dirStat.isDirectory()) {
        continue;
      }
      const relTitlesBase = path.relative(monoAbs, orchAbs);
      let orchRelPaths: string[] = [];
      try {
        orchRelPaths = await fg(`**/*`, {
          cwd: orchAbs,
          onlyFiles: true,
          dot: true,
          ignore: ['**/node_modules/**'],
        });
      } catch {
        orchRelPaths = [];
      }
      for (const cr of orchRelPaths.slice(0, 400)) {
        const ext = path.extname(cr).toLowerCase();
        if (ext !== '' && !TEXT_EXT.has(ext)) {
          continue;
        }
        const abs = path.resolve(orchAbs, cr);
        const titleParts = [
          relTitlesBase.split(path.sep).join('/'),
          cr.split(path.sep).join('/'),
        ].filter((s) => s !== '');
        const title =
          titleParts.length === 2
            ? `${titleParts[0]}/${titleParts[1]}`
            : titleParts[0] ?? cr;
        await readUnderContainedRoot(monoAbs, abs, title);
      }
    }
  }

  return chunks.join('\n').trim();
};
