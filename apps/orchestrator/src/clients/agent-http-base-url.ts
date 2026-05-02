const PORT_MIN = 1;
const PORT_MAX = 65535;

const trimmed = (raw: string | undefined): string => (raw ?? '').trim();

export const resolveAgentHttpBaseUrlFromEnv = (
  opts: Readonly<{
    explicitBaseUrlEnv: string | undefined;
    portEnv: string | undefined;
    portDefault: number;
  }>,
): string => {
  const url = trimmed(opts.explicitBaseUrlEnv);
  if (url !== '') return url;

  const hostRaw = trimmed(process.env.AGENTS_INTERNAL_HTTP_HOST);
  const host = hostRaw !== '' ? hostRaw : '127.0.0.1';
  let portNum = Number(opts.portEnv ?? String(opts.portDefault));
  if (!Number.isFinite(portNum) || portNum < PORT_MIN || portNum > PORT_MAX) {
    portNum = opts.portDefault;
  }
  return `http://${host}:${String(Math.trunc(portNum))}`;
};
