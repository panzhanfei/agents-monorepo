import { useMemo, useState, type FormEvent } from "react";
import { Box, Button, Callout, Card, Code, Flex, Heading, Link, Text, TextField } from "@radix-ui/themes";
import { Link as RouterLink } from "react-router-dom";
import { ApiError, getApiBase, registerRunner, postRunnerHeartbeat } from "@/api";
import { copyLabelToClipboard } from "@/utils";

export const RunnerRegisterPage = () => {
  const [displayName, setDisplayName] = useState("Dev Runner");
  const [deviceKey, setDeviceKey] = useState("");
  const [deviceSecret, setDeviceSecret] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canHeartbeat = useMemo(() => Boolean(deviceKey && deviceSecret), [deviceKey, deviceSecret]);

  const onRegister = (e: FormEvent): void => {
    e.preventDefault();
    setError(null);
    setNote(null);
    void registerRunner({ displayName })
      .then((res) => {
        setDeviceKey(res.runner.deviceKey);
        setDeviceSecret(res.deviceSecret);
        setNote("设备密钥只在注册响应中出现一次：请立即复制保存。");
      })
      .catch((err: unknown) => {
        const msg = err instanceof ApiError ? err.message : "Register failed";
        setError(msg);
      });
  };

  const onHeartbeat = (): void => {
    setError(null);
    setNote(null);
    void postRunnerHeartbeat(deviceKey, deviceSecret, {
      contractVersion: "0-placeholder",
      mountedProjectIds: [],
    })
      .then(() => setNote("心跳成功：你可以回到「任务」页面尝试 enqueue。"))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Heartbeat failed"));
  };

  const onCopyDeviceKey = (): void => {
    void copyLabelToClipboard("deviceKey", deviceKey).then((result) => {
      if (result.ok) setNote(result.note);
      else setError(result.error);
    });
  };

  const onCopyDeviceSecret = (): void => {
    void copyLabelToClipboard("deviceSecret", deviceSecret).then((result) => {
      if (result.ok) setNote(result.note);
      else setError(result.error);
    });
  };

  const curlExample = `curl -sS -X POST "${getApiBase()}/runners/heartbeat" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Key: …" \\
  -H "X-Device-Secret: …" \\
  -d '${`{"contractVersion":"0-placeholder","mountedProjectIds":[]}`}'`;

  return (
    <Flex direction="column" gap="5">
      <Box>
        <Heading size="6" mb="1">
          Runner 注册（占位向导）
        </Heading>
        <Text color="gray" size="2" highContrast={false}>
          第二期会替换为真实 Runner 引导。此处用于第一期闭环：{" "}
          <Code size="2" variant="soft">
            register → heartbeat → enqueue → claim
          </Code>
          。
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
                <TextField.Root id="runner-display" value={displayName} onChange={(evt) => setDisplayName(evt.target.value)} />
              </Flex>
              <Button type="submit">注册 Runner</Button>
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
            <Button type="button" disabled={!canHeartbeat} onClick={onHeartbeat}>
              我已保存 · 发送心跳
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
