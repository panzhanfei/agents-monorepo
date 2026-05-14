import { useMemo, useState, type FormEvent } from "react";
import { Box, Button, Card, Flex, Heading, ScrollArea, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getRunnerBase, streamEntryAgentChat } from "@/api";
import { useProjectsListQuery } from "@/hooks";

type ChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export const ProjectDialoguePage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";

  const projectsQ = useProjectsListQuery();
  const project = useMemo(
    () => (projectsQ.data ?? []).find((p) => p.id === projectId) ?? null,
    [projectsQ.data, projectId],
  );

  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [logLines, setLogLines] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const onSend = (e: FormEvent): void => {
    e.preventDefault();
    if (sending) return;
    const trimmed = input.trim();
    if (!trimmed) return;

    const iso = new Date().toISOString();
    const idBase = `${Date.now()}`;
    const payloadMessages = [
      ...lines
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({ role: m.role, content: m.text })),
      { role: "user" as const, content: trimmed },
    ].filter((m) => m.role === "user" || m.role === "assistant");

    setSending(true);
    setInput("");
    setLines((prev) => [
      ...prev,
      { id: `${idBase}-u`, role: "user", text: trimmed },
      { id: `${idBase}-a`, role: "assistant", text: "" },
    ]);
    setLogLines((prev) => [...prev, `[${iso}] send → ${getRunnerBase()}/v1/agent/entry/chat`]);

    void streamEntryAgentChat({
      messages: payloadMessages,
      projectId: projectId || undefined,
      onToken: (tok) => {
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
    })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "请求失败";
        setLines((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "assistant") {
            next[next.length - 1] = {
              ...last,
              text:
                last.text.trim().length > 0
                  ? `${last.text}\n\n（错误）${msg}`
                  : `（错误）${msg}`,
            };
          }
          return next;
        });
        setLogLines((prev) => [...prev, `[error] ${msg}`]);
      })
      .finally(() => {
        setSending(false);
      });
  };

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
            本页走本机 Runner 入口 Agent（槽位 router）；地址 {getRunnerBase()} · 可用环境变量{" "}
            VITE_RUNNER_BASE
            覆盖默认端口。
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
          <ScrollArea style={{ flex: 1 }} scrollbars="vertical">
            <Flex direction="column" gap="2" pr="2" pb="2">
              {lines.length === 0 ? (
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
                  disabled={sending}
                />
              </Box>
              <Button type="submit" disabled={sending}>
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
