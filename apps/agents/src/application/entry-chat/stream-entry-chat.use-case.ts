import {
  configSlotForLogicalRole,
  EntryChatConfigError,
  estimatePromptTokens,
  type IAgentSlotsGateway,
  type IChatLine,
  type IEntryChatLlmGateway,
} from "@/domain";

export type IEntryChatSseEvent =
  | { type: "route"; nextSlot: string; reason: string; configSlot: string }
  | { type: "budget"; remaining: number; total: number }
  | { type: "token"; text: string }
  | { type: "budget_exhausted" }
  | { type: "done"; budgetRemaining: number; budgetTotal: number }
  | { type: "error"; message: string };

export type IStreamEntryChatBudget = {
  budgetTotal: number;
  routerOverhead: number;
};

export type IStreamEntryChatInput = {
  messages: IChatLine[];
  budget: IStreamEntryChatBudget;
};

export type IStreamEntryChatDeps = {
  slots: IAgentSlotsGateway;
  llm: IEntryChatLlmGateway;
};

const ROUTER_NOT_CONFIGURED_MSG =
  "尚未配置「router」路由槽位：请在 Web「Agent 配置」中为 router 填写模型（用于一次 JSON 路由）。";

export const streamEntryChatEvents = async function* (
  input: IStreamEntryChatInput,
  deps: IStreamEntryChatDeps,
): AsyncGenerator<IEntryChatSseEvent, void, undefined> {
  const { messages, budget } = input;
  const routerFetch = await deps.slots.fetchSlotSecret("router");
  if (routerFetch.kind === "not_modified") {
    yield {
      type: "error",
      message: "无法解析槽位响应，请重试。",
    };
    return;
  }
  const routerRow = routerFetch.value;
  if (routerRow == null) {
    yield { type: "error", message: ROUTER_NOT_CONFIGURED_MSG };
    return;
  }

  const { budgetTotal, routerOverhead } = budget;
  let nextSlot: string;
  let reason: string;
  try {
    const d = await deps.llm.decideNextSlot(routerRow, messages);
    nextSlot = d.nextSlot;
    reason = d.reason;
  } catch (e) {
    if (e instanceof EntryChatConfigError) {
      yield { type: "error", message: e.message };
      return;
    }
    throw e;
  }
  const configKey = configSlotForLogicalRole(nextSlot);
  if (configKey == null) {
    yield {
      type: "error",
      message: `内部错误：未找到逻辑角色「${nextSlot}」对应的配置槽位。`,
    };
    return;
  }

  yield { type: "route", nextSlot, reason, configSlot: configKey };

  const promptEst = estimatePromptTokens(messages) + routerOverhead;
  const remainingAfterRoute = Math.max(0, budgetTotal - promptEst);
  yield { type: "budget", remaining: remainingAfterRoute, total: budgetTotal };

  const targetFetch = await deps.slots.fetchSlotSecret(configKey);
  if (targetFetch.kind === "not_modified") {
    yield { type: "error", message: "无法从控制面读取 Agent 槽位" };
    return;
  }
  const target = targetFetch.value;
  if (target == null) {
    yield {
      type: "error",
      message: `路由为逻辑角色「${nextSlot}」，需使用控制面槽位「${configKey}」的模型配置；该槽位尚未在 Web「Agent 配置」中填写并保存，请先配置后再试。`,
    };
    return;
  }

  let completionChars = 0;
  try {
    for await (const token of deps.llm.streamDownstreamReply(
      target,
      nextSlot,
      configKey,
      messages,
    )) {
      completionChars += token.length;
      yield { type: "token", text: token };
    }
  } catch (e) {
    if (e instanceof EntryChatConfigError) {
      yield { type: "error", message: e.message };
      return;
    }
    throw e;
  }

  const completionEst = completionChars > 0 ? Math.floor(completionChars / 4) : 0;
  const remainingEnd = Math.max(0, budgetTotal - promptEst - completionEst);
  yield { type: "budget", remaining: remainingEnd, total: budgetTotal };
  if (remainingEnd <= 0) {
    yield { type: "budget_exhausted" };
  }
  yield { type: "done", budgetRemaining: remainingEnd, budgetTotal };
};
