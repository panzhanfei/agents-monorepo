import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import type { IChatLine } from "./interface";
import { rowsToLines, tokenRemainingPct } from "./utils";

export const useProjectDialoguePage = () => {
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

  const [lines, setLines] = useState<IChatLine[]>([]);
  const [input, setInput] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [budgetRemaining, setBudgetRemaining] = useState<number | null>(null);
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitleDraft, setEditingTitleDraft] = useState("");
  const [sessionListCollapsed, setSessionListCollapsed] = useState(false);
  const [logsCollapsed, setLogsCollapsed] = useState(false);

  const creatingDefaultRef = useRef(false);
  const convScrollParentRef = useRef<HTMLDivElement | null>(null);
  const msgsScrollParentRef = useRef<HTMLDivElement | null>(null);
  const logsScrollParentRef = useRef<HTMLDivElement | null>(null);

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

  const conversationVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => convScrollParentRef.current,
    estimateSize: () => 112,
    overscan: 6,
    getItemKey: (index) => conversations[index]?.id ?? index,
  });

  const msgVirtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => msgsScrollParentRef.current,
    estimateSize: () => 96,
    overscan: 10,
    getItemKey: (index) => lines[index]?.id ?? index,
  });

  const logVirtualizer = useVirtualizer({
    count: logLines.length,
    getScrollElement: () => logsScrollParentRef.current,
    estimateSize: () => 22,
    overscan: 24,
    getItemKey: (index) => `log-${index}`,
  });

  const lastBubbleChars = lines.length > 0 ? lines[lines.length - 1]?.text.length ?? 0 : 0;

  useEffect(() => {
    if (lines.length === 0) return;
    msgVirtualizer.scrollToIndex(lines.length - 1, { align: "end" });
  }, [lines.length, lastBubbleChars, msgVirtualizer]);

  return {
    projectId,
    conversationId,
    project,
    setSearchParams,
    lines,
    input,
    setInput,
    logLines,
    sending,
    budgetRemaining,
    budgetTotal,
    editingConversationId,
    setEditingConversationId,
    editingTitleDraft,
    setEditingTitleDraft,
    sessionListCollapsed,
    setSessionListCollapsed,
    logsCollapsed,
    setLogsCollapsed,
    convScrollParentRef,
    msgsScrollParentRef,
    logsScrollParentRef,
    conversationsQ,
    messagesQ,
    appendM,
    clearMsgsM,
    deleteConvM,
    createConvM,
    patchConvM,
    startNewConversationRound,
    clearCurrentConversationMessages,
    deleteConversationRow,
    saveConversationTitle,
    onSend,
    chatLoading,
    budgetLabel,
    tokenPct,
    conversations,
    sidebarBusy,
    conversationVirtualizer,
    msgVirtualizer,
    logVirtualizer,
  };
};

export type IProjectDialoguePageViewModel = ReturnType<typeof useProjectDialoguePage>;
