import { spawn } from 'node:child_process';

export type IShellRunResult = {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
};

const MAX_CAPTURE_BYTES = 2_000_000;

const tailText = (s: string, maxChars: number): string =>
  s.length <= maxChars ? s : `…(truncated, tail ${String(maxChars)} chars)\n${s.slice(-maxChars)}`;

export type IShellRunOptions = {
  readonly cwd: string;
  readonly script: string;
  readonly timeoutMs: number;
};

export const runShellCommand = async (
  opts: IShellRunOptions
): Promise<IShellRunResult> => {
  return await new Promise<IShellRunResult>((resolve, reject) => {
    const child = spawn(opts.script, [], {
      cwd: opts.cwd,
      shell: true,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutParts: string[] = [];
    const stderrParts: string[] = [];

    const pushCap = (
      parts: string[],
      lenRef: { n: number },
      chunk: Buffer
    ): void => {
      if (lenRef.n >= MAX_CAPTURE_BYTES) {
        return;
      }
      const s = chunk.toString('utf8');
      parts.push(s);
      lenRef.n += Buffer.byteLength(chunk);
    };

    const outLen = { n: 0 };
    const errLen = { n: 0 };

    child.stdout?.on('data', (chunk: Buffer) => {
      pushCap(stdoutParts, outLen, chunk);
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      pushCap(stderrParts, errLen, chunk);
    });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, 8000).unref?.();
    }, opts.timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const stdout = stdoutParts.join('');
      const stderr = stderrParts.join('');
      if (timedOut && signal === 'SIGTERM') {
        resolve({
          exitCode: code,
          stdout: tailText(stdout, 24_000),
          stderr: tailText(
            `${stderr}\n[shell] Command timed out after ${String(opts.timeoutMs)}ms`,
            24_000
          ),
          timedOut: true,
        });
        return;
      }
      resolve({
        exitCode: code,
        stdout: tailText(stdout, 24_000),
        stderr: tailText(stderr, 24_000),
        timedOut: false,
      });
    });
  });
};
