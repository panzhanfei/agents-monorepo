import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Callout,
  Card,
  Code,
  Flex,
  Heading,
  Link,
  Select,
  Strong,
  Table,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { Link as RouterLink, useParams } from "react-router-dom";
import { ApiError } from "@/api";
import {
  getTasksMutationErrorMessage,
  useEnqueueTaskMutation,
  useRunnersListQuery,
  useTaskDetailQuery,
  useTasksByProjectQuery,
} from "@/hooks";

export const ProjectTasksPage = () => {
  const params = useParams();
  const projectId = params.projectId ?? "";

  const runnersQ = useRunnersListQuery();
  const tasksQ = useTasksByProjectQuery(projectId);
  const runners = useMemo(() => runnersQ.data ?? [], [runnersQ.data]);
  const tasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

  const [runnerDeviceId, setRunnerDeviceId] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(2500);
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const detailQ = useTaskDetailQuery(selectedTaskId, pollMs);
  const detail = detailQ.data ?? null;

  const enqueueM = useEnqueueTaskMutation(projectId);

  const selectedRunnerOnline = useMemo(() => {
    const r = runners.find((x) => x.id === runnerDeviceId);
    if (!r?.lastSeenAt) return false;
    const last = new Date(r.lastSeenAt).getTime();
    return Date.now() - last <= 120_000;
  }, [runnerDeviceId, runners]);

  useEffect(() => {
    if (!runnerDeviceId && runners.length > 0) {
      setRunnerDeviceId(runners[0].id);
    }
  }, [runnerDeviceId, runners]);

  const listLoadError = runnersQ.isError
    ? runnersQ.error instanceof ApiError
      ? runnersQ.error.message
      : "Failed to load runners"
    : null;
  const tasksLoadError = tasksQ.isError
    ? tasksQ.error instanceof ApiError
      ? tasksQ.error.message
      : "Failed to load tasks"
    : null;
  const enqueueError = enqueueM.isError ? getTasksMutationErrorMessage(enqueueM.error) : null;
  const error = listLoadError ?? tasksLoadError ?? payloadError ?? enqueueError;

  const onEnqueue = (e: FormEvent): void => {
    e.preventDefault();
    setPayloadError(null);
    enqueueM.reset();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setPayloadError("payload 必须是合法 JSON");
      return;
    }
    enqueueM.mutate({ projectId, runnerDeviceId, payload });
  };

  const reloadLists = (): void => {
    void runnersQ.refetch();
    void tasksQ.refetch();
  };

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            任务
          </Heading>
          <Flex align="center" gap="2" wrap="wrap">
            <Text color="gray" size="2" highContrast={false}>
              项目：
            </Text>
            <Code size="2" variant="soft">
              {projectId}
            </Code>
            <Text color="gray" size="2" highContrast={false}>
              ·
            </Text>
            <Link size="2" asChild>
              <RouterLink to="/projects">返回项目</RouterLink>
            </Link>
          </Flex>
        </Box>
        <Button type="button" variant="soft" color="gray" onClick={reloadLists}>
          刷新列表
        </Button>
      </Flex>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">入队</Heading>
          <Text color="gray" size="2" highContrast={false}>
            enqueue 会校验 Runner <Strong>心跳在线</Strong>。本地验收：先到 Runner 页面点心跳，再回到此处。
          </Text>

          <form onSubmit={onEnqueue}>
            <Flex direction="column" gap="3">
              <Flex direction="column" gap="1">
                <Text as="div" size="2" weight="medium">
                  Runner
                </Text>
                <Select.Root value={runnerDeviceId} onValueChange={setRunnerDeviceId} disabled={runners.length === 0}>
                  <Select.Trigger placeholder={runners.length === 0 ? "暂无 Runner" : "选择 Runner"} />
                  <Select.Content>
                    {runners.map((r) => (
                      <Select.Item key={r.id} value={r.id}>
                        {(r.displayName ?? r.deviceKey).slice(0, 48)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </Flex>

              <Callout.Root color={selectedRunnerOnline ? "blue" : "gray"}>
                <Callout.Text size="2">
                  Runner 心跳提示：{selectedRunnerOnline ? "近期有心跳（粗略判断）" : "可能离线（请先心跳）"}
                </Callout.Text>
              </Callout.Root>

              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="task-payload" size="2" weight="medium">
                  payload（JSON）
                </Text>
                <TextArea id="task-payload" rows={8} value={payloadText} onChange={(evt) => setPayloadText(evt.target.value)} />
              </Flex>

              <Button type="submit" disabled={enqueueM.isPending}>
                {enqueueM.isPending ? "提交中…" : "enqueue"}
              </Button>
            </Flex>
          </form>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Heading size="4">列表（轮询占位）</Heading>
            <Flex align="center" gap="2" wrap="wrap">
              <Text color="gray" size="2" highContrast={false}>
                间隔 ms
              </Text>
              <TextField.Root
                style={{ width: 120 }}
                type="number"
                min={500}
                step={100}
                value={String(pollMs)}
                onChange={(evt) => setPollMs(Number(evt.target.value))}
              />
            </Flex>
          </Flex>

          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>状态</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>任务 ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Runner</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="120px" justify="end" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {tasks.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={4}>
                      <Text color="gray" size="2" highContrast={false}>
                        {tasksQ.isPending ? "加载中…" : "暂无任务"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  tasks.map((t) => (
                    <Table.Row key={t.id}>
                      <Table.Cell>{t.status}</Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }} wrap="pretty">
                          {t.id}
                        </Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }} wrap="pretty">
                          {t.runnerDeviceId}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Button type="button" variant="soft" color="gray" size="1" onClick={() => setSelectedTaskId(t.id)}>
                          详情
                        </Button>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </Flex>
      </Card>

      {selectedTaskId ? (
        <Card size="2">
          <Flex direction="column" gap="3">
            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Heading size="4">详情</Heading>
              <Button type="button" variant="soft" color="gray" onClick={() => setSelectedTaskId(null)}>
                关闭
              </Button>
            </Flex>
            {detail ? (
              <Box
                p="3"
                style={{
                  borderRadius: "var(--radius-3)",
                  background: "var(--gray-a3)",
                  fontFamily: "var(--mono-font-family, ui-monospace)",
                  fontSize: "var(--font-size-2)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {JSON.stringify(detail, null, 2)}
              </Box>
            ) : (
              <Text color="gray" size="2" highContrast={false}>
                {detailQ.isPending ? "加载中…" : "—"}
              </Text>
            )}
          </Flex>
        </Card>
      ) : null}
    </Flex>
  );
};
