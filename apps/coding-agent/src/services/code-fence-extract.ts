export type ICodeFenceFileHint = {
  readonly relPosixPath: string;
  readonly content: string;
};

const firstLinePath = (line: string): string | undefined => {
  const t = line.trim();
  const m =
    /^(?:\/\/|#)\s*file:\s*(.+)$/i.exec(t) ??
    /^(?:\/\/|#)\s*path:\s*(.+)$/i.exec(t);
  if (m === null) {
    return undefined;
  }
  return m[1]!.trim().replace(/^\.\//, '');
};

const parseFenceHeader = (
  line: string
): { hintedPath?: string } => {
  const trimmed = line.trim();
  const afterTicks = trimmed.startsWith('```')
    ? trimmed.slice(3).trim()
    : '';
  let hintedPath: string | undefined;

  const fileEq =
    /file=(?:"([^"]+)"|'([^']+)'|(\S+))/i.exec(afterTicks) ??
    null;
  if (fileEq !== null) {
    hintedPath = fileEq[1] ?? fileEq[2] ?? fileEq[3];
  }

  const colon = /^([\w#+\-]+):(.+)$/.exec(afterTicks);
  if (
    colon !== null &&
    hintedPath === undefined &&
    /[./\\]/.test(colon[2] ?? '')
  ) {
    hintedPath = colon[2]!.trim();
  }

  return {
    ...(hintedPath !== undefined
      ? { hintedPath: hintedPath.replace(/^\.\//, '') }
      : {}),
  };
};

const stripIfLeadingFileDirective = (
  lines: readonly string[],
  hadHeaderHint: boolean
): string => {
  if (lines.length === 0) {
    return '';
  }
  if (hadHeaderHint) {
    const first = lines[0]!.trim();
    if (
      /^(?:\/\/|#)\s*file:\s*.+$/i.test(first) ||
      /^(?:\/\/|#)\s*path:\s*.+$/i.test(first)
    ) {
      return lines.slice(1).join('\n');
    }
    return lines.join('\n');
  }
  const pathFromLine = firstLinePath(lines[0]!);
  if (pathFromLine !== undefined) {
    return lines.slice(1).join('\n');
  }
  return lines.join('\n');
};

/**
 * 从自然语言指令中提取「可落盘」的代码块：
 * - 围栏行支持可选 `file="..."` / `file='...'` / `file:path`
 * - 或 `lang:path/to/file`（path 含 `.`）
 * - 或代码首行 `// file:` / `// path:` / `# file:` / `# path:`
 *
 * 无路径提示的裸围栏会被忽略（避免误写）。
 */
export const extractCodeFenceFiles = (
  instruction: string
): ICodeFenceFileHint[] => {
  const lines = instruction.split(/\r?\n/);
  const out: ICodeFenceFileHint[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim().startsWith('```')) {
      i += 1;
      continue;
    }
    const { hintedPath } = parseFenceHeader(line);
    i += 1;
    const body: string[] = [];
    while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
      body.push(lines[i]!);
      i += 1;
    }
    if (i < lines.length) {
      i += 1;
    }
    if (body.length === 0) {
      continue;
    }
    const fromFirst = firstLinePath(body[0]!);
    const rel =
      hintedPath !== undefined && hintedPath.trim() !== ''
        ? hintedPath.trim().replace(/\\/g, '/')
        : fromFirst !== undefined
          ? fromFirst.replace(/\\/g, '/')
          : undefined;
    if (rel === undefined || rel === '') {
      continue;
    }
    const hadHeaderHint = hintedPath !== undefined;
    const content = stripIfLeadingFileDirective(body, hadHeaderHint);
    if (content.trim() === '') {
      continue;
    }
    out.push({ relPosixPath: rel, content });
  }
  return out;
};
