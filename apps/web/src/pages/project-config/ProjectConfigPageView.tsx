import { Box, Button, Callout, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import type { IProjectConfigPageViewModel } from "./useProjectConfigPage";

export type IProjectConfigPageViewProps = { vm: IProjectConfigPageViewModel };

export const ProjectConfigPageView = ({ vm }: IProjectConfigPageViewProps) => {
  const {
    projectId,
    project,
    projectsQ,
    updateM,
    name,
    setName,
    workspaceRoot,
    setWorkspaceRoot,
    gitUrl,
    setGitUrl,
    error,
    onSave,
    notFound,
  } = vm;

  return (
    <Flex direction="column" gap="5">
      <Flex align="start" justify="between" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" mb="1">
            项目配置
          </Heading>
          <Text color="gray" size="2" highContrast={false}>
            <RouterLink to="/projects" style={{ color: "inherit" }}>
              ← 返回项目列表
            </RouterLink>
            {project ? ` · ${project.name}` : null}
          </Text>
        </Box>
        {project ? (
          <Flex gap="2" wrap="wrap">
            <Button type="button" size="2" variant="surface" color="gray" asChild>
              <RouterLink to="/settings/agent-models">Agent 模型（全局）</RouterLink>
            </Button>
            <Button type="button" size="2" variant="soft" color="gray" asChild>
              <RouterLink to={`/projects/${projectId}/tasks`}>任务</RouterLink>
            </Button>
          </Flex>
        ) : null}
      </Flex>

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      {projectsQ.isPending ? (
        <Text color="gray" size="2">
          加载中…
        </Text>
      ) : null}

      {notFound ? (
        <Callout.Root color="amber" role="status">
          <Callout.Text>未找到该项目，可能已被删除。</Callout.Text>
        </Callout.Root>
      ) : null}

      {project ? (
        <Card size="2">
          <form onSubmit={onSave}>
            <Flex direction="column" gap="4">
              <Heading size="4">基本信息</Heading>
              <Flex direction="column" gap="1">
                <Text size="2" color="gray">
                  项目 ID
                </Text>
                <Text size="2" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }}>
                  {project.id}
                </Text>
              </Flex>
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="cfg-name" size="2" weight="medium">
                  名称
                </Text>
                <TextField.Root id="cfg-name" value={name} onChange={(evt) => setName(evt.target.value)} />
              </Flex>
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="cfg-root" size="2" weight="medium">
                  workspaceRoot
                </Text>
                <TextField.Root
                  id="cfg-root"
                  value={workspaceRoot}
                  onChange={(evt) => setWorkspaceRoot(evt.target.value)}
                />
              </Flex>
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="cfg-git" size="2" weight="medium">
                  Git 远程地址
                </Text>
                <TextField.Root
                  id="cfg-git"
                  placeholder="git@github.com:org/repo.git"
                  value={gitUrl}
                  onChange={(evt) => setGitUrl(evt.target.value)}
                />
              </Flex>
              <Flex gap="2" justify="end">
                <Button type="submit" disabled={updateM.isPending}>
                  {updateM.isPending ? "保存中…" : "保存"}
                </Button>
              </Flex>
            </Flex>
          </form>
        </Card>
      ) : null}
    </Flex>
  );
};
