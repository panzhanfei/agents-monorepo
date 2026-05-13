import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  type IAuthPatchMeBody,
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

const buildSlotsPatch = (draft: Record<IAgentSlotKey, ISlotDraft>): IAuthPatchMeBody["agentSlots"] => {
  const out: IAuthPatchMeBody["agentSlots"] = {};
  for (const key of AGENT_SLOT_KEYS) {
    const d = draft[key];
    if (!d.model.trim()) {
      out[key] = null;
      continue;
    }
    const baseTrim = d.baseUrl.trim();
    const baseUrlVal = baseTrim === "" ? null : baseTrim;
    if (d.mode === "local") {
      out[key] = {
        mode: "local",
        model: d.model.trim(),
        baseUrl: baseUrlVal,
      };
    } else {
      const hp = d.hostedProvider.trim();
      out[key] = {
        mode: "hosted",
        model: d.model.trim(),
        baseUrl: baseUrlVal,
        hostedProvider: hp === "" ? null : hp,
        ...(d.clearApiKey ? { apiKey: null } : d.apiKeyDraft.trim() ? { apiKey: d.apiKeyDraft.trim() } : {}),
      };
    }
  }
  return out;
};

const draftFromServerSlots = (
  agentSlots: Record<IAgentSlotKey, { mode: IAgentInferenceMode; baseUrl: string | null; hostedProvider: string | null; model: string }>,
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

export const AgentModelsPage = () => {
  const meQ = useMeQuery();
  const patchM = usePatchAuthMeMutation();

  const agentSlots = meQ.data?.user.agentSlots;

  const [draft, setDraft] = useState<Record<IAgentSlotKey, ISlotDraft>>(initialDraftRecord);

  useEffect(() => {
    if (!agentSlots) return;
    setDraft(draftFromServerSlots(agentSlots));
  }, [agentSlots]);

  const loadError = meQ.isError
    ? meQ.error instanceof ApiError
      ? meQ.error.message
      : "Failed to load profile"
    : null;
  const saveError = patchM.isError
    ? getMutationErrorMessage(patchM.error, "Failed to save agent config")
    : null;
  const error = loadError ?? saveError;

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    patchM.mutate({ agentSlots: buildSlotsPatch(draft) });
  };

  const serverSnapshot = useMemo(() => (agentSlots ? draftFromServerSlots(agentSlots) : null), [agentSlots]);

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
              每个角色单独选择本地或线上，并填写自己的网关地址、（线上）密钥与模型名。互不影响。
            </Text>
          </Flex>
        </Box>
        <Button type="button" variant="soft" color="gray" size="2" asChild>
          <RouterLink to="/settings">设置</RouterLink>
        </Button>
      </Flex>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <form onSubmit={onSubmit}>
        <Flex direction="column" gap="4">
          {SLOT_META.map(({ key, label }) => {
            const d = draft[key];
            const serverSlot = agentSlots?.[key];
            return (
              <Card key={key} size="2">
                <Flex direction="column" gap="4">
                  <Heading size="4">
                    {label}（{key}）
                  </Heading>

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
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], mode: "local" },
                          }))
                        }
                      >
                        本地 / 自建
                      </Button>
                      <Button
                        type="button"
                        size="2"
                        variant={d.mode === "hosted" ? "solid" : "soft"}
                        color="gray"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], mode: "hosted" },
                          }))
                        }
                      >
                        线上 API
                      </Button>
                    </Flex>
                  </Box>

                  <Flex direction="column" gap="1">
                    <Text as="label" htmlFor={`slot-${key}-base`} size="2" weight="medium">
                      Base URL
                    </Text>
                    <TextField.Root
                      id={`slot-${key}-base`}
                      placeholder={
                        d.mode === "local" ? "如 http://127.0.0.1:11434" : "可空则探测时用 api.openai.com"
                      }
                      value={d.baseUrl}
                      onChange={(evt) =>
                        setDraft((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], baseUrl: evt.target.value },
                        }))
                      }
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
                          onChange={(evt) =>
                            setDraft((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], hostedProvider: evt.target.value },
                            }))
                          }
                        />
                      </Flex>
                      <Flex direction="column" gap="2">
                        <Flex direction="column" gap="1">
                          <Text as="label" htmlFor={`slot-${key}-key`} size="2" weight="medium">
                            API Key
                          </Text>
                          <TextField.Root
                            id={`slot-${key}-key`}
                            type="password"
                            autoComplete="off"
                            placeholder={
                              serverSlot?.apiKeyConfigured
                                ? "留空保留原密钥；或填新密钥"
                                : "线上接口通常需要"
                            }
                            value={d.apiKeyDraft}
                            onChange={(evt) =>
                              setDraft((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  apiKeyDraft: evt.target.value,
                                  clearApiKey: false,
                                },
                              }))
                            }
                          />
                        </Flex>
                        {serverSlot?.apiKeyConfigured ? (
                          <Button
                            type="button"
                            variant="soft"
                            color="red"
                            size="1"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                [key]: {
                                  ...prev[key],
                                  apiKeyDraft: "",
                                  clearApiKey: true,
                                },
                              }))
                            }
                          >
                            保存时清除已存密钥
                          </Button>
                        ) : null}
                      </Flex>
                    </>
                  ) : null}

                  <Flex direction="column" gap="1">
                    <Text as="label" htmlFor={`slot-${key}-model`} size="2" weight="medium">
                      模型名 / 模型 ID
                    </Text>
                    <TextField.Root
                      id={`slot-${key}-model`}
                      placeholder={
                        d.mode === "local" ? "如 qwen2.5:latest" : "如 gpt-4o"
                      }
                      value={d.model}
                      onChange={(evt) =>
                        setDraft((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], model: evt.target.value },
                        }))
                      }
                    />
                    <Text size="1" color="gray" highContrast={false}>
                      留空本槽并保存将删除该槽服务端配置。
                    </Text>
                  </Flex>

                  <InferenceTestBlock
                    slotKey={key}
                    modelDraft={d.model}
                    intro="基于该槽已保存的配置（若刚改表单请先保存再测）。"
                  />
                </Flex>
              </Card>
            );
          })}

          <Flex gap="2" justify="end" wrap="wrap">
            <Button
              type="button"
              variant="soft"
              color="gray"
              onClick={() => {
                if (serverSnapshot) setDraft(serverSnapshot);
              }}
            >
              丢弃未保存改动
            </Button>
            <Button type="submit" disabled={patchM.isPending}>
              {patchM.isPending ? "保存中…" : "保存全部槽位"}
            </Button>
          </Flex>
        </Flex>
      </form>
    </Flex>
  );
};
