import OpenAI from "openai";
import type { IRunnerAgentSlotSecret } from "@agents/shared-types";
import {
  DOWNSTREAM_AGENT_SYSTEM,
  ROUTER_ROUTING_SYSTEM,
  EntryChatConfigError,
  parseRoutePayload,
  type IChatLine,
  type IEntryChatLlmGateway,
} from "@/domain";

const ensureHttpScheme = (url: string): string => {
  const s = url.trim();
  if (!s.toLowerCase().startsWith("http://") && !s.toLowerCase().startsWith("https://")) {
    return `http://${s}`;
  }
  return s;
};

const normalizeOllamaOrigin = (raw: string | null | undefined): string | null => {
  if (raw == null || String(raw).trim() === "") return null;
  const s = ensureHttpScheme(String(raw));
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
};

const openaiV1Base = (raw: string | null | undefined): string | null => {
  const fallback = "https://api.openai.com/v1";
  const source = (raw && raw.trim()) || fallback;
  try {
    let s = source.trim();
    if (!s.toLowerCase().startsWith("http://") && !s.toLowerCase().startsWith("https://")) {
      s = `https://${s}`;
    }
    const u = new URL(s);
    let pathname = u.pathname.replace(/\/$/, "");
    if (!pathname.endsWith("/v1")) {
      if (pathname === "" || pathname === "/") pathname = "/v1";
      else pathname = `${pathname}/v1`;
    }
    return `${u.protocol}//${u.host}${pathname}`;
  } catch {
    return null;
  }
};

type IResolvedOpenAI = {
  client: OpenAI;
  model: string;
};

const resolveOpenAIForSlot = (
  slot: IRunnerAgentSlotSecret,
  slotKey: string,
): IResolvedOpenAI => {
  const modelRaw = (slot.model || "").trim();
  if (!modelRaw) {
    throw new EntryChatConfigError(
      `「${slotKey}」槽位未配置模型名：请在「Agent 配置」中填写 model。`,
    );
  }

  if (slot.mode === "local") {
    const origin = normalizeOllamaOrigin(slot.baseUrl);
    if (!origin) {
      throw new EntryChatConfigError("本地模式需要配置 Base URL（如 http://127.0.0.1:11434）。");
    }
    const model = modelRaw.startsWith("ollama/") ? modelRaw.slice("ollama/".length) : modelRaw;
    return {
      client: new OpenAI({ baseURL: `${origin}/v1`, apiKey: "ollama" }),
      model,
    };
  }

  if (slot.mode === "hosted") {
    const key = (slot.apiKey || "").trim();
    if (!key) {
      throw new EntryChatConfigError("线上模式需要已保存的 API Key。");
    }
    const base = openaiV1Base(slot.baseUrl);
    if (!base) {
      throw new EntryChatConfigError("Base URL 无效。");
    }
    return {
      client: new OpenAI({ baseURL: base, apiKey: key }),
      model: modelRaw,
    };
  }

  throw new EntryChatConfigError(`未知推理模式：${String(slot.mode)}`);
};

const userAssistantOnly = (raw: IChatLine[]): IChatLine[] =>
  raw.filter((m) => m.role === "user" || m.role === "assistant");

const buildDownstreamMessages = (
  slotKey: string,
  dialogue: IChatLine[],
): OpenAI.Chat.ChatCompletionMessageParam[] => {
  const system = DOWNSTREAM_AGENT_SYSTEM[slotKey];
  if (!system) {
    throw new EntryChatConfigError(`内部错误：未知下游槽位 ${slotKey}`);
  }
  const ua = userAssistantOnly(dialogue);
  return [
    { role: "system", content: system },
    ...ua.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];
};

export const createOpenAiEntryChatLlmGateway = (): IEntryChatLlmGateway => ({
  decideNextSlot: async (routerSlot: IRunnerAgentSlotSecret, messages: IChatLine[]) => {
    const { client, model } = resolveOpenAIForSlot(routerSlot, "router");
    const ua = userAssistantOnly(messages);
    const routingMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: ROUTER_ROUTING_SYSTEM },
      ...ua.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];
    const completion = await client.chat.completions.create({
      model,
      messages: routingMessages,
      stream: false,
    });
    const raw =
      completion.choices[0]?.message?.content == null
        ? ""
        : String(completion.choices[0].message.content).trim();
    return parseRoutePayload(raw);
  },

  streamDownstreamReply: async function* (
    targetSlot: IRunnerAgentSlotSecret,
    logicalRole: string,
    configSlotKey: string,
    messages: IChatLine[],
  ) {
    const { client, model } = resolveOpenAIForSlot(targetSlot, configSlotKey);
    const merged = buildDownstreamMessages(logicalRole, messages);
    const stream = await client.chat.completions.create({
      model,
      messages: merged,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (typeof text === "string" && text.length > 0) yield text;
    }
  },
});
