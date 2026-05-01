import fs from 'node:fs';
import path from 'node:path';

export type ILogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

export type ICreateLoggerOptions = {
  service: string;
  /** @default process.env.NODE_ENV ?? 'development' */
  env?: string;
};

const logRootPrepared = new Set<string>();

const appendAgentsFileLog = (
  rootDir: string,
  service: string,
  line: string
): void => {
  try {
    if (!logRootPrepared.has(rootDir)) {
      fs.mkdirSync(rootDir, { recursive: true });
      logRootPrepared.add(rootDir);
    }
    const safe = service.replace(/[^a-z0-9_-]/gi, '_');
    const file = path.join(rootDir, `${safe}.log`);
    fs.appendFileSync(file, line, 'utf8');
  } catch {
    // 落盘失败不阻断进程
  }
};

const formatLine = (
  level: 'info' | 'warn' | 'error',
  service: string,
  env: string,
  msg: string,
  meta?: Record<string, unknown>
): string =>
  `${JSON.stringify({
    level,
    service,
    env,
    msg,
    ts: new Date().toISOString(),
    ...meta,
  })}\n`;

const shouldAutoFileLog = (): boolean => {
  const n = process.env.NODE_ENV ?? 'development';
  if (n === 'production' || n === 'test') {
    return false;
  }
  if (process.env.AGENTS_LOG_DISABLE === '1') {
    return false;
  }
  return true;
};

const resolveAgentsLogDir = (): string => {
  const raw = process.env.AGENTS_LOG_DIR?.trim() ?? '';
  if (raw !== '') {
    if (path.isAbsolute(raw)) {
      return raw;
    }
    const root = process.env.AGENTS_MONOREPO_ROOT?.trim() ?? '';
    if (root !== '') {
      return path.resolve(root, raw);
    }
    return path.resolve(process.cwd(), raw);
  }
  if (!shouldAutoFileLog()) {
    return '';
  }
  const root = process.env.AGENTS_MONOREPO_ROOT?.trim() ?? '';
  if (root !== '') {
    return path.join(root, 'logs');
  }
  return path.resolve(process.cwd(), 'logs');
};

export const createLogger = (opts: ICreateLoggerOptions): ILogger => {
  const env = opts.env ?? process.env.NODE_ENV ?? 'development';
  const { service } = opts;

  const write = (
    level: 'info' | 'warn' | 'error',
    msg: string,
    meta?: Record<string, unknown>
  ): void => {
    const payload = formatLine(level, service, env, msg, meta);
    if (level === 'error') {
      process.stderr.write(payload);
    } else {
      process.stdout.write(payload);
    }
    const logDir = resolveAgentsLogDir();
    if (logDir !== '') {
      appendAgentsFileLog(logDir, service, payload);
    }
  };

  const logDirBoot = resolveAgentsLogDir();
  if (logDirBoot !== '') {
    appendAgentsFileLog(
      logDirBoot,
      service,
      formatLine('info', service, env, 'logger_ready', {
        logDir: logDirBoot,
      })
    );
  }

  return {
    info: (msg, meta) => {
      write('info', msg, meta);
    },
    warn: (msg, meta) => {
      write('warn', msg, meta);
    },
    error: (msg, meta) => {
      write('error', msg, meta);
    },
  };
};
