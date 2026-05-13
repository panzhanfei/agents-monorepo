import { useMemo, useState, type FormEvent } from "react";
import { Box, Button, Card, Flex, Heading, ScrollArea, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink, useParams } from "react-router-dom";
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

  const onSend = (e: FormEvent): void => {
    e.preventDefault();
    const t = input.trim();
    if (!t) return;
    const ts = new Date().toISOString();
    setLines((prev) => [
      ...prev,
      { id: `${ts}-u`, role: "user", text: t },
      {
        id: `${ts}-a`,
        role: "assistant",
        text: "（对话通道尚未接入后端，此为占位回复。）",
      },
    ]);
    setLogLines((prev) => [...prev, `[${ts}] send: ${t}`]);
    setInput("");
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
                  尚无消息。开始在下方输入；接入 API 后可与 Agent 实时对话。
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
                      {m.role === "user" ? "你" : "Assistant"}
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
                />
              </Box>
              <Button type="submit">发送</Button>
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
                  Runner / Agent 运行日志将显示于此（当前为前端占位）。
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
