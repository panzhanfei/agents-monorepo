import { Box, Button, Callout, Card, Code, Flex, Heading, Link, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import type { IRunnerRegisterPageViewModel } from "./useRunnerRegisterPage";

export type IRunnerRegisterPageViewProps = { vm: IRunnerRegisterPageViewModel };

export const RunnerRegisterPageView = ({ vm }: IRunnerRegisterPageViewProps) => {
  const {
    displayName,
    setDisplayName,
    deviceKey,
    deviceSecret,
    note,
    registerM,
    heartbeatM,
    canHeartbeat,
    error,
    onRegister,
    onHeartbeat,
    onCopyDeviceKey,
    onCopyDeviceSecret,
    curlExample,
  } = vm;

  return (
    <Flex direction="column" gap="5">
      <Box>
        <Heading size="6" mb="1">
          Runner 注册（占位向导）
        </Heading>
        <Text color="gray" size="2" highContrast={false}>
          开发用：注册设备与心跳验收（
          <Code size="2" variant="soft">
            register → heartbeat → enqueue → claim
          </Code>
          ）。日常使用时由本机程序自动完成环境准备，通常无需使用本页。
        </Text>
      </Box>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Flex align="start" justify="between" gap="3" wrap="wrap">
            <Heading size="4">注册设备</Heading>
            <Link size="2" asChild>
              <RouterLink to="/projects">返回项目</RouterLink>
            </Link>
          </Flex>

          {error ? (
            <Callout.Root color="red" role="alert">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          ) : null}
          {note ? (
            <Callout.Root color="blue">
              <Callout.Text>{note}</Callout.Text>
            </Callout.Root>
          ) : null}

          <form onSubmit={onRegister}>
            <Flex direction="column" gap="3">
              <Flex direction="column" gap="1">
                <Text as="label" htmlFor="runner-display" size="2" weight="medium">
                  显示名（可选）
                </Text>
                <TextField.Root
                  id="runner-display"
                  value={displayName}
                  onChange={(evt) => setDisplayName(evt.target.value)}
                />
              </Flex>
              <Button type="submit" disabled={registerM.isPending}>
                {registerM.isPending ? "注册中…" : "注册 Runner"}
              </Button>
            </Flex>
          </form>
        </Flex>
      </Card>

      <Card size="2">
        <Flex direction="column" gap="4">
          <Heading size="4">凭证（仅本地展示）</Heading>
          <Text color="gray" size="2" highContrast={false}>
            请勿把 `deviceSecret` 提交到 Git 或贴到公开渠道。
          </Text>

          <Flex direction="column" gap="1">
            <Text as="label" htmlFor="device-key" size="2" weight="medium">
              deviceKey
            </Text>
            <TextField.Root id="device-key" readOnly value={deviceKey} />
          </Flex>
          <Flex direction="column" gap="1">
            <Text as="label" htmlFor="device-secret" size="2" weight="medium">
              deviceSecret
            </Text>
            <TextField.Root id="device-secret" readOnly value={deviceSecret} />
          </Flex>

          <Flex gap="2" wrap="wrap">
            <Button type="button" variant="soft" color="gray" disabled={!deviceKey} onClick={onCopyDeviceKey}>
              复制 deviceKey
            </Button>
            <Button type="button" variant="soft" color="gray" disabled={!deviceSecret} onClick={onCopyDeviceSecret}>
              复制 deviceSecret
            </Button>
            <Button type="button" disabled={!canHeartbeat || heartbeatM.isPending} onClick={onHeartbeat}>
              {heartbeatM.isPending ? "发送中…" : "我已保存 · 发送心跳"}
            </Button>
          </Flex>

          <Callout.Root color="gray">
            <Callout.Text size="2">curl 验收示例：</Callout.Text>
            <Code size="2" variant="ghost" style={{ display: "block", whiteSpace: "pre-wrap", marginTop: "0.5rem" }}>
              {curlExample}
            </Code>
          </Callout.Root>
        </Flex>
      </Card>
    </Flex>
  );
};
