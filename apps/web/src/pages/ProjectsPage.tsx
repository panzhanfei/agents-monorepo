import { useState, type FormEvent } from "react";
import { Box, Button, Callout, Card, Flex, Heading, Link, Table, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import { ApiError } from "@/api";
import { readStoredProjectId, writeStoredProjectId } from "@/auth";
import {
  getProjectsMutationErrorMessage,
  useCreateProjectMutation,
  useProjectsListQuery,
} from "@/hooks";

export const ProjectsPage = () => {
  const projectsQ = useProjectsListQuery();
  const createM = useCreateProjectMutation();

  const [name, setName] = useState("Demo Project");
  const [workspaceRoot, setWorkspaceRoot] = useState("/tmp/demo-workspace");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => readStoredProjectId());

  const projects = projectsQ.data ?? [];
  const loadError = projectsQ.isError
    ? projectsQ.error instanceof ApiError
      ? projectsQ.error.message
      : "Failed to load projects"
    : null;
  const createError = createM.isError ? getProjectsMutationErrorMessage(createM.error) : null;
  const error = loadError ?? createError;

  const hint =
    currentProjectId === null ? "未选择当前项目：在表格里点「设为当前」。" : `当前项目：${currentProjectId}`;

  const onCreate = (e: FormEvent): void => {
    e.preventDefault();
    createM.mutate({ name, workspaceRoot });
  };

  const setCurrent = (projectId: string): void => {
    writeStoredProjectId(projectId);
    setCurrentProjectId(projectId);
  };

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            项目
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            {hint}
          </Text>
        </Box>
        <Button
          type="button"
          variant="soft"
          color="gray"
          onClick={() => void projectsQ.refetch()}
          disabled={projectsQ.isFetching}
        >
          刷新
        </Button>
      </Flex>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">新建项目</Heading>
          <form onSubmit={onCreate}>
            <Flex direction="column" gap="3">
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="project-name" size="2" weight="medium">
                  名称
                </Text>
                <TextField.Root id="project-name" value={name} onChange={(evt) => setName(evt.target.value)} />
              </Flex>
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="project-workspace" size="2" weight="medium">
                  workspaceRoot（登记路径）
                </Text>
                <TextField.Root
                  id="project-workspace"
                  value={workspaceRoot}
                  onChange={(evt) => setWorkspaceRoot(evt.target.value)}
                />
              </Flex>
              <Button type="submit" disabled={createM.isPending}>
                {createM.isPending ? "创建中…" : "创建"}
              </Button>
            </Flex>
          </form>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Heading size="4">列表</Heading>
            <Link size="2" color="gray" asChild>
              <RouterLink to="/runners">Runner 注册向导 →</RouterLink>
            </Link>
          </Flex>

          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>名称</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>workspaceRoot</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="220px" justify="end" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {projects.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={3}>
                      <Text color="gray" size="2" highContrast={false}>
                        {projectsQ.isPending ? "加载中…" : "暂无项目"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  projects.map((p) => (
                    <Table.Row key={p.id}>
                      <Table.Cell>
                        <Text weight="medium">{p.name}</Text>
                      </Table.Cell>
                      <Table.Cell>
                        <Text size="2" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }} wrap="pretty">
                          {p.workspaceRoot}
                        </Text>
                      </Table.Cell>
                      <Table.Cell justify="end">
                        <Flex gap="2" justify="end" wrap="wrap">
                          <Button type="button" variant="soft" color="gray" size="1" onClick={() => setCurrent(p.id)}>
                            设为当前
                          </Button>
                          <Button type="button" size="1" asChild>
                            <RouterLink to={`/projects/${p.id}/tasks`}>任务</RouterLink>
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>
        </Flex>
      </Card>
    </Flex>
  );
};
