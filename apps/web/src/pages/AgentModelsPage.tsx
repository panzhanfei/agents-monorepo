import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Callout,
  Card,
  Flex,
  Heading,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import {
  AGENT_SLOT_KEYS,
  type IAgentInferenceMode,
  type IAgentSlotKey,
  type IAgentSlotPublic,
  type IAuthPatchAgentSlotBody,
} from "@agents/shared-types";
import { ApiError } from "@/api";
import { getMutationErrorMessage, useMeQuery, usePatchAuthMeMutation } from "@/hooks";
import { InferenceTestBlock } from "./InferenceTestBlock";

const SLOT_META: readonly { key: IAgentSlotKey; label: string }[] = [
  { key: "router", label: "入口路由" },
  { key: "analyst", label: "需求分析" },
  { key: "architect", label: "架构设计" },
  { key: "coder", label: "编码实现" },
  { key: "reviewer", label: "代码评审" },
  { key: "verifier", label: "验证（测试 / CI）" },
  { key: "ops", label: "构建与发布" },
];

type ISlotDraft = {
  mode: IAgentInferenceMode;
  baseUrl: string;
  hostedProvider: string;
  model: string;
  apiKeyDraft: string;
  clearApiKey: boolean;
};

const emptyDraft = (): ISlotDraft => ({
  mode: "local",
  baseUrl: "",
  hostedProvider: "",
  model: "",
  apiKeyDraft: "",
  clearApiKey: false,
});

const initialDraftRecord = (): Record<IAgentSlotKey, ISlotDraft> => {
  const o = {} as Record<IAgentSlotKey, ISlotDraft>;
  for (const k of AGENT_SLOT_KEYS) o[k] = emptyDraft();
  return o;
};

const draftsEqual = (a: ISlotDraft, b: ISlotDraft): boolean =>
  a.mode === b.mode &&
  a.baseUrl === b.baseUrl &&
  a.hostedProvider === b.hostedProvider &&
  a.model === b.model &&
  a.apiKeyDraft === b.apiKeyDraft &&
  a.clearApiKey === b.clearApiKey;

/** `model` 为空时表示删除该槽配置；否则返回写入体。 */
const patchBodyFromDraft = (d: ISlotDraft): IAuthPatchAgentSlotBody | null => {
  if (!d.model.trim()) return null;
  const baseTrim = d.baseUrl.trim();
  const baseUrlVal = baseTrim === "" ? null : baseTrim;
  if (d.mode === "local") {
    return { mode: "local", model: d.model.trim(), baseUrl: baseUrlVal };
  }
  const hp = d.hostedProvider.trim();
  return {
    mode: "hosted",
    model: d.model.trim(),
    baseUrl: baseUrlVal,
    hostedProvider: hp === "" ? null : hp,
    ...(d.clearApiKey ? { apiKey: null } : d.apiKeyDraft.trim() ? { apiKey: d.apiKeyDraft.trim() } : {}),
  };
};

const validateSlotBeforeSave = (d: ISlotDraft, serverSlot: IAgentSlotPublic | undefined): string | null => {
  if (!d.model.trim()) return null;
  if (d.mode !== "hosted") return null;
  const hasStoredKey = Boolean(serverSlot?.apiKeyConfigured);
  const typedKey = d.apiKeyDraft.trim().length > 0;
  if (!hasStoredKey && !typedKey && !d.clearApiKey) {
    return "线上模式需提供 API Key（必填 · 当前尚无已存密钥）";
  }
  return null;
};

const draftFromServerSlots = (
  agentSlots: Record<IAgentSlotKey, IAgentSlotPublic>,
): Record<IAgentSlotKey, ISlotDraft> => {
  const next = initialDraftRecord();
  for (const k of AGENT_SLOT_KEYS) {
    const s = agentSlots[k];
    next[k] = {
      mode: s.mode,
      baseUrl: s.baseUrl ?? "",
      hostedProvider: s.hostedProvider ?? "",
      model: s.model,
      apiKeyDraft: "",
      clearApiKey: false,
    };
  }
  return next;
};

const mergeSlotDraft = (
  prev: Record<IAgentSlotKey, ISlotDraft>,
  key: IAgentSlotKey,
  partial: Partial<ISlotDraft>,
): Record<IAgentSlotKey, ISlotDraft> => ({
  ...prev,
  [key]: { ...prev[key], ...partial },
});

