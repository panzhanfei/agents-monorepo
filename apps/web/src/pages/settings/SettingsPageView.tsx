import { Box, Button, Callout, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import { getApiBase } from "@/api";
import type { ISettingsPageViewModel } from "./useSettingsPage";

export type ISettingsPageViewProps = { vm: ISettingsPageViewModel };

export const SettingsPageView = ({ vm }: ISettingsPageViewProps) => {
  const { displayUser, profileError, meQ, clearSession } = vm;

  return (
    <Flex direction="column" gap="5">
      <Box>
        <Heading size="6" mb="1">
          设置 / 关于
        </Heading>
        <Text color="gray" size="2" highContrast={false}>
          第一期占位页：展示环境与当前用户信息。
        </Text>
      </Box>

      {profileError ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{profileError}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Card size="2">
        <Flex direction="column" gap="3">
          <Heading size="4">Agent 与推理</Heading>
          <Text color="gray" size="2" highContrast={false}>
            每个 Agent 槽位可单独配置本地/线上、网关与模型。
          </Text>
          <Button type="button" variant="surface" color="gray" asChild>
            <RouterLink to="/settings/agent-models">Agent 配置（按槽位）</RouterLink>
          </Button>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">前端环境</Heading>
          <Flex direction="column" gap="1">
            <Text as="label" htmlFor="vite-api-base" size="2" weight="medium">
              当前 API Base（生效地址）
            </Text>
            <Text color="gray" size="1" highContrast={false}>
              优先级：`VITE_API_BASE_ONLINE` → `VITE_API_BASE` → 默认 `http://127.0.0.1:3000`
            </Text>
            <TextField.Root id="vite-api-base" readOnly value={getApiBase()} />
          </Flex>
          <Button
            type="button"
            variant="soft"
            color="gray"
            onClick={() => void meQ.refetch()}
            disabled={meQ.isFetching}
          >
            {meQ.isFetching ? "刷新中…" : "刷新用户信息"}
          </Button>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">账号</Heading>
          <Box>
            <Text color="gray" size="2" highContrast={false}>
              邮箱
            </Text>
            <Text size="3" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }}>
              {displayUser?.email ?? "—"}
            </Text>
          </Box>
          <Box>
            <Text color="gray" size="2" highContrast={false}>
              内部 userId
            </Text>
            <Text size="3" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }}>
              {displayUser?.id ?? "—"}
            </Text>
          </Box>

          <Button type="button" color="red" variant="soft" onClick={() => clearSession()}>
            退出登录
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
};
