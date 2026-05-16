import type { IResolvedRunnerCredentials } from "./resolve-runner-credentials";

export const buildRunnerAuthHeaders = (
  creds: IResolvedRunnerCredentials,
  extra?: Readonly<Record<string, string>>,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Device-Key": creds.deviceKey,
    "X-Device-Secret": creds.deviceSecret,
  };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      headers[k] = v;
    }
  }
  return headers;
};
