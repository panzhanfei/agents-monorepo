import type { IAgentChatConversationRow, IAgentChatMessageRow } from "@agents/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Box, Button, Flex, Heading, Spinner, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink, useParams, useSearchParams } from "react-router-dom";
import { getRunnerBase, streamEntryAgentChat } from "@/api";
import {
  invalidateProjectChatQueries,
  useAppendProjectChatMessageMutation,
  useClearConversationMessagesMutation,
  useCreateProjectChatConversationMutation,
  useDeleteProjectChatConversationMutation,
  usePatchProjectChatConversationMutation,
  useProjectChatConversationsQuery,
  useProjectChatMessagesQuery,
  useProjectsListQuery,
} from "@/hooks";

/** 原生容器替代 Radix Card，避免 Card 内部样式把 flex/grid 子项高度算成 0、输入框被裁切 */
const DIALOGUE_SHELL =
  "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--gray-a6)] bg-[var(--gray-a2)] shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const rowsToLines = (messages: IAgentChatMessageRow[]): ChatLine[] => {
  const out: ChatLine[] = [];
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ id: m.id, role: m.role, text: m.content });
    }
  }
  return out;
};

const conversationRowLabel = (c: IAgentChatConversationRow): string => {
  const t = c.title?.trim();
  if (t) return t.length > 40 ? `${t.slice(0, 40)}…` : t;
  const d = new Date(c.updatedAt);
  return `会话 · ${d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

const tokenRemainingPct = (remaining: number, total: number): number =>
  total <= 0 ? 0 : clampPct((remaining / total) * 100);

const tokenBarColorVar = (remainingPct: number): string =>
  remainingPct <= 10 ? "var(--red-9)" : remainingPct <= 28 ? "var(--amber-9)" : "var(--jade-9)";

export const ProjectDialoguePage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get("conversationId") ?? "";

  const projectsQ = useProjectsListQuery();
  const conversationsQ = useProjectChatConversationsQuery(projectId);
  const messagesQ = useProjectChatMessagesQuery(projectId, conversationId);
  const appendM = useAppendProjectChatMessageMutation();
  const clearMsgsM = useClearConversationMessagesMutation();
  const deleteConvM = useDeleteProjectChatConversationMutation();
  const createConvM = useCreateProjectChatConversationMutation();
  const patchConvM = usePatchProjectChatConversationMutation();

  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId) ?? null,
    [projectsQ.data, projectId],
  );

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitleDraft, setEditingTitleDraft] = useState("");

  const creatingDefaultRef = useRef(false);

  useEffect(() => {
    creatingDefaultRef.current = false;
    setEditingConversationId(null);
    setEditingTitleDraft("");
  }, [projectId]);

  useEffect(() => {
    if (!projectId || conversationsQ.isPending || conversationsQ.isError) return;
    const list = conversationsQ.data?.conversations ?? [];
    if (list.length > 0) return;
    if (creatingDefaultRef.current || createConvM.isPending) return;
    creatingDefaultRef.current = true;
    void createConvM
      .mutateAsync({ projectId })
      .then((res) => {
        setSearchParams({ conversationId: res.conversation.id }, { replace: true });
      })
      .catch(() => {
        creatingDefaultRef.current = false;
      });
  }, [
    projectId,
    conversationsQ.isPending,
    conversationsQ.isError,
    conversationsQ.data?.conversations,
    createConvM,
    setSearchParams,
  ]);

  useEffect(() => {
    const list = conversationsQ.data?.conversations ?? [];
    if (conversationsQ.isPending || list.length === 0) return;
    const valid = conversationId.length > 0 && list.some((c) => c.id === conversationId);
    if (!valid) {
      setSearchParams({ conversationId: list[0].id }, { replace: true });
    }
  }, [
    conversationsQ.data?.conversations,
    conversationsQ.isPending,
    conversationId,
    setSearchParams,
  ]);

  useEffect(() => {
    setBudgetRemaining(null);
    setBudgetTotal(null);
    setLogLines([]);
    setEditingConversationId(null);
    setEditingTitleDraft("");
  }, [conversationId]);

  useEffect(() => {
    if (sending) return;
    if (!messagesQ.data) {
      setLines([]);
      return;
    }
    setLines(rowsToLines(messagesQ.data.messages));
  }, [messagesQ.data, sending]);

  const startNewConversationRound = useCallback(
    async (reason: "manual" | "budget"): Promise<void> => {
      if (!projectId || createConvM.isPending) return;
      try {
        const res = await createConvM.mutateAsync({ projectId });
        setSearchParams({ conversationId: res.conversation.id }, { replace: true });
        setLogLines((prev) => [
          ...prev,
          reason === "budget"
            ? "[ui] 本轮 Token 额度用尽，已切换到新会话。"
            : "[ui] 已新建会话。",
        ]);
      } catch {
        /* noop */
      }
    },
    [projectId, createConvM, setSearchParams],
  );

  const clearCurrentConversationMessages = async (): Promise<void> => {
    if (!projectId || conversationId.length === 0 || clearMsgsM.isPending || sending) return;
    await clearMsgsM.mutateAsync({ projectId, conversationId });
    setLogLines((prev) => [...prev, "[ui] 已清空当前会话消息。"]);
  };

  const deleteConversationRow = async (cid: string): Promise<void> => {
    if (!projectId || deleteConvM.isPending) return;
    await deleteConvM.mutateAsync({ projectId, conversationId: cid });
    if (cid === conversationId) {
      setSearchParams({}, { replace: true });
    }
    if (cid === editingConversationId) {
      setEditingConversationId(null);
      setEditingTitleDraft("");
    }
  };

  const saveConversationTitle = async (): Promise<void> => {
    if (!projectId || editingConversationId === null || patchConvM.isPending) return;
    const trimmed = editingTitleDraft.trim();
    await patchConvM.mutateAsync({
      projectId,
      conversationId: editingConversationId,
      title: trimmed.length === 0 ? null : trimmed,
    });
    setEditingConversationId(null);
    setEditingTitleDraft("");
  };

  const onSend = (e: FormEvent): void => {
    e.preventDefault();
    if (sending || messagesQ.isPending || conversationId.length === 0) return;
    const trimmed = input.trim();
    if (!trimmed || !projectId) return;

    const iso = new Date().toISOString();
    const pendingAssistantId = `pending-${Date.now()}`;

    const payloadMessages = [
      ...lines
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.text })),
      { role: "user" as const, content: trimmed },
    ];

    setSending(true);
    setInput("");

    const run = async (): Promise<void> => {
      let userSaved = false;
      let assistantAcc = "";

      const appendAssistantToApi = async (text: string): Promise<void> => {
        const body = text.trim().length > 0 ? text : "（无输出）";
        await appendM.mutateAsync({
          projectId,
          conversationId,
          role: "assistant",
          content: body,
        });
      };

      try {
        const { message: userRow } = await appendM.mutateAsync({
          projectId,
          conversationId,
          role: "user",
          content: trimmed,
        });
        userSaved = true;

        setLines((prev) => [
          ...prev,
          { id: userRow.id, role: "user", text: trimmed },
          { id: pendingAssistantId, role: "assistant", text: "" },
        ]);

        setLogLines((prev) => [...prev, `[${iso}] send → ${getRunnerBase()}/v1/agent/entry/chat`]);

        let budgetDepleted = false;

        await streamEntryAgentChat({
          messages: payloadMessages,
          projectId,
          onToken: (tok) => {
            assistantAcc += tok;
            setLines((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, text: last.text + tok };
              }
              return next;
            });
          },
          onLog: (line) => setLogLines((prev) => [...prev, line]),
          onBudget: ({ remaining, total }) => {
            setBudgetRemaining(remaining);
            setBudgetTotal(total);
          },
          onBudgetExhausted: () => {
            budgetDepleted = true;
          },
        });

        await appendAssistantToApi(assistantAcc);
        if (budgetDepleted) {
          await startNewConversationRound("budget");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "请求失败";
        const merged =
          assistantAcc.trim().length > 0
            ? `${assistantAcc}\n\n（错误）${msg}`
            : `（错误）${msg}`;
        assistantAcc = merged;
        setLines((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = { ...last, text: merged };
          }
          return next;
        });
        setLogLines((prev) => [...prev, `[error] ${msg}`]);

        if (userSaved) {
          await appendAssistantToApi(merged);
        }
      } finally {
        await invalidateProjectChatQueries(qc, projectId);
        setSending(false);
      }
    };

    void run();
  };

  const chatLoading =
    conversationId.length > 0 && messagesQ.isPending && lines.length === 0 && !sending;

  const budgetLabel =
    budgetRemaining !== null && budgetTotal !== null
      ? `${budgetRemaining} / ${budgetTotal}`
      : "—";

  const tokenPct =
    budgetRemaining !== null && budgetTotal !== null && budgetTotal > 0
      ? tokenRemainingPct(budgetRemaining, budgetTotal)
      : null;

  const conversations = conversationsQ.data?.conversations ?? [];
  const sidebarBusy =
    conversationsQ.isPending ||
    createConvM.isPending ||
    (conversations.length === 0 && !conversationsQ.isError);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden">
      <Flex align="start" justify="between" gap="4" wrap="wrap" className="shrink-0">
        <Box>
          <Heading size="6" mb="1">
            对话
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            <RouterLink to="/projects" className="text-inherit">
              ← 返回项目列表
            </RouterLink>
            {project ? ` · ${project.name}` : projectId ? ` · ${projectId}` : null}
          </Text>
          <Text color="gray" size="2" highContrast={false} mt="1">
            消息按<strong>会话</strong>保存在云端（左侧列表切换）。推理走本机 Runner；{getRunnerBase()}
            ，可用 VITE_RUNNER_BASE 覆盖。
          </Text>
        </Box>
        <Flex gap="2" wrap="wrap" justify="end">
          <Button type="button" size="2" variant="soft" color="gray" asChild>
            <RouterLink to={`/projects/${projectId}/config`}>配置</RouterLink>
          </Button>
          <Button type="button" size="2" variant="soft" color="gray" asChild>
            <RouterLink to={`/projects/${projectId}/tasks`}>任务</RouterLink>
          </Button>
        </Flex>
      </Flex>

      <Flex
        direction={{ initial: "column", lg: "row" }}
        gap="4"
        className="min-h-[min(560px,calc(100dvh-10rem))] min-w-0 flex-1 items-stretch overflow-hidden"
      >
        <section
          className={`${DIALOGUE_SHELL} max-h-[min(44vh,400px)] w-full max-w-[308px] flex-none self-stretch p-4 lg:max-h-none`}
        >
          <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(12rem,1fr)] gap-3">
            <Flex direction="column" className="min-h-0 shrink-0">
              <Heading size="4" mb="2">
                会话列表
              </Heading>
              <Button
                type="button"
                size="1"
                variant="soft"
                mb="0"
                disabled={sending || sidebarBusy || !projectId}
                onClick={() => void startNewConversationRound("manual")}
              >
                新会话
              </Button>
            </Flex>
            <Box className="min-h-0 overflow-x-hidden overflow-y-scroll overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y">
            {conversationsQ.isError ? (
              <Text color="red" size="2">
                无法加载会话列表。
              </Text>
            ) : sidebarBusy ? (
              <Flex align="center" gap="2">
                <Spinner size="2" />
                <Text color="gray" size="2" highContrast={false}>
                  加载中…
                </Text>
              </Flex>
            ) : (
              <Flex direction="column" gap="2">
                {conversations.map((c) => {
                  const active = c.id === conversationId;
                  const isEditing = editingConversationId === c.id;
                  return (
                    <Flex
                      key={c.id}
                      direction="column"
                      gap="2"
                      p="2"
                      className={[
                        "rounded-lg border-l-[3px]",
                        c.pinned ? "border-l-[var(--amber-9)]" : "border-l-transparent",
                        active ? "bg-[var(--accent-a3)]" : "bg-[var(--gray-a2)]",
                      ].join(" ")}
                    >
                      {isEditing ? (
                        <Flex direction="column" gap="2">
                          <TextField.Root
                            placeholder="会话标题（留空则恢复默认展示）"
                            value={editingTitleDraft}
                            maxLength={200}
                            onChange={(evt) => setEditingTitleDraft(evt.target.value)}
                            disabled={patchConvM.isPending}
                          />
                          <Flex gap="2" justify="end" wrap="wrap">
                            <Button
                              type="button"
                              size="1"
                              variant="soft"
                              disabled={patchConvM.isPending}
                              onClick={() => {
                                setEditingConversationId(null);
                                setEditingTitleDraft("");
                              }}
                            >
                              取消
                            </Button>
                            <Button
                              type="button"
                              size="1"
                              disabled={patchConvM.isPending}
                              onClick={() => void saveConversationTitle()}
                            >
                              {patchConvM.isPending ? "保存中…" : "保存"}
                            </Button>
                          </Flex>
                        </Flex>
                      ) : (
                        <>
                          <Flex align="center" gap="2" wrap="wrap">
                            <Button
                              type="button"
                              size="1"
                              variant={c.pinned ? "solid" : "soft"}
                              color={c.pinned ? "amber" : "gray"}
                              disabled={patchConvM.isPending || sending}
                              title={c.pinned ? "取消置顶" : "置顶"}
                              onClick={(evt) => {
                                evt.preventDefault();
                                void patchConvM.mutateAsync({
                                  projectId,
                                  conversationId: c.id,
                                  pinned: !c.pinned,
                                });
                              }}
                            >
                              {c.pinned ? "取消置顶" : "置顶"}
                            </Button>
                            <Box
                              className="min-w-0 flex-[1_1_120px] cursor-pointer"
                              onClick={() =>
                                setSearchParams({ conversationId: c.id }, { replace: true })
                              }
                            >
                              <Text size="2" weight={active ? "bold" : "medium"} asChild>
                                <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                  {conversationRowLabel(c)}
                                </span>
                              </Text>
                            </Box>
                          </Flex>
                          <Flex gap="2" justify="end" wrap="wrap">
                            <Button
                              type="button"
                              size="1"
                              variant="ghost"
                              disabled={patchConvM.isPending || sending}
                              onClick={(evt) => {
                                evt.preventDefault();
                                setEditingConversationId(c.id);
                                setEditingTitleDraft(c.title?.trim() ?? "");
                              }}
                            >
                              改名
                            </Button>
                            <Button
                              type="button"
                              size="1"
                              variant="ghost"
                              color="red"
                              disabled={deleteConvM.isPending || sending}
                              onClick={(evt) => {
                                evt.preventDefault();
                                void deleteConversationRow(c.id);
                              }}
                            >
                              删除
                            </Button>
                          </Flex>
                        </>
                      )}
                    </Flex>
                  );
                })}
              </Flex>
            )}
          </Box>
          </div>
        </section>

        <Flex direction="column" gap="4" className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Flex
            direction={{ initial: "column", md: "row" }}
            gap="4"
            className="min-h-0 min-w-0 flex-1 items-stretch overflow-hidden"
          >
            <section className={`${DIALOGUE_SHELL} flex-1 p-4`}>
              <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_auto_minmax(12rem,1fr)_auto] gap-3">
                <Flex align="center" justify="between" gap="3" wrap="wrap" className="min-h-0 shrink-0">
                  <Heading size="4" mb="0">
                    会话
                  </Heading>
                  <Flex align="center" gap="2" wrap="wrap">
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      disabled={sending || sidebarBusy || !projectId}
                      onClick={() => void startNewConversationRound("manual")}
                    >
                      新会话
                    </Button>
                    <Button
                      type="button"
                      size="1"
                      variant="soft"
                      color="red"
                      disabled={
                        sending ||
                        messagesQ.isPending ||
                        clearMsgsM.isPending ||
                        !projectId ||
                        conversationId.length === 0
                      }
                      onClick={() => void clearCurrentConversationMessages()}
                    >
                      {clearMsgsM.isPending ? "清空中…" : "清空对话"}
                    </Button>
                  </Flex>
                </Flex>

                <Box className="min-h-0 shrink-0">
                  <Flex justify="between" align="center" gap="2" wrap="wrap" mb="1">
                    <Text size="1" color="gray" highContrast={false}>
                      本轮 Token（估算）
                    </Text>
                    <Text size="1" color="gray" highContrast={false}>
                      剩余 <strong>{budgetLabel}</strong>
                      {tokenPct !== null ? (
                        <span className="ml-1 opacity-90">· {Math.round(tokenPct)}%</span>
                      ) : null}
                    </Text>
                  </Flex>
                  {tokenPct !== null ? (
                    <Box
                      role="progressbar"
                      aria-valuenow={budgetRemaining ?? undefined}
                      aria-valuemin={0}
                      aria-valuemax={budgetTotal ?? undefined}
                      className="h-1 overflow-hidden rounded-full bg-[var(--gray-a4)]"
                    >
                      <Box
                        className="h-full transition-[width] duration-300 ease-in-out"
                        style={{
                          width: `${tokenPct}%`,
                          background: tokenBarColorVar(tokenPct),
                        }}
                      />
                    </Box>
                  ) : (
                    <Text size="1" color="gray" highContrast={false}>
                      发送消息后随 Runner SSE 更新。
                    </Text>
                  )}
                  {messagesQ.isError ? (
                    <Text color="red" size="2" mt="2">
                      无法加载当前会话消息。
                    </Text>
                  ) : null}
                </Box>

                <Box className="min-h-0 overflow-x-hidden overflow-y-scroll overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y">
                  <Flex direction="column" gap="3" className="mx-auto w-full max-w-2xl px-1 py-2">
                    {conversationId.length === 0 ? (
                      <Flex align="center" justify="center" py="8">
                        <Text color="gray" size="2" highContrast={false}>
                          正在准备会话…
                        </Text>
                      </Flex>
                    ) : chatLoading ? (
                      <Flex align="center" justify="center" gap="2" py="8">
                        <Spinner size="2" />
                        <Text color="gray" size="2" highContrast={false}>
                          正在加载历史消息…
                        </Text>
                      </Flex>
                    ) : lines.length === 0 ? (
                      <Flex align="center" justify="center" py="8" px="2">
                        <Text color="gray" size="2" highContrast={false} className="text-center">
                          尚无消息。请确认本机 agents-runner 已启动，并已在「Agent 配置」中填写 router
                          槽位的模型与网关。
                        </Text>
                      </Flex>
                    ) : (
                      lines.map((m) => (
                        <Box
                          key={m.id}
                          px="3"
                          py="2"
                          className={[
                            "max-w-[min(92%,36rem)] rounded-2xl text-[15px] leading-relaxed",
                            m.role === "user"
                              ? "ml-auto bg-[var(--gray-a4)] text-[var(--gray-12)]"
                              : "mr-auto border border-[var(--gray-a6)] bg-[var(--gray-a3)] text-[var(--gray-12)]",
                          ].join(" ")}
                        >
                          <Text size="1" weight="bold" mb="1" color="gray">
                            {m.role === "user" ? "你" : "入口 Agent"}
                          </Text>
                          <Text size="2" className="whitespace-pre-wrap break-words">
                            {m.text}
                          </Text>
                        </Box>
                      ))
                    )}
                  </Flex>
                </Box>

                <form onSubmit={onSend} className="min-h-0 shrink-0">
                  <Box className="rounded-2xl border border-[var(--gray-a7)] bg-[var(--gray-a3)] p-3 shadow-[0_12px_40px_-16px_rgb(0_0_0/0.45)]">
                    <Flex gap="3" align="end">
                      <Box className="min-w-0 flex-1 [&_.rt-TextFieldInput]:min-h-[44px] [&_.rt-TextFieldInput]:rounded-xl [&_.rt-TextFieldInput]:border-[var(--gray-a7)] [&_.rt-TextFieldInput]:bg-[var(--gray-a2)]">
                        <TextField.Root
                          placeholder="发消息或输入指令…"
                          value={input}
                          onChange={(evt) => setInput(evt.target.value)}
                          disabled={sending || messagesQ.isPending || conversationId.length === 0}
                        />
                      </Box>
                      <Button
                        type="submit"
                        size="3"
                        disabled={sending || messagesQ.isPending || conversationId.length === 0}
                        className="shrink-0 rounded-xl px-5"
                      >
                        {sending ? "生成中…" : "发送"}
                      </Button>
                    </Flex>
                  </Box>
                </form>
              </div>
            </section>

            <section className={`${DIALOGUE_SHELL} flex-1 p-4`}>
              <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(12rem,1fr)] gap-3">
                <Heading size="4" mb="0" className="min-h-0 shrink-0">
                  日志
                </Heading>
                <Box className="min-h-0 overflow-x-hidden overflow-y-scroll overscroll-y-contain [-webkit-overflow-scrolling:touch] touch-pan-y">
                  <Box
                    pr="2"
                    pb="2"
                    className="break-words whitespace-pre-wrap text-[length:var(--font-size-2)] [font-family:var(--mono-font-family,ui-monospace)]"
                  >
                    {logLines.length === 0 ? (
                      <Text color="gray" size="2" highContrast={false}>
                        与本页 Runner 请求相关的一行级日志。
                      </Text>
                    ) : (
                      logLines.join("\n")
                    )}
                  </Box>
                </Box>
              </div>
            </section>
          </Flex>
        </Flex>
      </Flex>
    </div>
  );
};
