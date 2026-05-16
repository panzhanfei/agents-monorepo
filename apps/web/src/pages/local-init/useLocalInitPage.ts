import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "@/api";
import { getOrRunLocalSetup, isAllowedIngestUrl, STORAGE_PREFIX } from "./utils";

export const useLocalInitPage = () => {
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

    void getOrRunLocalSetup(ingestUrl, setupToken, storageKey)
      .then((result) => {
        if (!alive) return;
        if (result.ok) {
          setPhase("done");
          setMessage("本机已就绪，正在进入项目列表…");
          return;
        }
        setPhase("error");
        setMessage(result.message);
      })
      .catch((e: unknown) => {
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

  return { phase, message };
};

export type ILocalInitPageViewModel = ReturnType<typeof useLocalInitPage>;
