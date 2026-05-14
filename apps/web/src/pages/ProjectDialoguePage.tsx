import type { IAgentChatMessageRow } from "@agents/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Box, Button, Card, Flex, Heading, ScrollArea, Spinner, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getRunnerBase, streamEntryAgentChat } from "@/api";
import {
  projectChatQueryKey,
  useAppendProjectChatMessageMutation,
  useProjectChatQuery,
  useProjectsListQuery,
} from "@/hooks";

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

export const ProjectDialoguePage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";
  const qc = useQueryClient();

  const projectsQ = useProjectsListQuery();
  const chatQ = useProjectChatQuery(projectId);
  const appendM = useAppendProjectChatMessageMutation();

  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId) ?? null,
    [projectsQ.data, projectId],
  );

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (sending) return;
    if (!chatQ.data) {
      setLines([]);
      return;
    }
    setLines(rowsToLines(chatQ.data.messages));
  }, [chatQ.data, sending]);

  const onSend = (e: FormEvent): void => {
    e.preventDefault();
    if (sending || chatQ.isPending) return;
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
          role: "assistant",
          content: body,
        });
      };

      try {
        const { message: userRow } = await appendM.mutateAsync({
          projectId,
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
        });

        await appendAssistantToApi(assistantAcc);
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
        await qc.invalidateQueries({ queryKey: projectChatQueryKey(projectId) });
        setSending(false);
      }
    };

    void run();
  };

  const chatLoading = chatQ.isPending && lines.length === 0 && !sending;

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            对话
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            <RouterLink to="/projects" style={{ color: "inherit" }}>
              ← 返回项目列表
            </RouterLink>
            {project ? ` · ${project.name}` : projectId ? ` · ${projectId}` : null}
          </Text>
          <Text color="gray" size="2" highContrast={false} mt="1">
            消息保存在云端（按项目）。推理仍走本机 Runner（槽位 router）；{getRunnerBase()} · 可用{" "}
            VITE_RUNNER_BASE 覆盖。
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
        direction={{ initial: "column", md: "row" }}
        gap="4"
        style={{ minHeight: "min(70vh, 720px)", alignItems: "stretch" }}
      >
        <Card size="2" style={{ flex: "1 1 50%", display: "flex", flexDirection: "column", minHeight: 280 }}>
          <Heading size="4" mb="3">
            会话
          </Heading>
          {chatQ.isError ? (
            <Text color="red" size="2" mb="2">
              无法加载历史记录，请稍后重试。
            </Text>
          ) : null}
          <ScrollArea style={{ flex: 1 }} scrollbars="vertical">
            <Flex direction="column" gap="2" pr="2" pb="2">
              {chatLoading ? (
                <Flex align="center" gap="2">
                  <Spinner size="2" />
                  <Text color="gray" size="2" highContrast={false}>
                    正在加载历史消息…
                  </Text>
                </Flex>
              ) : lines.length === 0 ? (
                <Text color="gray" size="2" highContrast={false}>
                  尚无消息。请确认本机 agents-runner 已启动，并已在「Agent 配置」中填写 router
                  槽位的模型与网关。
                </Text>
              ) : (
                lines.map((m) => (
                  <Box
                    key={m.id}
                    p="2"
                    style={{
                      borderRadius: 8,
                      background:
                        m.role === "user" ? "var(--gray-a3)" : "var(--accent-a3)",
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "92%",
                    }}
                  >
                    <Text size="1" weight="bold" mb="1" color="gray">
                      {m.role === "user" ? "你" : "入口 Agent"}
                    </Text>
                    <Text size="2">{m.text}</Text>
                  </Box>
                ))
              )}
            </Flex>
          </ScrollArea>
          <form onSubmit={onSend}>
            <Flex gap="2" mt="3" align="end">
              <Box style={{ flex: 1 }}>
                <TextField.Root
                  placeholder="输入消息后回车发送…"
                  value={input}
                  onChange={(evt) => setInput(evt.target.value)}
                  disabled={sending || chatQ.isPending}
                />
              </Box>
              <Button type="submit" disabled={sending || chatQ.isPending}>
                {sending ? "生成中…" : "发送"}
              </Button>
            </Flex>
          </form>
        </Card>

        <Card size="2" style={{ flex: "1 1 50%", display: "flex", flexDirection: "column", minHeight: 280 }}>
          <Heading size="4" mb="3">
            日志
          </Heading>
          <ScrollArea style={{ flex: 1 }} scrollbars="vertical">
            <Box
              pr="2"
              pb="2"
              style={{
                fontFamily: "var(--mono-font-family, ui-monospace)",
                fontSize: "var(--font-size-2)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {logLines.length === 0 ? (
                <Text color="gray" size="2" highContrast={false}>
                  与本页 Runner 请求相关的一行级日志。
                </Text>
              ) : (
                logLines.join("\n")
              )}
            </Box>
          </ScrollArea>
        </Card>
      </Flex>
    </Flex>
  );
};
