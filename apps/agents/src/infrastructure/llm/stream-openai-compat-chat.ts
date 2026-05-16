import OpenAI from "openai";

import type { IRunnerAgentSlotSecret } from "@agents/shared-types";

const trimTrailingSlashes = (u: string): string => u.replace(/\/+$/, "");

const compatBaseUrlV1 = (raw: string): string => {
  const trimmed = trimTrailingSlashes(raw.trim());
  if (/\/v1$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
};

export async function* iterateOpenAiCompatChatText({
  slot,
  messages,
  abortSignal,
}: Readonly<{
  slot: IRunnerAgentSlotSecret;
  messages: OpenAI.ChatCompletionMessageParam[];
  abortSignal: AbortSignal;
}>): AsyncGenerator<string> {
  const base = slot.baseUrl?.trim();
  const baseURL = base !== undefined && base.length > 0 ? compatBaseUrlV1(base) : undefined;

  const trimmedKey = slot.apiKey?.trim();
  const apiKey =
    trimmedKey !== undefined && trimmedKey.length > 0
      ? trimmedKey
      : "local-no-key-required";

  const client = new OpenAI({ apiKey, baseURL });

  const stream = await client.chat.completions.create(
    {
      model: slot.model,
      messages,
      stream: true,
    },
    { signal: abortSignal },
  );

  for await (const chunk of stream) {
    const t = chunk.choices[0]?.delta?.content;
    if (typeof t === "string" && t.length > 0) {
      yield t;
    }
  }
}
