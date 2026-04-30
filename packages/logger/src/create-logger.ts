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
  };

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
