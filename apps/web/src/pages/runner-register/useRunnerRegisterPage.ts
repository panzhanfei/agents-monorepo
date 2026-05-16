import { useMemo, useState, type FormEvent } from "react";
import { ApiError, getApiBase } from "@/api";
import { useRegisterRunnerMutation, useRunnerHeartbeatMutation } from "@/hooks";
import { copyLabelToClipboard } from "@/utils";

export const useRunnerRegisterPage = () => {
  const [displayName, setDisplayName] = useState("Dev Runner");
  const [deviceKey, setDeviceKey] = useState("");
  const [deviceSecret, setDeviceSecret] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const registerM = useRegisterRunnerMutation();
  const heartbeatM = useRunnerHeartbeatMutation();

  const canHeartbeat = useMemo(() => Boolean(deviceKey && deviceSecret), [deviceKey, deviceSecret]);

  const registerError = registerM.isError
    ? registerM.error instanceof ApiError
      ? registerM.error.message
      : "Register failed"
    : null;
  const heartbeatError = heartbeatM.isError
    ? heartbeatM.error instanceof Error
      ? heartbeatM.error.message
      : "Heartbeat failed"
    : null;
  const error = registerError ?? heartbeatError ?? localError;

  const onRegister = (e: FormEvent): void => {
    e.preventDefault();
    setNote(null);
    setLocalError(null);
    registerM.mutate(
      { displayName },
      {
        onSuccess: (res) => {
          setDeviceKey(res.runner.deviceKey);
          setDeviceSecret(res.deviceSecret);
          setNote("设备密钥只在注册响应中出现一次：请立即复制保存。");
        },
      },
    );
  };

  const onHeartbeat = (): void => {
    setNote(null);
    setLocalError(null);
    heartbeatM.mutate(
      { deviceKey, deviceSecret },
      {
        onSuccess: () => setNote("心跳成功：你可以回到「任务」页面尝试 enqueue。"),
      },
    );
  };

  const onCopyDeviceKey = (): void => {
    void copyLabelToClipboard("deviceKey", deviceKey).then((result) => {
      if (result.ok) setNote(result.note);
      else setLocalError(result.error);
    });
  };

  const onCopyDeviceSecret = (): void => {
    void copyLabelToClipboard("deviceSecret", deviceSecret).then((result) => {
      if (result.ok) setNote(result.note);
      else setLocalError(result.error);
    });
  };

  const curlExample = `curl -sS -X POST "${getApiBase()}/runners/heartbeat" \\
  -H "Content-Type: application/json" \\
  -H "X-Device-Key: …" \\
  -H "X-Device-Secret: …" \\
  -d '${`{"contractVersion":"0-placeholder","mountedProjectIds":[]}`}'`;

  return {
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
  };
};

export type IRunnerRegisterPageViewModel = ReturnType<typeof useRunnerRegisterPage>;