export const AgentModelsPage = () => {
  const meQ = useMeQuery();
  const patchM = usePatchAuthMeMutation();

  const agentSlots = meQ.data?.user.agentSlots;

  const [draft, setDraft] = useState<Record<IAgentSlotKey, ISlotDraft>>(initialDraftRecord);
  const [slotErrors, setSlotErrors] = useState<Partial<Record<IAgentSlotKey, string>>>({});

  useEffect(() => {
    if (!agentSlots) return;
    setDraft(draftFromServerSlots(agentSlots));
    setSlotErrors({});
  }, [agentSlots]);

  const loadError = meQ.isError
    ? meQ.error instanceof ApiError
      ? meQ.error.message
      : "Failed to load profile"
    : null;

  const serverSnapshot = useMemo(() => (agentSlots ? draftFromServerSlots(agentSlots) : null), [agentSlots]);

  const patchSlotDraft = (key: IAgentSlotKey, partial: Partial<ISlotDraft>): void => {
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDraft((prev) => mergeSlotDraft(prev, key, partial));
  };

  const discardSlot = (key: IAgentSlotKey): void => {
    if (!serverSnapshot) return;
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDraft((prev) => ({ ...prev, [key]: serverSnapshot[key] }));
  };

  const saveSlot = (key: IAgentSlotKey): void => {
    const d = draft[key];
    const serverSlot = agentSlots?.[key];
    const validation = validateSlotBeforeSave(d, serverSlot);
    if (validation) {
      setSlotErrors((prev) => ({ ...prev, [key]: validation }));
      return;
    }
    setSlotErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const body = patchBodyFromDraft(d);
    patchM.mutate(
      { agentSlots: { [key]: body } },
      {
        onError: (e) => {
          setSlotErrors((prev) => ({
            ...prev,
            [key]: getMutationErrorMessage(e, "保存失败"),
          }));
        },
      },
    );
  };

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            Agent 配置（按槽位）
          </Heading>
          <Flex direction="column" gap="1">
            <Text color="gray" size="2" highContrast={false}>
              <RouterLink to="/projects" style={{ color: "inherit" }}>
                ← 返回项目列表
              </RouterLink>
            </Text>
            <Text color="gray" size="2" highContrast={false}>
              每个槽位单独保存、单独丢弃草稿，便于只测某一个 Agent；必填项带 * 且靠前填写。
            </Text>
          </Flex>
        </Box>
        <Button type="button" variant="soft" color="gray" size="2" asChild>
          <RouterLink to="/settings">设置</RouterLink>
        </Button>
      </Flex>

      {loadError ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{loadError}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Flex direction="column" gap="4">
        {SLOT_META.map(({ key, label }) => {
          const d = draft[key];
          const serverSlot = agentSlots?.[key];
          const snap = serverSnapshot?.[key];
          const dirty = snap ? !draftsEqual(d, snap) : false;
          const slotErr = slotErrors[key];
          const savingThis =
            patchM.isPending && patchM.variables?.agentSlots && key in patchM.variables.agentSlots;

          return (
            <Card key={key} size="2">
              <Flex direction="column" gap="4">
                <Flex align="center" justify="between" gap="3" wrap="wrap">
                  <Heading size="4">
                    {label}（{key}）
                  </Heading>
                  {dirty ? (
                    <Text size="1" color="amber" weight="medium">
                      未保存
                    </Text>
                  ) : (
                    <Text size="1" color="gray" highContrast={false}>
                      已与服务器一致
                    </Text>
                  )}
                </Flex>

                {slotErr ? (
                  <Callout.Root color="red" role="alert">
                    <Callout.Text>{slotErr}</Callout.Text>
                  </Callout.Root>
                ) : null}

                <Box>
                  <Text size="2" weight="medium" mb="2" as="div">
                    模式
                  </Text>
                  <Flex gap="2" wrap="wrap">
                    <Button
                      type="button"
                      size="2"
                      variant={d.mode === "local" ? "solid" : "soft"}
                      color="gray"
                      onClick={() => patchSlotDraft(key, { mode: "local" })}
                    >
                      本地 / 自建
                    </Button>
                    <Button
                      type="button"
                      size="2"
                      variant={d.mode === "hosted" ? "solid" : "soft"}
                      color="gray"
                      onClick={() => patchSlotDraft(key, { mode: "hosted" })}
                    >
                      线上 API
                    </Button>
                  </Flex>
                </Box>

                <Flex direction="column" gap="1">
                  <Flex align="baseline" gap="1" wrap="wrap">
                    <Text as="label" htmlFor={`slot-${key}-model`} size="2" weight="medium">
                      模型名 / 模型 ID
                    </Text>
                    <Text size="2" color="red" weight="bold">
                      *
                    </Text>
                  </Flex>
                  <TextField.Root
                    id={`slot-${key}-model`}
                    placeholder={d.mode === "local" ? "如 qwen2.5:latest" : "如 gpt-4o"}
                    value={d.model}
                    onChange={(evt) => patchSlotDraft(key, { model: evt.target.value })}
                  />
                  <Text size="1" color="gray" highContrast={false}>
                    留空则视为删除该槽配置；保存本槽将生效。
                  </Text>
                </Flex>

                <Flex direction="column" gap="1">
                  <Text as="label" htmlFor={`slot-${key}-base`} size="2" weight="medium">
                    Base URL（可选）
                  </Text>
                  <TextField.Root
                    id={`slot-${key}-base`}
                    placeholder={
                      d.mode === "local" ? "如 http://127.0.0.1:11434" : "可空则探测时用 api.openai.com"
                    }
                    value={d.baseUrl}
                    onChange={(evt) => patchSlotDraft(key, { baseUrl: evt.target.value })}
                  />
                </Flex>

                {d.mode === "hosted" ? (
                  <>
                    <Flex direction="column" gap="1">
                      <Text as="label" htmlFor={`slot-${key}-provider`} size="2" weight="medium">
                        供应商标识（可选）
                      </Text>
                      <TextField.Root
                        id={`slot-${key}-provider`}
                        placeholder="如 openai"
                        value={d.hostedProvider}
                        onChange={(evt) => patchSlotDraft(key, { hostedProvider: evt.target.value })}
                      />
                    </Flex>
                    <Flex direction="column" gap="2">
                      <Flex align="baseline" gap="1" wrap="wrap">
                        <Text as="label" htmlFor={`slot-${key}-key`} size="2" weight="medium">
                          API Key
                        </Text>
                        {!serverSlot?.apiKeyConfigured ? (
                          <Text size="2" color="red" weight="bold">
                            *
                          </Text>
                        ) : (
                          <Text size="2" color="gray" highContrast={false}>
                            （可选）
                          </Text>
                        )}
                      </Flex>
                      <TextField.Root
                        id={`slot-${key}-key`}
                        type="password"
                        autoComplete="off"
                        placeholder={
                          serverSlot?.apiKeyConfigured
                            ? "留空保留原密钥；或填新密钥"
                            : "线上接口必填（尚无已存密钥）"
                        }
                        value={d.apiKeyDraft}
                        onChange={(evt) =>
                          patchSlotDraft(key, {
                            apiKeyDraft: evt.target.value,
                            clearApiKey: false,
                          })
                        }
                      />
                      {serverSlot?.apiKeyConfigured ? (
                        <Button
                          type="button"
                          variant="soft"
                          color="red"
                          size="1"
                          onClick={() =>
                            patchSlotDraft(key, {
                              apiKeyDraft: "",
                              clearApiKey: true,
                            })
                          }
                        >
                          清除已存密钥（保存此槽时生效）
                        </Button>
                      ) : null}
                    </Flex>
                  </>
                ) : null}

                <Flex gap="2" justify="end" wrap="wrap">
                  <Button
                    type="button"
                    variant="soft"
                    color="gray"
                    disabled={!dirty || patchM.isPending}
                    onClick={() => discardSlot(key)}
                  >
                    丢弃此槽未保存改动
                  </Button>
                  <Button
                    type="button"
                    disabled={!dirty || patchM.isPending}
                    onClick={() => saveSlot(key)}
                  >
                    {savingThis ? "保存中…" : "保存此槽位"}
                  </Button>
                </Flex>

                <InferenceTestBlock
                  slotKey={key}
                  modelDraft={d.model}
                  intro="基于该槽已保存的配置（若刚改表单请先按上方「保存此槽位」再测）。"
                />
              </Flex>
            </Card>
          );
        })}
      </Flex>
    </Flex>
  );
};
