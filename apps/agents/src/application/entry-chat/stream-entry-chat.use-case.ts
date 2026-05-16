import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { IRunnerAgentSlotSecret } from "@agents/shared-types";
import { z } from "zod";

import type { IAgentsSettings } from "@/infrastructure";
import {
  getRunnerAgentSlots,
  iterateOpenAiCompatChatText,
  RunnerGatewayError,
  tryResolveRunnerCredentials,
} from "@/infrastructure";

export const entryChatRequestBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1),
  projectId: z.string().trim().min(1).optional(),
});

export type IEntryChatRequestBody = z.infer<typeof entryChatRequestBodySchema>;

export type IEntryChatSseEmit = (event: string, data: Record<string, unknown>) => void;

/** ~4 chars / token heuristic for SSE `budget*` (matches frontend expectations). */
const roughEstimateTokensFromText = (text: string): number =>
  Math.max(0, Math.ceil(text.length / 4));

export interface IPreparedStreamEntryChatContext {
  readonly slot: IRunnerAgentSlotSecret;
  readonly messages: IEntryChatRequestBody["messages"];
  readonly budgetTotal: number;
  readonly budgetRemainingStart: number;
}

export type IPrepareStreamEntryChatResult =
  | { readonly ok: true; readonly ctx: IPreparedStreamEntryChatContext }
  | { readonly ok: false; readonly status: number; readonly json: Record<string, unknown> };

export const prepareStreamEntryChatContext = async (
  body: IEntryChatRequestBody,
  settings: IAgentsSettings,
): Promise<IPrepareStreamEntryChatResult> => {
  const creds = tryResolveRunnerCredentials();
  if (!creds) {
    return {
      ok: false,
      status: 503,
      json: {
        error: "runner_credentials_missing",
        message:
          "Set RUNNER_NODE_API_BASE, RUNNER_DEVICE_KEY, RUNNER_DEVICE_SECRET (or ~/.agents-runner/device.env).",
      },
    };
  }

  let slotsOutcome;
  try {
    slotsOutcome = await getRunnerAgentSlots(creds);
  } catch (e) {
    if (e instanceof RunnerGatewayError) {
      return {
        ok: false,
        status: 502,
        json: {
          error: "agent_slots_upstream",
          message: e.message,
          ...(e.bodySnippet ? { snippet: e.bodySnippet } : {}),
        },
      };
    }
    throw e;
  }

  if (slotsOutcome.status !== 200) {
    return {
      ok: false,
      status: 503,
      json: {
        error: "agent_slots_unusable",
        message: "Unexpected agent-slots response (expected 200 with body).",
      },
    };
  }

  const routerSlot = slotsOutcome.payload.slots.router;
  if (!routerSlot) {
    return {
      ok: false,
      status: 422,
      json: {
        error: "router_slot_missing",
        message: "Configure the `router` slot in control-plane Agent models for this Runner user.",
      },
    };
  }

  if (routerSlot.mode === "hosted" && !(routerSlot.apiKey?.trim()?.length ?? 0)) {
    return {
      ok: false,
      status: 422,
      json: {
        error: "router_hosted_api_key_missing",
        message: "`router` hosted mode requires an API key in control-plane.",
      },
    };
  }

  const overhead = settings.entryChatRouterOverhead;
  const total = settings.entryChatRoundTokenBudget;
  const payloadText = body.messages.map((m) => m.content).join("\n");
  const started = roughEstimateTokensFromText(payloadText);
  const budgetRemainingStart = Math.max(0, total - overhead - started);

  return {
    ok: true,
    ctx: {
      slot: routerSlot,
      messages: body.messages,
      budgetTotal: total,
      budgetRemainingStart,
    },
  };
};

export const runPreparedEntryChatStream = async (
  ctx: IPreparedStreamEntryChatContext,
  emit: IEntryChatSseEmit,
): Promise<void> => {
  emit("route", {
    nextSlot: "router",
    reason: "entry",
    configSlot: "router",
  });

  let remaining = ctx.budgetRemainingStart;
  emit("budget", { remaining, total: ctx.budgetTotal });

  if (remaining <= 0) {
    emit("budget_exhausted", {});
    emit("done", { budgetRemaining: remaining, budgetTotal: ctx.budgetTotal });
    return;
  }

  const ac = new AbortController();
  let exhaustedByBudget = false;

  try {
    const iterable = iterateOpenAiCompatChatText({
      slot: ctx.slot,
      messages: ctx.messages as ChatCompletionMessageParam[],
      abortSignal: ac.signal,
    });

    for await (const text of iterable) {
      if (text.length === 0) continue;

      emit("token", { text });
      remaining -= roughEstimateTokensFromText(text);

      if (remaining <= 0) {
        exhaustedByBudget = true;
        emit("budget_exhausted", {});
        ac.abort();
        break;
      }
    }

    emit("done", {
      budgetRemaining: Math.max(0, remaining),
      budgetTotal: ctx.budgetTotal,
    });
  } catch (e) {
    const aborted =
      e !== null &&
      typeof e === "object" &&
      "name" in e &&
      (e as { name?: string }).name === "AbortError";
    if (aborted && exhaustedByBudget) {
      emit("done", {
        budgetRemaining: Math.max(0, remaining),
        budgetTotal: ctx.budgetTotal,
      });
      return;
    }
    const msg = e instanceof Error ? e.message : String(e);
    emit("error", { message: msg });
  }
};
