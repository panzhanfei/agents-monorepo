import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Box,
  Button,
  Callout,
  Card,
  Dialog,
  Flex,
  Heading,
  Link,
  Strong,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import { ApiError } from "@/api";
import type { IProjectRow } from "@/api";
import {
  getCreateProjectMutationErrorMessage,
  getProjectsMutationErrorMessage,
  useCreateProjectMutation,
  useDeleteProjectMutation,
  useProjectsListQuery,
} from "@/hooks";
import { useCurrentProjectStore } from "@/stores";

const PAGE_SIZE = 10;

export const ProjectsPage = () => {
  const projectsQ = useProjectsListQuery();
  const createM = useCreateProjectMutation();
  const deleteM = useDeleteProjectMutation();
  const currentProjectId = useCurrentProjectStore((s) => s.currentProjectId);
  const setCurrentProjectId = useCurrentProjectStore((s) => s.setCurrentProjectId);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("Demo Project");
  const [workspaceRoot, setWorkspaceRoot] = useState("/tmp/demo-workspace");
  const [gitUrlDraft, setGitUrlDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<IProjectRow | null>(null);

  const filtered = useMemo(() => {
    const list = projectsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.workspaceRoot.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.gitUrl ?? "").toLowerCase().includes(q),
    );
  }, [projectsQ.data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const rememberedProject = useMemo(() => {
    if (!currentProjectId) return null;
    const list = projectsQ.data ?? [];
    return list.find((p) => p.id === currentProjectId) ?? null;
  }, [currentProjectId, projectsQ.data]);

  const loadError = projectsQ.isError
    ? projectsQ.error instanceof ApiError
      ? projectsQ.error.message
      : "Failed to load projects"
    : null;
  const createError = createM.isError ? getCreateProjectMutationErrorMessage(createM.error) : null;
  const deleteError = deleteM.isError ? getProjectsMutationErrorMessage(deleteM.error) : null;
  const error = loadError ?? createError ?? deleteError;

  const onCreate = (e: FormEvent): void => {
    e.preventDefault();
    const g = gitUrlDraft.trim();
    createM.mutate(
      { name, workspaceRoot, ...(g.length > 0 ? { gitUrl: g } : {}) },
      {
        onSuccess: (res) => {
          setCurrentProjectId(res.project.id);
          setCreateOpen(false);
        },
      },
    );
  };

  const onConfirmDelete = (): void => {
    if (!pendingDelete) return;
    deleteM.mutate(pendingDelete.id, {
      onSuccess: () => setPendingDelete(null),
    });
  };

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            项目
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            按名称、路径或 ID 搜索；列表支持分页。
          </Text>
        </Box>
        <Flex gap="2" wrap="wrap" justify="end">
          <Button type="button" variant="surface" color="gray" size="2" asChild>
            <RouterLink to="/settings/agent-models">Agent 模型</RouterLink>
          </Button>
          <Button
            type="button"
            variant="soft"
            color="gray"
            onClick={() => void projectsQ.refetch()}
            disabled={projectsQ.isFetching}
          >
            刷新
          </Button>
          <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
            <Dialog.Trigger>
              <Button type="button">新建项目</Button>
            </Dialog.Trigger>
            <Dialog.Content maxWidth="420px">
              <Dialog.Title>新建项目</Dialog.Title>
              <Dialog.Description size="2" color="gray" mb="3">
                登记名称与本机 workspace 路径；可选填写 Git 远程地址便于关联仓库。
              </Dialog.Description>
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
                  <Flex direction="column" gap="1">
                    <Text as="label" htmlFor="project-git" size="2" weight="medium">
                      Git 远程地址（可选）
                    </Text>
                    <TextField.Root
                      id="project-git"
                      placeholder="git@github.com:org/repo.git"
                      value={gitUrlDraft}
                      onChange={(evt) => setGitUrlDraft(evt.target.value)}
                    />
                  </Flex>
                  <Flex gap="2" justify="end" mt="2">
                    <Dialog.Close>
                      <Button type="button" variant="soft" color="gray">
                        取消
                      </Button>
                    </Dialog.Close>
                    <Button type="submit" disabled={createM.isPending}>
                      {createM.isPending ? "创建中…" : "创建"}
                    </Button>
                  </Flex>
                </Flex>
              </form>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      {rememberedProject ? (
        <Callout.Root color="blue" role="status">
          <Callout.Text>
            <Strong>记住的当前项目</Strong>
            {`: ${rememberedProject.name} · `}
            <Link size="2" asChild>
              <RouterLink to={`/projects/${rememberedProject.id}/tasks`}>打开任务</RouterLink>
            </Link>
            {" · "}
            <Link size="2" asChild>
              <RouterLink to={`/projects/${rememberedProject.id}/chat`}>对话</RouterLink>
            </Link>
          </Callout.Text>
        </Callout.Root>
      ) : currentProjectId ? (
        <Callout.Root color="amber" role="status">
          <Callout.Text>
            本地记录的项目 ID 在当前列表中未找到（可能已删除或无权限）；进入任一项目子页面后将更新记录。
          </Callout.Text>
        </Callout.Root>
      ) : null}

      <Card size="2">
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Heading size="4">列表</Heading>
            <Flex align="center" gap="3" wrap="wrap">
              <Box style={{ minWidth: 200, flex: "1 1 200px" }}>
                <TextField.Root
                  placeholder="搜索名称、Git、路径或 ID…"
                  value={search}
                  onChange={(evt) => setSearch(evt.target.value)}
                />
              </Box>
              <Link size="2" color="gray" asChild>
                <RouterLink to="/runners">Runner 注册向导 →</RouterLink>
              </Link>
            </Flex>
          </Flex>

          <Box style={{ overflowX: "auto" }}>
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>名称</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>workspaceRoot</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell width="280px" justify="end" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {filtered.length === 0 ? (
                  <Table.Row>
                    <Table.Cell colSpan={3}>
                      <Text color="gray" size="2" highContrast={false}>
                        {projectsQ.isPending ? "加载中…" : search.trim() ? "没有匹配的项目" : "暂无项目"}
                      </Text>
                    </Table.Cell>
                  </Table.Row>
                ) : (
                  pageRows.map((p) => (
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
                          <Button type="button" size="1" asChild>
                            <RouterLink to={`/projects/${p.id}/tasks`}>任务</RouterLink>
                          </Button>
                          <Button type="button" size="1" variant="soft" color="gray" asChild>
                            <RouterLink to={`/projects/${p.id}/chat`}>对话</RouterLink>
                          </Button>
                          <Button type="button" variant="soft" color="gray" size="1" asChild>
                            <RouterLink to={`/projects/${p.id}/config`}>配置</RouterLink>
                          </Button>
                          <Button
                            type="button"
                            variant="soft"
                            color="red"
                            size="1"
                            onClick={() => setPendingDelete(p)}
                          >
                            删除
                          </Button>
                        </Flex>
                      </Table.Cell>
                    </Table.Row>
                  ))
                )}
              </Table.Body>
            </Table.Root>
          </Box>

          {filtered.length > 0 ? (
            <Flex align="center" justify="between" gap="3" wrap="wrap">
              <Text size="2" color="gray" highContrast={false}>
                共 {filtered.length} 条 · 每页 {PAGE_SIZE} 条 · 第 {page} / {totalPages} 页
              </Text>
              <Flex gap="2">
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  color="gray"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button
                  type="button"
                  size="1"
                  variant="soft"
                  color="gray"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  下一页
                </Button>
              </Flex>
            </Flex>
          ) : null}
        </Flex>
      </Card>

      <Dialog.Root open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <Dialog.Content maxWidth="420px">
          <Dialog.Title>删除项目</Dialog.Title>
          <Dialog.Description size="2" color="gray" mb="3">
            将永久删除「{pendingDelete?.name ?? ""}」及其关联任务数据（不可恢复）。确认继续？
          </Dialog.Description>
          <Flex gap="2" justify="end">
            <Dialog.Close>
              <Button type="button" variant="soft" color="gray" disabled={deleteM.isPending}>
                取消
              </Button>
            </Dialog.Close>
            <Button type="button" color="red" disabled={deleteM.isPending} onClick={onConfirmDelete}>
              {deleteM.isPending ? "删除中…" : "确认删除"}
            </Button>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
};
