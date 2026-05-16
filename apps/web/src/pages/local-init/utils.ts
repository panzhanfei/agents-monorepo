import { getApiBase, registerRunner } from "@/api";

export const STORAGE_PREFIX = "agents-runner-local-init:";

export const isAllowedIngestUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:") return false;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return false;
    return url.pathname === "/v1/setup/ingest";
  } catch {
    return false;
  }
};

export type ILocalSetupResult = { ok: true } | { ok: false; message: string };

export const runLocalSetup = async (
  ingestUrl: string,
  setupToken: string,
): Promise<ILocalSetupResult> => {
  const reg = await registerRunner({ displayName: "本机" });
  const res = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Runner-Setup-Token": setupToken,
    },
    body: JSON.stringify({
      deviceKey: reg.runner.deviceKey,
      deviceSecret: reg.deviceSecret,
      nodeApiBase: getApiBase(),
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      message: text.length > 0 ? text.slice(0, 400) : `无法完成准备（${res.status}）`,
    };
  }
  return { ok: true };
};

const localSetupPromises = new Map<string, Promise<ILocalSetupResult>>();

export const getOrRunLocalSetup = (
  ingestUrl: string,
  setupToken: string,
  storageKey: string,
): Promise<ILocalSetupResult> => {
  const prev = localSetupPromises.get(setupToken);
  if (prev) return prev;
  const created = runLocalSetup(ingestUrl, setupToken).then((r) => {
    if (r.ok) sessionStorage.setItem(storageKey, "done");
    return r;
  });
  localSetupPromises.set(setupToken, created);
  void created.finally(() => {
    localSetupPromises.delete(setupToken);
  });
  return created;
};
