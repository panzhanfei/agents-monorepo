import { useEffect, useState } from "react";
import { Box, Button, Callout, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { ApiError, getApiBase, fetchMe } from "@/api";
import type { IAuthUser } from "@/auth";
import { useAuth } from "@/auth";

export const SettingsPage = () => {
  const { user, clearSession } = useAuth();
  const [me, setMe] = useState<IAuthUser | null>(user);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMe(user);
  }, [user]);

  const onRefreshProfile = (): void => {
    setError(null);
    void fetchMe()
      .then((res) => setMe(res.user))
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Failed to load profile";
        setError(msg);
      });
  };

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

      {error ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      ) : null}

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">前端环境</Heading>
          <Flex direction="column" gap="1">
            <Text as="label" htmlFor="vite-api-base" size="2" weight="medium">
              VITE_API_BASE
            </Text>
            <TextField.Root id="vite-api-base" readOnly value={getApiBase()} />
          </Flex>
          <Button type="button" variant="soft" color="gray" onClick={onRefreshProfile}>
            刷新用户信息
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
              {me?.email ?? "—"}
            </Text>
          </Box>
          <Box>
            <Text color="gray" size="2" highContrast={false}>
              内部 userId
            </Text>
            <Text size="3" style={{ fontFamily: "var(--mono-font-family, ui-monospace)" }}>
              {me?.id ?? "—"}
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
