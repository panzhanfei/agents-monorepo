import { useEffect, useMemo, useState } from "react";
import { Box, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, getApiBase, registerRunner } from "@/api";

const STORAGE_PREFIX = "agents-runner-local-init:";

const isAllowedIngestUrl = (raw: string): boolean => {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:") return false;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return false;
    return url.pathname === "/v1/setup/ingest";
  } catch {
    return false;
  }
};

const runLocalSetup = async (
  ingestUrl: string,
  setupToken: string,
): Promise<{ ok: true } | { ok: false; message: string }> => {
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

type SetupResult = { ok: true } | { ok: false; message: string };

const localSetupPromises = new Map<string, Promise<SetupResult>>();

const getOrRunLocalSetup = (
  ingestUrl: string,
  setupToken: string,
  storageKey: string,
): Promise<SetupResult> => {
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

export const LocalInitPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ingestUrl = useMemo(() => (searchParams.get("ingestUrl") ?? "").trim(), [searchParams]);
  const setupToken = useMemo(() => (searchParams.get("setupToken") ?? "").trim(), [searchParams]);

  const storageKey = useMemo(
    () => (setupToken ? `${STORAGE_PREFIX}${setupToken}` : ""),
    [setupToken],
  );

  const [phase, setPhase] = useState<"idle" | "working" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const paramsOk = useMemo(
    () => ingestUrl.length > 0 && setupToken.length > 0 && isAllowedIngestUrl(ingestUrl),
    [ingestUrl, setupToken],
  );

  useEffect(() => {
    if (!paramsOk || !storageKey) {
      setPhase("error");
      setMessage("此页面应由本机程序自动打开；若你误打开请关闭即可。");
      return;
    }

    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(storageKey) === "done") {
      setPhase("done");
      setMessage("本机已就绪，正在进入项目列表…");
      return;
    }

    let alive = true;
    setPhase("working");
    setMessage(null);

    void getOrRunLocalSetup(ingestUrl, setupToken, storageKey).then((result) => {
      if (!alive) return;
      if (result.ok) {
        setPhase("done");
        setMessage("本机已就绪，正在进入项目列表…");
        return;
      }
      setPhase("error");
      setMessage(result.message);
    }).catch((e: unknown) => {
      if (!alive) return;
      if (e instanceof ApiError) setMessage(e.message);
      else if (e instanceof Error) setMessage(e.message);
      else setMessage("暂时无法完成准备，请稍后重试。");
      setPhase("error");
    });

    return () => {
      alive = false;
    };
  }, [ingestUrl, paramsOk, setupToken, storageKey]);

  useEffect(() => {
    if (phase !== "done") return;
    const id = window.setTimeout(() => navigate("/projects", { replace: true }), 600);
    return () => window.clearTimeout(id);
  }, [phase, navigate]);

  return (
    <Flex direction="column" gap="5" align="center" py="8">
      <Box style={{ maxWidth: 420, textAlign: "center" }}>
        <Heading size="5" mb="3" weight="medium">
          请稍候
        </Heading>
        {phase === "working" ? (
          <Flex align="center" justify="center" gap="3">
            <Spinner size="3" />
            <Text color="gray" size="2" highContrast={false}>
              正在准备本机环境…
            </Text>
          </Flex>
        ) : null}
        {message ? (
          <Callout.Root color={phase === "error" ? "red" : "gray"} role={phase === "error" ? "alert" : "status"} mt="4">
            <Callout.Text>{message}</Callout.Text>
          </Callout.Root>
        ) : null}
      </Box>
    </Flex>
  );
};
