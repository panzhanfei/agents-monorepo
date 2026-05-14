export type IEntryChatLineRole = "user" | "assistant" | "system";

export type IEntryChatPayloadLine = {
  role: IEntryChatLineRole;
  content: string;
};

const trimRunnerBase = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/** 本机 Runner HTTP 根（与 `agents/runner` 监听地址一致）。 */
export const getRunnerBase = (): string => {
  const fromEnv = trimRunnerBase(import.meta.env.VITE_RUNNER_BASE);
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "http://127.0.0.1:8765";
};

const parseSseBlock = (block: string): { event: string; data: string } | null => {
  let evt = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) evt = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  const data = dataLines.join("\n");
  if (data.length === 0) return null;
  return { event: evt, data };
};

export type IEntryChatBudgetPayload = {
  remaining: number;
  total: number;
};

export type IStreamEntryAgentParams = {
  messages: IEntryChatPayloadLine[];
  projectId?: string;
  onToken: (text: string) => void;
  onLog?: (line: string) => void;
  onBudget?: (payload: IEntryChatBudgetPayload) => void;
  onBudgetExhausted?: () => void;
};

/** 调用本机 Runner `POST /v1/agent/entry/chat`，解析 SSE（`token` | `done` | `error`）。 */
export const streamEntryAgentChat = async (params: IStreamEntryAgentParams): Promise<void> => {
  const { messages, projectId, onToken, onLog, onBudget, onBudgetExhausted } = params;
  const base = getRunnerBase();
  const url = `${base}/v1/agent/entry/chat`;
  const log = (s: string): void => {
    onLog?.(s);
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      ...(projectId ? { projectId } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text.length > 0 ? text.slice(0, 400) : `Runner 响应 ${String(res.status)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("无法读取 Runner 流式响应。");

  const decoder = new TextDecoder();
  let buffer = "";

  const handleBlock = (block: string): void => {
    const parsed = parseSseBlock(block);
    if (!parsed) return;
    if (parsed.event === "route") {
      try {
        const json = JSON.parse(parsed.data) as {
          nextSlot?: unknown;
          reason?: unknown;
          configSlot?: unknown;
        };
        const ns = typeof json.nextSlot === "string" ? json.nextSlot : "?";
        const cs = typeof json.configSlot === "string" ? json.configSlot : "";
        const r = typeof json.reason === "string" ? json.reason : "";
        log(
          `[route] ${ns}${cs.length > 0 ? ` (凭证槽 ${cs})` : ""}${r.length > 0 ? ` — ${r}` : ""}`,
        );
      } catch {
        log("[route] (parse error)");
      }
      return;
    }
    if (parsed.event === "budget") {
      try {
        const json = JSON.parse(parsed.data) as { remaining?: unknown; total?: unknown };
        const remaining = typeof json.remaining === "number" ? json.remaining : 0;
        const total = typeof json.total === "number" ? json.total : 0;
        onBudget?.({ remaining, total });
      } catch {
        log("[stream] bad budget json");
      }
      return;
    }
    if (parsed.event === "budget_exhausted") {
      onBudgetExhausted?.();
      return;
    }
    if (parsed.event === "token") {
      let t = "";
      try {
        const json = JSON.parse(parsed.data) as { text?: unknown };
        t = typeof json.text === "string" ? json.text : "";
      } catch {
        log("[stream] bad token json");
        return;
      }
      if (t.length > 0) onToken(t);
      return;
    }
    if (parsed.event === "error") {
      let msg = "未知错误";
      try {
        const json = JSON.parse(parsed.data) as { message?: unknown };
        msg = typeof json.message === "string" ? json.message : msg;
      } catch {
        msg = parsed.data;
      }
      throw new Error(msg);
    }
    if (parsed.event === "done") {
      log("[stream] done");
      try {
        const json = JSON.parse(parsed.data || "{}") as {
          budgetRemaining?: unknown;
          budgetTotal?: unknown;
        };
        if (
          typeof json.budgetRemaining === "number" &&
          typeof json.budgetTotal === "number"
        ) {
          onBudget?.({ remaining: json.budgetRemaining, total: json.budgetTotal });
        }
      } catch {
        /* ignore non-json done payloads */
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const raw of parts) {
      const block = raw.trim();
      if (block.length === 0) continue;
      handleBlock(block);
    }
  }

  if (buffer.trim().length > 0) {
    handleBlock(buffer.trim());
  }
};
